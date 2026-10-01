import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin.from('employees').select('id, avatar_url').not('avatar_url', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const avatars = {};
  for (const row of data ?? []) {
    if (!row.avatar_url) continue;
    const { data: signed } = await admin.storage.from('avatars').createSignedUrl(row.avatar_url, 60 * 60 * 24);
    if (signed?.signedUrl) avatars[row.id] = signed.signedUrl;
  }
  return NextResponse.json({ avatars });
}
