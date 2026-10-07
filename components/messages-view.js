'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCheck, Inbox, Loader2, MailOpen, Pencil, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'unread', label: 'غير مقروء' },
  { value: 'replied', label: 'تم الرد' },
  { value: 'pending', label: 'لم يتم الرد' },
];

export default function MessagesView({ initialMessages }) {
  const [messages, setMessages] = useState(initialMessages ?? []);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [replies, setReplies] = useState({});
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [savingMessage, setSavingMessage] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/messages', { cache: 'no-store' });
        const payload = await response.json();
        if (active && response.ok) setMessages(payload.messages ?? []);
      } catch { /* نخلي البيانات المحمّلة ظاهرة لو الاتصال المؤقت وقع */ }
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const counts = useMemo(() => ({
    all: messages.length,
    unread: messages.filter((m) => !m.is_read).length,
    replied: messages.filter((m) => m.admin_reply).length,
    pending: messages.filter((m) => !m.admin_reply).length,
  }), [messages]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (filter === 'unread' && message.is_read) return false;
      if (filter === 'replied' && !message.admin_reply) return false;
      if (filter === 'pending' && message.admin_reply) return false;
      if (!term) return true;
      const name = message.employees?.full_name ?? '';
      return name.toLowerCase().includes(term) || message.national_id.includes(term) || message.body.toLowerCase().includes(term);
    });
  }, [messages, filter, query]);

  function patchLocal(id, changes) {
    setMessages((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  // نبدأ بمحتوى الرد الموجود، أو مسودة لو الأدمن بدأ يكتب
  async function openMessage(message) {
    setOpenId(message.id);
    setReplies((prev) => (prev[message.id] !== undefined ? prev : { ...prev, [message.id]: message.admin_reply ?? '' }));
    if (!message.is_read) {
      patchLocal(message.id, { is_read: true });
      try {
        await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id, is_read: true }) });
      } catch { /* التحديث محلي، وراجع-load هيصحح */ }
    }
  }

  async function toggleRead(message) {
    const next = !message.is_read;
    patchLocal(message.id, { is_read: next });
    try {
      await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id, is_read: next }) });
    } catch (error) { patchLocal(message.id, { is_read: message.is_read }); setNotice({ kind: 'error', text: error.message }); }
  }

  async function saveMessage(message) {
    const text = String(editingMessage?.body ?? '').trim();
    const type = String(editingMessage?.message_type ?? '').trim();
    if (!text || !type) return setNotice({ kind: 'error', text: 'نص الرسالة ونوعها مطلوبين' });
    setSavingMessage(true);
    try {
      const response = await fetch('/api/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id, body: text, message_type: type }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر تعديل الرسالة');
      patchLocal(message.id, payload.message);
      setEditingMessage(null);
      setNotice({ kind: 'ok', text: 'تم تعديل الرسالة' });
    } catch (error) { setNotice({ kind: 'error', text: error.message }); }
    finally { setSavingMessage(false); }
  }

  async function deleteMessage(message) {
    if (!window.confirm('متأكد من حذف الرسالة؟ الحذف نهائي.')) return;
    setDeletingId(message.id);
    try {
      const response = await fetch('/api/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'تعذر حذف الرسالة');
      setMessages((previous) => previous.filter((item) => item.id !== message.id));
      if (openId === message.id) setOpenId(null);
      setNotice({ kind: 'ok', text: 'تم حذف الرسالة' });
    } catch (error) { setNotice({ kind: 'error', text: error.message }); }
    finally { setDeletingId(null); }
  }

  async function sendReply(message) {
    const text = (replies[message.id] ?? '').trim();
    if (text.length < 2) return setNotice({ kind: 'error', text: 'اكتب الرد قبل الإرسال' });
    setSending(true);
    try {
      const response = await fetch('/api/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id, admin_reply: text }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      patchLocal(message.id, { admin_reply: payload.message.admin_reply, replied_at: payload.message.replied_at, is_read: payload.message.is_read });
      setNotice({ kind: 'ok', text: 'تم إرسال الرد للموظف' });
    } catch (error) { setNotice({ kind: 'error', text: error.message }); }
    finally { setSending(false); }
  }

  return (
    <section className="messages-view">
      <div className="section-heading">
        <div>
          <span className="section-kicker">صندوق الوارد</span>
          <h2>رسائل الموظفين</h2>
          <p>{counts.all} رسالة · {counts.pending} بانتظار الرد</p>
        </div>
        <span className="section-badge">{counts.unread} غير مقروءة · {counts.pending} بانتظار الرد <Inbox size={16} /></span>
      </div>

      <div className="filters glass">
        <div className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الرقم القومي أو نص الرسالة" aria-label="بحث في الرسائل" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث"><X size={15} /></button>}
        </div>
        <div className="status-tabs" role="group" aria-label="تصفية الرسائل">
          {FILTERS.map((item) => (
            <button key={item.value} type="button" className={filter === item.value ? 'is-active' : ''} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}>
              {item.label} <span className="tab-count">{counts[item.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {notice && <motion.p className={`notice notice--${notice.kind}`} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onAnimationComplete={() => setTimeout(() => setNotice(null), 4000)}>{notice.text}</motion.p>}

      {filtered.length === 0 ? (
        <div className="empty-state glass">
          <MailOpen size={34} />
          <strong>{messages.length ? 'مفيش رسائل في الفلتر ده' : 'صندوق الوارد فاضي'}</strong>
          <p>{messages.length ? 'جرّب فلتر تاني أو ابحث بكلمة تانية' : 'أول ما الموظفين يبعتوا رسائل هتظهر هنا'}</p>
        </div>
      ) : (
        <ul className="message-list">
          <AnimatePresence initial={false}>
            {filtered.map((message) => {
              const isOpen = openId === message.id;
              const name = message.employees?.full_name ?? 'موظف';
              return (
                <motion.li
                  key={message.id}
                  layout
                  className={`message-card glass ${isOpen ? 'is-open' : ''} ${message.is_read ? '' : 'is-unread'} ${message.admin_reply ? 'has-reply' : ''}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: .98 }}
                >
                  <button type="button" className="message-head" onClick={() => (isOpen ? setOpenId(null) : openMessage(message))} aria-expanded={isOpen}>
                    <span className="emp-avatar">{name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('')}</span>
                    <span className="message-meta">
                      <span className="message-name">{name} {!message.is_read && <i className="dot-new" aria-label="غير مقروء" />}</span>
                      <span className="message-sub">
                        <span className="type-pill">{message.message_type}</span>
                        <span className="mono">{message.national_id}</span>
                      </span>
                    </span>
                    <span className="message-side">
                      <span className="message-date">{formatDate(message.created_at)}</span>
                      {message.admin_reply
                        ? <span className="reply-badge"><CheckCheck size={13} /> تم الرد</span>
                        : <span className="reply-badge is-pending">بانتظار الرد</span>}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div className="message-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .25 }}>
                        {editingMessage?.id === message.id ? (
                          <div className="message-edit-form">
                            <label>نوع الرسالة<input value={editingMessage.message_type} onChange={(event) => setEditingMessage((prev) => ({ ...prev, message_type: event.target.value }))} maxLength={60} /></label>
                            <label>نص الرسالة<textarea value={editingMessage.body} onChange={(event) => setEditingMessage((prev) => ({ ...prev, body: event.target.value }))} rows={4} maxLength={2000} /></label>
                            <div className="reply-actions"><button type="button" className="ghost-button" onClick={() => setEditingMessage(null)}>إلغاء</button><button type="button" className="primary-button" onClick={() => saveMessage(message)} disabled={savingMessage}>{savingMessage ? <Loader2 size={15} className="spin" /> : <Check size={15} />} حفظ التعديل</button></div>
                          </div>
                        ) : <p className="message-text">{message.body}</p>}

                        {message.admin_reply ? (
                          <div className="admin-reply">
                            <div className="reply-head"><Sparkles size={15} /><strong>رد الإدارة</strong><span>{formatDate(message.replied_at)}</span></div>
                            <p>{message.admin_reply}</p>
                          </div>
                        ) : null}

                        <div className="message-admin-actions">
                          <button type="button" className="ghost-button" onClick={() => setEditingMessage({ id: message.id, body: message.body, message_type: message.message_type })}><Pencil size={15} /> تعديل الرسالة</button>
                          <button type="button" className="ghost-button message-delete-button" onClick={() => deleteMessage(message)} disabled={deletingId === message.id}>{deletingId === message.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} حذف الرسالة</button>
                        </div>

                        <div className="reply-box">
                          <label htmlFor={`reply-${message.id}`}>
                            {message.admin_reply ? 'تعديل الرد' : 'اكتب رد الإدارة'}
                          </label>
                          <textarea
                            id={`reply-${message.id}`}
                            value={replies[message.id] ?? ''}
                            onChange={(event) => setReplies((prev) => ({ ...prev, [message.id]: event.target.value }))}
                            placeholder="اكتب ردك للموظف هنا..."
                            rows={3}
                          />
                          <div className="reply-actions">
                            <button type="button" className="ghost-button" onClick={() => toggleRead(message)}>
                              {message.is_read ? <><MailOpen size={16} /> تحديد كغير مقروء</> : <><Check size={16} /> تحديد كمقروء</>}
                            </button>
                            <button type="button" className="primary-button" onClick={() => sendReply(message)} disabled={sending}>
                              {sending ? <><Loader2 size={16} className="spin" /> جاري الإرسال...</> : <><Send size={16} /> {message.admin_reply ? 'تحديث الرد' : 'إرسال الرد'}</>}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
