'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, CheckCircle2, ClipboardPaste, FileSpreadsheet, FileText, FolderOpen,
  Link2Off, Pencil, Search, Table2, Trash2, UserRound, X,
} from 'lucide-react';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - 3 + i);

// المسار لازم يكون على قرص (C:\ أو K: إلخ) وينتهي بامتداد معروف
const DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const KNOWN_EXT = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.rar'];

// بيانات اتصال وهمية — بتتعرض في الـ modal بس، مفيش أي اتصال حقيقي
const FAKE_SERVER = {
  status: 'متصل',
  host: '192.168.1.50',
  port: 445,
  protocol: 'SMB / CIFS',
  share: '\\\\FILES-SRV\\payslips',
  latency: 12,
  lastSync: 'منذ دقيقتين',
};

function detectKind(path) {
  const value = (path ?? '').trim().toLowerCase();
  if (!value) return 'none';
  if (value.endsWith('.pdf')) return 'pdf';
  if (value.endsWith('.xlsx') || value.endsWith('.xls') || value.endsWith('.csv')) return 'excel';
  if (value.endsWith('.docx') || value.endsWith('.doc')) return 'word';
  if (value.endsWith('.zip') || value.endsWith('.rar')) return 'archive';
  if (value.endsWith('.png') || value.endsWith('.jpg') || value.endsWith('.jpeg') || value.endsWith('.webp')) return 'image';
  return 'unknown';
}

function checkPath(path) {
  const value = (path ?? '').trim();
  if (!value) return { state: 'empty', message: '' };
  if (!DRIVE_PATH.test(value)) {
    return { state: 'bad', message: 'المسار لازم يبدأ بحرف قرص مثل C:\\ أو K:' };
  }
  if (!KNOWN_EXT.some((item) => value.toLowerCase().endsWith(item))) {
    return { state: 'bad', message: 'الامتداد مش معروف. المسموح: PDF · Word · Excel · CSV · صور · ZIP' };
  }
  return { state: 'ok', message: 'المسار صالح للربط' };
}

function KindIcon({ kind, size = 19 }) {
  if (kind === 'excel') return <FileSpreadsheet size={size} />;
  return <FileText size={size} />;
}

function initials(name) {
  return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('');
}

function StatCard({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div className="stat-card glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: .4 }}>
      <span className="stat-icon"><Icon size={19} /></span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </motion.div>
  );
}

