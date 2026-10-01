'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Building2, Files, MailOpen, MessageSquareText, ShieldCheck, TrendingUp, UsersRound } from 'lucide-react';

const CARDS = [
  { key: 'employees', icon: UsersRound, label: 'إجمالي الموظفين', tint: 'mint', href: '/dashboard/employees' },
  { key: 'files', icon: Files, label: 'إجمالي الملفات', tint: 'blue', href: '/dashboard/files' },
  { key: 'categories', icon: Building2, label: 'إجمالي الأقسام', tint: 'violet', href: '/dashboard/categories' },
  { key: 'unread', icon: MessageSquareText, label: 'رسائل غير مقروءة', tint: 'peach', href: '/dashboard/messages' },
];

function useCountUp(target) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const final = Number.isFinite(target) ? target : 0;
    if (started.current || final === 0) { setValue(final); return; }
    started.current = true;
    const duration = 750;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(final * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function StatCard({ config, value, note, index }) {
  const shown = useCountUp(value);
  const Icon = config.icon;
  return (
    <motion.a
      href={config.href}
      className={`stat-card glass ${config.tint}`}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.4 }}
    >
      <div className="stat-top">
        <div className="stat-icon"><Icon size={23} strokeWidth={1.8} /></div>
        <TrendingUp className="stat-arrow" size={18} />
      </div>
      <p>{config.label}</p>
      <strong>{shown.toLocaleString('ar-EG')}</strong>
      <span className="stat-note">{note}</span>
    </motion.a>
  );
}

function MonthlyChart({ monthly }) {
  const max = Math.max(1, ...monthly.map((month) => month.count));
  const total = monthly.reduce((sum, month) => sum + month.count, 0);
  return (
    <div className="chart-card glass">
      <div className="chart-head">
        <div>
          <span className="section-kicker">آخر 6 شهور</span>
          <h3>الملفات المرفوعة شهرياً</h3>
        </div>
        <span className="chart-badge"><Activity size={15} /> {total} ملف</span>
      </div>
      <div className="chart-bars" role="img" aria-label="رسم بياني لعدد الملفات المرفوعة في آخر 6 شهور">
        {monthly.map((month, index) => (
          <div className="chart-col" key={`${month.label}-${index}`}>
            <span className="chart-value">{month.count}</span>
            <div className="chart-track">
              <motion.span
                className="chart-fill"
                style={{ height: `${Math.max(4, (month.count / max) * 100)}%` }}
                initial={false}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.05 * index, duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="chart-label">{month.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChart({ active, inactive }) {
  const total = active + inactive;
  const percent = total ? Math.round((active / total) * 100) : 0;
  const circumference = 2 * Math.PI * 52;
  const dash = (percent / 100) * circumference;
  return (
    <div className="chart-card glass">
      <div className="chart-head">
        <div>
          <span className="section-kicker">حالة الحسابات</span>
          <h3>النشطون مقابل الموقوفين</h3>
        </div>
      </div>
      <div className="donut-wrap">
        <div className="donut-box">
          <svg viewBox="0 0 120 120" className="donut" role="img" aria-label={`الموظفون النشطون ${percent}%`}>
            <circle cx="60" cy="60" r="52" className="donut-track" />
            <motion.circle
              cx="60" cy="60" r="52" className="donut-fill"
              strokeDasharray={`${dash} ${circumference}`}
              initial={false}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="donut-center"><strong>{percent}%</strong><span>نشط</span></div>
        </div>
        <ul className="donut-legend">
          <li><span className="dot dot-active" /> نشط <strong>{active}</strong></li>
          <li><span className="dot dot-inactive" /> موقوف <strong>{inactive}</strong></li>
        </ul>
      </div>
    </div>
  );
}

export default function DashboardOverview({ stats }) {
  const employees = stats?.employees ?? 0;
  const active = stats?.active ?? 0;
  const inactive = stats?.inactive ?? 0;
  const monthly = stats?.monthly ?? [];
  const unread = stats?.unread ?? 0;
  const values = { employees, files: stats?.files ?? 0, categories: stats?.categories ?? 0, unread };
  const notes = {
    employees: employees ? `${active} نشط · ${inactive} موقوف` : 'مفيش موظفين مسجلين بعد',
    files: 'إجمالي الملفات المرفوعة للموظفين',
    categories: 'أقسام الملفات المتاحة في اللوحة',
    unread: unread ? 'رسائل محتاجة مراجعة' : 'كل الرسائل مقروءة',
  };

  return (
    <>
      <motion.div className="welcome glass" initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
        <div className="welcome-copy">
          <h1>أهلاً بيك في لوحة الإدارة <span>✦</span></h1>
        </div>
        <div className="welcome-art" aria-hidden="true"><div className="art-ring ring-outer" /><div className="art-ring ring-inner" /><ShieldCheck size={56} strokeWidth={1.25} /></div>
      </motion.div>

      <div className="section-heading">
        <div><span className="section-kicker">نظرة عامة</span><h2>إحصائيات المنصة</h2></div>
        <span className="section-badge"><MailOpen size={16} /> {unread} غير مقروءة</span>
      </div>

      <div className="stats-grid">
        {CARDS.map((config, index) => (
          <StatCard key={config.key} config={config} value={values[config.key]} note={notes[config.key]} index={index} />
        ))}
      </div>

      <div className="charts-grid">
        <MonthlyChart monthly={monthly} />
        <StatusChart active={active} inactive={inactive} />
      </div>

      <footer className="dash-footer">© {new Date().getFullYear()} الرحمة للتوظيف · لوحة الإدارة</footer>
    </>
  );
}
