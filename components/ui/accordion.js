'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * جزء قابل للطي (Accordion) — بيتستخدم جوه مركز المساعدة الموحد.
 * controlled: open يتحكم فيه الأب (عشان نسمح أكتر من جزء مفتوح في نفس الوقت).
 */
export default function Accordion({ title, badge, icon, open, onToggle, children }) {
  return (
    <div className={`accordion ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="accordion-head"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`accordion-panel-${title.replace(/\s+/g, '-')}`}
      >
        <span className="accordion-title">
          {badge && <span className="accordion-badge">{badge}</span>}
          {title}
        </span>
        <ChevronDown size={19} className="accordion-caret" aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`accordion-panel-${title.replace(/\s+/g, '-')}`}
            className="accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="accordion-content">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}