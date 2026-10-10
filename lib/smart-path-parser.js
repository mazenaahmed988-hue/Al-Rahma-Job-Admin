import { checkPath, cleanPath } from './files.js';

const MONTH_ALIASES = [
  ['يناير', 'jan', 'january'], ['فبراير', 'feb', 'february'], ['مارس', 'mar', 'march'],
  ['أبريل', 'ابريل', 'apr', 'april'], ['مايو', 'may'], ['يونيو', 'يونية', 'jun', 'june'],
  ['يوليو', 'يونيه', 'jul', 'july'], ['أغسطس', 'اغسطس', 'aug', 'august'],
  ['سبتمبر', 'sep', 'sept', 'september'], ['أكتوبر', 'اكتوبر', 'oct', 'october'],
  ['نوفمبر', 'nov', 'november'], ['ديسمبر', 'dec', 'december'],
];
const MONTH_TOKEN = MONTH_ALIASES.flatMap((aliases, index) => aliases.map((alias) => ({ alias, month: index + 1 })))
  .sort((a, b) => b.alias.length - a.alias.length);

// امتدادات الملفات المعروفة عشان نتعرف على مسار الملف وسط السطر
const KNOWN_EXT = /\.(?:pdf|docx?|xlsx?|csv|png|jpe?g|webp|zip|rar)\b/i;

// حروف عربية خالص (بدون أي مسافات/أرقام/رموز) — دي اللي مسموح بيها في اسم الموظف
const ARABIC_LETTER = /\p{Script=Arabic}/u;

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * "غرفة التحكم الشاملة" — محرك Pattern Matching بيلزق السطر بأي ترتيب عشوائي.
 * بيقرا كل سطر من الإكسيل ويصطاد:
 *   • الرقم القومي (إجباري): أي 14 رقم ورا بعض، حتى لو فيهم مسافات أو ملزوق فيهم ".00".
 *   • مسار الملف (إجباري): أي نص فيه "\" أو ":" أو بينتهي بامتداد ملف معروف (.pdf إلخ).
 *   • السنة: أي رقم من 4 خانات (2022 لـ 2030).
 *   • الشهر: اسم شهر عربي (يناير، مارس..) أو رقم شهر (1-12).
 *   • الاسم (اختياري): أي نص يتبقى في السطر بعد استخراج اللي فات.
 */
