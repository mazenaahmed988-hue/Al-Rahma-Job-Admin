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
  // لو القسم مستخدم في ملفات موجودة، نمنع الحذف بدل ما نكسر الملفات القديمة
  const { count } = await admin.from('payslips').select('*', { count: 'exact', head: true }).eq('category', (await admin.from('payslip_categories').select('name').eq('id', id).maybeSingle()).data?.name ?? '__none__');
  if (count > 0) {
    return NextResponse.json({ error: `القسم ده مستخدم في ${count} ملف. غيّر ملفاتك للقسم التاني الأول.` }, { status: 409 });
  }
  const { error } = await admin.from('payslip_categories').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
