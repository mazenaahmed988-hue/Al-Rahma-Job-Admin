import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const ALLOWED = [
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp',
];
const EXT = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};
const MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { data, error } = await getAdminClient()
    .from('payslips')
    .select('id, employee_id, category, year, month, month_label, file_name, mime_type, storage_path, status, is_visible, created_at, employees(id, full_name, national_id)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data ?? [] });
}

export async function PATCH(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { id, is_visible: isVisible, status } = await request.json();
  if (!id) return NextResponse.json({ error: 'مفيش معرف ملف' }, { status: 400 });
  const update = {};
  if (isVisible !== undefined) update.is_visible = Boolean(isVisible);
  if (status !== undefined) update.status = status === 'available' ? 'available' : 'pending';
  if (!Object.keys(update).length) return NextResponse.json({ error: 'مفيش بيانات للتعديل' }, { status: 400 });
  const { data, error } = await getAdminClient().from('payslips').update(update).eq('id', id).select().single();
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

  const admin = getAdminClient();
  const existing = await admin.from('payslips').select('id, storage_path').in('id', ids);
  if (!existing.data?.length) return NextResponse.json({ error: 'الملفات دي مش موجودة' }, { status: 404 });

  const { error } = await admin.from('payslips').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const paths = existing.data.map((row) => row.storage_path).filter(Boolean);
  if (paths.length) await admin.storage.from('payslips').remove(paths);
  return NextResponse.json({ ok: true, deleted: existing.data.map((row) => row.id) });
}

// استبدال الملف الفعلي مع الحفاظ على نفس السجل (نفس الموظف/القسم/الفترة/الظهور)
export async function PUT(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const form = await request.formData();
  const fileId = String(form.get('id') ?? '');
  const file = form.get('file');
  if (!fileId) return NextResponse.json({ error: 'مفيش معرف ملف' }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'اختار الملف الجديد' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'النوع ده مش مدعوم. المسموح: PDF، Word، Excel، أو صور' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'حجم الملف أكبر من 20 ميجا' }, { status: 400 });

  const admin = getAdminClient();
  const existing = await admin.from('payslips').select('id, employee_id, year, month, storage_path').eq('id', fileId).maybeSingle();
  if (!existing.data) return NextResponse.json({ error: 'الملف ده مش موجود' }, { status: 404 });

  const oldPath = existing.data.storage_path;
  const path = `${existing.data.employee_id}/${existing.data.year}/${existing.data.month}-${Date.now()}.${EXT[file.type]}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('payslips').upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: `رفع الملف فشل: ${uploadError.message}` }, { status: 500 });

  const { data, error } = await admin.from('payslips')
    .update({ storage_path: path, file_name: file.name, mime_type: file.type, title: file.name })
    .eq('id', fileId).select().single();
  if (error) {
    await admin.storage.from('payslips').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // نمسح الملف القديم بعد نجاح الاستبدال (لو مختلف عن الجديد)
  if (oldPath && oldPath !== path) await admin.storage.from('payslips').remove([oldPath]);
  return NextResponse.json({ file: data });
}

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const form = await request.formData();
  const employeeId = String(form.get('employeeId') ?? '');
  const category = String(form.get('category') ?? '').trim();
  const year = Number(form.get('year'));
  const month = Number(form.get('month'));
  const isVisible = String(form.get('isVisible')) === 'true';
  const file = form.get('file');

  if (!employeeId) return NextResponse.json({ error: 'اختار الموظف الأول' }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'اختار الملف الأول' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'النوع ده مش مدعوم. المسموح: PDF، Word، Excel، أو صور' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'حجم الملف أكبر من 20 ميجا' }, { status: 400 });
  if (category.length < 2) return NextResponse.json({ error: 'اختار القسم' }, { status: 400 });
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({ error: 'السنة غير صحيحة' }, { status: 400 });
  if (!Number.isInteger(month) || month < 1 || month > 12) return NextResponse.json({ error: 'الشهر غير صحيح' }, { status: 400 });

  const admin = getAdminClient();
  const employee = await admin.from('employees').select('id, full_name').eq('id', employeeId).maybeSingle();
  if (!employee.data) return NextResponse.json({ error: 'الموظف ده مش موجود' }, { status: 404 });

  const extension = EXT[file.type];
  const path = `${employeeId}/${year}/${month}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('payslips').upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: `رفع الملف فشل: ${uploadError.message}` }, { status: 500 });

  const { data: payslip, error } = await admin.from('payslips').insert({
    employee_id: employeeId,
    category,
    year,
    month,
    month_label: MONTHS[month - 1],
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    status: 'available',
    is_visible: isVisible,
    title: file.name,
  }).select().single();

  if (error) {
    await admin.storage.from('payslips').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ payslip, employee: employee.data }, { status: 201 });
}
