'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Plus, Tags, UserRoundPlus, X } from 'lucide-react';

export default function QuickManagementDrawer({ open, initialTab = 'employee', employees = [], categories = [], suggestedName = '', suggestedNationalId = '', onClose, onEmployeeCreated, onEmployeeUpdated, onCategoryCreated, onCategoryUpdated }) {
  const [tab, setTab] = useState(initialTab);
  const [employee, setEmployee] = useState({ full_name: '', national_id: '' });
  const [categoryName, setCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setEmployee({ full_name: suggestedName, national_id: suggestedNationalId });
    setCategoryName('');
    setError('');
  }, [open, initialTab, suggestedName, suggestedNationalId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  async function addEmployee(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'إضافة الموظف ما نجحتش');
      onEmployeeCreated(payload.employee);
      onClose();
    } catch (err) {
      setError(err.message || 'مفيش اتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'إضافة القسم ما نجحتش');
      onCategoryCreated(payload.category);
      onClose();
    } catch (err) {
      setError(err.message || 'مفيش اتصال بالسيرفر');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button type="button" className="quick-drawer-backdrop" aria-label="إغلاق الدرج" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside className="quick-drawer glass" role="dialog" aria-modal="true" aria-labelledby="quick-drawer-title" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 280 }}>
            <header className="quick-drawer-head">
              <div><span className="section-kicker">غرفة التحكم الشاملة</span><h2 id="quick-drawer-title">إضافة سريعة لربط الملفات</h2></div>
              <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق" disabled={busy}><X size={19} /></button>
            </header>
            <div className="quick-drawer-tabs" role="tablist" aria-label="نوع الإدارة">
              <button type="button" role="tab" aria-selected={tab === 'employee'} className={tab === 'employee' ? 'is-active' : ''} onClick={() => { setTab('employee'); setError(''); }}><UserRoundPlus size={16} /> موظف</button>
              <button type="button" role="tab" aria-selected={tab === 'category'} className={tab === 'category' ? 'is-active' : ''} onClick={() => { setTab('category'); setError(''); }}><Tags size={16} /> قسم</button>
            </div>
            <div className="quick-drawer-content">
              {tab === 'employee' ? (
                <>
                  <div className="quick-management-list">
                    <strong>إضافة موظف سريع</strong>
                    <p className="quick-drawer-hint">الإدارة الشاملة للموظفين موجودة في القائمة الرئيسية تحت «إدارة الموظفين».</p>
                  </div>
                  <form className="quick-form" onSubmit={addEmployee}>
                  <strong>إضافة موظف جديد</strong>
                  <div className="emp-field"><label htmlFor="quick-employee-name">اسم الموظف</label><div className="emp-input"><input id="quick-employee-name" autoFocus value={employee.full_name} onChange={(e) => setEmployee((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="الاسم بالكامل" minLength={3} required /></div></div>
                  <div className="emp-field"><label htmlFor="quick-employee-nid">الرقم القومي</label><div className="emp-input"><input id="quick-employee-nid" inputMode="numeric" dir="ltr" maxLength={14} value={employee.national_id} onChange={(e) => setEmployee((prev) => ({ ...prev, national_id: e.target.value.replace(/\D/g, '').slice(0, 14) }))} placeholder="14 رقم" required /></div></div>
                  <p className="quick-drawer-hint">الموظف هيتضاف كموظف نشط ويتحدد تلقائياً في معاينة المسار.</p>
                  {error && <p className="notice notice--error" role="alert">{error}</p>}
                  <button className="primary-button" type="submit" disabled={busy}>{busy ? <><Loader2 size={17} className="spin" /> جاري الحفظ...</> : <><UserRoundPlus size={17} /> إضافة الموظف</>}</button>
                  </form>
                </>
              ) : (
                <>
                  <div className="quick-management-list">
                    <strong>إضافة قسم سريع</strong>
                    <p className="quick-drawer-hint">الأقسام الحالية: {categories.length ? categories.map((category) => category.name).join('، ') : 'لسه مفيش أقسام'}.</p>
                  </div>
                  <form className="quick-form" onSubmit={addCategory}>
                  <strong>إضافة قسم جديد</strong>
                  <div className="emp-field"><label htmlFor="quick-category-name">اسم القسم الجديد</label><div className="emp-input"><input id="quick-category-name" autoFocus maxLength={60} value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="مثال: مفردات مرتب" required minLength={2} /></div></div>
                  <p className="quick-drawer-hint">الأقسام المتاحة دلوقتي: {categories.length ? categories.map((category) => category.name).join('، ') : 'لسه مفيش أقسام'}</p>
                  {error && <p className="notice notice--error" role="alert">{error}</p>}
                  <button className="primary-button" type="submit" disabled={busy}>{busy ? <><Loader2 size={17} className="spin" /> جاري الحفظ...</> : <><Plus size={17} /> إضافة القسم</>}</button>
                  </form>
                </>
              )}
              <div className="quick-drawer-current" aria-live="polite"><Check size={16} /> الإضافات الجديدة بتظهر فوراً في معاينة ربط الملفات</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
