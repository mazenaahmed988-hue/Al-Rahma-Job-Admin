import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient, hasContactColumns, isMissingContactColumn } from '@/lib/supabase/admin';

const NID = /^[0-9]{14}$/;

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const fullName = String(body.full_name ?? '').trim();
  const nationalId = String(body.national_id ?? '').trim();
  const jobTitle = String(body.job_title ?? '').trim();
  if (fullName.length < 3) return NextResponse.json({ error: 'اسم الموظف لازم يكون 3 حروف على الأقل' }, { status: 400 });
  if (!NID.test(nationalId)) return NextResponse.json({ error: 'الرقم القومي لازم يكون 14 رقم' }, { status: 400 });
  if (jobTitle.length < 2) return NextResponse.json({ error: 'الوظيفة مطلوبة' }, { status: 400 });

  const admin = getAdminClient();
  const phone = String(body.phone ?? '').trim() || null;
  const address = String(body.address ?? '').trim() || null;
  const withContacts = await hasContactColumns();
  const { data, error } = await admin.from('employees').insert({
    full_name: fullName,
    national_id: nationalId,
    job_title: jobTitle,
    ...(withContacts ? { phone, address } : {}),
    is_active: true,
  }).select().single();
  if (error) {
    if (isMissingContactColumn(error)) {
      return NextResponse.json({ error: 'ترحيل قاعدة البيانات لسه مش متنفذ. شغّل supabase/migrations/0002_employee_contacts_and_avatars.sql' }, { status: 503 });
    }
    const duplicate = error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'الرقم القومي ده مسجل قبل كده' : error.message }, { status: 400 });
  }
  return NextResponse.json({ employee: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = getAdminClient();
  const withContacts = await hasContactColumns();
  const columns = ['id', 'full_name', 'national_id', 'job_title', 'avatar_url', 'is_active', 'created_at', 'department_id'];
  const { data, error } = await admin
    .from('employees')
    .select(columns.concat(withContacts ? ['phone', 'address'] : []).join(', '))
    .order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data ?? [], contactColumns: withContacts });
}
