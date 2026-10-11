import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.rar'];
// القسم بقى ثابت في الداتابيز بالقيمة دي (الأقسام بقت Hardcoded)
const FIXED_CATEGORY = 'شيت القبض';

// حجم دفعة الاستعلام الواحدة: بنقسّم الأرقام لمجموعات صغيرة عشان ما نتخطاش حد طول
// الـ URL في PostgREST (خصوصاً لما العميل يرفع كمية مسارات كبيرة).
const IN_CHUNK_SIZE = 50;

// بنقسّم أي array لمجموعات بحجم محدّد. مثال: [1..120] → 3 دفعات (50, 50, 20).
function chunk(list, size = IN_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) chunks.push(list.slice(index, index + size));
  return chunks;
}

// تنظيف الاسم: بنسمح بالعربي والإنجليزي معاً — بس trim وتنظيف المسافات الزايدة.
// المسار ككتلة واحدة (C:\...) بيتصطاد لوحده في الـ Parser، فمفيش خطر إن مسار يتخزن كاسم.
function cleanFullName(value) {
  return String(value ?? '')
    .replace(/[\u200f\u200e]/g, ' ')
    .replace(/[|,،;\t]+/g, ' ')
    .replace(/[()\[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// بنحوّل أي خطأ من السيرفر/قاعدة البيانات لرسالة عربية مفهومة للمستخدم.
//  • Timeout/504/ضغط على النظام → رسالة الضغط
//  • غير كده → خطأ غير متوقع في قاعدة البيانات
function friendlyError(error) {
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  const isTimeout = status === 504 || status === 408 || status === 502 || status === 503
    || /timeout|timed out|ETIMEDOUT|ECONNRESET|upstream/i.test(`${code} ${message}`);
  if (isTimeout) return 'يوجد ضغط حالياً على النظام، يرجى الانتظار ثواني والمحاولة مرة أخرى.';
  return 'حدث خطأ غير متوقع في قاعدة البيانات، يرجى إعادة تحميل الصفحة.';
}

export async function POST(request) {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error('files/batch unexpected error:', error);
    return NextResponse.json({ error: friendlyError(error) }, { status: 500 });
  }
}

async function handlePost(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || rows.length > 250) return NextResponse.json({ error: 'لازم تبعت بين 1 و250 مسار' }, { status: 400 });

  const admin = getAdminClient();
  // حل الموظفين: بالإدارة (لو محددة) أو بالرقم القومي المُستخرج من السطر.
  // لو الرقم القومي مش مسجل، بيتنشأ موظف جديد تلقائياً عشان السطر ميفضلش 'محتاج مراجعة'.
  const explicitIds = [...new Set(rows.flatMap((row) => {
    const ids = Array.isArray(row.employeeIds) ? row.employeeIds : [row.employeeId];
    return ids.map((id) => String(id ?? '').trim()).filter(Boolean);
  }))];
  const lineNationalIds = [...new Set(rows.map((row) => String(row.nationalId ?? '').replace(/[^0-9]/g, '')).filter((id) => id.length === 14))];

  // بنقرأ الموظفين باستعلامين منفصلين بـ .in() وبنمرّر القيم كـ Array of strings.
  // وكمان بنقسّم كل Array لدُفَع (chunks) عشان مايضربش URL length limit في PostgREST
  // لما عدد المسارات/الأرقام يكون كبير.
  let employees = [];
  if (explicitIds.length || lineNationalIds.length) {
    const queries = [];
    for (const part of chunk(explicitIds)) {
      queries.push(admin.from('employees').select('id, full_name, national_id').in('id', part));
    }
    for (const part of chunk(lineNationalIds)) {
      queries.push(admin.from('employees').select('id, full_name, national_id').in('national_id', part));
    }
    const results = await Promise.all(queries);
    const failed = results.find((result) => result.error);
    if (failed) return NextResponse.json({ error: friendlyError(failed.error) }, { status: 502 });
    const merged = new Map();
    results.forEach((result) => (result.data ?? []).forEach((employee) => merged.set(employee.id, employee)));
    employees = [...merged.values()];
  }
  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const byNationalId = new Map((employees ?? []).map((employee) => [String(employee.national_id ?? ''), employee]));

  const records = [];
  const problems = [];
  const rowsById = new Map();
  const autoCreate = [];
  const pendingRows = [];
  rows.forEach((row, index) => {
    const localPath = String(row.localPath ?? '').replace(/["']/g, '').trim();
    const selectedEmployeeIds = [...new Set((Array.isArray(row.employeeIds) ? row.employeeIds : [row.employeeId])
      .map((id) => String(id ?? '').trim()).filter(Boolean))];
    const lineNationalId = String(row.nationalId ?? '').replace(/[^0-9]/g, '');
    const month = Number(row.month);
    const year = Number(row.year);
    const category = FIXED_CATEGORY;
    // لو مفيش موظف محدد بس الرقم القومي موجود في السطر، بنحله من الداتابيز
    // (أو بننشئه جديد) — كده السطر بيتسجل على طول بدون ما يفضل محتاج مراجعة.
    if (!selectedEmployeeIds.length && lineNationalId.length === 14) {
      const existing = byNationalId.get(lineNationalId);
      if (existing) {
        selectedEmployeeIds.push(existing.id);
      } else {
        const name = String(row.employeeName ?? '').trim();
        autoCreate.push({ index, nationalId: lineNationalId, fullName: name });
      }
    }
    if (!selectedEmployeeIds.length) return problems.push({ index, reason: 'اختار موظف واحد على الأقل أو سطر فيه رقم قومي 14 رقم' });
    if (selectedEmployeeIds.some((id) => !employeeMap.has(id))) return problems.push({ index, reason: 'فيه موظف مش موجود' });
    if (!DRIVE_PATH.test(localPath) || !EXTENSIONS.some((extension) => localPath.toLowerCase().endsWith(extension))) return problems.push({ index, reason: 'مسار الملف أو امتداده غير صالح' });
    if (!Number.isInteger(month) || month < 1 || month > 12) return problems.push({ index, reason: 'الشهر غير صحيح' });
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return problems.push({ index, reason: 'السنة غير صحيحة' });
    const nameFromLine = String(row.employeeName ?? '').trim();
    const baseRecord = {
      local_path: localPath,
      file_name: String(row.fileName ?? '').trim() || localPath.split(/[\\/]/).pop(),
      category,
      year,
      month,
      month_label: MONTHS[month - 1],
      status: 'pending',
      is_visible: true,
    };
    selectedEmployeeIds.forEach((employeeId) => {
      rowsById.set(employeeId, { employeeId, nameFromLine });
      records.push({ ...baseRecord, employee_id: employeeId });
    });
    pendingRows.push({ index, lineNationalId, nameFromLine, baseRecord, month, year, localPath });
  });

  if (!records.length && !autoCreate.length) {
    return NextResponse.json({ error: 'مفيش مسارات صالحة للتسجيل', problems }, { status: 400 });
  }

  // إنشاء تلقائي للموظفين الجدد اللي الرقم القومي بتاعهم مش مسجل
  let createdCount = 0;
  if (autoCreate.length) {
    const toInsert = [...new Map(autoCreate.map((item) => [item.nationalId, item])).values()]
      .map((item) => ({ full_name: cleanFullName(item.fullName) || `موظف ${item.nationalId.slice(-4)}`, national_id: item.nationalId, is_active: true }));
    const { data: created, error: createError } = await admin.from('employees').insert(toInsert)
      .select('id, full_name, national_id');
    if (createError) return NextResponse.json({ error: friendlyError(createError) }, { status: 502 });
    createdCount = created?.length ?? 0;
    (created ?? []).forEach((employee) => {
      employeeMap.set(employee.id, employee);
      byNationalId.set(String(employee.national_id), employee);
    });
    autoCreate.forEach((item) => {
      const employee = byNationalId.get(item.nationalId);
      if (!employee) return;
      rowsById.set(employee.id, { employeeId: employee.id, nameFromLine: String(item.fullName ?? '').trim() });
      records.push({ ...item.baseRecord, employee_id: employee.id });
    });
  }

  if (!records.length) return NextResponse.json({ error: 'مفيش مسارات صالحة للتسجيل', problems }, { status: 400 });

  // ── تريكة الإصلاح التلقائي ──
  // لو الرقم القومي متسجل بس اسمه فاضي (null أو فاضي)، والإدمن كتب الاسم في سطر المسار،
  // بنحدّث اسم الموظف في الداتابيز بالاسم الجديد اللي الإدمن دخله.
  await Promise.all([...rowsById.entries()].map(async ([employeeId, { nameFromLine }]) => {
    const current = employeeMap.get(employeeId);
    if (!current) return;
    const existingName = String(current.full_name ?? '').trim();
    if (existingName) return;
    const safeName = cleanFullName(nameFromLine);
    if (safeName.length < 3) return;
    const { error } = await admin.from('employees').update({ full_name: safeName }).eq('id', employeeId);
    if (!error) {
      current.full_name = safeName;
      employeeMap.set(employeeId, current);
    }
  }));

  const { data: saved, error: insertError } = await admin.from('payslips').insert(records)
    .select('id, employee_id, category, year, month, month_label, local_path, file_name, mime_type, storage_path, status, is_visible, created_at, employees(id, full_name, national_id)');
  if (insertError) return NextResponse.json({ error: friendlyError(insertError) }, { status: 502 });

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
    return NextResponse.json({ error: friendlyError(requestError) }, { status: 502 });
  }

  return NextResponse.json({ saved: saved ?? [], problems, createdEmployees: createdCount }, { status: 201 });
}
