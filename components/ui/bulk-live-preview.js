'use client';

import { motion } from 'framer-motion';
import { MONTHS } from '@/lib/files';

/**
 * عيّنة حيّة من أول 3 صفوف اتلصقت — بتوضح للمستخدم قبل ما يدوس "تحليل البيانات"
 * إزاي السيستم فهم اللصق (نفس النص المعتمد في مركز المساعدة).
 */
export default function BulkLivePreview({ rows }) {
  if (!rows?.length) return null;

  return (
    <motion.div
      className="bulk-live-preview"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.25 }}
    >
      <p className="list-hint bulk-hint">
              اللي لزقته في المربع (من الإكسيل) &nbsp;·&nbsp; بعد الضغط على &apos;تحليل البيانات&apos; (السيستم بيفهم إيه)
            </p>

      <div className="help-table-wrap">
        <table className="help-table">
          <thead>
            <tr>
              <th>اللي لزقته في المربع (من الإكسيل)</th>
              <th>بعد الضغط على &apos;تحليل البيانات&apos; (السيستم بيفهم إيه)</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 3).map((row) => (
              <tr key={row.raw}>
                <td>
                  <span className="mono">{row.raw}</span>
                </td>
                <td>
                  <span className="help-cell-text">
                    {row.name
                      ? `بيعمل كارت منفصل للموظف (${row.name})، شهر (${MONTHS[row.month - 1] ?? '؟'})، ومساره جاهز`
                      : `بيعمل كارت منفصل، بس الموظف ده محتاج مراجعة`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 3 && <p className="list-hint bulk-hint">وإجمالي {rows.length} سطر.</p>}
    </motion.div>
  );
}