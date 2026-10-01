'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function ConfirmDialog({ title, message, confirmLabel = 'حذف', busy = false, onConfirm, onClose }) {
  return (
    <motion.div className="modal-backdrop modal-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} onClick={busy ? undefined : onClose}>
      <motion.div
        className="confirm-dialog glass"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        initial={{ opacity: 0, scale: .92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: .95 }}
        transition={{ duration: .26, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon"><AlertTriangle size={22} /></div>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>إلغاء</button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={busy} autoFocus>
            <Trash2 size={17} /> {busy ? 'جارٍ الحذف...' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}