'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, Download, Eye, EyeOff, FileSpreadsheet, FolderOpen, Link2Off, Pencil, Search, Table2, Trash2, UserRound, X,
} from 'lucide-react';
import { MONTHS, detectKind, initials } from '@/lib/files';
import StatCard from '@/components/ui/stat-card';
import KindIcon from '@/components/ui/kind-icon';
import GlassModal from '@/components/ui/glass-modal';
import ConfirmDialog from '@/components/confirm-dialog';
import FilesSingleEntry from '@/components/files-single-entry';
import FilesBulkEntry from '@/components/files-bulk-entry';
import HelpCenter from '@/components/help-center';

export default function FilesView({ employees, initialFiles }) {
  const [files, setFiles] = useState(initialFiles ?? []);
  const [mode, setMode] = useState('single');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [query, setQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  // لو السيرفر رجّع سجلات جديدة بعد ما الصفحة اتحمّلت
  useEffect(() => {
    setFiles(initialFiles ?? []);
  }, [initialFiles]);

  const linkedFiles = useMemo(() => files.filter((f) => f.local_path), [files]);

  const completedEmployees = useMemo(() => {
    const ids = new Set(linkedFiles.map((f) => f.employee_id));
    return employees.filter((e) => ids.has(e.id)).length;
  }, [linkedFiles, employees]);

  const tableYears = useMemo(
    () => [...new Set(files.map((f) => f.year).filter(Boolean))].sort((a, b) => b - a),
    [files],
  );
  const tableMonths = useMemo(
    () => [...new Set(files.map((f) => f.month).filter(Boolean))].sort((a, b) => a - b),
    [files],
  );

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

  function flash(kind, text) {
    setNotice({ kind, text });
  }

  function handleError(payload) {
    flash('error', payload?.error ?? 'حصل خطأ غير متوقع');
  }

  /** تسجيل صف واحد (فردي أو من صف في المعاينة) */
  async function saveOne(row, options = {}) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('employeeId', row.employeeId);
      form.append('localPath', row.localPath);
      form.append('month', String(row.month));
      form.append('year', String(row.year));

      const res = await fetch('/api/files', { method: 'POST', body: form });
      const payload = await res.json();
      if (!res.ok) return handleError(payload);

      setFiles((prev) => [payload.payslip, ...prev]);
      flash('ok', 'تم تسجيل المسار بنجاح');
      if (options.reset) options.reset();
    } catch {
      flash('error', 'مفيش اتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  }

  /** تسجيل كل الصفوف مرة واحدة */
  async function saveBulk(rows, options = {}) {
    setBusy(true);
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const payload = await res.json();
      if (!res.ok) return handleError(payload);

      setFiles((prev) => [...payload.files, ...prev]);
      flash(
        'ok',
        `تم تسجيل ${payload.saved} مسار${payload.problems?.length ? ` · ${payload.problems.length} سطر محتاج مراجعة` : ''}`,
      );
      if (options.reset) options.reset();
    } catch {
      flash('error', 'مفيش اتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setBusy(true);
    try {
      const res = await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          local_path: editing.local_path,
          file_name: editing.file_name,
          category: editing.category,
          month: editing.month,
          year: editing.year,
        }),
      });
      const payload = await res.json();
      if (!res.ok) return handleError(payload);

      setFiles((prev) => prev.map((item) => (item.id === editing.id ? payload.file : item)));
      setEditing(null);
      flash('ok', 'تم حفظ التعديلات');
    } catch {
      flash('error', 'مفيش اتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(item) {
    setBusy(true);
    try {
      const res = await fetch('/api/files', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, is_visible: !item.is_visible }) });
      const payload = await res.json();
      if (!res.ok) return handleError(payload);
      setFiles((prev) => prev.map((file) => file.id === item.id ? payload.file : file));
      flash('ok', payload.file.is_visible ? 'الملف بقى ظاهر للموظف' : 'الملف اختفى من بوابة الموظف');
    } catch { flash('error', 'مفيش اتصال بالسيرفر'); } finally { setBusy(false); }
  }

  function downloadFile(item) {
    if (!item.storage_path) return flash('warn', 'الملف لسه مرفوعش على السحابة');
    window.open(`/api/files/download?id=${encodeURIComponent(item.id)}`, '_blank', 'noopener,noreferrer');
  }

  async function doDelete() {
    setBusy(true);
    try {
      const res = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: confirmDelete }),
      });
      const payload = await res.json();
      if (!res.ok) return handleError(payload);

      setFiles((prev) => prev.filter((item) => !confirmDelete.includes(item.id)));
      setConfirmDelete(null);
      flash('ok', 'تم حذف السجل');
    } catch {
      flash('error', 'مفيش اتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['الموظف', 'الرقم القومي', 'الشهر', 'السنة', 'المسار', 'حالة الربط'];
    const lines = filtered.map((f) => [
      f.employees?.full_name,
      f.employees?.national_id,
      f.month_label,
      f.year,
      f.local_path || '—',
      f.local_path ? 'مربوط' : 'غير مربوط',
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
    flash('ok', `تم تصدير ${filtered.length} صف`);
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

      {/* 1) شريط الإحصائيات */}
      <div className="stats-row">
        <StatCard icon={Link2Off} label="إجمالي الملفات المربوطة" value={linkedFiles.length} delay={0} />
        <StatCard icon={UserRound} label="الموظفين المكتملين" value={completedEmployees} delay={0.06} />
      </div>

      {/* 2) منطقة الإدخال الذكي — وضعان */}
      <div className="entry-card glass">
        <div className="entry-toggle" role="group" aria-label="طريقة الإدخال">
          <div className="entry-toggle-group">
            <button
              type="button"
              className={mode === 'single' ? 'is-active' : ''}
              onClick={() => setMode('single')}
              aria-pressed={mode === 'single'}
            >
              <UserRound size={15} /> إدخال فردي
            </button>
            <button
              type="button"
              className={mode === 'bulk' ? 'is-active' : ''}
              onClick={() => setMode('bulk')}
              aria-pressed={mode === 'bulk'}
            >
              <Table2 size={15} /> لصق مجمع من الإكسيل
            </button>
            <button type="button" className="help-button" onClick={() => setHelpOpen(true)} title="اقرأ التعليمات">
              <span aria-hidden="true">📖</span>
              <span>اقرأ التعليمات</span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'single' ? (
            <FilesSingleEntry
              key="single"
              employees={employees}
              onSubmit={saveOne}
              busy={busy}
              notice={notice}
            />
          ) : (
            <FilesBulkEntry
              key="bulk"
              employees={employees}
              onSubmit={saveBulk}
              busy={busy}
              onOpenHelp={() => setHelpOpen(true)}
            />
          )}
        </AnimatePresence>
      </div>

      {mode === 'bulk' && notice && (
        <motion.p
          className={`notice notice--${notice.kind}`}
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {notice.text}
        </motion.p>
      )}

      {/* 3) جدول إدارة البيانات */}
      <div className="files-managed">
        <div className="section-heading">
          <div>
            <span className="section-kicker">الملفات المسجلة</span>
            <h2>سجل الملفات</h2>
            <p>{filtered.length} من {files.length} 파일</p>
          </div>
          <div className="heading-actions">
            <button type="button" className="ghost-button" onClick={exportCsv} disabled={!filtered.length}>
              <FileSpreadsheet size={16} /> تصدير إلى Excel/CSV
            </button>
          </div>
        </div>

        <div className="filters glass">
          <div className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم القومي"
              aria-label="بحث في الملفات"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="filter-field">
            <label htmlFor="f-year">السنة</label>
            <select id="f-year" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="all">كل السنين</option>
              {tableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="f-month">الشهر</label>
            <select id="f-month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="all">كل الشهور</option>
              {tableMonths.map((m) => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}
            </select>
          </div>
          {(query || filterYear !== 'all' || filterMonth !== 'all') && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setQuery('');
                setFilterYear('all');
                setFilterMonth('all');
              }}
            >
              مسح الفلتر
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state glass">
            <Search size={30} />
            <strong>مفيش ملفات في الفلتر ده</strong>
            <p>سجّل مسار من الأعلى أو جرّب فلتر تاني.</p>
          </div>
        ) : (
          <div className="table-wrap glass">
            <table className="emp-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الشهر/السنة</th>
                  <th>مسار الملف</th>
                  <th>حالة الربط</th>
                  <th><span className="sr-only">إجراءات</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const kind = detectKind(item.local_path);
                  return (
                    <tr key={item.id}>
                      <td data-label="الموظف">
                        <div className="emp-cell">
                          <span className="emp-avatar">{initials(item.employees?.full_name)}</span>
                          <div>
                            <strong>{item.employees?.full_name ?? '—'}</strong>
                            <small className="mono">{item.employees?.national_id ?? ''}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="الاسم والقسم">
                        {editing?.id === item.id ? <div className="inline-fields"><input value={editing.file_name ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, file_name: e.target.value }))} placeholder="اسم الملف" /><input value={editing.category ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, category: e.target.value }))} placeholder="القسم" /></div> : <div><strong>{item.file_name || item.category || '—'}</strong><small className="muted-cell">{item.category || 'عام'}</small></div>}
                      </td>
                      <td data-label="الشهر/السنة">
                        {editing?.id === item.id ? <div className="inline-fields inline-fields--period"><select value={editing.month ?? 1} onChange={(e) => setEditing((prev) => ({ ...prev, month: Number(e.target.value), month_label: MONTHS[Number(e.target.value) - 1] }))}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><input type="number" min="2000" max="2100" value={editing.year ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, year: Number(e.target.value) }))} /></div> : <span className="mono">{item.month_label} {item.year}</span>}
                      </td>
                      <td data-label="مسار الملف">
                        <span className="path-cell">
                          <span className={`kind-icon kind-icon--${kind}`}>
                            <KindIcon kind={kind} size={15} />
                          </span>
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
                          <button type="button" className="icon-button icon-button--download" onClick={() => downloadFile(item)} aria-label="تحميل الملف" title="تحميل"><Download size={16} /></button>
                          <button type="button" className="icon-button" onClick={() => toggleVisibility(item)} disabled={busy} aria-label={item.is_visible ? 'إخفاء الملف' : 'إظهار الملف'} title={item.is_visible ? 'إخفاء' : 'إظهار'}>{item.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                          {editing?.id === item.id ? <><button type="button" className="icon-button icon-button--success" onClick={saveEdit} disabled={busy} aria-label="حفظ التعديل" title="حفظ"><CheckCircle2 size={16} /></button><button type="button" className="icon-button" onClick={() => setEditing(null)} disabled={busy} aria-label="إلغاء التعديل" title="إلغاء"><X size={16} /></button></> : <button type="button" className="icon-button" onClick={() => setEditing({ ...item })} aria-label="تعديل السجل" title="تعديل"><Pencil size={16} /></button>}
                          <button
                            type="button"
                            className="icon-button icon-button--danger"
                            onClick={() => setConfirmDelete([item.id])}
                            aria-label="حذف السجل"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {/* مودال التعديل */}
      <GlassModal
        open={false}
        onClose={() => setEditing(null)}
        kicker="تعديل السجل"
        title={editing?.employees?.full_name ?? ''}
        titleId="edit-file-title"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setEditing(null)} disabled={busy}>
              إلغاء
            </button>
            <button type="button" className="primary-button" onClick={saveEdit} disabled={busy}>
              {busy ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </>
        }
      >
        <div className="emp-grid">
          <div className="emp-field">
            <label htmlFor="edit-month">الشهر</label>
            <div className="emp-input">
              <select
                id="edit-month"
                value={editing?.month ?? 1}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, month: Number(e.target.value), month_label: MONTHS[Number(e.target.value) - 1] }))
                }
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="emp-field">
            <label htmlFor="edit-year">السنة</label>
            <div className="emp-input">
              <input
                id="edit-year"
                type="number"
                min="2000"
                max="2100"
                value={editing?.year ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, year: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="emp-field span-all">
            <label htmlFor="edit-path">مسار الملف</label>
            <div className="emp-input">
              <input
                id="edit-path"
                value={editing?.local_path ?? ''}
                onChange={(e) => setEditing((prev) => ({ ...prev, local_path: e.target.value }))}
                dir="ltr"
                placeholder="K:\files\salary.pdf"
              />
            </div>
          </div>
        </div>
      </GlassModal>

      {/* تأكيد الحذف */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            title="تأكيد الحذف"
            message={`هتحذف ${confirmDelete.length} سجل من سجل الملفات. العملية دي مش بترجع.`}
            busy={busy}
            onConfirm={doDelete}
            onClose={() => setConfirmDelete(null)}
          />
        )}
      </AnimatePresence>

      {/* مركز المساعدة — المحتوى بيتغير حسب القسم (مركز الملفات هنا) */}
      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} section="files" />
    </section>
  );
}