export function parsePathLine(raw, index, employees = [], categories = []) {
  const line = String(raw ?? '').replace(/^\s*["']|[\"']\s*$/g, '').trim();

  // ── 1) مسار الملف (إجباري): أي نص فيه \ أو : وبيوصل لامتداد ملف معروف ──
  //     بيسمح بمسافات جوّه المسار (زي "K:\شيت القبض\ملف.pdf") وبيوقف عند الامتداد.
  let path = '';
  let pathStart = -1;
  let pathEnd = -1;
  const pathCandidates = [];
  // بنلقط المسار ككتلة واحدة: من أول حرف القرص [A-Za-z]:\ ونفضل ناكل لحد أول امتداد
  // معروف (.pdf/.xlsx/…)، وعشان نظبط الأدق لو فيه أكتر من امتداد في السطر بناخد
  // الامتداد اللي بعده نهاية السطر أو علامة فاصلة/كوتيشن على طول (مش أي مسافة جوّه المسار).
  const pathRegex = /[A-Za-z]:[\\/][^\r\n"'،;]*?\.(?:pdf|docx?|xlsx?|csv|png|jpe?g|webp|zip|rar)(?=[\s"',،;]*$|[\s"',،;])/gi;
  let pathMatch;
  while ((pathMatch = pathRegex.exec(line)) !== null) {
    const value = pathMatch[0].trim();
    if (KNOWN_EXT.test(value)) pathCandidates.push({ value, start: pathMatch.index, end: pathMatch.index + value.length });
  }
  // لو مفيش مسار بامتداد معروف، نقبل أي توكن فيه \ أو :
  if (!pathCandidates.length) {
    const fallback = line.match(/[^\s"']*[\\/][^\s"']+|\S+:[^\s"']+/);
    if (fallback) {
      const value = fallback[0];
      pathCandidates.push({ value, start: fallback.index, end: fallback.index + value.length });
    }
  }
  const pathToken = pathCandidates[0] ?? null;
  if (pathToken) {
    path = cleanPath(pathToken.value);
    pathStart = pathToken.start;
    pathEnd = pathToken.end;
  }

  // الجزء اللي بعد المسار (هو اللي فيه الاسم + الرقم القومي عادةً)
  const afterPathRaw = pathEnd >= 0 ? line.slice(pathEnd) : line;
  const beforePathRaw = pathStart > 0 ? line.slice(0, pathStart) : '';
  const outsidePath = (beforePathRaw + ' ' + afterPathRaw);
  // اسم ملف المسار كمان مصدر معتبر للشهر والسنة (زي salary_3_2026.pdf)
  const pathFileName = (path.split(/[\\/]/).pop() ?? '');

  // ── 2) الرقم القومي (إجباري): 14 رقم ورا بعض، مع تجاهل المسافات و .00 الملزوقة ──
  function extractNationalId(text) {
    const cleaned = text.replace(/[\u200f\u200e]/g, ' ');
    const match = cleaned.match(/(?:^|[^0-9])((?:\d[\s.]*){14})(?:[^0-9]|$)/);
    if (!match) return '';
    const digits = match[1].replace(/[^0-9]/g, '');
    return digits.length === 14 ? digits : '';
  }
  let nationalId = extractNationalId(afterPathRaw);
  if (!nationalId) nationalId = extractNationalId(beforePathRaw);

  // النص اللي بندور فيه على الشهر والسنة: برّا المسار + اسم ملف المسار
  const searchText = `${outsidePath} ${pathFileName}`;

  // ── 3) السنة: رقم من 4 خانات (2022 لـ 2030) ──
  const yearMatch = searchText.match(/(?:^|[^0-9])(20[2-3][0-9])(?:[^0-9]|$)/);
  const year = yearMatch ? Number(yearMatch[1]) : 0;

  // بنشيل الرقم القومي والسنة واسم الملف من النص قبل ما ندور على الشهر والاسم،
  // عشان ما نفسرش أرقام الرقم القومي أو السنة على إنها رقم شهر.
  let rest = outsidePath;
  if (nationalId) rest = rest.replace(nationalId, ' ');
  rest = rest.replace(/\b20[2-3][0-9]\b/g, ' ');
  // نص إضافي للشهر جاي من اسم الملف بعد شيل الرقم القومي والسنة
  let restFromFile = pathFileName.replace(nationalId, ' ').replace(/\b20[2-3][0-9]\b/g, ' ');

  // ── 4) الشهر: اسم شهر عربي أو رقم شهر (1-12) ──
  let month = 0;
  const findMonthName = (text) => MONTH_TOKEN.map((entry) => ({ ...entry, at: text.toLowerCase().indexOf(entry.alias.toLowerCase()) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at)[0];
  const monthNameToken = findMonthName(rest) ?? findMonthName(restFromFile);
  if (monthNameToken) {
    month = monthNameToken.month;
    // بنشيل اسم الشهر من النص عشان ما يظهرش في الاسم المستخرج
    if (findMonthName(rest)) rest = rest.slice(0, monthNameToken.at) + ' ' + rest.slice(monthNameToken.at + monthNameToken.alias.length);
    else restFromFile = restFromFile.slice(0, monthNameToken.at) + ' ' + restFromFile.slice(monthNameToken.at + monthNameToken.alias.length);
  } else {
    // بندور على كل الأرقام وناخد أول رقم صالح من 1 لـ 12 (مش أول رقم في السطر لوحده)
    const numberPattern = /(?:^|[^0-9])(\d{1,2})(?:[^0-9]|$)/g;
    const collect = (text) => {
      const found = [];
      let m;
      while ((m = numberPattern.exec(text)) !== null) {
        const value = Number(m[1]);
        if (value >= 1 && value <= 12) found.push({ value, at: (m.index ?? 0) + m[0].indexOf(m[1]), len: m[1].length });
      }
      return found;
    };
    const fromOutside = collect(rest)[0];
    const fromFile = fromOutside ? null : collect(restFromFile)[0];
    const picked = fromOutside ?? fromFile;
    if (picked) {
      month = picked.value;
      if (fromOutside) rest = rest.slice(0, fromOutside.at) + ' ' + rest.slice(fromOutside.at + fromOutside.len);
      else restFromFile = restFromFile.slice(0, fromFile.at) + ' ' + restFromFile.slice(fromFile.at + fromFile.len);
    }
  }

  // ── 5) الاسم (اختياري): حروف عربية صافية فقط ──
  //     بنشيل الأول الامتداد وأي كلمات إنجليزية معروفة (زي Salary/MY computer/work،
  //     ودي بالظبط اللي كانت بتتخزن غلط مكان اسم الموظف)، وبعدين نفلتر على حروف
  //     العربية بس — أي حرف إنجليزي/رقم/رمز (\، :، -، _، .) بيتشال. لو مفيش عربي → null.
  //     كده مستحيل نكتب مسار أو 14 رقم مكان اسم موظف عربي في الداتابيز.
  const restWithoutExt = rest
    .replace(/\.[A-Za-z]{1,5}\b/g, ' ')
    .replace(/\b(?:salary|incentive|bonus|payroll|overtime|pdf|docx?|xlsx?|csv|image|img|scan|copy|final|new|egypt|hr|my|computer|work|file|files|docs?|documents?|desktop|downloads?)\b/gi, ' ');
  const rawName = (restWithoutExt.match(/\p{Script=Arabic}[\p{Script=Arabic}\s]*/gu) ?? [])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || null;

  // ── 6) القسم: ثابت 'شيت القبض' (الأقسام بقت Hardcoded) ──
  const category = 'شيت القبض';
  const categoryRecognized = true;

  // الاسم لازم يكون عربي وفيه 3 حروف على الأقل، وإلا مفيش اسم (null) ومش بيمس أي حاجة في الداتابيز
  const hasArabicName = typeof rawName === 'string' && ARABIC_LETTER.test(rawName) && rawName.replace(/\s+/g, '').length >= 3;
  const matchedEmployee = nationalId
    ? employees.find((item) => String(item.national_id ?? '') === nationalId)
    : hasArabicName
      ? employees.find((item) => normalizeName(item.full_name) === normalizeName(rawName))
      ?? employees.find((item) => normalizeName(item.full_name).includes(normalizeName(rawName)) || normalizeName(rawName).includes(normalizeName(item.full_name)))
      : undefined;
  const pathCheck = checkPath(path);
  const fileName = (path.split(/[\\/]/).pop() ?? '').trim();

  return {
    id: `path-${index}-${fileName || nationalId || index}`,
    raw: line,
    localPath: path,
    fileName,
    employeeId: matchedEmployee?.id ?? '',
    employeeName: matchedEmployee?.full_name ?? (hasArabicName ? rawName : null),
    nationalId: matchedEmployee?.national_id ?? nationalId,
    month: month || new Date().getMonth() + 1,
    year: year || new Date().getFullYear(),
    category,
    categoryRecognized,
    isValidPath: pathCheck.state === 'ok',
    pathError: pathCheck.state === 'bad' ? pathCheck.message : '',
    status: matchedEmployee ? 'ready' : 'missing-employee',
  };
}
