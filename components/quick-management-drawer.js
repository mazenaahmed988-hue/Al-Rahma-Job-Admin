'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ClipboardPaste, Loader2, UserPlus, X } from 'lucide-react';

export default function QuickManagementDrawer({ open, initialTab = 'employee', employees = [], onClose, onEmployeeCreated }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setText('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setText(value);
    } catch {
      setError('الصق الأسطر في المربع مباشرة باستخدام Ctrl+V.');
    }
  }

  async function addEmployees(event) {
    event.preventDefault();
    setError('');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return setError('الصق سطر واحد على الأقل (الاسم مع الرقم القومي).');
    setBusy(true);
    try {
      const response = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'الإضافة المجمعة فشلت');
      (payload.saved ?? []).forEach((employee) => onEmployeeCreated?.(employee));
      setText('');
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
              <div><span className="section-kicker">غرفة التحكم الشاملة</span><h2 id="quick-drawer-title">إضافة موظفين باللصق</h2></div>
              <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق" disabled={busy}><X size={19} /></button>
            </header>
            <div className="quick-drawer-content">
              <div className="quick-management-list">
                <strong>الإضافة المجمعة</strong>
                <p className="quick-drawer-hint">الصق سطر لكل موظف: الاسم مع الرقم القومي بأي ترتيب. السيستم هيصطاد الرقم القومي الـ 14 رقم ويعتبر الباقي هو الاسم.</p>
              </div>
              <form className="quick-form" onSubmit={addEmployees}>
                <div className="smart-textarea-wrap">
                  <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} aria-label="أسطر الموظفين" placeholder={'أحمد محمد علي 29001011501234\n29001011501235 محمود عبد الله'} />
                  <button type="button" className="path-clipboard" onClick={pasteFromClipboard} aria-label="لصق من الحافظة" title="لصق من الحافظة"><ClipboardPaste size={17} /></button>
                </div>
                {error && <p className="notice notice--error" role="alert">{error}</p>}
                <button className="primary-button" type="submit" disabled={busy || !text.trim()}>{busy ? <><Loader2 size={17} className="spin" /> جاري الحفظ...</> : <><UserPlus size={17} /> إضافة الموظفين</>}</button>
              </form>
              <div className="quick-drawer-current" aria-live="polite"><Check size={16} /> الإضافات بتظهر فوراً في معاينة ربط الملفات</div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
