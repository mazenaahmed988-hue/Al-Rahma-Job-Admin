'use client';

import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, FileText, FolderOpen, LayoutDashboard, Mail, Tags, UsersRound } from 'lucide-react';
import GlassModal from '@/components/ui/glass-modal';
import Accordion from '@/components/ui/accordion';
import { HELP_SECTION_ORDER, HELP_SECTIONS } from '@/lib/help-content';

// أيقونة كل قسم — lucide عشان تبقى موحّدة مع باقي اللوحة (مفيش إيموجي)
const SECTION_ICONS = {
  overview: LayoutDashboard,
  employees: UsersRound,
  files: FolderOpen,
  categories: Tags,
  messages: Mail,
};

export default function HelpCenter({ open, onClose, section }) {
  const sectionKey = HELP_SECTIONS[section] ? section : 'overview';
  const [tab, setTab] = useState(sectionKey);
  const [openParts, setOpenParts] = useState(() => [0]);

  // كل ما القسم يتغير، نرجع لأول تبويب ونفتح أول جزء
  const activeKey = useMemo(() => (HELP_SECTIONS[tab] ? tab : sectionKey), [tab, sectionKey]);

  function selectTab(key) {
    setTab(key);
    setOpenParts([0]);
  }

  function togglePart(index) {
    setOpenParts((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  const active = HELP_SECTIONS[activeKey];

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      size="lg"
      kicker="مركز المساعدة الموحد"
      title={<><BookOpen size={20} /> اقرأ التعليمات</>}
      titleId="help-center-title"
      footer={
        <button type="button" className="primary-button" onClick={onClose}>
          <CheckCircle2 size={17} /> فهمت، شكراً
        </button>
      }
    >
      <div className="help-center">
        {/* تابات الأقسام — بيتغيرون حسب القسم اللي المستخدم واقف فيه */}
        <div className="help-tabs" role="tablist" aria-label="أقسام اللوحة">
          {HELP_SECTION_ORDER.map((key) => {
            const item = HELP_SECTIONS[key];
            const TabIcon = SECTION_ICONS[key] ?? FileText;
            const isActive = key === activeKey;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`help-tab ${isActive ? 'is-active' : ''}`}
                onClick={() => selectTab(key)}
              >
                <TabIcon size={15} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="help-body help-center-body">
          <p className="help-lead">
            أنت دلوقتي في قسم: <strong>{active.label}</strong>
          </p>

          {active.parts.map((part, index) => (
            <Accordion
              key={part.title}
              title={part.title}
              open={openParts.includes(index)}
              onToggle={() => togglePart(index)}
            >
              {part.goal && (
                <p className="accordion-goal">
                  <strong>الهدف:</strong> {part.goal}
                </p>
              )}

              {part.list && (
                <ol className="help-steps">
                  {part.list.map((step, i) => (
                    <li key={step.label}>
                      <span className="help-step-badge">{i + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {part.table && (
                <div className="help-table-wrap">
                  <table className="help-table">
                    <thead>
                      <tr>
                        {part.table.head.map((cell) => (
                          <th key={cell}>{cell}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {part.table.rows.map((row) => (
                        <tr key={row.join('|')}>
                          {row.map((cell, i) => (
                            <td key={cell}>{i === 0 ? cell : <span className="help-cell-text">{cell}</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {part.note && (
                <div className="help-note">
                  <span className="help-note-icon" aria-hidden="true">💡</span>
                  <div>
                    <strong>{part.note.title}</strong>
                    <p>{part.note.text}</p>
                  </div>
                </div>
              )}
            </Accordion>
          ))}
        </div>
      </div>
    </GlassModal>
  );
}