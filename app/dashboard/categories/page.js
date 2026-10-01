import { getAdminClient } from '@/lib/supabase/admin';
import CategoriesView from '@/components/categories-view';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const { data } = await getAdminClient().from('payslip_categories').select('*').order('sort_order').order('name');
  return <CategoriesView initialCategories={data ?? []} />;
}
