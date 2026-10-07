'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Files, LayoutDashboard, LogOut, Mail, Menu, Tags, UsersRound, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import AgentStatusBadge from '@/components/agent-status-badge';

export default function DashboardShell({ email, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isFiles = pathname?.startsWith('/dashboard/files') ?? false;
  const isMessages = pathname?.startsWith('/dashboard/messages') ?? false;
  const isEmployees = pathname?.startsWith('/dashboard/employees') ?? false;
  const isCategories = pathname?.startsWith('/dashboard/categories') ?? false;

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }
  const sidebar = (
    <>
      <div className="sidebar-brand"><span className="sidebar-logo"><Image src="/logo-transparent.png" alt="شعار الرحمة للتوظيف" width={64} height={45} /></span><div><strong>الرحمة</strong><small>لوحة الإدارة</small></div></div>
      <div className="nav-caption">القائمة الرئيسية</div>
      <nav aria-label="القائمة الرئيسية">
        <a href="/dashboard" className={`nav-item ${!isFiles && !isMessages && !isEmployees && !isCategories ? 'active' : ''}`} aria-current={!isFiles && !isMessages && !isEmployees && !isCategories ? 'page' : undefined}><LayoutDashboard size={20} /> نظرة عامة</a>
        <a href="/dashboard/employees" className={`nav-item ${isEmployees ? 'active' : ''}`} aria-current={isEmployees ? 'page' : undefined}><UsersRound size={20} /> إدارة الموظفين</a>
        <a href="/dashboard/categories" className={`nav-item ${isCategories ? 'active' : ''}`} aria-current={isCategories ? 'page' : undefined}><Tags size={20} /> أقسام الملفات</a>
        <a href="/dashboard/files" className={`nav-item ${isFiles ? 'active' : ''}`} aria-current={isFiles ? 'page' : undefined}><Files size={20} /> غرفة التحكم الشاملة</a>
        <a href="/dashboard/messages" className={`nav-item ${isMessages ? 'active' : ''}`} aria-current={isMessages ? 'page' : undefined}><Mail size={20} /> صندوق الرسائل</a>
      </nav>
      <div className="sidebar-bottom"><button onClick={signOut} disabled={signingOut} className="logout"><LogOut size={19} /> {signingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}</button></div>
    </>
  );
  return (
    <div className="dashboard-root">
      <aside className="sidebar glass">{sidebar}</aside>
      <AnimatePresence>{menuOpen && <><motion.button type="button" className="menu-backdrop" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.aside className="sidebar mobile-sidebar glass" initial={{ x: 310 }} animate={{ x: 0 }} exit={{ x: 310 }} transition={{ type: 'spring', damping: 28 }}><button type="button" className="close-menu" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}><X size={23} /></button>{sidebar}</motion.aside></>}</AnimatePresence>
      <div className="dashboard-main">
        <header className="topbar glass"><div className="topbar-start"><button className="hamburger" aria-label="فتح القائمة" type="button" onClick={() => setMenuOpen(true)}><Menu size={23} /></button><div className="breadcrumb">لوحة الإدارة <span>/</span> <strong>{isFiles ? 'غرفة التحكم الشاملة' : isMessages ? 'صندوق الرسائل' : isEmployees ? 'إدارة الموظفين' : isCategories ? 'أقسام الملفات' : 'نظرة عامة'}</strong></div></div><div className="topbar-end"><AgentStatusBadge /><span className="topbar-status"><span className="status-dot" /> لوحة المسؤول</span><div className="avatar" aria-label="حساب المسؤول">{email?.charAt(0).toUpperCase() || 'A'}</div></div></header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
