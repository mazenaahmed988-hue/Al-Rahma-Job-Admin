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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// Supabase/PostgREST بياخد قيمة الـ filter جوه علامات اقتباس مفردة،
// فلازم نهرّب أي علامة اقتباس أو فاصلة موجودة في كلمة البحث عشان ما يتكسرش الـ or().
function escapeFilter(value) {
  return value.replace(/[%,\(\)"']/g, ' ').trim();
}

export async function GET(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = getAdminClient();
  const columns = ['id', 'full_name', 'national_id', 'is_active', 'created_at', 'department_id'];

  const params = new URL(request.url).searchParams;
  // البحث سيرفر-سايد بـ ilike عشان يدوّر في الداتابيز كلها
  // (مش في الصفحة الحالية بس) — ده بيحل مشكلة حرف 'ي' اللي كان بيقع آخر الأبجدية
  const term = escapeFilter(String(params.get('search') ?? '').trim());
  const status = String(params.get('status') ?? 'all').trim();

  // Pagination بـ offset/limit عشان الإدمن يقدر ينزل لحد آخر موظف في الداتابيز
  const limit = clampInt(params.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(params.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER);

  let query = admin.from('employees').select(columns.join(', '), { count: 'exact' });
  if (term) query = query.or(`full_name.ilike.%${term}%,national_id.ilike.%${term}%`);
  if (status === 'active') query = query.eq('is_active', true);
  else if (status === 'inactive') query = query.eq('is_active', false);

  // الترتيب الافتراضي: الأحدث إضافةً الأول (created_at DESC)، والاسم كفاصل ثانوي ثابت
  // عشان ترقيم الصفحات يفضل مستقر.
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('full_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = count ?? 0;
  return NextResponse.json({
    employees: data ?? [],
    total,
    limit,
    offset,
    hasMore: offset + (data?.length ?? 0) < total,
    contactColumns: false,
  });
}
