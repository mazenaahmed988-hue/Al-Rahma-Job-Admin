import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const NID = /^[0-9]{14}$/;

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const fullName = String(body.full_name ?? '').trim();
  const nationalId = String(body.national_id ?? '').trim();
  if (fullName.length < 3) return NextResponse.json({ error: 'اسم الموظف لازم يكون 3 حروف على الأقل' }, { status: 400 });
  if (!NID.test(nationalId)) return NextResponse.json({ error: 'الرقم القومي لازم يكون 14 رقم' }, { status: 400 });

  const admin = getAdminClient();
  const jobTitle = String(body.job_title ?? '').trim();
  const { data, error } = await admin.from('employees').insert({
    full_name: fullName,
    national_id: nationalId,
    ...(jobTitle ? { job_title: jobTitle } : {}),
    is_active: true,
  }).select().single();
  if (error) {
    const duplicate = error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'الرقم القومي ده مسجل قبل كده' : error.message }, { status: 400 });
  }
  return NextResponse.json({ employee: data }, { status: 201 });
}

export async function GET(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = getAdminClient();
  const columns = ['id', 'full_name', 'national_id', 'is_active', 'created_at', 'department_id'];
  // البحث سيرفر-سايد بـ ilike عشان يدوّر في الداتابيز كلها
  // (مش في الصفحة الحالية بس) — ده بيحل مشكلة حرف 'ي' اللي كان بيقع آخر الأبجدية
  const term = String(new URL(request.url).searchParams.get('search') ?? '').trim();
  let query = admin.from('employees').select(columns.join(', '));
  if (term) query = query.or(`full_name.ilike.%${term}%,national_id.ilike.%${term}%`);
  const { data, error } = await query.order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data ?? [], contactColumns: false });
}
