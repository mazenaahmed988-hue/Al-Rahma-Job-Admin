'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardPaste, FolderOpen, HelpCircle, Table2, X } from 'lucide-react';
import { MONTHS, CURRENT_YEAR, checkPath, parseMonthValue, parseYearValue } from '@/lib/files';
import BulkLivePreview from '@/components/ui/bulk-live-preview';

/**
 * الوضع المجمع: Textarea للصق بيانات الإكسيل + زر "تحليل البيانات" + أيقونة مساعدة (❓).
 * كل سطر: الرقم القومي/الاسم &nbsp;|&nbsp; الشهر &nbsp;|&nbsp; السنة &nbsp;|&nbsp; المسار
 */
export default function FilesBulkEntry({ employees, onSubmit, busy, onOpenHelp }) {
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState([]);

  const rawLines = useMemo(
    () => bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    [bulkText],
  );

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setBulkText(text);
    } catch {
      /* المتصفح ماحظةش — المستخدم يلصق بإيده */
    }
  }

  function clear() {
    setBulkText('');
    setBulkRows([]);
  }

  function parseBulk() {
    if (!rawLines.length) return;

    const rows = [];
    const problems = [];

    rawLines.forEach((line, index) => {
      const cells = line.split(/\t|,|;/).map((c) => c.trim());
      // تخطي سطر العناوين لو اتلصق معاه
      if (index === 0 && cells.length > 1 && cells.some((c) => /اسم|مسار|name|path/i.test(c))) return;

      const [rawName, rawMonth, rawYear, rawPath] = cells;
      const path = (rawPath ?? '').replace(/^["']|["']$/g, '').trim();

      if (!rawName || !path) {
        problems.push(`سطر ${index + 1}: ناقص`);
        return;
      }

      const employee = employees.find(
        (e) => e.full_name.trim() === rawName || (e.national_id ?? '') === rawName.replace(/\D/g, ''),
      );
      if (!employee) {
        problems.push(`سطر ${index + 1}: "${rawName}" مش موجود`);
        return;
      }

      const month = parseMonthValue(rawMonth);
      const year = parseYearValue(rawYear) || CURRENT_YEAR;

      if (checkPath(path).state !== 'ok') {
        problems.push(`سطر ${index + 1}: مسار غير صالح`);
        return;
      }

      rows.push({
        key: `${index}-${employee.id}`,
        raw: line,
        employeeId: employee.id,
        name: employee.full_name,
        month,
        year,
        localPath: path,
      });
    });

    setBulkRows(rows);
  }

  return (
    <motion.div
      className="entry-body"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      <div className="entry-bulk-head">
        <p className="list-hint bulk-hint">
          الصق من الإكسيل — كل سطر: الاسم أو الرقم القومي &nbsp;|&nbsp; الشهر &nbsp;|&nbsp; السنة &nbsp;|&nbsp; المسار
        </p>
        <button type="button" className="icon-button" onClick={onOpenHelp} aria-label="إرشادات" title="إرشادات اللصق المجمع">
          <HelpCircle size={18} />
        </button>
      </div>

      <div className="emp-field span-all">
        <label htmlFor="bulk-text">بيانات الإكسيل</label>
        <div className="bulk-textarea-wrap">
          <textarea
            id="bulk-text"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'29001011501234\t3\t2026\tK:\\1.pdf\n29666777889999\t4\t2026\tK:\\2.pdf'}
            rows={7}
            dir="ltr"
            aria-label="لصق بيانات الإكسيل"
          />
          <button
            type="button"
            className="path-clipboard bulk-clip"
            onClick={pasteFromClipboard}
            aria-label="لصق من الحافظة"
            title="لصق من الحافظة"
          >
            <ClipboardPaste size={17} />
          </button>
        </div>
      </div>

      <BulkLivePreview rows={rawLines.map((raw) => {
        const parsed = bulkRows.find((r) => r.raw === raw);
        const cells = raw.split(/\t|,|;/).map((c) => c.trim());
        const employee = employees.find(
          (e) => e.full_name.trim() === cells[0] || (e.national_id ?? '') === (cells[0] ?? '').replace(/\D/g, ''),
        );
        return { raw, name: parsed?.name ?? employee?.full_name, month: parsed?.month ?? parseMonthValue(cells[1]) };
      })} />

      <div className="entry-actions">
        <button type="button" className="ghost-button" onClick={clear} disabled={busy}>
          <X size={16} /> مسح
        </button>
        <button type="button" className="primary-button" onClick={parseBulk} disabled={busy || !bulkText.trim()}>
          <Table2 size={17} /> تحليل البيانات
        </button>
      </div>

      <AnimatePresence>
        {bulkRows.length > 0 && (
          <motion.div
            className="bulk-preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className="list-hint bulk-hint">
              تم تحليل {bulkRows.length} صف — دوس على التسجيل عشان ينحفظ في السيستم.
            </p>
            <table className="emp-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الفترة</th>
                  <th>المسار</th>
                  <th><span className="sr-only">إجراء</span></th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row) => (
                  <tr key={row.key}>
                    <td data-label="الموظف">{row.name}</td>
                    <td data-label="الفترة">
                      <span className="mono">{MONTHS[row.month - 1] ?? '—'} {row.year}</span>
                    </td>
                    <td data-label="المسار">
                      <span className="path-cell">{row.localPath}</span>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => {
                          onSubmit({
                            employeeId: row.employeeId,
                            localPath: row.localPath,
                            month: row.month,
                            year: row.year,
                          });
                        }}
                        aria-label={`تسجيل مسار ${row.name}`}
                        title="تسجيل المسار"
                      >
                        <FolderOpen size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="entry-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => onSubmit(bulkRows.map((r) => ({
                  employeeId: r.employeeId,
                  localPath: r.localPath,
                  month: r.month,
                  year: r.year,
                })), { bulk: true, reset: clear })}
                disabled={busy}
              >
                <Table2 size={17} /> تسجيل كل الصفوف ({bulkRows.length})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}