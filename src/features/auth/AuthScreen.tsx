import React, { useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { requestPasswordReset, signInWithEmail, signUpWithEmail } from './api';

type Mode = 'login' | 'register' | 'forgot';

function authErrorMessage(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (value.includes('email not confirmed')) return 'E-posta adresinizi doğruladıktan sonra giriş yapabilirsiniz.';
  if (value.includes('password should be at least')) return 'Şifre yeterince güçlü değil.';
  if (value.includes('user already registered')) return 'Bu e-posta ile daha önce hesap oluşturulmuş.';
  if (value.includes('rate limit')) return 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.';
  return raw || 'Kimlik doğrulama işlemi tamamlanamadı.';
}

export default function AuthScreen({
  onAuthenticated,
  title = 'Golden Oremar Hesabı',
  description = 'Siparişlerinizi, favorilerinizi ve satıcı işlemlerinizi güvenle yönetin.',
}: {
  onAuthenticated?: () => void;
  title?: string;
  description?: string;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Geçerli bir e-posta adresi yazın.');
      queueMicrotask(() => errorRef.current?.focus());
      return;
    }

    try {
      setBusy(true);
      if (mode === 'forgot') {
        await requestPasswordReset(normalizedEmail);
        setMessage('Şifre sıfırlama bağlantısı e-posta adresinize gönderildiyse gelen kutunuzdan devam edebilirsiniz.');
        return;
      }
      if (password.length < 8 || password.length > 72) throw new Error('Şifre 8-72 karakter arasında olmalıdır.');

      if (mode === 'login') {
        await signInWithEmail(normalizedEmail, password);
        setMessage('Giriş başarılı. Hesabınız açılıyor.');
        onAuthenticated?.();
        return;
      }

      if (displayName.trim().length < 2 || displayName.trim().length > 120) throw new Error('Ad soyad 2-120 karakter arasında olmalıdır.');
      const result = await signUpWithEmail({
        email: normalizedEmail,
        password,
        displayName,
        phone,
        locale: 'tr',
      });
      if (result.session) {
        setMessage('Hesabınız oluşturuldu ve giriş yapıldı.');
        onAuthenticated?.();
      } else {
        setMessage('Hesabınız oluşturuldu. E-posta doğrulaması açıksa gelen kutunuzdaki doğrulama bağlantısından devam edin.');
      }
    } catch (e: any) {
      setError(authErrorMessage(String(e?.message || e)));
      queueMicrotask(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto flex min-h-[70vh] max-w-lg items-center p-4 sm:p-6" aria-labelledby="auth-title">
    <section className="w-full rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-gold/10 text-brand-gold"><LockKeyhole className="h-7 w-7" /></div>
        <h1 id="auth-title" className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2" role="tablist" aria-label="Hesap işlemi">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')} className={`min-h-11 rounded-xl border font-bold ${mode === 'login' ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : ''}`}>Giriş Yap</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')} className={`min-h-11 rounded-xl border font-bold ${mode === 'register' ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : ''}`}>Hesap Aç</button>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div> : null}

        {mode === 'register' ? <>
          <label className="block"><span className="text-sm font-semibold">Ad Soyad</span><div className="relative mt-1"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" className="min-h-12 w-full rounded-xl border bg-transparent pl-11 pr-3" /></div></label>
          <label className="block"><span className="text-sm font-semibold">Telefon (opsiyonel)</span><input value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
        </> : null}

        <label className="block"><span className="text-sm font-semibold">E-posta</span><div className="relative mt-1"><Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" className="min-h-12 w-full rounded-xl border bg-transparent pl-11 pr-3" /></div></label>

        {mode !== 'forgot' ? <label className="block"><span className="text-sm font-semibold">Şifre</span><div className="relative mt-1"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="min-h-12 w-full rounded-xl border bg-transparent px-3 pr-12" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} className="absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-lg p-2 text-gray-500">{showPassword ? <EyeOff className="mx-auto h-5 w-5" /> : <Eye className="mx-auto h-5 w-5" />}</button></div>{mode === 'register' ? <span className="mt-1 block text-xs text-gray-500">En az 8 karakter kullanın.</span> : null}</label> : null}

        <button disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50">{busy ? 'İşlem yapılıyor…' : mode === 'login' ? 'Giriş Yap' : mode === 'register' ? 'Hesap Oluştur' : 'Sıfırlama Bağlantısı Gönder'}</button>
      </form>

      <div className="mt-4 text-center">
        {mode === 'login' ? <button type="button" onClick={() => switchMode('forgot')} className="min-h-11 px-3 text-sm font-semibold text-brand-gold">Şifremi unuttum</button> : mode === 'forgot' ? <button type="button" onClick={() => switchMode('login')} className="min-h-11 px-3 text-sm font-semibold text-brand-gold">Giriş ekranına dön</button> : null}
      </div>

      <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Google, Apple ve Facebook girişleri ancak ilgili Supabase sağlayıcıları ve mobil yönlendirme adresleri gerçekten yapılandırıldıktan sonra gösterilecektir. Bu sürüm sahte sosyal giriş yapmaz.</div>
    </section>
  </main>;
}
