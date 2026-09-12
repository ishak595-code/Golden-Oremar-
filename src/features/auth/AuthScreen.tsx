import React, { useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import {
  getSocialAuthAvailability,
  requestPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  startSocialAuth,
  type SocialAuthProvider,
} from './api';

type Mode = 'login' | 'register' | 'forgot';

const providerLabels: Record<SocialAuthProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
};

function authErrorMessage(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes('native_auth_redirect_not_configured')) return 'Mobil şifre sıfırlama bağlantısı henüz güvenli dönüş adresine bağlanmamış. Lütfen destek ile iletişime geçin.';
  if (value.includes('social_auth_redirect_not_configured')) return 'Sosyal giriş için güvenli uygulama dönüş adresi henüz yapılandırılmamış.';
  if (value.includes('social_provider_not_configured')) return 'Bu sosyal giriş sağlayıcısı henüz Golden Oremar hesabına güvenli biçimde bağlanmamış.';
  if (value.includes('provider is not enabled') || value.includes('unsupported provider')) return 'Bu sosyal giriş sağlayıcısı Supabase tarafında henüz etkin değil.';
  if (value.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (value.includes('email not confirmed')) return 'E-posta adresinizi doğruladıktan sonra giriş yapabilirsiniz.';
  if (value.includes('password should be at least')) return 'Şifre yeterince güçlü değil.';
  if (value.includes('user already registered')) return 'Bu e-posta ile daha önce hesap oluşturulmuş.';
  if (value.includes('rate limit')) return 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.';
  return raw || 'Kimlik doğrulama işlemi tamamlanamadı.';
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validOptionalPhone(value: string) {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized.length > 40 || /[\u0000-\u001F\u007F]/.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 20;
}

function SocialProviderButton({
  provider,
  busy,
  interactionBusy,
  focusClass,
  onClick,
}: {
  provider: SocialAuthProvider;
  busy: boolean;
  interactionBusy: boolean;
  focusClass: string;
  onClick: () => void;
}) {
  const label = providerLabels[provider];
  const mark = provider === 'google' ? 'G' : provider === 'facebook' ? 'f' : 'A';
  return <button type="button" disabled={interactionBusy} onClick={onClick} aria-label={`${label} ile güvenli giriş yap`} className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-300 bg-white px-4 font-bold text-gray-900 shadow-sm transition-all hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:hover:bg-gray-900 ${focusClass}`}>
    <span aria-hidden="true" className={`grid h-7 w-7 place-items-center text-sm font-black ${provider === 'apple' ? 'rounded-lg bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'rounded-full border-2'}`}>{mark}</span>
    {busy ? `${label} açılıyor…` : `${label} ile devam et`}
  </button>;
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
  const socialAvailability = getSocialAuthAvailability();
  const hasSocialAuth = socialAvailability.google || socialAvailability.facebook || socialAvailability.apple;
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function tabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: 'login' | 'register') {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'login' : event.key === 'End' ? 'register' : current === 'login' ? 'register' : 'login';
    switchMode(next);
    queueMicrotask(() => (next === 'login' ? loginTabRef.current : registerTabRef.current)?.focus());
  }

  async function socialSignIn(provider: SocialAuthProvider) {
    setError('');
    setMessage('');
    try {
      setSocialBusy(provider);
      await startSocialAuth(provider);
      setMessage(`${providerLabels[provider]} güvenli giriş penceresi açıldı. İşlemi tamamladıktan sonra Golden Oremar'a geri döneceksiniz.`);
    } catch (e: any) {
      setError(authErrorMessage(String(e?.message || e)));
      queueMicrotask(() => errorRef.current?.focus());
    } finally {
      setSocialBusy(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!validEmail(normalizedEmail)) {
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
      if (password.length < 8 || password.length > 72 || /[\u0000-\u001F\u007F]/.test(password)) throw new Error('Şifre 8-72 karakter arasında olmalı ve kontrol karakteri içermemelidir.');

      if (mode === 'login') {
        await signInWithEmail(normalizedEmail, password);
        setMessage('Giriş başarılı. Hesabınız açılıyor.');
        onAuthenticated?.();
        return;
      }

      const normalizedName = displayName.trim().replace(/\s+/g, ' ');
      if (normalizedName.length < 2 || normalizedName.length > 120 || /[\u0000-\u001F\u007F]/.test(normalizedName)) throw new Error('Ad soyad 2-120 karakter arasında olmalıdır.');
      if (!validOptionalPhone(phone)) throw new Error('Telefon numarası girildiğinde 7 ile 20 rakam içermelidir.');
      if (password !== confirmPassword) throw new Error('Şifre ve şifre tekrarı aynı olmalıdır.');

      const result = await signUpWithEmail({
        email: normalizedEmail,
        password,
        displayName: normalizedName,
        phone: phone.trim(),
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

  const interactionBusy = busy || socialBusy !== null;
  const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold';
  const panelLabelId = mode === 'register' ? 'auth-register-tab' : 'auth-login-tab';

  return <main className="mx-auto flex min-h-[70vh] max-w-lg items-center p-4 sm:p-6" aria-labelledby="auth-title">
    <section className="w-full rounded-3xl border-2 border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-7" aria-busy={interactionBusy}>
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-green/10 text-brand-green"><LockKeyhole aria-hidden="true" className="h-8 w-8" /></div>
        <h1 id="auth-title" className="mt-4 text-2xl font-black">{mode === 'forgot' ? 'Şifrenizi Sıfırlayın' : title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{mode === 'forgot' ? 'Hesabınıza bağlı e-posta adresini yazın. Varsa güvenli sıfırlama bağlantısı e-posta ile gönderilir.' : description}</p>
      </div>

      {mode !== 'forgot' ? <div className="mt-6 grid grid-cols-2 gap-2" role="tablist" aria-label="Hesap işlemi">
        <button ref={loginTabRef} id="auth-login-tab" type="button" role="tab" aria-selected={mode === 'login'} aria-controls="auth-form-panel" tabIndex={mode === 'login' ? 0 : -1} disabled={interactionBusy} onKeyDown={event => tabKeyDown(event, 'login')} onClick={() => switchMode('login')} className={`min-h-11 rounded-xl border-2 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${focusClass} ${mode === 'login' ? 'border-brand-green bg-brand-green/10 text-brand-green shadow-sm' : 'border-gray-200 hover:border-brand-gold/30 hover:bg-brand-gold/5 dark:border-gray-700'}`}>Giriş Yap</button>
        <button ref={registerTabRef} id="auth-register-tab" type="button" role="tab" aria-selected={mode === 'register'} aria-controls="auth-form-panel" tabIndex={mode === 'register' ? 0 : -1} disabled={interactionBusy} onKeyDown={event => tabKeyDown(event, 'register')} onClick={() => switchMode('register')} className={`min-h-11 rounded-xl border-2 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${focusClass} ${mode === 'register' ? 'border-brand-green bg-brand-green/10 text-brand-green shadow-sm' : 'border-gray-200 hover:border-brand-gold/30 hover:bg-brand-gold/5 dark:border-gray-700'}`}>Hesap Aç</button>
      </div> : null}

      {mode !== 'forgot' && hasSocialAuth ? <div className="mt-5 space-y-3" aria-label="Sosyal hesap ile devam et">
        {socialAvailability.google ? <SocialProviderButton provider="google" busy={socialBusy === 'google'} interactionBusy={interactionBusy} focusClass={focusClass} onClick={() => void socialSignIn('google')} /> : null}
        {socialAvailability.facebook ? <SocialProviderButton provider="facebook" busy={socialBusy === 'facebook'} interactionBusy={interactionBusy} focusClass={focusClass} onClick={() => void socialSignIn('facebook')} /> : null}
        {socialAvailability.apple ? <SocialProviderButton provider="apple" busy={socialBusy === 'apple'} interactionBusy={interactionBusy} focusClass={focusClass} onClick={() => void socialSignIn('apple')} /> : null}
        <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /><span className="text-xs font-semibold text-gray-400">veya e-posta ile</span><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>
      </div> : null}

      <div id="auth-form-panel" role={mode === 'forgot' ? undefined : 'tabpanel'} aria-labelledby={mode === 'forgot' ? undefined : panelLabelId}>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">⚠ {error}</div> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">✓ {message}</div> : null}

        {mode === 'register' ? <>
          <label htmlFor="auth-display-name" className="block"><span className="text-sm font-bold">Ad Soyad <span className="text-red-500" aria-label="zorunlu">*</span></span><div className="relative mt-1"><UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input id="auth-display-name" value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,120))} minLength={2} maxLength={120} autoComplete="name" required disabled={interactionBusy} placeholder="Adınız ve soyadınız" className={`min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent pl-11 pr-3 transition-colors hover:border-brand-gold/30 focus:border-brand-green disabled:opacity-60 disabled:cursor-not-allowed ${focusClass}`} /></div></label>
          <label htmlFor="auth-phone" className="block"><span className="text-sm font-bold">Telefon <span className="font-normal text-gray-500 dark:text-gray-400">(opsiyonel)</span></span><input id="auth-phone" value={phone} onChange={e => setPhone(e.target.value.slice(0,40))} maxLength={40} autoComplete="tel" inputMode="tel" disabled={interactionBusy} placeholder="+90 555 123 4567" aria-describedby="auth-phone-help" className={`mt-1 min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent px-3 transition-colors hover:border-brand-gold/30 focus:border-brand-green disabled:opacity-60 disabled:cursor-not-allowed ${focusClass}`} /><span id="auth-phone-help" className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">7 ile 20 rakam içeren uluslararası veya yerel biçim (ör. +90 555 123 4567).</span></label>
        </> : null}

        <label htmlFor="auth-email" className="block"><span className="text-sm font-bold">E-posta <span className="text-red-500" aria-label="zorunlu">*</span></span><div className="relative mt-1"><Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value.slice(0,254))} maxLength={254} autoComplete="email" inputMode="email" enterKeyHint={mode === 'forgot' ? 'done' : 'next'} required disabled={interactionBusy} placeholder="ornek@email.com" className={`min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent pl-11 pr-3 transition-colors hover:border-brand-gold/30 focus:border-brand-green disabled:opacity-60 disabled:cursor-not-allowed ${focusClass}`} /></div></label>

        {mode !== 'forgot' ? <label htmlFor="auth-password" className="block"><span className="text-sm font-bold">Şifre <span className="text-red-500" aria-label="zorunlu">*</span></span><div className="relative mt-1"><input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value.slice(0,72))} minLength={8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} enterKeyHint={mode === 'login' ? 'done' : 'next'} required disabled={interactionBusy} placeholder={mode === 'register' ? 'En az 8 karakter' : 'Şifrenizi girin'} aria-describedby={mode === 'register' ? 'auth-password-help' : undefined} className={`min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent px-3 pr-12 transition-colors hover:border-brand-gold/30 focus:border-brand-green disabled:opacity-60 disabled:cursor-not-allowed ${focusClass}`} /><button type="button" disabled={interactionBusy} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} className={`absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-lg p-2 text-gray-500 transition-all hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-800 ${focusClass}`}>{showPassword ? <EyeOff aria-hidden="true" className="mx-auto h-5 w-5" /> : <Eye aria-hidden="true" className="mx-auto h-5 w-5" />}</button></div>{mode === 'register' ? <span id="auth-password-help" className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">Güvenli bir şifre için en az 8 karakter kullanın. Büyük harf, küçük harf, rakam ve özel karakter karıştırmanız önerilir.</span> : null}</label> : null}

        {mode === 'register' ? <label htmlFor="auth-confirm-password" className="block"><span className="text-sm font-bold">Şifre Tekrarı <span className="text-red-500" aria-label="zorunlu">*</span></span><div className="relative mt-1"><input id="auth-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.slice(0,72))} minLength={8} maxLength={72} autoComplete="new-password" enterKeyHint="done" required disabled={interactionBusy} placeholder="Şifrenizi tekrar girin" className={`min-h-12 w-full rounded-xl border-2 border-brand-border bg-transparent px-3 pr-12 transition-colors hover:border-brand-gold/30 focus:border-brand-green disabled:opacity-60 disabled:cursor-not-allowed ${focusClass}`} /><button type="button" disabled={interactionBusy} onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? 'Şifre tekrarını gizle' : 'Şifre tekrarını göster'} className={`absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-lg p-2 text-gray-500 transition-all hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-800 ${focusClass}`}>{showConfirmPassword ? <EyeOff aria-hidden="true" className="mx-auto h-5 w-5" /> : <Eye aria-hidden="true" className="mx-auto h-5 w-5" />}</button></div></label> : null}

        <button type="submit" disabled={interactionBusy} className={`min-h-12 w-full rounded-xl border-2 border-brand-green bg-brand-green px-4 font-bold text-white shadow-lg transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${focusClass}`}>{busy ? 'İşlem yapılıyor…' : mode === 'login' ? 'Giriş Yap' : mode === 'register' ? 'Hesap Oluştur' : 'Sıfırlama Bağlantısı Gönder'}</button>
      </form>
      </div>

      <div className="mt-4 text-center">
        {mode === 'login' ? <button type="button" disabled={interactionBusy} onClick={() => switchMode('forgot')} className={`min-h-11 rounded-lg px-3 text-sm font-bold text-brand-green transition-all hover:bg-brand-gold/5 disabled:opacity-50 disabled:cursor-not-allowed ${focusClass}`}>Şifremi unuttum</button> : mode === 'forgot' ? <button type="button" disabled={interactionBusy} onClick={() => switchMode('login')} className={`min-h-11 rounded-lg px-3 text-sm font-bold text-brand-green transition-all hover:bg-brand-gold/5 disabled:opacity-50 disabled:cursor-not-allowed ${focusClass}`}>Giriş ekranına dön</button> : null}
      </div>

      {!hasSocialAuth ? <div className="mt-5 rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">ℹ️ Google, Facebook ve Apple girişleri yalnız ilgili sağlayıcı Golden Oremar için gerçekten yapılandırıldığında görünür. Bu sürüm çalışmayan sosyal giriş butonu göstermez.</div> : null}
    </section>
  </main>;
}
