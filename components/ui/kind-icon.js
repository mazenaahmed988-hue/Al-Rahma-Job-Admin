'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';

/** أيقونة حسب نوع الملف المتعرف عليه من الامتداد */
export default function KindIcon({ kind, size = 19 }) {
  if (kind === 'excel') return <FileSpreadsheet size={size} />;
  return <FileText size={size} />;
}