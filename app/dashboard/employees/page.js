 import { connection } from 'next/server';
import { getAdminClient, hasContactColumns } from '@/lib/supabase/admin';
import EmployeesView from '@/components/employees-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployeesPage() {
  // الصفحة بتقرأ من قاعدة البيانات مباشرة، فلازم تتخليش من أي كاش
  await connection();
  const admin = getAdminClient();
  const withContacts = await hasContactColumns();
  const columns = ['id', 'full_name', 'national_id', 'job_title', 'avatar_url', 'is_active', 'created_at', 'department_id'];
  const { data } = await admin
    .from('employees')
    .select(columns.concat(withContacts ? ['phone', 'address'] : []).join(', '))
    .order('full_name');

  const rows = data ?? [];

  return <EmployeesView initialEmployees={rows} contactColumns={withContacts} />;
}
