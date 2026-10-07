'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';

const realtimeClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
import {
  CheckCircle2, Download, Eye, EyeOff, FileSpreadsheet, Link2Off, MoreHorizontal, Pencil, RotateCcw, Search, Trash2, UserRound, UserRoundPlus, X,
} from 'lucide-react';
import { MONTHS, detectKind, initials } from '@/lib/files';
import StatCard from '@/components/ui/stat-card';
import KindIcon from '@/components/ui/kind-icon';
import GlassModal from '@/components/ui/glass-modal';
import ConfirmDialog from '@/components/confirm-dialog';
import SmartPathProcessor from '@/components/smart-path-processor';
import QuickManagementDrawer from '@/components/quick-management-drawer';

export default function FilesView({ employees: initialEmployees, initialFiles }) {
  const [files, setFiles] = useState(initialFiles ?? []);
  const [employees, setEmployees] = useState(initialEmployees ?? []);
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [retryingId, setRetryingId] = useState(null);
  const [query, setQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  // لو السيرفر رجّع سجلات جديدة بعد ما الصفحة اتحمّلت
  useEffect(() => {
    setFiles(initialFiles ?? []);
  }, [initialFiles]);

  // تحديث سجل الملفات فوراً عند أي تغيير من البرنامج المحلي أو لوحة أخرى.
  useEffect(() => {
    const channel = realtimeClient
      .channel('admin-files-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'file_requests' }, (payload) => {
        const request = payload.new;
        const requestId = request?.payslip_id ? request : payload.old;
        if (!requestId?.payslip_id) return;
        setFiles((previous) => previous.map((file) => file.id === requestId.payslip_id
          ? { ...file, file_requests: payload.eventType === 'DELETE' ? [] : [request] }
          : file));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payslips' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setFiles((prev) => prev.filter((file) => file.id !== payload.old?.id));
          setSelectedIds((prev) => prev.filter((id) => id !== payload.old?.id));
          return;
        }
        const next = payload.new;
        if (!next?.id) return;
        setFiles((prev) => {
          const exists = prev.some((file) => file.id === next.id);
          return exists ? prev.map((file) => (file.id === next.id ? { ...file, ...next } : file)) : [next, ...prev];
        });
      })
      .subscribe();

    return () => { realtimeClient.removeChannel(channel); };
  }, []);

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

  /** اعتماد المسارات بعد مراجعة المعاينة الذكية */
  async function saveSmartBatch(rows) {
    setBusy(true);
    try {
      const response = await fetch('/api/files/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const payload = await response.json();
      if (!response.ok) {
        handleError(payload);
        return false;
      }
      setFiles((previous) => [...(payload.saved ?? []), ...previous]);
      flash('ok', `تم اعتماد ${payload.saved?.length ?? 0} مسار وإرسالها للوكيل المحلي${payload.problems?.length ? ` · ${payload.problems.length} صف محتاج مراجعة` : ''}`);
      return true;
    } catch {
      flash('error', 'مفيش اتصال بالسيرفر');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openDrawer(options = {}) {
    setDrawer({ ...options });
  }

  function handleEmployeeCreated(employee) {
    setEmployees((previous) => [...previous, employee].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar')));
    if (drawer?.rowId) window.dispatchEvent(new CustomEvent('smart-path-employee-added', { detail: { rowId: drawer.rowId, employee } }));
    setDrawer(null);
  }

  function handleEmployeeUpdated(employee) {
    setEmployees((previous) => previous.map((item) => item.id === employee.id ? { ...item, ...employee } : item));
    window.dispatchEvent(new CustomEvent('smart-path-employee-updated', { detail: { employee } }));
    setDrawer(null);
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

      setFiles((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...payload.file, employees: item.employees, file_requests: item.file_requests } : item)));
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

  async function downloadFile(item) {
    if (!item.storage_path) return flash('warn', 'الملف لسه مرفوعش على السحابة');
    try {
      // بنجيب رابط التحميل الموقّع من الـ API وبعدين بننزّل الملف نفسه كـ Blob (Force Download)
      const response = await fetch(`/api/files/download?id=${encodeURIComponent(item.id)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) return flash('error', payload?.error || 'مقدرناش نجيب رابط التحميل');
      const fileResponse = await fetch(payload.url);
      if (!fileResponse.ok) return flash('error', 'فشل تحميل الملف من السيرفر');
      const blob = await fileResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = payload.fileName || item.file_name || item.local_path?.split(/[\\/]/).pop() || 'ملف';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      flash('ok', 'بدأ تحميل الملف');
    } catch {
      flash('error', 'مفيش اتصال بالسيرفر');
    }
  }

  function toggleSelected(id) {
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  function toggleAllVisible() {
    const visibleIds = filtered.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((previous) => allSelected ? previous.filter((id) => !visibleIds.includes(id)) : [...new Set([...previous, ...visibleIds])]);
  }

  async function retryRequest(item) {
    setRetryingId(item.id);
    try {
      const response = await fetch('/api/files', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, retry: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذرت إعادة المحاولة');
      setFiles((previous) => previous.map((file) => file.id === item.id ? { ...file, ...payload.file, employees: file.employees, file_requests: [payload.request ?? { status: 'pending' }] } : file));
      flash('ok', 'رجّعنا الطلب لطابور الوكيل المحلي');
    } catch (error) { flash('error', error.message || 'مفيش اتصال بالسيرفر'); }
    finally { setRetryingId(null); }
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
      setSelectedIds((previous) => previous.filter((id) => !confirmDelete.includes(id)));
      setConfirmDelete(null);
      flash('ok', `تم حذف ${payload.deleted?.length ?? confirmDelete.length} سجل`);
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

      <div className="stats-row">
        <StatCard icon={Link2Off} label="إجمالي الملفات المربوطة" value={linkedFiles.length} delay={0} />
        <StatCard icon={UserRound} label="الموظفين المكتملين" value={completedEmployees} delay={0.06} />
      </div>

      <div className="master-control-actions">
        <button type="button" className="ghost-button" onClick={() => openDrawer({ tab: 'employee' })}><UserRoundPlus size={17} /> إدارة الموظفين السريعة</button>
      </div>

      <div className="entry-card glass">
        <SmartPathProcessor employees={employees} busy={busy} onSubmit={saveSmartBatch} onOpenDrawer={openDrawer} />
      </div>
      {notice && <motion.p className={`notice notice--${notice.kind}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{notice.text}</motion.p>}

      {/* 3) جدول إدارة البيانات */}
      <div className="files-managed">
        <div className="section-heading files-managed-heading">
        <div>
          <span className="section-kicker">الملفات المسجلة</span>
          <h2>سجل الملفات</h2>
          <p>{filtered.length} من {files.length} ملفات</p>
        </div>
        <div className="heading-actions">
          {selectedIds.length > 0 && <button type="button" className="bulk-delete-button" onClick={() => setConfirmDelete(selectedIds)}><Trash2 size={16} /> حذف المحدد ({selectedIds.length})</button>}
          <button type="button" className="ghost-button" onClick={exportCsv} disabled={!filtered.length}>
              <FileSpreadsheet size={16} /> تصدير إلى Excel/CSV
            </button>
          </div>
        </div>

        <div className="filters files-filters glass">
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
                  <th className="pick-col"><input type="checkbox" aria-label="تحديد كل الملفات الظاهرة" checked={filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))} onChange={toggleAllVisible} /></th>
                  <th>الموظف</th>
                  <th>الملف</th>
                  <th>الشهر/السنة</th>
                  <th>الحالة</th>
                  <th><span className="sr-only">إجراءات</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const kind = detectKind(item.file_name || item.local_path);
                  const queueStatus = item.file_requests?.[0]?.status;
                  const state = queueStatus === 'failed' ? 'failed' : queueStatus === 'processing' ? 'processing' : item.status === 'available' ? 'completed' : queueStatus === 'completed' ? 'completed' : 'pending';
                  const stateLabels = { completed: 'مكتمل', pending: 'قيد الانتظار', processing: 'جاري الرفع', failed: 'فشل' };
                  return (
                    <tr key={item.id} className={selectedIds.includes(item.id) ? 'is-selected' : ''}>
                      <td className="pick-col" data-label="تحديد"><input type="checkbox" aria-label={`تحديد ملف ${item.file_name || item.category}`} checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} /></td>
                      <td data-label="الموظف">
                        <div className="emp-cell">
                          <span className="emp-avatar">{initials(item.employees?.full_name)}</span>
                          <div>
                            <strong>{item.employees?.full_name ?? '—'}</strong>
                            <small className="mono">{item.employees?.national_id ?? ''}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="الملف">
                        {editing?.id === item.id ? <div className="inline-fields"><input value={editing.file_name ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, file_name: e.target.value }))} placeholder="اسم الملف" /><input value={editing.category ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, category: e.target.value }))} placeholder="القسم" /><input value={editing.local_path ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, local_path: e.target.value }))} placeholder="المسار المحلي" dir="ltr" /></div> : <div className="grid-file" title={item.local_path || ''}><span className={`kind-icon kind-icon--${kind}`}><KindIcon kind={kind} size={17} /></span><span><strong>{item.file_name || item.local_path?.split(/[\\/]/).pop() || item.category || 'ملف بدون اسم'}</strong><small>{item.category || 'عام'}</small></span></div>}
                      </td>
                      <td data-label="الشهر/السنة">
                        {editing?.id === item.id ? <div className="inline-fields inline-fields--period"><select value={editing.month ?? 1} onChange={(e) => setEditing((prev) => ({ ...prev, month: Number(e.target.value), month_label: MONTHS[Number(e.target.value) - 1] }))}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><input type="number" min="2000" max="2100" value={editing.year ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, year: Number(e.target.value) }))} /></div> : <span className="mono">{item.month_label} {item.year}</span>}
                      </td>
                      <td data-label="الحالة"><span className={`file-status-badge file-status-badge--${state}`}>{state === 'completed' ? <CheckCircle2 size={14} /> : state === 'failed' ? <Link2Off size={14} /> : null}{stateLabels[state]}</span>{state === 'failed' && <button type="button" className="retry-button" onClick={() => retryRequest(item)} disabled={retryingId === item.id} aria-label="إعادة محاولة رفع الملف" title="إعادة المحاولة">{retryingId === item.id ? <span className="spin">⟳</span> : <RotateCcw size={14} />}</button>}</td>
                      <td className="actions-cell">
                        {editing?.id === item.id ? <div className="row-actions"><button type="button" className="icon-button icon-button--success" onClick={saveEdit} disabled={busy} aria-label="حفظ التعديل" title="حفظ"><CheckCircle2 size={16} /></button><button type="button" className="icon-button" onClick={() => setEditing(null)} disabled={busy} aria-label="إلغاء التعديل" title="إلغاء"><X size={16} /></button></div> : <details className="file-action-menu"><summary className="icon-button" aria-label="إجراءات الملف"><MoreHorizontal size={17} /></summary><div className="file-action-menu-panel"><button type="button" onClick={() => downloadFile(item)}><Download size={15} /> تحميل الملف</button><button type="button" onClick={() => toggleVisibility(item)}><Eye size={15} /> {item.is_visible ? 'إخفاء من البوابة' : 'إظهار في البوابة'}</button><button type="button" onClick={() => setEditing({ ...item })}><Pencil size={15} /> تعديل البيانات</button><button type="button" className="is-danger" onClick={() => setConfirmDelete([item.id])}><Trash2 size={15} /> حذف الملف</button></div></details>}
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

      <QuickManagementDrawer
        open={Boolean(drawer)}
        employees={employees}
        onClose={() => setDrawer(null)}
        onEmployeeCreated={handleEmployeeCreated}
      />
    </section>
  );
}