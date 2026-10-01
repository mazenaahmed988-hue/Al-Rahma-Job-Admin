import { createClient } from '@supabase/supabase-js';

let client;
export function getAdminClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase service role configuration');
    client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return client;
}

let contactColumns;
let contactCheckedAt = 0;
const MISSING_COLUMN = /column .*\.(phone|address) does not exist/i;
const CACHE_MS = 60_000;

/**
 * أعمدة الهاتف والعنوان جاية مع ترحيل 0002. لو الترحيل لسه مش متنفذ
 * بنفترض إنه مش موجود، عشان الواجهة ما تكسرش على قاعدة البيانات القديمة.
 * النتيجة بتتخزن لدة قصيرة بس، عشان الترحيل اللي يتنفذ أثناء التشغيل
 * ياخد دوره من غير إعادة تشغيل السيرفر.
 */
export async function hasContactColumns() {
  if (contactColumns !== undefined && Date.now() - contactCheckedAt < CACHE_MS) return contactColumns;
  const { error } = await getAdminClient().from('employees').select('phone, address').limit(1);
  contactColumns = !error;
  contactCheckedAt = Date.now();
  return contactColumns;
}

export function isMissingContactColumn(error) {
  return Boolean(error) && MISSING_COLUMN.test(error.message);
}
