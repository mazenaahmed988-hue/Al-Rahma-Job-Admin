'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2,
  RefreshCw, Search, Trash2, Upload, X,
} from 'lucide-react';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR - 3 + index);

function fileIcon(mime) {
  if (!mime) return <FileText size={19} />;
  if (mime.startsWith('image/')) return <ImageIcon size={19} />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('spreadsheet')) return <FileSpreadsheet size={19} />;
  return <FileText size={19} />;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجا`;
}

export default function FilesView({ employees, categories, initialFiles }) {
  const [files, setFiles] = useState(initialFiles ?? []);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState(categories[0]?.name ?? '');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [isVisible, setIsVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [replacingId, setReplacingId] = useState(null);
  const [filterYear, setFilterYear] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const replaceInput = useRef(null);

  const filteredEmployees = useMemo(() => {
    const term = employeeQuery.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) => e.full_name.toLowerCase().includes(term) || e.national_id.includes(term));
  }, [employees, employeeQuery]);

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  // فلترة الجدول بالسنة والقسم + تمييز المحدد
  const tableYears = useMemo(() => [...new Set(files.map((f) => f.year))].sort((a, b) => b - a), [files]);
  const tableCategories = useMemo(() => [...new Set(files.map((f) => f.category).filter(Boolean))].sort(), [files]);
  const filteredFiles = useMemo(() => files.filter((f) => {
    if (filterYear !== 'all' && String(f.year) !== String(filterYear)) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    return true;
  }), [files, filterYear, filterCategory]);

  const selectedSet = new Set(selected);
  const allVisibleSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedSet.has(f.id));

  function toggleOne(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected((prev) => {
      const visibleIds = filteredFiles.map((f) => f.id);
      const everySelected = visibleIds.every((id) => prev.includes(id));
      return everySelected ? prev.filter((id) => !visibleIds.includes(id)) : [...new Set([...prev, ...visibleIds])];
    });
  }

  function pickFile(next) {
    setError('');
    setFile(next ?? null);
  }

  function reset() {
    setFile(null); setError(''); setEmployeeId(''); setEmployeeQuery('');
  }

  async function submit(event) {
    event.preventDefault();
    setError(''); setNotice(null);
    if (!employeeId) return setError('اختار الموظف الأول');
    if (!file) return setError('اختار الملف الأول');
    if (!category) return setError('اختار القسم');
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return setError('اكتب سنة صحيحة بين 2000 و 2100');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('employeeId', employeeId);
      form.append('category', category);
      form.append('year', String(year));
      form.append('month', String(month));
      form.append('isVisible', String(isVisible));
      form.append('file', file);
      const response = await fetch('/api/files', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFiles((prev) => [{ ...payload.payslip, employees: payload.employee }, ...prev]);
      setNotice({ kind: 'ok', text: `تم رفع الملف لـ ${payload.employee.full_name} (${isVisible ? 'مرئي' : 'مخفي'})` });
      setFile(null);
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function patchFile(id, changes) {
    setBusyId(id);
    try {
      const response = await fetch('/api/files', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...changes }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, ...payload.file } : item)));
    } catch (err) { setNotice({ kind: 'error', text: err.message }); }
    finally { setBusyId(null); }
  }

  async function removeFile(id) {
    if (!window.confirm('متأكد من حذف الملف ده نهائياً؟')) return;
    setBusyId(id);
    try {
      const response = await fetch('/api/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFiles((prev) => prev.filter((item) => item.id !== id));
      setNotice({ kind: 'ok', text: 'تم حذف الملف' });
    } catch (err) { setNotice({ kind: 'error', text: err.message }); }
    finally { setBusyId(null); }
  }

  async function removeSelected() {
    const ids = selected.filter((id) => files.some((f) => f.id === id));
    if (!ids.length) return;
    if (!window.confirm(`متأكد من حذف ${ids.length} ملف نهائياً؟`)) return;
    setBusyId('bulk');
    try {
      const response = await fetch('/api/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const deleted = new Set(payload.deleted ?? ids);
      setFiles((prev) => prev.filter((item) => !deleted.has(item.id)));
      setSelected((prev) => prev.filter((id) => !deleted.has(id)));
      setNotice({ kind: 'ok', text: `تم حذف ${deleted.size} ملف` });
    } catch (err) { setNotice({ kind: 'error', text: err.message }); }
    finally { setBusyId(null); }
  }

  // استبدال: نفس السجل، بس ملف جديد مكان القديم
  function startReplace(id) {
    setReplacingId(id);
    if (replaceInput.current) { replaceInput.current.value = ''; replaceInput.current.click(); }
  }

  async function doReplace(fileToUpload) {
    if (!fileToUpload || !replacingId) return;
    setBusyId(replacingId);
    try {
      const form = new FormData();
      form.append('id', replacingId);
      form.append('file', fileToUpload);
      const response = await fetch('/api/files', { method: 'PUT', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFiles((prev) => prev.map((item) => (item.id === replacingId ? { ...item, ...payload.file } : item)));
      setNotice({ kind: 'ok', text: 'تم استبدال الملف بنجاح' });
    } catch (err) { setNotice({ kind: 'error', text: err.message }); }
    finally { setBusyId(null); setReplacingId(null); }
  }

  async function download(id) {
    setDownloadingId(id);
    try {
      const response = await fetch(`/api/files/download?id=${id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const link = document.createElement('a');
      link.href = payload.url;
      if (payload.fileName) link.download = payload.fileName;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { setNotice({ kind: 'error', text: err.message }); }
    finally { setDownloadingId(null); }
  }

  return (
    <section className="files-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">مركز إدارة الملفات</span>
          <h2>رفع الملفات</h2>
          <p>اختار الموظف، ارفع الملف، وحدد بياناته وضهوره</p>
        </div>
        <span className="section-badge">{files.length} ملف <Upload size={16} /></span>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state glass">
          <Upload size={34} />
          <strong>مفيش موظفين مسجلين بعد</strong>
          <p>ضيف موظف من صفحة "إدارة الموظفين" الأول، بعدين تقدر ترفع له ملفات</p>
        </div>
      ) : (
        <form className="upload-card glass" onSubmit={submit}>
          {/* الخطوة 1: اختيار الموظف */}
          <section className="upload-step">
            <header className="step-head"><span className="step-num">1</span><div><strong>اختر الموظف</strong><small>ابحث بالاسم أو الرقم القومي</small></div></header>
            <div className="search-box">
              <Search size={18} />
              <input value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} placeholder="اكتب اسم الموظف أو رقمه القومي" aria-label="بحث عن الموظف" />
              {employeeQuery && <button type="button" onClick={() => setEmployeeQuery('')} aria-label="مسح"><X size={15} /></button>}
            </div>
            {selectedEmployee ? (
              <div className="employee-picked">
                <span className="emp-avatar">{selectedEmployee.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')}</span>
                <div><strong>{selectedEmployee.full_name}</strong><small>{selectedEmployee.job_title} · {selectedEmployee.national_id}</small></div>
                <button type="button" className="ghost-button" onClick={() => setEmployeeId('')}>تغيير</button>
              </div>
            ) : (
              <div className="employee-results">
                {filteredEmployees.length === 0 ? (
                  <p className="list-hint">مفيش نتيجة للبحث ده</p>
                ) : filteredEmployees.slice(0, 8).map((employee) => (
                  <button key={employee.id} type="button" className="employee-option" onClick={() => { setEmployeeId(employee.id); setEmployeeQuery(''); }}>
                    <span className="emp-avatar">{employee.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')}</span>
                    <div><strong>{employee.full_name}</strong><small>{employee.job_title} · {employee.national_id}</small></div>
                    <Check size={17} className="pick-check" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* الخطوة 2: رفع الملف */}
          <section className="upload-step">
            <header className="step-head"><span className="step-num">2</span><div><strong>ارفع الملف</strong><small>PDF أو Word أو Excel أو صور · حتى 20 ميجا</small></div></header>
            {!file ? (
              <label className={`drop-zone ${dragging ? 'is-dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}>
                <input type="file" onChange={(e) => pickFile(e.target.files?.[0])} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" />
                <Upload size={26} />
                <strong>اسحب الملف هنا أو اضغط للاختيار</strong>
                <small>المسموح: PDF · Word · Excel · JPG · PNG · WEBP</small>
              </label>
            ) : (
              <div className="file-picked">
                <span className="file-picked-icon">{fileIcon(file.type)}</span>
                <div><strong>{file.name}</strong><small>{formatSize(file.size)}</small></div>
                <button type="button" className="icon-button" onClick={() => setFile(null)} aria-label="إزالة الملف"><X size={16} /></button>
              </div>
            )}
          </section>

          {/* الخطوة 3: بيانات الملف */}
          <section className="upload-step">
            <header className="step-head"><span className="step-num">3</span><div><strong>بيانات الملف</strong><small>القسم والسنة والشهر</small></div></header>
            {categories.length === 0 ? (
              <p className="list-hint warn">مفيش أقسام معرّفة. روح لصفحة "الأقسام" وضيف قسم الأول.</p>
            ) : (
              <div className="upload-fields">
                <div className="emp-field span-all">
                  <label htmlFor="file-category">القسم</label>
                  <div className="emp-input"><select id="file-category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                </div>
                <div className="emp-field">
                  <label htmlFor="file-year">السنة</label>
                  {/* كتابة يدوية + قائمة اقتراحات: تقدر تكتب أي سنة جديدة مش موجودة في القائمة */}
                  <div className="emp-input">
                    <input
                      id="file-year"
                      type="number"
                      inputMode="numeric"
                      list="file-year-options"
                      min="2000"
                      max="2100"
                      value={year}
                      onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="مثال: 2027"
                    />
                  </div>
                  <datalist id="file-year-options">{YEARS.map((y) => <option key={y} value={y} />)}</datalist>
                </div>
                <div className="emp-field">
                  <label htmlFor="file-month">الشهر</label>
                  <div className="emp-input"><select id="file-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>
                </div>
              </div>
            )}
          </section>

          {/* الخطوة 4: الظهور */}
          <section className="upload-step">
            <header className="step-head"><span className="step-num">4</span><div><strong>حالة الملف</strong><small>هل الموظف يشوف الملف ولا لأ</small></div></header>
            <label className="switch switch-large">
              <input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} aria-label="ظهور الملف للموظف" />
              <span className="switch-track"><span className="switch-thumb" /></span>
              <span className={`switch-label ${isVisible ? 'is-active' : 'is-inactive'}`}>{isVisible ? 'مرئي للموظف' : 'مخفي عن الموظف'}</span>
            </label>
          </section>

          {error && <p className="emp-form-error" role="alert">{error}</p>}

          <div className="upload-actions">
            <button type="button" className="ghost-button" onClick={reset} disabled={uploading}>مسح</button>
            <button type="submit" className="primary-button" disabled={uploading || categories.length === 0 || employees.length === 0}>
              {uploading ? <><Loader2 size={17} className="spin" /> جاري الرفع...</> : <><Upload size={17} /> رفع الملف</>}
            </button>
          </div>
        </form>
      )}

      {notice && <motion.p className={`notice notice--${notice.kind}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{notice.text}</motion.p>}

      {files.length > 0 && (
        <div className="files-managed">
          <div className="section-heading">
            <div><span className="section-kicker">الملفات المرفوعة</span><h2>إدارة الملفات</h2><p>{filteredFiles.length} من {files.length} ملف</p></div>
            {selected.length > 0 && (
              <button type="button" className="bulk-delete-button" onClick={removeSelected} disabled={busyId === 'bulk'}>
                {busyId === 'bulk' ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} حذف المحدد ({selected.length})
              </button>
            )}
          </div>

          {/* فلترة متقدمة بالسنة والقسم */}
          <div className="files-filters glass">
            <div className="filter-field">
              <label htmlFor="filter-year">السنة</label>
              <select id="filter-year" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="all">كل السنين</option>
                {tableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="filter-category">القسم</label>
              <select id="filter-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="all">كل الأقسام</option>
                {tableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {(filterYear !== 'all' || filterCategory !== 'all') && (
              <button type="button" className="ghost-button" onClick={() => { setFilterYear('all'); setFilterCategory('all'); }}>مسح الفلتر</button>
            )}
          </div>

          {filteredFiles.length === 0 ? (
            <div className="empty-state glass"><Search size={30} /><strong>مفيش ملفات في الفلتر ده</strong><p>جرّب تختار سنة أو قسم تاني.</p></div>
          ) : (
          <div className="table-wrap glass">
            <table className="emp-table">
              <thead><tr><th className="pick-col"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="تحديد كل الملفات الظاهرة" /></th><th>الملف</th><th>الموظف</th><th>القسم</th><th>الفترة</th><th>الظهور</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
              <tbody>
                {filteredFiles.map((item) => (
                  <tr key={item.id} className={selectedSet.has(item.id) ? 'is-selected' : ''}>
                    <td className="pick-col"><input type="checkbox" checked={selectedSet.has(item.id)} onChange={() => toggleOne(item.id)} aria-label={`تحديد ${item.file_name || 'الملف'}`} /></td>
                    <td data-label="الملف">
                      <div className="emp-cell">
                        <span className="file-type-icon">{fileIcon(item.mime_type)}</span>
                        <div><strong>{item.file_name || item.title || 'ملف'}</strong><small>{item.status === 'available' ? 'جاهز' : 'قيد التجهيز'}</small></div>
                      </div>
                    </td>
                    <td data-label="الموظف">{item.employees?.full_name ?? '—'}</td>
                    <td data-label="القسم">{item.category}</td>
                    <td data-label="الفترة"><span className="mono">{item.month_label} {item.year}</span></td>
                    <td data-label="الظهور">
                      <label className="switch">
                        <input type="checkbox" checked={item.is_visible} onChange={() => patchFile(item.id, { is_visible: !item.is_visible })} disabled={busyId === item.id} aria-label={`ظهور ملف ${item.file_name || ''}`} />
                        <span className="switch-track"><span className="switch-thumb" /></span>
                        <span className={`switch-label ${item.is_visible ? 'is-active' : 'is-inactive'}`}>{item.is_visible ? 'مرئي' : 'مخفي'}</span>
                      </label>
                    </td>
                    <td className="actions-cell">
                      <button type="button" className="icon-button" onClick={() => download(item.id)} aria-label={`تحميل ${item.file_name || 'الملف'}`} title="تحميل" disabled={downloadingId === item.id}>
                        {downloadingId === item.id ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                      </button>
                      <button type="button" className="icon-button" onClick={() => startReplace(item.id)} aria-label={`استبدال ${item.file_name || 'الملف'}`} title="استبدال الملف" disabled={busyId === item.id}>
                        {busyId === item.id ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                      </button>
                      <button type="button" className="icon-button icon-button--danger" onClick={() => removeFile(item.id)} aria-label={`حذف ${item.file_name || 'الملف'}`} title="حذف" disabled={busyId === item.id}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <div className="cards-list">
            {filteredFiles.map((item) => (
              <motion.article key={item.id} className="emp-card glass" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                <div className="emp-card-head">
                  <span className="file-type-icon">{fileIcon(item.mime_type)}</span>
                  <div><strong>{item.file_name || item.title || 'ملف'}</strong><span>{item.employees?.full_name} · {item.category}</span></div>
                </div>
                <dl className="emp-card-meta">
                  <div><dt>الفترة</dt><dd className="mono">{item.month_label} {item.year}</dd></div>
                  <div><dt>الحالة</dt><dd>{item.status === 'available' ? 'جاهز' : 'قيد التجهيز'}</dd></div>
                </dl>
                <div className="emp-card-foot">
                  <label className="switch">
                    <input type="checkbox" checked={item.is_visible} onChange={() => patchFile(item.id, { is_visible: !item.is_visible })} disabled={busyId === item.id} aria-label={`ظهور ملف ${item.file_name || ''}`} />
                    <span className="switch-track"><span className="switch-thumb" /></span>
                    <span className={`switch-label ${item.is_visible ? 'is-active' : 'is-inactive'}`}>{item.is_visible ? 'مرئي' : 'مخفي'}</span>
                  </label>
                  <div className="card-actions">
                    <button type="button" className="ghost-button" onClick={() => download(item.id)} disabled={downloadingId === item.id}>
                      {downloadingId === item.id ? <Loader2 size={16} className="spin" /> : <Download size={16} />} تحميل
                    </button>
                    <button type="button" className="icon-button" onClick={() => startReplace(item.id)} aria-label="استبدال الملف" title="استبدال الملف" disabled={busyId === item.id}>
                      {busyId === item.id ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                    </button>
                    <button type="button" className="icon-button icon-button--danger" onClick={() => removeFile(item.id)} aria-label="حذف" disabled={busyId === item.id}><Trash2 size={16} /></button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      )}

      {/* input مخفي بيستخدم لاختيار الملف البديل وقت الاستبدال */}
      <input
        ref={replaceInput}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        onChange={(e) => { const next = e.target.files?.[0]; if (next) doReplace(next); }}
      />
    </section>
  );
}
