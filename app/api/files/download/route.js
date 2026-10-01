import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const DOWNLOAD_TTL = 60 * 60; // رابط تحميل صالح ساعة

export async function GET(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'مفيش معرف ملف' }, { status: 400 });
  const admin = getAdminClient();
  const { data: file, error } = await admin.from('payslips').select('storage_path, file_name').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!file?.storage_path) return NextResponse.json({ error: 'الملف ده مش موجود على السيرفر' }, { status: 404 });
  const signed = await admin.storage.from('payslips').createSignedUrl(file.storage_path, DOWNLOAD_TTL);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: signed.error?.message || 'مقدرتش أعمل رابط تحميل' }, { status: 500 });
  }
  return NextResponse.json({ url: signed.data.signedUrl, fileName: file.file_name });
}
