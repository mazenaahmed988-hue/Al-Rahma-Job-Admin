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

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function parsePathLine(raw, index, employees = [], categories = []) {
  const path = cleanPath(String(raw ?? '').replace(/^\s*["']|["']\s*$/g, ''));
  const fileName = path.split(/[\\/]/).pop() ?? '';
  const stem = fileName.replace(/\.[^.]+$/, '');
  const nationalId = stem.match(/(?:^|\D)(\d{14})(?:\D|$)/)?.[1] ?? '';
  const tokens = stem.replace(/\d{14}/g, ' ').split(/[_\s-]+/).filter(Boolean);

  let month = 0;
  let year = 0;
  let monthTokenIndex = -1;
  let yearTokenIndex = -1;
  tokens.forEach((token, tokenIndex) => {
    const number = Number(token);
    if (!year && /^20\d{2}$/.test(token)) { year = number; yearTokenIndex = tokenIndex; }
    if (!month && Number.isInteger(number) && number >= 1 && number <= 12 && !/^20\d{2}$/.test(token)) {
      month = number;
      monthTokenIndex = tokenIndex;
    }
    if (!month) {
      const matched = MONTH_TOKEN.find(({ alias }) => token.toLowerCase() === alias.toLowerCase());
      if (matched) { month = matched.month; monthTokenIndex = tokenIndex; }
    }
  });

  const normalizedStem = normalizeName(stem);
  const databaseCategory = categories.filter((item) => normalizeName(item.name))
    .sort((a, b) => normalizeName(b.name).length - normalizeName(a.name).length)
    .find((item) => normalizedStem.includes(normalizeName(item.name)));
  const categoryHints = [
    { name: 'مرتب', terms: ['salary', 'payroll', 'راتب', 'مرتب', 'مفردات'] },
    { name: 'حافز', terms: ['incentive', 'bonus', 'حافز', 'حوافز', 'مكافأة', 'مكافاه'] },
    { name: 'إضافي', terms: ['overtime', 'extra', 'إضافي', 'اضافي'] },
  ];
  const detectedHint = categoryHints.find((item) => item.terms.some((term) => normalizedStem.includes(normalizeName(term))));
  const category = databaseCategory?.name ?? detectedHint?.name ?? '';
  const categoryRecognized = Boolean(databaseCategory);
  const categoryTokenIndex = databaseCategory
    ? tokens.findIndex((token) => normalizeName(databaseCategory.name).split(' ').includes(normalizeName(token)))
    : detectedHint
      ? tokens.findIndex((token) => detectedHint.terms.some((term) => normalizeName(token).includes(normalizeName(term))))
      : -1;

  const ignored = new Set([monthTokenIndex, yearTokenIndex, categoryTokenIndex].filter((value) => value >= 0));
  const rawName = nationalId ? '' : tokens.filter((_, tokenIndex) => !ignored.has(tokenIndex))
    .join(' ').replace(/\b(?:salary|incentive|bonus|payroll|overtime)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const matchedEmployee = nationalId
    ? employees.find((item) => String(item.national_id ?? '') === nationalId)
    : rawName
      ? employees.find((item) => normalizeName(item.full_name) === normalizeName(rawName))
      ?? employees.find((item) => normalizeName(item.full_name).includes(normalizeName(rawName)) || normalizeName(rawName).includes(normalizeName(item.full_name)))
      : undefined;
  const pathCheck = checkPath(path);

  return {
    id: `path-${index}-${fileName}`,
    raw: String(raw ?? '').trim(),
    localPath: path,
    fileName,
    employeeId: matchedEmployee?.id ?? '',
    employeeName: matchedEmployee?.full_name ?? rawName,
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
