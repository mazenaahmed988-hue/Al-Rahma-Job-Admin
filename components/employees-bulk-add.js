'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardPaste, Loader2, UserPlus, X } from 'lucide-react';

/**
 * إضافة مجمعة للموظفين بـ Text Area.
 * الإدمن بيلزق (الاسم مع الرقم القومي) بأي ترتيب عشوائي،
 * والسيستم بيصطاد الرقم القومي الـ 14 رقم ويعتبر الباقي هو الاسم.
 */
export default function EmployeesBulkAdd({ onClose, onSaved }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setText(value);
    } catch {
      setError('الصق الأسطر في المربع مباشرة باستخدام Ctrl+V.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setResult(null);
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return setError('الصق سطر واحد على الأقل (الاسم مع الرقم القومي).');

    setSaving(true);
    try {
      const response = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'الإضافة المجمعة فشلت');
      setResult({ saved: payload.saved?.length ?? 0, problems: payload.problems ?? [] });
      if (payload.saved?.length) onSaved?.(payload.saved);
      setText('');
    } catch (err) {
      setError(err.message || 'مفيش اتصال بالسيرفر');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="modal-backdrop modal-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }} onClick={onClose}>
      <motion.div
        className="emp-modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-bulk-title"
        initial={{ opacity: 0, scale: .92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: .95 }}
        transition={{ duration: .26, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="emp-modal-head">
          <div>
            <span className="section-kicker">إضافة مجمعة</span>
            <h2 id="emp-bulk-title">إضافة موظفين باللصق</h2>
          </div>
          <button type="button" className="emp-close" onClick={onClose} aria-label="إغلاق"><X size={19} /></button>
        </header>

        <form onSubmit={submit} className="emp-form">
          <p className="quick-drawer-hint">الصق سطر لكل موظف: الاسم مع الرقم القومي بأي ترتيب. السيستم هيصطاد الرقم القومي الـ 14 رقم ويعتبر الباقي هو الاسم.</p>
          <div className="smart-textarea-wrap">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              aria-label="أسطر الموظفين"
              placeholder={'أحمد محمد علي 29001011501234\n29001011501235 محمود عبد الله\nسعاد حسن | 29001011501236'}
            />
            <button type="button" className="path-clipboard" onClick={pasteFromClipboard} aria-label="لصق من الحافظة" title="لصق من الحافظة"><ClipboardPaste size={17} /></button>
          </div>

          {error && <p className="emp-form-error" role="alert">{error}</p>}
          {result && (
            <div className={`notice notice--${result.saved ? 'ok' : 'warn'}`} role="status">
              تمت إضافة {result.saved} موظف{result.problems.length ? ` · ${result.problems.length} سطر محتاج مراجعة` : ''}
              {result.problems.length ? <ul className="bulk-problems">{result.problems.slice(0, 6).map((problem, index) => <li key={index}>{problem.reason}</li>)}</ul> : null}
            </div>
          )}

          <div className="emp-form-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>إغلاق</button>
            <button type="submit" className="primary-button" disabled={saving || !text.trim()}>
              {saving ? <><Loader2 size={17} className="spin" /> جاري الإضافة...</> : <><UserPlus size={17} /> إضافة الموظفين</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
