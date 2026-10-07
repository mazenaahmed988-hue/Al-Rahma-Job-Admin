import { NextResponse } from 'next/server';
import { createClient, isAdmin } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const NID = /^[0-9]{14}$/;

/**
 * إضافة مجمعة للموظفين من Text Area — الإدمن بيلزق (الاسم مع الرقم القومي)
 * بأي ترتيب عشوائي، والمحرك بيصطاد الرقم القومي الـ 14 رقم ويعتبر الباقي هو الاسم.
 */
function parseEmployeeLine(raw) {
  const line = String(raw ?? '').replace(/^\s*["']|["']\s*$/g, '').trim();
  if (!line) return null;

  // الرقم القومي: أي 14 رقم ورا بعض، مع تجاهل المسافات أو .00 الملزوقة
  const cleaned = line.replace(/[\u200f\u200e]/g, ' ');
  const match = cleaned.match(/(?:^|[^0-9])((?:\d[\s.]*){14})(?:[^0-9]|$)/);
  const digits = match ? match[1].replace(/[^0-9]/g, '') : '';
  const nationalId = NID.test(digits) ? digits : '';

  // الاسم: أي نص يتبقى بعد شيل الرقم القومي، مع تنظيف الفواصل الزايدة
  let rest = line;
  if (match) rest = rest.replace(match[1], ' ');
  const fullName = rest
    .replace(/[|,،;\t]+/g, ' ')
    .replace(/[()\[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { full_name: fullName, national_id: nationalId };
}

export async function POST(request) {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  if (!isAdmin(result.data.user)) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  if (!lines.length || lines.length > 500) {
    return NextResponse.json({ error: 'لازم تلزق بين سطر و500 سطر' }, { status: 400 });
  }

  const parsed = lines.map((line, index) => ({ index, ...(parseEmployeeLine(line) ?? { full_name: '', national_id: '' }) }));

  const problems = [];
  const records = [];
  parsed.forEach((row) => {
    if (!row.national_id) return problems.push({ index: row.index, reason: 'مفيش رقم قومي 14 رقم في السطر' });
    if (row.full_name.length < 3) return problems.push({ index: row.index, reason: 'الاسم لازم يكون 3 حروف على الأقل' });
    records.push({ full_name: row.full_name, national_id: row.national_id, is_active: true });
  });

  if (!records.length) return NextResponse.json({ error: 'مفيش أسطر صالحة للإضافة', problems }, { status: 400 });

  // بنشيل التكرار جوه الطلب نفسه (نفس الرقم القومي)
  const unique = [];
  const seen = new Set();
  records.forEach((row) => {
    if (seen.has(row.national_id)) return problems.push({ index: -1, reason: `الرقم القومي ${row.national_id} مكرر في اللصق` });
    seen.add(row.national_id);
    unique.push(row);
  });

  const admin = getAdminClient();
  // نتجاهل اللي مسجّل قبل كده بدل ما نفشل الطلب كله
  const { data: existing } = await admin.from('employees').select('national_id').in('national_id', unique.map((r) => r.national_id));
  const existingIds = new Set((existing ?? []).map((row) => row.national_id));
  const toInsert = unique.filter((row) => {
    if (existingIds.has(row.national_id)) {
      problems.push({ index: -1, reason: `الرقم القومي ${row.national_id} مسجل قبل كده` });
      return false;
    }
    return true;
  });

  let saved = [];
  if (toInsert.length) {
    const { data, error } = await admin.from('employees').insert(toInsert).select('id, full_name, national_id, is_active, created_at, department_id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data ?? [];
  }

  return NextResponse.json({ saved, problems }, { status: 201 });
}
