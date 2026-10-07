import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const NID = /^[0-9]{14}$/;

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { id: routeId } = await params;
  const body = await request.json();
  const id = routeId ?? body.id;
  if (!id) return NextResponse.json({ error: 'مفيش معرف موظف' }, { status: 400 });
  const { id: _ignored, ...patch } = body;

  const update = {};
  if (patch.full_name !== undefined) {
    const name = String(patch.full_name).trim();
    if (name.length < 3) return NextResponse.json({ error: 'اسم الموظف لازم يكون 3 حروف على الأقل' }, { status: 400 });
    update.full_name = name;
  }
  if (patch.national_id !== undefined) {
    const nid = String(patch.national_id).trim();
    if (!NID.test(nid)) return NextResponse.json({ error: 'الرقم القومي لازم يكون 14 رقم' }, { status: 400 });
    update.national_id = nid;
  }
  if (patch.job_title !== undefined) {
    const title = String(patch.job_title).trim();
    if (title) update.job_title = title;
  }
  if (patch.is_active !== undefined) update.is_active = Boolean(patch.is_active);

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'مفيش بيانات للتعديل' }, { status: 400 });

  const admin = getAdminClient();
  const { data, error } = await admin.from('employees').update(update).eq('id', id).select().single();
  if (error) {
    const duplicate = error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'الرقم القومي ده مسجل قبل كده' : error.message }, { status: 400 });
  }
  return NextResponse.json({ employee: data });
}

export async function DELETE(_request, { params }) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'مفيش معرف موظف' }, { status: 400 });

  const admin = getAdminClient();

  const { error: filesError } = await admin.from('payslips').delete().eq('employee_id', id);
  if (filesError) return NextResponse.json({ error: `تعذر حذف ملفات الموظف المرتبطة: ${filesError.message}` }, { status: 400 });
  const { error: messagesError } = await admin.from('messages').update({ employee_id: null }).eq('employee_id', id);
  if (messagesError) return NextResponse.json({ error: `تعذر فصل رسائل الموظف: ${messagesError.message}` }, { status: 400 });
  const { error } = await admin.from('employees').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ deleted: id });
}
