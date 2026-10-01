                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             import { redirect } from 'next/navigation';
import { createClient, isAdmin } from '@/lib/supabase/server';
import DashboardShell from '@/components/dashboard-shell';

export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) redirect('/');
  return <DashboardShell email={result.data.user.email}>{children}</DashboardShell>;
}
