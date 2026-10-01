'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FolderOpen, Loader2, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';

export default function CategoriesView({ initialCategories }) {
  const [categories, setCategories] = useState(initialCategories ?? []);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  function flash(kind, text) { setNotice({ kind, text }); }

  async function create(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return flash('error', 'اسم القسم لازم يكون حرفين على الأقل');
    setBusy('create');
    try {
      const response = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setCategories((prev) => [...prev, payload.category].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setName('');
      flash('ok', `تمت إضافة قسم "${trimmed}"`);
    } catch (error) { flash('error', error.message); }
    finally { setBusy(null); }
  }

  async function rename(category) {
    const trimmed = editName.trim();
    if (trimmed.length < 2) return flash('error', 'اسم القسم لازم يكون حرفين على الأقل');
    setBusy(category.id);
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimmed }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setCategories((prev) => prev.map((item) => (item.id === category.id ? payload.category : item)).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setEditing(null);
      flash('ok', 'تم تعديل اسم القسم');
    } catch (error) { flash('error', error.message); }
    finally { setBusy(null); }
  }

  async function remove(category) {
    if (!window.confirm(`متأكد من حذف قسم "${category.name}"؟`)) return;
    setBusy(category.id);
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
      flash('ok', `تم حذف قسم "${category.name}"`);
    } catch (error) { flash('error', error.message); }
    finally { setBusy(null); }
  }

  return (
    <section className="categories-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">إدارة الأقسام</span>
          <h2>أقسام الملفات</h2>
          <p>الأقسام دي بتظهر في شاشة رفع الملفات، والمستخدم يختار منها</p>
        </div>
        <span className="section-badge">{categories.length} قسم <Tags size={16} /></span>
      </div>

      <form className="category-add glass" onSubmit={create}>
        <div className="search-box">
          <Plus size={18} />
          <input value={name} onChange={(event) => { setName(event.target.value); if (notice?.kind === 'error') setNotice(null); }} placeholder="اكتب اسم القسم الجديد (مثلاً: مفردات مرتب)" aria-label="اسم القسم الجديد" maxLength={60} />
        </div>
        <button className="primary-button" type="submit" disabled={busy === 'create'}>
          {busy === 'create' ? <><Loader2 size={17} className="spin" /> جاري الإضافة...</> : <><Plus size={17} /> إضافة قسم</>}
        </button>
      </form>

      {notice && <motion.p className={`notice notice--${notice.kind}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{notice.text}</motion.p>}

      {categories.length === 0 ? (
        <div className="empty-state glass"><FolderOpen size={34} /><strong>مفيش أقسام لسه</strong><p>ابدأ بإضافة أول قسم زي "مفردات مرتب"</p></div>
      ) : (
        <ul className="category-list">
          {categories.map((category) => (
            <motion.li key={category.id} className="category-item glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} layout>
              {editing?.id === category.id ? (
                <>
                  <div className="search-box">
                    <Pencil size={17} />
                    <input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="تعديل اسم القسم" maxLength={60} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') rename(category); if (e.key === 'Escape') setEditing(null); }} />
                  </div>
                  <div className="category-actions">
                    <button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="إلغاء"><X size={16} /></button>
                    <button className="icon-button icon-button--save" type="button" onClick={() => rename(category)} disabled={busy === category.id} aria-label="حفظ">
                      {busy === category.id ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="category-name"><span className="category-dot" /><strong>{category.name}</strong></div>
                  <div className="category-actions">
                    <button className="icon-button" type="button" onClick={() => { setEditing(category); setEditName(category.name); }} aria-label={`تعديل ${category.name}`} title="تعديل"><Pencil size={16} /></button>
                    <button className="icon-button icon-button--danger" type="button" onClick={() => remove(category)} disabled={busy === category.id} aria-label={`حذف ${category.name}`} title="حذف">
                      {busy === category.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
