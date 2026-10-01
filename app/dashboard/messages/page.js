import { getAdminClient } from '@/lib/supabase/admin';
import MessagesView from '@/components/messages-view';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const { data } = await getAdminClient()
    .from('messages')
    .select('id, employee_id, national_id, message_type, body, created_at, admin_reply, replied_at, is_read, employees(id, full_name, national_id, job_title)')
    .order('created_at', { ascending: false });
  return <MessagesView initialMessages={data ?? []} />;
}
