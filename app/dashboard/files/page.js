import { getAdminClient } from '@/lib/supabase/admin';
import FilesView from '@/components/files-view';

export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const admin = getAdminClient();
  const [employees, categories, files] = await Promise.all([
    admin.from('employees').select('id, full_name, national_id, avatar_url').order('full_name'),
    admin.from('payslip_categories').select('id, name').order('sort_order').order('name'),
    admin
      .from('payslips')
      .select('id, employee_id, category, year, month, month_label, local_path, file_name, mime_type, storage_path, status, is_visible, created_at, employees(id, full_name, national_id), file_requests(id, status, error, created_at)')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <FilesView
      employees={employees.data ?? []}
      categories={categories.data ?? []}
      initialFiles={files.data ?? []}
    />
  );
}
