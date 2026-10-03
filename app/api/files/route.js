import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// المسار المحلي لازم يكون على قرص (C:\ أو K:\ إلخ) وينتهي بامتداد معروف
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const KNOWN_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.rar'];

function checkLocalPath(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return { ok: false, value, message: 'المسار فاضي' };
  if (!DRIVE_PATH.test(value)) return { ok: false, value, message: 'المسار لازم يبدأ بحرف قرص مثل C:\\ أو K:' };
  if (!KNOWN_EXT.some((ext) => value.toLowerCase().endsWith(ext))) {
    return { ok: false, value, message: 'الامتداد مش معروف. المسموح: PDF · Word · Excel · CSV · صور · ZIP' };
  }
  return { ok: true, value, message: 'المسار صالح للربط' };
}

function toMonthLabel(month) {
  return MONTHS[month - 1] ?? null;
}

// بيقبل رقم (1..12) أو اسم الشهر عربي ("يناير") أو بادئة ("ينا")
function parseMonth(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return 0;
  const byName = MONTHS.findIndex((m) => m === value) + 1;
  if (byName > 0) return byName;
  const byPrefix = MONTHS.findIndex((m) => m.startsWith(value)) + 1;
  if (byPrefix > 0) return byPrefix;
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= 12 ? num : 0;
}

function parseYear(raw) {
  const num = Number(String(raw ?? '').trim());
  return Number.isInteger(num) && num >= 2000 && num <= 2100 ? num : 0;
}

const FILE_COLUMNS = 'id, employee_id, category, year, month, month_label, local_path, file_name, mime_type, storage_path, status, is_visible, created_at, employees(id, full_name, national_id)';

// عمود category في الداتابيز NOT NULL — لو المستخدم مش محددش قسم، بنستخدم أول قسم متاح
async function resolveCategory(admin, requested) {
  const wanted = String(requested ?? '').trim();
  if (wanted) return wanted;
  const { data } = await admin.from('payslip_categories').select('name').order('id').limit(1);
  return data?.[0]?.name ?? 'عام';
}

export async function GET() {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { data, error } = await getAdminClient()
    .from('payslips')
    .select(FILE_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data ?? [] });
}

// تسجيل مسار محلي فقط — الرفع الفعلي بقى اختياري/معطل مؤقتاً
export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const form = await request.formData();
  const employeeId = String(form.get('employeeId') ?? '');
  const localPath = String(form.get('localPath') ?? '');
  const month = parseMonth(form.get('month'));
  const year = parseYear(form.get('year'));
  const category = String(form.get('category') ?? '').trim();
  const isVisible = String(form.get('isVisible') ?? 'true') === 'true';

  if (!employeeId) return NextResponse.json({ error: 'اختار الموظف الأول' }, { status: 400 });

  const pathCheck = checkLocalPath(localPath);
  if (!pathCheck.ok) return NextResponse.json({ error: pathCheck.message }, { status: 400 });
  if (!month) return NextResponse.json({ error: 'الشهر غير صحيح' }, { status: 400 });
  if (!year) return NextResponse.json({ error: 'السنة غير صحيحة' }, { status: 400 });

  const admin = getAdminClient();
  const employee = await admin.from('employees').select('id, full_name').eq('id', employeeId).maybeSingle();
  if (!employee.data) return NextResponse.json({ error: 'الموظف ده مش موجود' }, { status: 404 });

  const { data: payslip, error } = await admin
    .from('payslips')
    .insert({
      employee_id: employeeId,
      local_path: pathCheck.value,
      year,
      month,
      month_label: toMonthLabel(month),
      status: 'pending',
      is_visible: isVisible,
      category: await resolveCategory(admin, category),
    })
    .select(FILE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payslip, employee: employee.data }, { status: 201 });
}

// إنشاء مجمّع: نفس صفوف اللصق من الإكسيل في نداء واحد
export async function PUT(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: 'مفيش صفوف للتسجيل' }, { status: 400 });

  const admin = getAdminClient();
  const employeeIds = [...new Set(rows.map((r) => String(r.employeeId ?? '')).filter(Boolean))];
  const { data: employees } = await admin.from('employees').select('id, full_name').in('id', employeeIds);
  const employeeMap = new Map((employees ?? []).map((e) => [e.id, e]));

  const records = [];
  const problems = [];
  const fallbackCategory = await resolveCategory(admin, '');

  rows.forEach((row, index) => {
    const employeeId = String(row.employeeId ?? '');
    const pathCheck = checkLocalPath(row.localPath);
    const month = parseMonth(row.month);
    const year = parseYear(row.year);

    if (!employeeId || !employeeMap.has(employeeId)) return problems.push({ index, reason: 'الموظف مش موجود' });
    if (!pathCheck.ok) return problems.push({ index, reason: pathCheck.message });
    if (!month) return problems.push({ index, reason: 'الشهر غير صحيح' });
    if (!year) return problems.push({ index, reason: 'السنة غير الصحيحة' });

    records.push({
      employee_id: employeeId,
      local_path: pathCheck.value,
      year,
      month,
      month_label: toMonthLabel(month),
      status: 'pending',
      is_visible: true,
      category: String(row.category ?? '').trim() || fallbackCategory,
    });
  });

  let saved = [];
  if (records.length) {
    const { data, error } = await admin.from('payslips').insert(records).select(FILE_COLUMNS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data ?? [];
  }

  return NextResponse.json({ saved: saved.length, files: saved, problems });
}

export async function PATCH(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { id, is_visible: isVisible, status, local_path: localPath, file_name: fileName, category, month, year } = await request.json();
  if (!id) return NextResponse.json({ error: 'مفيش معرف ملف' }, { status: 400 });

  const update = {};
  if (isVisible !== undefined) update.is_visible = Boolean(isVisible);
  if (status !== undefined) update.status = status === 'available' ? 'available' : 'pending';
  if (localPath !== undefined) {
    const pathCheck = checkLocalPath(localPath);
    if (!pathCheck.ok) return NextResponse.json({ error: pathCheck.message }, { status: 400 });
    update.local_path = pathCheck.value;
  }
  if (fileName !== undefined) update.file_name = String(fileName).trim() || null;
  if (category !== undefined) update.category = String(category).trim() || 'عام';
  if (month !== undefined) {
    const m = parseMonth(month);
    if (!m) return NextResponse.json({ error: 'الشهر غير صحيح' }, { status: 400 });
    update.month = m;
    update.month_label = toMonthLabel(m);
  }
  if (year !== undefined) {
    const y = parseYear(year);
    if (!y) return NextResponse.json({ error: 'السنة غير صحيحة' }, { status: 400 });
    update.year = y;
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'مفيش بيانات للتعديل' }, { status: 400 });
  const { data, error } = await getAdminClient().from('payslips').update(update).eq('id', id).select(FILE_COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ file: data });
}

export async function DELETE(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const body = await request.json();
  // بيقبل id واحد أو ids مصفوفة — عشان الحذف المجمع يبقى نداء واحد
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : (body.id ? [body.id] : []);
  if (!ids.length) return NextResponse.json({ error: 'مفيش معرف ملف' }, { status: 400 });

  const { data, error } = await getAdminClient().from('payslips').delete().in('id', ids).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, deleted: (data ?? []).map((row) => row.id) });
}