import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { data, error } = await getAdminClient().from('payslip_categories').select('*').order('sort_order').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const name = String((await request.json()).name ?? '').trim();
  if (name.length < 2) return NextResponse.json({ error: 'اسم القسم لازم يكون حرفين على الأقل' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'اسم القسم طويل أوي (الحد 60 حرف)' }, { status: 400 });
  const { data, error } = await getAdminClient().from('payslip_categories').insert({ name }).select().single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'القسم ده موجود بالفعل' }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ category: data }, { status: 201 });
}
