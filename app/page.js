'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || user?.app_metadata?.role !== 'admin') {
        await supabase.auth.signOut();
        setError('الحساب ده مش مصرح له بالدخول للوحة الإدارة.');
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول تاني.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      {/* بدون initial=opacity:0 — لو الجافاسكريبت اتأخر أو فشل، الفورم لازم يفضل ظاهر */}
      <motion.div className="login-shell" initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <section className="login-hero">
          <div className="hero-logo"><Image src="/logo-transparent.png" alt="شعار الرحمة للتوظيف" width={420} height={292} priority /></div>
        </section>
        <section className="login-panel glass" aria-labelledby="login-title">
          <h2 id="login-title">تسجيل الدخول</h2>
          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="email">البريد الإلكتروني</label>
            <div className="field"><Mail size={19} /><input id="email" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required dir="ltr" /></div>
            <label htmlFor="password">كلمة المرور</label>
            <div className="field"><LockKeyhole size={19} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••" value={password} onChange={e => setPassword(e.target.value)} required dir="ltr" /><button type="button" className="eye-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={loading}>{loading ? 'جارٍ التحقق...' : 'دخول لوحة الإدارة'} <ArrowLeft size={18} /></button>
          </form>
        </section>
      </motion.div>
      <div className="login-copyright">© {new Date().getFullYear()} الرحمة للتوظيف · لوحة الإدارة</div>
    </main>
  );
}