export default function FilesView({ employees, initialFiles }) {
  const [files, setFiles] = useState(initialFiles ?? []);
  const [mode, setMode] = useState('single');
  const [entry, setEntry] = useState({ employeeId: '', employeeQuery: '', month: new Date().getMonth() + 1, year: CURRENT_YEAR, path: '' });
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState([]);
  const [serverOpen, setServerOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  const pathCheck = checkPath(entry.path);
  const pathKind = detectKind(entry.path);

  const suggestions = useMemo(() => {
    const term = entry.employeeQuery.trim().toLowerCase();
    if (term.length < 3) return [];
    return employees.filter((e) => e.full_name.toLowerCase().includes(term) || e.national_id.includes(term)).slice(0, 6);
  }, [employees, entry.employeeQuery]);

  const selectedEmployee = employees.find((e) => e.id === entry.employeeId);

  // إحصائيات: الملفات المربوطة فعلاً + الموظفين المكتملين (عندهم ملف مربوط)
  const linkedFiles = files.filter((f) => f.local_path);
  const completedEmployees = useMemo(() => {
    const ids = new Set(linkedFiles.map((f) => f.employee_id));
    return employees.filter((e) => ids.has(e.id)).length;
  }, [linkedFiles, employees]);

  const tableYears = useMemo(() => [...new Set(files.map((f) => f.year).filter(Boolean))].sort((a, b) => b - a), [files]);
  const tableMonths = useMemo(() => [...new Set(files.map((f) => f.month).filter(Boolean))].sort((a, b) => a - b), [files]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return files.filter((f) => {
      if (filterYear !== 'all' && String(f.year) !== String(filterYear)) return false;
      if (filterMonth !== 'all' && String(f.month) !== String(filterMonth)) return false;
      if (!term) return true;
      const name = f.employees?.full_name ?? '';
      return name.toLowerCase().includes(term) || (f.employees?.national_id ?? '').includes(term);
    });
  }, [files, query, filterYear, filterMonth]);

  function setField(name, value) {
    setEntry((prev) => ({ ...prev, [name]: value }));
  }

  function pickEmployee(employee) {
    setEntry((prev) => ({ ...prev, employeeId: employee.id, employeeQuery: employee.full_name }));
  }

  function resetEntry() {
    setEntry({ employeeId: '', employeeQuery: '', month: new Date().getMonth() + 1, year: CURRENT_YEAR, path: '' });
  }

  // لصق من الحافظة: بنقرا الحافظة وبنملا حقل المسار
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return setNotice({ kind: 'error', text: 'الحافظة فاضية' });
      setField('path', text.trim().split(/\r?\n/)[0]);
      setNotice({ kind: 'ok', text: 'تم لصق المسار من الحافظة' });
    } catch {
      setNotice({ kind: 'error', text: 'المتصفح مسمحش بالقراءة من الحافظة. الصق بإيدك في الحقل.' });
    }
  }

  // تحليل بيانات الإكسيل: كل سطر = موظف | شهر | سنة | مسار
  function parseBulk() {
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return setNotice({ kind: 'error', text: 'الصق بيانات الأول' });
    const rows = [];
    const problems = [];
    lines.forEach((line, index) => {
      const cells = line.split(/\t|,|;/).map((c) => c.trim());
      // تخطي سطر العناوين
      if (index === 0 && cells.length > 1 && cells.some((c) => /اسم|مسار|name|path/i.test(c))) return;
      const [rawName, rawMonth, rawYear, rawPath] = cells;
      const path = (rawPath ?? '').replace(/^["']|["']$/g, '').trim();
      if (!rawName || !path) { problems.push(`سطر ${index + 1}: ناقص`); return; }
      const employee = employees.find((e) => e.full_name.trim() === rawName || e.national_id === rawName.replace(/\D/g, ''));
      if (!employee) { problems.push(`سطر ${index + 1}: "${rawName}" مش موجود`); return; }
      const month = MONTHS.findIndex((m) => m === rawMonth) + 1 || Number(rawMonth) || 0;
      if (checkPath(path).state !== 'ok') { problems.push(`سطر ${index + 1}: مسار غير صالح`); return; }
      rows.push({ key: `${index}-${employee.id}`, employeeId: employee.id, name: employee.full_name, month, year: Number(rawYear) || CURRENT_YEAR, path });
    });
    setBulkRows(rows);
    setNotice(rows.length
      ? { kind: 'ok', text: `تم تحليل ${rows.length} صف${problems.length ? ` · ${problems.length} سطر محتاج مراجعة` : ''}` }
      : { kind: 'error', text: problems[0] ?? 'مفيش صفوف صالحة' });
  }

  // ربط (واجهة فقط): بنسجل الصف في الجدول، من غير رفع حقيقي
  function linkRow(row) {
    const employee = employees.find((e) => e.id === row.employeeId);
    setFiles((prev) => [{
      id: `local-${Date.now()}-${row.employeeId}-${row.month}`,
      employee_id: row.employeeId,
      local_path: row.path,
      month: row.month,
      year: row.year,
      month_label: MONTHS[row.month - 1] ?? '',
      status: 'pending',
      employees: { full_name: employee?.full_name, national_id: employee?.national_id },
    }, ...prev]);
    setNotice({ kind: 'ok', text: `تم تسجيل مسار ${employee?.full_name} — الربط الفعلي هيتم مع الخادم المحلي` });
  }

  function linkSingle() {
    if (!entry.employeeId) return setNotice({ kind: 'error', text: 'اختار الموظف الأول' });
    if (pathCheck.state !== 'ok') return setNotice({ kind: 'error', text: pathCheck.message });
    linkRow({ employeeId: entry.employeeId, month: entry.month, year: entry.year, path: entry.path.trim() });
    resetEntry();
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((item) => item.id !== id));
    setNotice({ kind: 'ok', text: 'تم حذف السجل' });
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['الموظف', 'الرقم القومي', 'الشهر', 'السنة', 'المسار', 'حالة الربط'];
    const lines = filtered.map((f) => [
      f.employees?.full_name, f.employees?.national_id, f.month_label, f.year,
      f.local_path || '—', f.local_path ? 'مربوط' : 'غير مربوط',
    ].map(esc).join(','));
    const csv = `\uFEFF${[headers.map(esc).join(','), ...lines].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `files-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'ok', text: `تم تصدير ${filtered.length} صف` });
  }

  return (
    <section className="files-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">مركز ربط الملفات</span>
          <h2>إدارة الملفات</h2>
          <p>سجّل مسار الملف المحلي، والربط الفعلي هيتم مع الخادم المحلي</p>
        </div>
      </div>

      {/* 1) شريط الإحصائيات + مؤشر حالة الخادم */}
      <div className="stats-row">
        <StatCard icon={Link2Off} label="إجمالي الملفات المربوطة" value={linkedFiles.length} delay={0} />
        <StatCard icon={UserRound} label="الموظفين المكتملين" value={completedEmployees} delay={.06} />
        <motion.button type="button" className="server-pill glass" onClick={() => setServerOpen(true)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12, duration: .4 }}>
          <span className="status-led" />
          <span className="server-pill-text">الخادم المحلي متصل</span>
        </motion.button>
      </div>

      {/* 2) منطقة الإدخال الذكي */}
      <div className="entry-card glass">
        <div className="entry-toggle" role="group" aria-label="طريقة الإدخال">
          <button type="button" className={mode === 'single' ? 'is-active' : ''} onClick={() => setMode('single')} aria-pressed={mode === 'single'}><UserRound size={15} /> إدخال فردي</button>
          <button type="button" className={mode === 'bulk' ? 'is-active' : ''} onClick={() => setMode('bulk')} aria-pressed={mode === 'bulk'}><Table2 size={15} /> لصق مجمع من الإكسيل</button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'single' ? (
            <motion.div key="single" className="entry-body" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .25 }}>
              <div className="emp-field">
                <label htmlFor="entry-employee">الموظف</label>
                <div className="emp-input">
                  <Search size={16} />
                  <input
                    id="entry-employee"
                    value={entry.employeeQuery}
                    onChange={(e) => { setField('employeeQuery', e.target.value); setField('employeeId', ''); }}
                    placeholder="اكتب 3 حروف على الأقل للبحث"
                    aria-label="بحث عن الموظف"
                    autoComplete="off"
                  />
                  {entry.employeeQuery && <button type="button" onClick={() => { setField('employeeQuery', ''); setField('employeeId', ''); }} aria-label="مسح"><X size={15} /></button>}
                </div>
                {selectedEmployee ? (
                  <div className="entry-picked">
                    <span className="emp-avatar">{initials(selectedEmployee.full_name)}</span>
                    <div><strong>{selectedEmployee.full_name}</strong><small className="mono">{selectedEmployee.national_id}</small></div>
                    <CheckCircle2 size={17} className="entry-picked-check" />
                  </div>
                ) : entry.employeeQuery.trim().length >= 3 ? (
                  <div className="entry-suggestions">
                    {suggestions.length === 0 ? <p className="list-hint">مفيش نتيجة للبحث ده</p> : suggestions.map((employee) => (
                      <button key={employee.id} type="button" className="employee-option" onClick={() => pickEmployee(employee)}>
                        <span className="emp-avatar">{initials(employee.full_name)}</span>
                        <div><strong>{employee.full_name}</strong><small className="mono">{employee.national_id}</small></div>
                        <CheckCircle2 size={16} className="pick-check" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="entry-two">
                <div className="emp-field">
                  <label htmlFor="entry-month">الشهر</label>
                  <div className="emp-input"><select id="entry-month" value={entry.month} onChange={(e) => setField('month', Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
                </div>
                <div className="emp-field">
                  <label htmlFor="entry-year">السنة</label>
                  <div className="emp-input"><input id="entry-year" type="number" min="2000" max="2100" list="entry-year-options" value={entry.year} onChange={(e) => setField('year', e.target.value === '' ? '' : Number(e.target.value))} /></div>
                  <datalist id="entry-year-options">{YEARS.map((y) => <option key={y} value={y} />)}</datalist>
                </div>
              </div>

              <div className="emp-field span-all">
                <label htmlFor="entry-path">مسار الملف المحلي</label>
                <div className={`emp-input path-input ${pathCheck.state === 'ok' ? 'is-valid' : ''} ${pathCheck.state === 'bad' ? 'has-error' : ''}`}>
                  <span className={`kind-icon kind-icon--${pathKind}`}><KindIcon kind={pathKind} size={17} /></span>
                  <input
                    id="entry-path"
                    value={entry.path}
                    onChange={(e) => setField('path', e.target.value)}
                    placeholder="K:\files\salary.pdf"
                    dir="ltr"
                    aria-label="مسار الملف المحلي"
                    autoComplete="off"
                  />
                  <button type="button" className="path-clipboard" onClick={pasteFromClipboard} aria-label="لصق من الحافظة" title="لصق من الحافظة"><ClipboardPaste size={17} /></button>
                  <AnimatePresence>
                    {pathCheck.state !== 'empty' && (
                      <motion.span className={`path-check path-check--${pathCheck.state}`} initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .6, opacity: 0 }}>
                        {pathCheck.state === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {pathCheck.message && <span className={`path-msg path-msg--${pathCheck.state}`}>{pathCheck.message}</span>}
              </div>

              <div className="entry-actions">
                <button type="button" className="ghost-button" onClick={resetEntry}><X size={16} /> مسح</button>
                <button type="button" className="primary-button" onClick={linkSingle} disabled={pathCheck.state !== 'ok' || !entry.employeeId}><FolderOpen size={17} /> تسجيل المسار</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="bulk" className="entry-body" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .25 }}>
              <p className="list-hint bulk-hint">الصق من الإكسيل — كل سطر: الاسم أو الرقم القومي &nbsp;|&nbsp; الشهر &nbsp;|&nbsp; السنة &nbsp;|&nbsp; المسار</p>
              <div className="emp-field span-all">
                <label htmlFor="bulk-text">بيانات الإكسيل</label>
                <div className="bulk-textarea-wrap">
                  <textarea
                    id="bulk-text"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={'أحمد محمد\tيناير\t2026\tK:\\files\\ahmed.pdf\n29666777888000\tمارس\t2026\tK:\\files\\mona.xlsx'}
                    rows={7}
                    dir="ltr"
                    aria-label="لصق بيانات الإكسيل"
                  />
                  <button type="button" className="path-clipboard bulk-clip" onClick={pasteFromClipboard} aria-label="لصق من الحافظة" title="لصق من الحافظة"><ClipboardPaste size={17} /></button>
                </div>
              </div>
              <div className="entry-actions">
                <button type="button" className="ghost-button" onClick={() => { setBulkText(''); setBulkRows([]); }}><X size={16} /> مسح</button>
                <button type="button" className="primary-button" onClick={parseBulk} disabled={!bulkText.trim()}><Table2 size={17} /> تحليل البيانات</button>
              </div>

              <AnimatePresence>
                {bulkRows.length > 0 && (
                  <motion.div className="bulk-preview" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <table className="emp-table">
                      <thead><tr><th>الموظف</th><th>الفترة</th><th>المسار</th><th><span className="sr-only">إجراء</span></th></tr></thead>
                      <tbody>
                        {bulkRows.map((row) => (
                          <tr key={row.key}>
                            <td data-label="الموظف">{row.name}</td>
                            <td data-label="الفترة"><span className="mono">{MONTHS[row.month - 1] ?? '—'} {row.year}</span></td>
                            <td data-label="المسار"><span className="path-cell">{row.path}</span></td>
                            <td className="actions-cell">
                              <button type="button" className="icon-button" onClick={() => linkRow(row)} aria-label={`تسجيل مسار ${row.name}`} title="تسجيل المسار"><FolderOpen size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {notice && <motion.p className={`notice notice--${notice.kind}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{notice.text}</motion.p>}

      {/* 4) جدول إدارة البيانات */}
      <div className="files-managed">
        <div className="section-heading">
          <div><span className="section-kicker">الملفات المسجلة</span><h2>سجل الملفات</h2><p>{filtered.length} من {files.length} ملف</p></div>
          <div className="heading-actions">
            <button type="button" className="ghost-button" onClick={exportCsv} disabled={!filtered.length}><FileSpreadsheet size={16} /> تصدير إلى Excel/CSV</button>
          </div>
        </div>

        <div className="filters glass">
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الرقم القومي" aria-label="بحث في الملفات" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={15} /></button>}
          </div>
          <div className="filter-field"><label htmlFor="f-year">السنة</label><select id="f-year" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}><option value="all">كل السنين</option>{tableYears.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
          <div className="filter-field"><label htmlFor="f-month">الشهر</label><select id="f-month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}><option value="all">كل الشهور</option>{tableMonths.map((m) => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}</select></div>
          {(query || filterYear !== 'all' || filterMonth !== 'all') && <button type="button" className="ghost-button" onClick={() => { setQuery(''); setFilterYear('all'); setFilterMonth('all'); }}>مسح الفلتر</button>}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state glass"><Search size={30} /><strong>مفيش ملفات في الفلتر ده</strong><p>سجّل مسار من الأعلى أو جرّب فلتر تاني.</p></div>
        ) : (
          <div className="table-wrap glass">
            <table className="emp-table">
              <thead><tr><th>الموظف</th><th>الشهر/السنة</th><th>مسار الملف</th><th>حالة الربط</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const kind = detectKind(item.local_path);
                  return (
                    <tr key={item.id}>
                      <td data-label="الموظف">
                        <div className="emp-cell">
                          <span className="emp-avatar">{initials(item.employees?.full_name)}</span>
                          <div><strong>{item.employees?.full_name ?? '—'}</strong><small className="mono">{item.employees?.national_id ?? ''}</small></div>
                        </div>
                      </td>
                      <td data-label="الشهر/السنة"><span className="mono">{item.month_label} {item.year}</span></td>
                      <td data-label="مسار الملف">
                        <span className="path-cell">
                          <span className={`kind-icon kind-icon--${kind}`}><KindIcon kind={kind} size={15} /></span>
                          {item.local_path || <span className="muted-cell">غير مربوط</span>}
                        </span>
                      </td>
                      <td data-label="حالة الربط">
                        <span className={`link-state link-state--${item.local_path ? 'linked' : 'none'}`}>
                          {item.local_path ? <CheckCircle2 size={14} /> : <Link2Off size={14} />}
                          {item.local_path ? 'مربوط' : 'غير مربوط'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="row-actions">
                          <button type="button" className="icon-button" onClick={() => setNotice({ kind: 'warn', text: 'فتح الملف المحلي — متاح بعد ربط الخادم' })} aria-label="فتح مسار الملف" title="فتح مسار الملف"><FolderOpen size={16} /></button>
                          <button type="button" className="icon-button" onClick={() => setEditing(item)} aria-label="تعديل السجل" title="تعديل"><Pencil size={16} /></button>
                          <button type="button" className="icon-button icon-button--danger" onClick={() => removeFile(item.id)} aria-label="حذف السجل" title="حذف"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal بيانات الاتصال الوهمية */}
      <AnimatePresence>
        {serverOpen && (
          <motion.div className="modal-backdrop modal-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }} onClick={() => setServerOpen(false)}>
            <motion.div className="emp-modal glass" role="dialog" aria-modal="true" aria-labelledby="server-modal-title" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }} transition={{ duration: .26, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}>
              <div className="emp-modal-head">
                <div><span className="section-kicker">حالة الخادم</span><h2 id="server-modal-title">الخادم المحلي</h2></div>
                <button type="button" className="emp-close" onClick={() => setServerOpen(false)} aria-label="إغلاق"><X size={19} /></button>
              </div>
              <div className="server-status-head"><span className="status-led" /><strong>{FAKE_SERVER.status}</strong></div>
              <dl className="server-grid">
                {[['العنوان', FAKE_SERVER.host], ['المنفذ', FAKE_SERVER.port], ['البروتوكول', FAKE_SERVER.protocol], ['المجلد المشترك', FAKE_SERVER.share], ['زمن الاستجابة', `${FAKE_SERVER.latency} مللي ثانية`], ['آخر مزامنة', FAKE_SERVER.lastSync]].map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd className="mono">{value}</dd></div>
                ))}
              </dl>
              <p className="server-note">البيانات دي وهمية — للعرض فقط، ومفيش أي اتصال حقيقي بالسيرفر.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal التعديل */}
      <AnimatePresence>
        {editing && (
          <motion.div className="modal-backdrop modal-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }} onClick={() => setEditing(null)}>
            <motion.div className="emp-modal glass" role="dialog" aria-modal="true" aria-labelledby="edit-file-title" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }} transition={{ duration: .26, ease: [0.16, 1, 0.3, 1] }} onClick={(e) => e.stopPropagation()}>
              <div className="emp-modal-head">
                <div><span className="section-kicker">تعديل السجل</span><h2 id="edit-file-title">{editing.employees?.full_name}</h2></div>
                <button type="button" className="emp-close" onClick={() => setEditing(null)} aria-label="إغلاق"><X size={19} /></button>
              </div>
              <div className="emp-grid">
                <div className="emp-field">
                  <label htmlFor="edit-month">الشهر</label>
                  <div className="emp-input"><select id="edit-month" value={editing.month} onChange={(e) => setEditing({ ...editing, month: Number(e.target.value), month_label: MONTHS[Number(e.target.value) - 1] })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
                </div>
                <div className="emp-field">
                  <label htmlFor="edit-year">السنة</label>
                  <div className="emp-input"><input id="edit-year" type="number" min="2000" max="2100" value={editing.year} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })} /></div>
                </div>
                <div className="emp-field span-all">
                  <label htmlFor="edit-path">مسار الملف</label>
                  <div className="emp-input"><input id="edit-path" value={editing.local_path ?? ''} onChange={(e) => setEditing({ ...editing, local_path: e.target.value })} dir="ltr" placeholder="K:\files\salary.pdf" /></div>
                </div>
              </div>
              <div className="emp-form-actions">
                <button type="button" className="ghost-button" onClick={() => setEditing(null)}>إلغاء</button>
                <button type="button" className="primary-button" onClick={() => { setFiles((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...editing } : item))); setEditing(null); setNotice({ kind: 'ok', text: 'تم حفظ التعديلات' }); }}>
                  <CheckCircle2 size={17} /> حفظ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
