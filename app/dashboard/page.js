import { getAdminClient } from '@/lib/supabase/admin';
import DashboardOverview from '@/components/dashboard-overview';

export const dynamic = 'force-dynamic';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default async function DashboardPage() {
  const admin = getAdminClient();
  const [employees, files, categories, unread] = await Promise.all([
    admin.from('employees').select('id, is_active'),
    admin.from('payslips').select('id, created_at'),
    admin.from('payslip_categories').select('id'),
    admin.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
  ]);

  const rows = employees.data ?? [];
  const activeCount = rows.filter((row) => row.is_active).length;

  // آخر 6 شهور: عدد الملفات المرفوعة في كل شهر
  const now = new Date();
  const monthly = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const count = (files.data ?? []).filter((file) => {
      const created = new Date(file.created_at);
      return created.getFullYear() === year && created.getMonth() === month;
    }).length;
    monthly.push({ label: MONTHS[month], short: MONTHS[month].slice(0, 4), count });
  }

  const stats = {
    employees: rows.length,
    active: activeCount,
    inactive: rows.length - activeCount,
    files: (files.data ?? []).length,
    categories: (categories.data ?? []).length,
    unread: unread.count ?? 0,
    monthly,
  };

  return <DashboardOverview stats={stats} />;
}

