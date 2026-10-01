import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const form = await request.formData();
  const employeeId = String(form.get('employeeId') ?? '');
  const file = form.get('file');
  if (!employeeId) return NextResponse.json({ error: 'مفيش معرف موظف' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'مفيش صورة مرفوعة' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'الصورة لازم تكون JPG أو PNG أو WEBP' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'حجم الصورة أكبر من 4 ميجا' }, { status: 400 });

  const admin = getAdminClient();
  const previous = await admin.from('employees').select('avatar_url').eq('id', employeeId).maybeSingle();
  const oldPath = previous.data?.avatar_url || null;

  // المسار جوه الـ bucket: {employee_id}/{timestamp}.{ext}
  // الـ supabase client بيضيف اسم الـ bucket لوحده، فمينفعش نكرره هنا.
  const path = `${employeeId}/${Date.now()}.${EXT[file.type]}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from('avatars').upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  if (oldPath && oldPath !== path) await admin.storage.from('avatars').remove([oldPath]);
  const { data: updated, error: updateError } = await admin.from('employees').update({ avatar_url: path }).eq('id', employeeId).select().single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const signed = await admin.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24);
  return NextResponse.json({ avatarUrl: signed?.signedUrl ?? null, storagePath: path, employee: updated });
}
