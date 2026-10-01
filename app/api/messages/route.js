import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { data, error } = await getAdminClient()
    .from('messages')
    .select('id, employee_id, national_id, message_type, body, created_at, admin_reply, replied_at, is_read, employees(id, full_name, national_id, job_title)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

/** تحديد كمقروء / غير مقروء */
export async function PATCH(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { id, is_read: isRead } = await request.json();
  if (!id) return NextResponse.json({ error: 'مفيش معرف رسالة' }, { status: 400 });
  const { data, error } = await getAdminClient().from('messages').update({ is_read: Boolean(isRead) }).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}

/** رد الإدارة على الرسالة */
export async function PUT(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const { id, admin_reply: reply } = await request.json();
  if (!id) return NextResponse.json({ error: 'مفيش معرف رسالة' }, { status: 400 });
  const text = String(reply ?? '').trim();
  if (text.length < 2) return NextResponse.json({ error: 'اكتب الرد قبل الإرسال' }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: 'الرد طويل أوي (الحد 2000 حرف)' }, { status: 400 });
  const { data, error } = await getAdminClient()
    .from('messages')
    .update({ admin_reply: text, replied_at: new Date().toISOString(), is_read: true })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}
