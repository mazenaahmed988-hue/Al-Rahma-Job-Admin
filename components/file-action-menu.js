'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';

/**
 * قائمة إجراءات الملف — بتـ render عبر Portal على document.body
 * عشان تطفو فوق كل الطبقات ومتتقصش جوه الجدول أو الكارت (مشكلة الـ overflow على الموبايل).
 */
export default function FileActionMenu({ item, busy, onDownload, onToggleVisibility, onEdit, onDelete }) {
  const [pos, setPos] = useState(null);
  const menuId = `file-menu-${item.id}`;

  function open(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(230, window.innerWidth - 24);
    const menuHeight = 230;
    // لو مفيش مساحة تحت، نفتح فوق الزرار
    const top = rect.bottom + menuHeight + 8 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - menuHeight - 8);
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    setPos({ top, left, width });
  }

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onKey = (event) => { if (event.key === 'Escape') setPos(null); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  return (
    <>
      <button
        type="button"
        className="icon-button file-action-trigger"
        onClick={open}
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        aria-controls={pos ? menuId : undefined}
        aria-label="إجراءات الملف"
        title="إجراءات الملف"
      >
        {pos ? <X size={17} /> : <MoreHorizontal size={17} />}
      </button>
      {pos && typeof document !== 'undefined' && createPortal(
        <div className="file-action-portal" onMouseDown={(event) => { if (event.target === event.currentTarget) setPos(null); }}>
          <div className="file-action-menu-panel" id={menuId} role="menu" style={{ top: pos.top, left: pos.left, width: pos.width }}>
            <button type="button" role="menuitem" onClick={() => { setPos(null); onDownload(item); }}><Download size={15} /> تحميل الملف</button>
            <button type="button" role="menuitem" onClick={() => { setPos(null); onToggleVisibility(item); }}>{item.is_visible ? <EyeOff size={15} /> : <Eye size={15} />} {item.is_visible ? 'إخفاء من البوابة' : 'إظهار في البوابة'}</button>
            <button type="button" role="menuitem" onClick={() => { setPos(null); onEdit({ ...item }); }}><Pencil size={15} /> تعديل البيانات</button>
            <button type="button" role="menuitem" className="is-danger" disabled={busy} onClick={() => { setPos(null); onDelete([item.id]); }}><Trash2 size={15} /> حذف الملف</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
