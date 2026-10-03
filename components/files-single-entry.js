'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, CheckCircle2, ClipboardPaste, FolderOpen, Search, X,
} from 'lucide-react';
import { MONTHS, YEARS, checkPath, cleanPath, detectKind, initials } from '@/lib/files';
import KindIcon from '@/components/ui/kind-icon';

/**
 * الوضع الفردي: بحث الموظف (auto-complete من 3 حروف) + شهر + سنة + مسار الملف المحلي مع زر اللصق.
 */
export default function FilesSingleEntry({ employees, onSubmit, busy, notice }) {
  const [entry, setEntry] = useState({
    employeeId: '',
    employeeQuery: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    path: '',
  });

  const pathCheck = checkPath(entry.path);
  const pathKind = detectKind(entry.path);

  const suggestions = useMemo(() => {
    const term = entry.employeeQuery.trim().toLowerCase();
    if (term.length < 3) return [];
    return employees
      .filter((e) => e.full_name.toLowerCase().includes(term) || (e.national_id ?? '').includes(term))
      .slice(0, 6);
  }, [employees, entry.employeeQuery]);

  const selectedEmployee = employees.find((e) => e.id === entry.employeeId);

  function setField(name, value) {
    setEntry((prev) => ({ ...prev, [name]: value }));
  }

  function pickEmployee(employee) {
    setEntry((prev) => ({ ...prev, employeeId: employee.id, employeeQuery: employee.full_name }));
  }

  function resetEntry() {
    setEntry({
      employeeId: '',
      employeeQuery: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      path: '',
    });
  }

  // زر اللصق (📋) — بيكتب المسار اللي المستخدم انسخه
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      setField('path', cleanPath(text.split(/\r?\n/)[0]));
    } catch {
      /* المتصفح مسمحش بالقراءة — المستخدم يلصق بإيده */
    }
  }

  function submit() {
    onSubmit({
      employeeId: entry.employeeId,
      localPath: cleanPath(entry.path),
      month: entry.month,
      year: entry.year,
    });
  }

  return (
    <motion.div
      className="entry-body"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      <div className="emp-field">
        <label htmlFor="entry-employee">الموظف</label>
        <div className="emp-input">
          <Search size={16} />
          <input
            id="entry-employee"
            value={entry.employeeQuery}
            onChange={(e) => {
              setField('employeeQuery', e.target.value);
              setField('employeeId', '');
            }}
            placeholder="اكتب 3 حروف على الأقل للبحث"
            aria-label="بحث عن الموظف"
            autoComplete="off"
          />
          {entry.employeeQuery && (
            <button
              type="button"
              onClick={() => {
                setField('employeeQuery', '');
                setField('employeeId', '');
              }}
              aria-label="مسح"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {selectedEmployee ? (
          <div className="entry-picked">
            <span className="emp-avatar">{initials(selectedEmployee.full_name)}</span>
            <div>
              <strong>{selectedEmployee.full_name}</strong>
              <small className="mono">{selectedEmployee.national_id}</small>
            </div>
            <CheckCircle2 size={17} className="entry-picked-check" />
          </div>
        ) : entry.employeeQuery.trim().length >= 3 ? (
          <div className="entry-suggestions">
            {suggestions.length === 0 ? (
              <p className="list-hint">مفيش نتيجة للبحث ده</p>
            ) : (
              suggestions.map((employee) => (
                <button key={employee.id} type="button" className="employee-option" onClick={() => pickEmployee(employee)}>
                  <span className="emp-avatar">{initials(employee.full_name)}</span>
                  <div>
                    <strong>{employee.full_name}</strong>
                    <small className="mono">{employee.national_id}</small>
                  </div>
                  <CheckCircle2 size={16} className="pick-check" />
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="entry-two">
        <div className="emp-field">
          <label htmlFor="entry-month">الشهر</label>
          <div className="emp-input">
            <select
              id="entry-month"
              value={entry.month}
              onChange={(e) => setField('month', Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="emp-field">
          <label htmlFor="entry-year">السنة</label>
          <div className="emp-input">
            <input
              id="entry-year"
              type="number"
              min="2000"
              max="2100"
              list="entry-year-options"
              value={entry.year}
              onChange={(e) => setField('year', e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <datalist id="entry-year-options">
            {YEARS.map((y) => <option key={y} value={y} />)}
          </datalist>
        </div>
      </div>

      <div className="emp-field span-all">
        <label htmlFor="entry-path">مسار الملف المحلي</label>
        <div
          className={`emp-input path-input ${pathCheck.state === 'ok' ? 'is-valid' : ''} ${pathCheck.state === 'bad' ? 'has-error' : ''
            }`}
        >
          <span className={`kind-icon kind-icon--${pathKind}`}>
            <KindIcon kind={pathKind} size={17} />
          </span>
          <input
            id="entry-path"
            value={entry.path}
            onChange={(e) => setField('path', cleanPath(e.target.value))}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData('text').split(/\r?\n/)[0];
              setField('path', cleanPath(pasted));
            }}
            placeholder="K:\files\salary.pdf"
            dir="ltr"
            aria-label="مسار الملف المحلي"
            autoComplete="off"
          />
          <button
            type="button"
            className="path-clipboard"
            onClick={pasteFromClipboard}
            aria-label="لصق من الحافظة"
            title="لصق من الحافظة"
          >
            <ClipboardPaste size={17} />
          </button>
          <AnimatePresence>
            {pathCheck.state !== 'empty' && (
              <motion.span
                className={`path-check path-check--${pathCheck.state}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                {pathCheck.state === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {pathCheck.message && <span className={`path-msg path-msg--${pathCheck.state}`}>{pathCheck.message}</span>}
      </div>

      {notice && (
        <p className={`notice notice--${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}

      <div className="entry-actions">
        <button type="button" className="ghost-button" onClick={resetEntry} disabled={busy}>
          <X size={16} /> مسح
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={submit}
          disabled={busy || pathCheck.state !== 'ok' || !entry.employeeId}
        >
          <FolderOpen size={17} /> {busy ? 'جارٍ الحفظ...' : 'تسجيل المسار'}
        </button>
      </div>
    </motion.div>
  );
}