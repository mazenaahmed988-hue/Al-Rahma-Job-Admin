'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

// مؤشر نبض الوكيل المحلي — بيتسمع على قناة Supabase Realtime Presence
// البرنامج المحلي (Electron) بيعمل track على قناة agent-presence،
// وأول ما يتحط في الـ state يظهر أخضر "الوكيل متصل" — وغير كده رمادي/أحمر.
export default function AgentStatusBadge() {
  const [connected, setConnected] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let channel;
    try {
      channel = createClient().channel('agent-presence', { config: { presence: { key: 'admin-panel' } } });
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const online = state && Object.keys(state).length > 0;
          setConnected(online);
          // فشل الاتصال عند فقدان نبض الوكيل بعد فترة زمنية قصيرة
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        })
        .on('presence', { event: 'join' }, () => setConnected(true))
        .on('presence', { event: 'leave' }, () => {
          // انتظر ثانية قصيرة عشان أي إعادة اتصال سريعة من الـ agent
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            const state = channel.presenceState();
            setConnected(state && Object.keys(state).length > 0);
          }, 1500);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // الحالة الحقيقية هتتحدد من presence sync
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnected(false);
          }
        });
    } catch {
      setConnected(false);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try { channel && createClient().removeChannel(channel); } catch { /* ignore */ }
    };
  }, []);

  return (
    <span className={`agent-badge ${connected ? 'agent-badge--on' : 'agent-badge--off'}`} role="status" aria-live="polite">
      <span className="agent-badge__dot" aria-hidden="true" />
      <span className="agent-badge__label">{connected ? 'الوكيل متصل' : 'الوكيل غير متصل'}</span>
    </span>
  );
}
