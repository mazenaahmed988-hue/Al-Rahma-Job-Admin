'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * مودال زجاجي مشترك (.glass + .modal-backdrop).
 * بياخد kicker وعنوان و children وأزرار سفلية اختيارية.
 */
export default function GlassModal({
  open,
  onClose,
  title,
  titleId,
  kicker,
  children,
  footer,
  size = 'md',
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop modal-backdrop--center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
        >
          <motion.div
            className={`emp-modal glass help-modal help-modal--${size}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="emp-modal-head">
              <div>
                {kicker && <span className="section-kicker">{kicker}</span>}
                <h2 id={titleId}>{title}</h2>
              </div>
              <button type="button" className="emp-close" onClick={onClose} aria-label="إغلاق">
                <X size={19} />
              </button>
            </div>

            {children}

            {footer && <div className="emp-form-actions">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}