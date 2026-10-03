// ثوابت ودوال مشتركة لمركز الملفات (كانت كلها جوّه files-view.js قبل الفك)

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export const CURRENT_YEAR = new Date().getFullYear();

export const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 3 + i);

// المسار لازم يكون على قرص (C:\ أو K:\ إلخ) وينتهي بامتداد معروف
export const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
export const KNOWN_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.rar'];

export function detectKind(path) {
  const value = (path ?? '').trim().toLowerCase();
  if (!value) return 'none';
  if (value.endsWith('.pdf')) return 'pdf';
  if (value.endsWith('.xlsx') || value.endsWith('.xls') || value.endsWith('.csv')) return 'excel';
  if (value.endsWith('.docx') || value.endsWith('.doc')) return 'word';
  if (value.endsWith('.zip') || value.endsWith('.rar')) return 'archive';
  if (value.endsWith('.png') || value.endsWith('.jpg') || value.endsWith('.jpeg') || value.endsWith('.webp')) return 'image';
  return 'unknown';
}

export function cleanPath(path) {
  return String(path ?? '').replace(/["']/g, '').trim();
}

export function checkPath(path) {
  const value = cleanPath(path);
  if (!value) return { state: 'empty', message: '' };
  if (!DRIVE_PATH.test(value)) {
    return { state: 'bad', message: 'المسار لازم يبدأ بحرف قرص مثل C:\\ أو K:' };
  }
  if (!KNOWN_EXT.some((item) => value.toLowerCase().endsWith(item))) {
    return { state: 'bad', message: 'الامتداد مش معروف. المسموح: PDF · Word · Excel · CSV · صور · ZIP' };
  }
  return { state: 'ok', message: 'المسار صالح للربط' };
}

export function initials(name) {
  return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('');
}

// الاسم أو الرقم القومي → رقم الشهر (1..12)
export function parseMonthValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return 0;
  const byName = MONTHS.findIndex((m) => m === value) + 1;
  if (byName > 0) return byName;
  const byPrefix = MONTHS.findIndex((m) => m.startsWith(value)) + 1;
  if (byPrefix > 0) return byPrefix;
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= 12 ? num : 0;
}

export function parseYearValue(raw) {
  const num = Number(String(raw ?? '').trim());
  return Number.isInteger(num) && num >= 2000 && num <= 2100 ? num : 0;
}