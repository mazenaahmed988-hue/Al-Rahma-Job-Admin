 import { connection } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import EmployeesView from '@/components/employees-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// نفس حجم الدفعة المستخدم في الـ API — أول دفعة بس بنجيبها من السيرفر
const PAGE_SIZE = 50;

export default async function EmployeesPage() {
  // الصفحة بتقرأ من قاعدة البيانات مباشرة، فلازم تتخليش من أي كاش
  await connection();
  const admin = getAdminClient();
  // العرض بيعرض الاسم والرقم القومي والحالة فقط، والصور اتشالت خلاص
  const columns = ['id', 'full_name', 'national_id', 'is_active', 'created_at', 'department_id'];
  // الترتيب الافتراضي: الأحدث إضافةً الأول (created_at DESC) + عدد الصفوف الكلي
  const { data, count } = await admin
    .from('employees')
    .select(columns.join(', '), { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('full_name', { ascending: true })
    .range(0, PAGE_SIZE - 1);

  const rows = data ?? [];

  return <EmployeesView initialEmployees={rows} initialTotal={count ?? rows.length} pageSize={PAGE_SIZE} />;
}
