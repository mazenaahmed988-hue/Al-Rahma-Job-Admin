'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ClipboardPaste, Loader2, ScanSearch, UserRoundPlus, X } from 'lucide-react';
import { MONTHS } from '@/lib/files';
import { parsePathLine } from '@/lib/smart-path-parser';


export default function SmartPathProcessor({ employees, onOpenDrawer, onSubmit, busy }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState('');
  const [employeeMenu, setEmployeeMenu] = useState(null);

  useEffect(() => {
    const onEmployeeAdded = (event) => {
      const { rowId, employee } = event.detail ?? {};
      if (!rowId || !employee) return;
      setRows((previous) => previous.map((row) => row.id === rowId
        ? { ...row, employeeIds: [...new Set([...(row.employeeIds ?? []), employee.id])], employeeId: row.employeeId || employee.id, employeeName: [row.employeeName, employee.full_name].filter(Boolean).join('، '), nationalId: [row.nationalId, employee.national_id].filter(Boolean).join('، '), status: 'ready' }
        : row));
    };
    const onEmployeeUpdated = (event) => {
      const { employee } = event.detail ?? {};
      if (!employee) return;
      setRows((previous) => previous.map((row) => {
        const ids = row.employeeIds ?? (row.employeeId ? [row.employeeId] : []);
        if (!ids.includes(employee.id)) return row;
        const selectedEmployees = employees.filter((item) => ids.includes(item.id)).map((item) => item.id === employee.id ? employee : item);
        return { ...row, employeeName: selectedEmployees.map((item) => item.full_name).join('، '), nationalId: selectedEmployees.map((item) => item.national_id).filter(Boolean).join('، ') };
      }));
    };
    window.addEventListener('smart-path-employee-added', onEmployeeAdded);
    window.addEventListener('smart-path-employee-updated', onEmployeeUpdated);
    return () => {
      window.removeEventListener('smart-path-employee-added', onEmployeeAdded);
      window.removeEventListener('smart-path-employee-updated', onEmployeeUpdated);
    };
  }, [employees]);

  const readyCount = useMemo(() => rows.filter((row) => row.isValidPath && (row.employeeIds ?? [row.employeeId]).some(Boolean) || (row.isValidPath && row.nationalId)).length, [rows]);

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setText(value);
    } catch {
      setNotice('الصق المسارات في المربع مباشرة باستخدام Ctrl+V.');
    }
  }

  const analyze = useCallback(() => {
    const parsed = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      .map((line, index) => parsePathLine(line, index, employees));
    setRows(parsed);
    setNotice(parsed.length ? `اتحلل ${parsed.length} مسار. راجع بيانات المعاينة قبل التسجيل.` : 'الصق مسار واحد على الأقل في كل سطر.');
  }, [text, employees]);

  function updateRow(id, update) {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...update } : row));
  }

  function toggleEmployee(row, employeeId) {
    const selected = row.employeeIds ?? (row.employeeId ? [row.employeeId] : []);
    const employeeIds = selected.includes(employeeId)
      ? selected.filter((id) => id !== employeeId)
      : [...selected, employeeId];
    const selectedEmployees = employees.filter((employee) => employeeIds.includes(employee.id));
    updateRow(row.id, {
      employeeIds,
      employeeId: employeeIds[0] ?? '',
      employeeName: selectedEmployees.map((employee) => employee.full_name).join('، '),
      nationalId: selectedEmployees.map((employee) => employee.national_id).filter(Boolean).join('، '),
      status: employeeIds.length ? 'ready' : 'missing-employee',
    });
  }

  function isRowReady(row) {
    // جاهز لو المسار صالح + (موظف محدد أو الرقم القومي موجود — السيرفر هيحله وينشئ الموظف تلقائياً)
    return Boolean(row.isValidPath && ((row.employeeIds ?? [row.employeeId]).some(Boolean) || row.nationalId));
  }

  const submitPayload = useCallback((row) => ({
    employeeIds: row.employeeIds?.length ? row.employeeIds : (row.employeeId ? [row.employeeId] : []),
    nationalId: row.nationalId ?? '',
    employeeName: row.employeeName ?? '',
    localPath: row.localPath,
    month: row.month,
    year: row.year,
    category: 'شيت القبض',
    fileName: row.fileName,
  }), []);

  async function submitAll() {
    const validRows = rows.filter((row) => isRowReady(row) && row.month && row.year);
    if (!validRows.length) {
      setNotice('مفيش صفوف جاهزة للتسجيل. كمّل الموظف والقسم وتأكد من المسار.');
      return;
    }
    const success = await onSubmit(validRows.map(submitPayload));
    if (success) {
      const submitted = new Set(validRows.map((row) => row.id));
      setRows((previous) => previous.filter((row) => !submitted.has(row.id)));
      const employeeCount = validRows.reduce((total, row) => total + (row.employeeIds?.length || 1), 0);
      setNotice(`تم إرسال ${validRows.length} مسار لـ ${employeeCount} موظف للوكيل المحلي.`);
    }
  }

  return (
    <section className="smart-processor" aria-labelledby="smart-path-title">
      <header className="smart-processor-head">
        <div><span className="section-kicker">المعالجة الذكية</span><h3 id="smart-path-title">المعالجة الذكية للمسارات المتعددة</h3><p>الصق سطر لكل ملف في أي ترتيب؛ السيستم هيصطاد الرقم القومي والمسار والشهر والسنة، والقسم ثابت «شيت القبض».</p></div>
        <button type="button" className="ghost-button" onClick={() => onOpenDrawer()}><UserRoundPlus size={16} /> إدارة سريعة</button>
      </header>
      <div className="smart-textarea-wrap">
        <textarea value={text} onChange={(event) => setText(event.target.value)} onPaste={() => setRows([])} rows={5} dir="ltr" aria-label="مسارات الملفات" placeholder={'K:\\Files\\29001011501234_Salary_3_2026.pdf\nK:\\Files\\Ahmed_Mohamed_Incentive_3_2026.pdf'} />
        <button type="button" className="path-clipboard" onClick={pasteFromClipboard} aria-label="لصق المسارات من الحافظة" title="لصق من الحافظة"><ClipboardPaste size={17} /></button>
      </div>
      <div className="smart-actions">
        <button type="button" className="ghost-button" onClick={() => { setText(''); setRows([]); setNotice(''); }} disabled={busy || (!text && !rows.length)}><X size={16} /> مسح</button>
        <button type="button" className="primary-button" onClick={analyze} disabled={!text.trim() || busy}><ScanSearch size={17} /> معالجة المسارات</button>
      </div>
      {notice && <p className="smart-notice" role="status">{notice}</p>}

      <AnimatePresence>
        {rows.length > 0 && (
          <motion.div className="smart-preview" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .25 }}>
            <div className="smart-preview-head"><div><strong>معاينة المسارات</strong><span>{readyCount} جاهز من {rows.length}</span></div><button type="button" className="primary-button" onClick={submitAll} disabled={busy || readyCount === 0}>{busy ? <><Loader2 size={16} className="spin" /> جاري التسجيل...</> : <><CheckCircle2 size={16} /> اعتماد الجاهز ({readyCount})</>}</button></div>
            <div className="smart-table-scroll">
              <table className="smart-table">
                <thead><tr><th>الموظف</th><th>الشهر والسنة</th><th>المسار</th><th>الحالة</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.id} className={isRowReady(row) ? 'smart-row-ready' : 'smart-row-incomplete'}>
                    <td data-label="الموظف">
                      <div className="smart-employee-cell">
                        <button type="button" className="smart-employee-picker" aria-expanded={employeeMenu?.rowId === row.id} onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const width = Math.min(320, window.innerWidth - 24);
                          const menuHeight = Math.min(380, window.innerHeight - 24);
                          const top = rect.bottom + menuHeight + 6 <= window.innerHeight - 8
                            ? rect.bottom + 6
                            : Math.max(8, rect.top - menuHeight - 6);
                          setEmployeeMenu({ rowId: row.id, top, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), width });
                        }}>
                          <span>{(row.employeeIds ?? (row.employeeId ? [row.employeeId] : [])).length ? row.employeeName : (row.employeeName || row.nationalId || 'اختار موظف')}</span>
                          <small>{(row.employeeIds ?? (row.employeeId ? [row.employeeId] : [])).length ? `${(row.employeeIds ?? [row.employeeId]).filter(Boolean).length} موظف محدد` : 'اختيار موظف أو أكتر'}</small>
                        </button>
                        {!(row.employeeIds ?? (row.employeeId ? [row.employeeId] : [])).length && <button type="button" className="smart-add-employee" onClick={() => onOpenDrawer({ tab: 'employee', rowId: row.id, full_name: row.employeeName, national_id: row.nationalId })}><UserRoundPlus size={14} /> إضافة موظف جديد</button>}
                      </div>
                    </td>
                    <td data-label="الشهر والسنة"><div className="smart-period"><select aria-label="الشهر" value={row.month} onChange={(event) => updateRow(row.id, { month: Number(event.target.value) })}>{MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><input aria-label="السنة" inputMode="numeric" value={row.year} onChange={(event) => updateRow(row.id, { year: Number(event.target.value) })} /></div></td>
                    <td data-label="المسار"><span className="smart-path" title={row.localPath}>{row.localPath}</span>{row.pathError && <small className="smart-error">{row.pathError}</small>}</td>
                    <td data-label="الحالة"><span className={`smart-status ${isRowReady(row) ? 'is-ready' : 'is-incomplete'}`}>{isRowReady(row) ? <><CheckCircle2 size={14} /> جاهز للتسجيل</> : 'محتاج مراجعة'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="smart-preview-foot">تقدر تختار أكتر من موظف لنفس المسار. كل موظف هيتسجل له ملف وطلب مستقل للوكيل المحلي.</p>
          </motion.div>
        )}
      </AnimatePresence>
      {employeeMenu && typeof document !== 'undefined' && createPortal(
        <div className="smart-employee-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEmployeeMenu(null); }}>
          <div className="smart-employee-menu" role="dialog" aria-label="اختيار الموظفين" style={{ top: employeeMenu.top, left: employeeMenu.left, width: employeeMenu.width }}>
            <div className="smart-employee-menu-head"><strong>اختار موظف أو أكتر</strong><button type="button" onClick={() => setEmployeeMenu(null)} aria-label="إغلاق"><X size={16} /></button></div>
            <div className="smart-employee-menu-list">
              {employees.length ? employees.map((employee) => {
                const row = rows.find((item) => item.id === employeeMenu.rowId);
                const checked = (row?.employeeIds ?? (row?.employeeId ? [row.employeeId] : [])).includes(employee.id);
                return <label key={employee.id} className="smart-employee-option"><input type="checkbox" checked={checked} onChange={() => row && toggleEmployee(row, employee.id)} /><span><strong>{employee.full_name}</strong><small>{employee.national_id}</small></span></label>;
              }) : <p className="smart-employee-empty">مفيش موظفين متاحين للاختيار.</p>}
            </div>
            <button type="button" className="smart-employee-done" onClick={() => setEmployeeMenu(null)}>تم ({rows.find((row) => row.id === employeeMenu.rowId)?.employeeIds?.length ?? (rows.find((row) => row.id === employeeMenu.rowId)?.employeeId ? 1 : 0)})</button>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
