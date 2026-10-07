import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.rar'];

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || rows.length > 250) return NextResponse.json({ error: 'لازم تبعت بين 1 و250 مسار' }, { status: 400 });

  const admin = getAdminClient();
  const employeeIds = [...new Set(rows.flatMap((row) => {
    const ids = Array.isArray(row.employeeIds) ? row.employeeIds : [row.employeeId];
    return ids.map((id) => String(id ?? '').trim()).filter(Boolean);
  }))];
  const categoryNames = [...new Set(rows.map((row) => String(row.category ?? '').trim()).filter(Boolean))];
  const [{ data: employees, error: employeeError }, { data: categories, error: categoryError }] = await Promise.all([
    employeeIds.length ? admin.from('employees').select('id, full_name').in('id', employeeIds) : Promise.resolve({ data: [], error: null }),
    categoryNames.length ? admin.from('payslip_categories').select('name').in('name', categoryNames) : Promise.resolve({ data: [], error: null }),
  ]);
  if (employeeError) return NextResponse.json({ error: employeeError.message }, { status: 500 });
  if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 });
  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const validCategories = new Set((categories ?? []).map((category) => category.name));
  const fallback = await admin.from('payslip_categories').select('name').order('sort_order').order('name').limit(1).maybeSingle();
  const fallbackCategory = fallback.data?.name ?? 'عام';

  const records = [];
  const problems = [];
  rows.forEach((row, index) => {
    const localPath = String(row.localPath ?? '').replace(/["']/g, '').trim();
    const selectedEmployeeIds = [...new Set((Array.isArray(row.employeeIds) ? row.employeeIds : [row.employeeId])
      .map((id) => String(id ?? '').trim()).filter(Boolean))];
    const month = Number(row.month);
    const year = Number(row.year);
    const category = String(row.category ?? '').trim() || fallbackCategory;
    if (!selectedEmployeeIds.length) return problems.push({ index, reason: 'اختار موظف واحد على الأقل' });
    if (selectedEmployeeIds.some((id) => !employeeMap.has(id))) return problems.push({ index, reason: 'فيه موظف مش موجود' });
    if (!DRIVE_PATH.test(localPath) || !EXTENSIONS.some((extension) => localPath.toLowerCase().endsWith(extension))) return problems.push({ index, reason: 'مسار الملف أو امتداده غير صالح' });
    if (!Number.isInteger(month) || month < 1 || month > 12) return problems.push({ index, reason: 'الشهر غير صحيح' });
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return problems.push({ index, reason: 'السنة غير صحيحة' });
    if (category !== fallbackCategory && !validCategories.has(category)) return problems.push({ index, reason: 'القسم مش موجود' });
    selectedEmployeeIds.forEach((employeeId) => records.push({
      employee_id: employeeId,
      local_path: localPath,
      file_name: String(row.fileName ?? '').trim() || localPath.split(/[\\/]/).pop(),
      category,
      year,
      month,
      month_label: MONTHS[month - 1],
      status: 'pending',
      is_visible: true,
    }));
  });

  if (!records.length) return NextResponse.json({ error: 'مفيش مسارات صالحة للتسجيل', problems }, { status: 400 });
  const { data: saved, error: insertError } = await admin.from('payslips').insert(records)
    .select('id, employee_id, category, year, month, month_label, local_path, file_name, mime_type, storage_path, status, is_visible, created_at, employees(id, full_name, national_id)');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const requests = (saved ?? []).map((payslip) => ({
    employee_id: payslip.employee_id,
    payslip_id: payslip.id,
    local_path: payslip.local_path,
    year: payslip.year,
    month: payslip.month,
    category: payslip.category,
    status: 'pending',
  }));
  const { error: requestError } = await admin.from('file_requests').insert(requests);
  if (requestError) {
    await admin.from('payslips').delete().in('id', (saved ?? []).map((payslip) => payslip.id));
    return NextResponse.json({ error: `فشل إنشاء طلبات الوكيل المحلي: ${requestError.message}` }, { status: 500 });
  }

  return NextResponse.json({ saved: saved ?? [], problems }, { status: 201 });
}
