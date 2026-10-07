import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { id } = await params;
  const name = String((await request.json()).name ?? '').trim();
  if (name.length < 2) return NextResponse.json({ error: 'اسم القسم لازم يكون حرفين على الأقل' }, { status: 400 });
  const { data, error } = await getAdminClient().from('payslip_categories').update({ name }).eq('id', id).select().single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'في قسم تاني بنفس الاسم' }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ category: data });
}

export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { id } = await params;
  const admin = getAdminClient();
  const { data: category, error: lookupError } = await admin.from('payslip_categories').select('name').eq('id', id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!category) return NextResponse.json({ error: 'القسم مش موجود' }, { status: 404 });
  const { error: requestsError } = await admin.from('file_requests').update({ category: 'عام' }).eq('category', category.name);
  if (requestsError) return NextResponse.json({ error: `تعذر تحديث طلبات الوكيل المرتبطة: ${requestsError.message}` }, { status: 400 });
  const { error: filesError } = await admin.from('payslips').update({ category: 'عام' }).eq('category', category.name);
  if (filesError) return NextResponse.json({ error: `تعذر نقل الملفات المرتبطة للقسم العام: ${filesError.message}` }, { status: 400 });
  const { error } = await admin.from('payslip_categories').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
