'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileSpreadsheet, Loader2, Pencil, RefreshCw, Search, Trash2, UserPlus, UserRoundX, UsersRound, X } from 'lucide-react';
import EmployeeForm from '@/components/employee-form';
import ConfirmDialog from '@/components/confirm-dialog';

function initials(name) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
}

function EmployeeAvatar({ employee, signedUrl }) {
  const [failed, setFailed] = useState(false);
  const src = signedUrl ?? employee.avatarUrl;
  if (src && !failed) {
    return <span className="emp-avatar"><img src={src} alt={`صورة ${employee.full_name}`} onError={() => setFailed(true)} /></span>;
  }
  const letters = initials(employee.full_name);
  return <span className="emp-avatar" aria-hidden="true">{letters ? letters : <UserRoundX size={20} />}</span>;
}

export default function EmployeesView({ initialEmployees }) {
  const [employees, setEmployees] = useState(initialEmployees ?? []);
  const [avatars, setAvatars] = useState({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reloadError, setReloadError] = useState('');

  useEffect(() => { setEmployees(initialEmployees ?? []); }, [initialEmployees]);

  // روابط الصور الموقعة بتتحمل من الـ API (الروابط قصيرة العمر)
  useEffect(() => {
    let active = true;
    fetch('/api/employees/avatars')
      .then((response) => response.json())
      .then((payload) => { if (active && payload.avatars) setAvatars(payload.avatars); })
      .catch(() => {});
    return () => { active = false; };
  }, [employees]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (status === 'active' && !employee.is_active) return false;
      if (status === 'inactive' && employee.is_active) return false;
      if (!term) return true;
      return employee.full_name.toLowerCase().includes(term) || employee.national_id.includes(term);
    });
  }, [employees, query, status]);

  const activeCount = employees.filter((employee) => employee.is_active).length;

  function handleSaved({ type, employee, avatarUrl }) {
    if (type === 'avatar') {
      setEmployees((prev) => prev.map((item) => (item.id === employee.id ? { ...item, avatar_url: employee.avatar_url } : item)));
      if (avatarUrl) setAvatars((prev) => ({ ...prev, [employee.id]: avatarUrl }));
      setNotice({ kind: 'ok', text: 'تم تحديث صورة الموظف' });
      return;
    }
    if (type === 'created') {
      setEmployees((prev) => [...prev, employee].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar')));
      setNotice({ kind: 'ok', text: 'تمت إضافة الموظف بنجاح' });
      return;
    }
    setEmployees((prev) => prev.map((item) => (item.id === employee.id ? { ...item, ...employee } : item)));
    setNotice({ kind: 'ok', text: 'تم حفظ تعديلات الموظف' });
  }

  async function toggleStatus(employee) {
    const next = !employee.is_active;
    setTogglingId(employee.id);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'التعديل فشل');
      setEmployees((prev) => prev.map((item) => (item.id === employee.id ? { ...item, ...payload.employee } : item)));
      setNotice({ kind: next ? 'ok' : 'warn', text: next ? `تم تفعيل حساب ${employee.full_name}` : `تم إيقاف حساب ${employee.full_name}` });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message });
    } finally {
      setTogglingId(null);
    }
  }

  async function reload() {
    setReloadError('');
    setNotice(null);
    try {
      const [list, pictures] = await Promise.all([
        fetch('/api/employees').then((response) => response.json()),
        fetch('/api/employees/avatars').then((response) => response.json()),
      ]);
      if (list.error) throw new Error(list.error);
      setEmployees(list.employees ?? []);
      setAvatars(pictures.avatars ?? {});
    } catch (error) {
      setReloadError(error.message);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setBusyId(target.id);
    try {
      const response = await fetch(`/api/employees/${target.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'الحذف فشل');
      setEmployees((prev) => prev.filter((item) => item.id !== target.id));
      setAvatars((prev) => { const next = { ...prev }; delete next[target.id]; return next; });
      setNotice({ kind: 'ok', text: `تم حذف ${target.full_name}` });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message });
    } finally {
      setBusyId(null);
    }
  }

  // تصدير البيانات CSV مع BOM عشان العربي يفتح صح في Excel
  function exportData() {
    const headers = ['الاسم', 'الرقم القومي', 'الحالة'];
    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map((employee) => [
      employee.full_name,
      employee.national_id,
      employee.is_active ? 'نشط' : 'موقوف',
    ].map(escapeCell).join(','));
    const csv = `\uFEFF${[headers.map(escapeCell).join(','), ...lines].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `employees-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'ok', text: `تم تصدير ${filtered.length} موظف` });
  }

  return (
    <section className="employees-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">إدارة الموظفين</span>
          <h2>قائمة الموظفين</h2>
          <p>{employees.length} موظف · {activeCount} نشط · {employees.length - activeCount} موقوف</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="ghost-button" onClick={reload} aria-label="تحديث البيانات"><RefreshCw size={17} /></button>
          <button type="button" className="ghost-button" onClick={exportData} disabled={!filtered.length}><FileSpreadsheet size={17} /> تصدير البيانات</button>
          <button type="button" className="primary-button" onClick={() => { setEditing(null); setFormOpen(true); }}><UserPlus size={17} /> موظف جديد</button>
        </div>
      </div>

      <div className="filters glass">
        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الرقم القومي" aria-label="بحث عن موظف" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={15} /></button>}
        </div>
        <div className="status-tabs" role="group" aria-label="تصفية الحالة">
          {[['all', 'الكل'], ['active', 'نشط'], ['inactive', 'موقوف']].map(([value, label]) => (
            <button key={value} type="button" className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)} aria-pressed={status === value}>{label}</button>
          ))}
        </div>
      </div>

      {notice && (
        <motion.p className={`notice notice--${notice.kind}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{notice.text}</motion.p>
      )}
      {reloadError && <p className="notice notice--error" role="alert">{reloadError}</p>}

      {filtered.length === 0 ? (
        <div className="empty-state glass">
          <UsersRound size={34} />
          <strong>{employees.length ? 'مفيش نتائج للبحث ده' : 'لسه مفيش موظفين مسجلين'}</strong>
          <p>{employees.length ? 'جرّب اسم تاني أو رقم قومي تاني' : 'ابدأ بإضافة أول موظف في الفريق'}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap glass">
            <table className="emp-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الرقم القومي</th>
                  <th>الحالة</th>
                  <th><span className="sr-only">إجراءات</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id} className={employee.is_active ? '' : 'row-inactive'}>
                    <td data-label="الموظف">
                      <div className="emp-cell">
                        <EmployeeAvatar employee={employee} signedUrl={avatars[employee.id]} />
                        <div>
                          <strong>{employee.full_name}</strong>
                        </div>
                      </div>
                    </td>
                    <td data-label="الرقم القومي"><span className="mono">{employee.national_id}</span></td>
                    <td data-label="الحالة">
                      <label className="switch">
                        <input type="checkbox" checked={employee.is_active} onChange={() => toggleStatus(employee)} disabled={togglingId === employee.id} aria-label={`حالة ${employee.full_name}`} />
                        <span className="switch-track"><span className="switch-thumb" /></span>
                        <span className={`switch-label ${employee.is_active ? 'is-active' : 'is-inactive'}`}>{employee.is_active ? 'نشط' : 'موقوف'}</span>
                      </label>
                    </td>
                    <td className="actions-cell">
                      <div className="row-actions">
                        <button type="button" className="icon-button" onClick={() => { setEditing(employee); setFormOpen(true); }} aria-label={`تعديل ${employee.full_name}`} title="تعديل">
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="icon-button icon-button--danger" onClick={() => setDeleting(employee)} disabled={busyId === employee.id} aria-label={`حذف ${employee.full_name}`} title="حذف">
                          {busyId === employee.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cards-list">
            {filtered.map((employee) => (
              <motion.article key={employee.id} className={`emp-card glass ${employee.is_active ? '' : 'card-inactive'}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
                <div className="emp-card-head">
                  <EmployeeAvatar employee={employee} signedUrl={avatars[employee.id]} />
                  <div>
                    <strong>{employee.full_name}</strong>
                  </div>
                  <div className="emp-card-actions">
                    <button type="button" className="icon-button" onClick={() => { setEditing(employee); setFormOpen(true); }} aria-label={`تعديل ${employee.full_name}`}><Pencil size={16} /></button>
                    <button type="button" className="icon-button icon-button--danger" onClick={() => setDeleting(employee)} disabled={busyId === employee.id} aria-label={`حذف ${employee.full_name}`}>
                      {busyId === employee.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
                <dl className="emp-card-meta">
                  <div><dt>الرقم القومي</dt><dd className="mono">{employee.national_id}</dd></div>
                </dl>
                <div className="emp-card-foot">
                  <label className="switch">
                    <input type="checkbox" checked={employee.is_active} onChange={() => toggleStatus(employee)} disabled={togglingId === employee.id} aria-label={`حالة ${employee.full_name}`} />
                    <span className="switch-track"><span className="switch-thumb" /></span>
                    <span className={`switch-label ${employee.is_active ? 'is-active' : 'is-inactive'}`}>{employee.is_active ? 'نشط' : 'موقوف'}</span>
                  </label>
                </div>
              </motion.article>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {formOpen && <EmployeeForm employee={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={handleSaved} />}
      </AnimatePresence>

      <AnimatePresence>
        {deleting && (
          <ConfirmDialog
            title="حذف الموظف"
            message={`متأكد إنك عايز تحذف ${deleting.full_name}؟ هتتمسح كمان كل ملفاته المرتبطة من السجل، ورسائله هتفضل محفوظة من غير ربط بحسابه. الخطوة دي مش بترجع تاني.`}
            confirmLabel="حذف الموظف"
            busy={busyId === deleting.id}
            onConfirm={confirmDelete}
            onClose={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
        </section>
      );
    }
