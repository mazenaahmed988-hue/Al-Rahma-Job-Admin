'use client';

import { Archive, FileImage, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';

/** أيقونة حسب نوع الملف المتعرف عليه من الامتداد */
export default function KindIcon({ kind, size = 19 }) {
  if (kind === 'excel') return <FileSpreadsheet size={size} />;
  if (kind === 'word') return <FileType2 size={size} />;
  if (kind === 'image') return <FileImage size={size} />;
  if (kind === 'archive') return <Archive size={size} />;
  return <FileText size={size} />;
}