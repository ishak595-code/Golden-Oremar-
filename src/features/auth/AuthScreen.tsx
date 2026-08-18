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
  const hasSocialAuth = socialAvailability.google || socialAvailability.facebook;
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
      setMessage(`${provider === 'google' ? 'Google' : 'Facebook'} güvenli giriş penceresi açıldı. İşlemi tamamladıktan sonra Golden Oremar'a geri döneceksiniz.`);
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
    <section className="w-full rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7" aria-busy={interactionBusy}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-green/10 text-brand-green"><LockKeyhole aria-hidden="true" className="h-7 w-7" /></div>
        <h1 id="auth-title" className="mt-4 text-2xl font-bold">{mode === 'forgot' ? 'Şifrenizi Sıfırlayın' : title}</h1>
        <p className="mt-2 text-sm text-gray-500">{mode === 'forgot' ? 'Hesabınıza bağlı e-posta adresini yazın. Varsa güvenli sıfırlama bağlantısı e-posta ile gönderilir.' : description}</p>
      </div>

      {mode !== 'forgot' ? <div className="mt-6 grid grid-cols-2 gap-2" role="tablist" aria-label="Hesap işlemi">
        <button ref={loginTabRef} id="auth-login-tab" type="button" role="tab" aria-selected={mode === 'login'} aria-controls="auth-form-panel" tabIndex={mode === 'login' ? 0 : -1} disabled={interactionBusy} onKeyDown={event => tabKeyDown(event, 'login')} onClick={() => switchMode('login')} className={`min-h-11 rounded-xl border font-bold disabled:opacity-50 ${focusClass} ${mode === 'login' ? 'border-brand-green bg-brand-green/10 text-brand-green' : ''}`}>Giriş Yap</button>
        <button ref={registerTabRef} id="auth-register-tab" type="button" role="tab" aria-selected={mode === 'register'} aria-controls="auth-form-panel" tabIndex={mode === 'register' ? 0 : -1} disabled={interactionBusy} onKeyDown={event => tabKeyDown(event, 'register')} onClick={() => switchMode('register')} className={`min-h-11 rounded-xl border font-bold disabled:opacity-50 ${focusClass} ${mode === 'register' ? 'border-brand-green bg-brand-green/10 text-brand-green' : ''}`}>Hesap Aç</button>
      </div> : null}

      {mode !== 'forgot' && hasSocialAuth ? <div className="mt-5 space-y-3" aria-label="Sosyal hesap ile devam et">
        {socialAvailability.google ? <button type="button" disabled={interactionBusy} onClick={() => void socialSignIn('google')} className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 font-bold text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:hover:bg-gray-900 ${focusClass}`}>
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border text-sm font-black">G</span>
          {socialBusy === 'google' ? 'Google açılıyor…' : 'Google ile devam et'}
        </button> : null}
        {socialAvailability.facebook ? <button type="button" disabled={interactionBusy} onClick={() => void socialSignIn('facebook')} className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 font-bold text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:hover:bg-gray-900 ${focusClass}`}>
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border text-sm font-black">f</span>
          {socialBusy === 'facebook' ? 'Facebook açılıyor…' : 'Facebook ile devam et'}
        </button> : null}
        <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /><span className="text-xs font-semibold text-gray-400">veya e-posta ile</span><span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" /></div>
      </div> : null}

      <div id="auth-form-panel" role={mode === 'forgot' ? undefined : 'tabpanel'} aria-labelledby={mode === 'forgot' ? undefined : panelLabelId}>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">{message}</div> : null}

        {mode === 'register' ? <>
          <label htmlFor="auth-display-name" className="block"><span className="text-sm font-semibold">Ad Soyad</span><div className="relative mt-1"><UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input id="auth-display-name" value={displayName} onChange={e => setDisplayName(e.target.value.slice(0,120))} minLength={2} maxLength={120} autoComplete="name" required disabled={interactionBusy} className={`min-h-12 w-full rounded-xl border bg-transparent pl-11 pr-3 disabled:opacity-60 ${focusClass}`} /></div></label>
          <label htmlFor="auth-phone" className="block"><span className="text-sm font-semibold">Telefon <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="auth-phone" value={phone} onChange={e => setPhone(e.target.value.slice(0,40))} maxLength={40} autoComplete="tel" inputMode="tel" disabled={interactionBusy} aria-describedby="auth-phone-help" className={`mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60 ${focusClass}`} /><span id="auth-phone-help" className="mt-1 block text-xs text-gray-500">Girerseniz 7 ile 20 rakam içeren uluslararası veya yerel biçim kullanın.</span></label>
        </> : null}

        <label htmlFor="auth-email" className="block"><span className="text-sm font-semibold">E-posta</span><div className="relative mt-1"><Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value.slice(0,254))} maxLength={254} autoComplete="email" inputMode="email" required disabled={interactionBusy} className={`min-h-12 w-full rounded-xl border bg-transparent pl-11 pr-3 disabled:opacity-60 ${focusClass}`} /></div></label>

        {mode !== 'forgot' ? <label htmlFor="auth-password" className="block"><span className="text-sm font-semibold">Şifre</span><div className="relative mt-1"><input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value.slice(0,72))} minLength={8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required disabled={interactionBusy} aria-describedby={mode === 'register' ? 'auth-password-help' : undefined} className={`min-h-12 w-full rounded-xl border bg-transparent px-3 pr-12 disabled:opacity-60 ${focusClass}`} /><button type="button" disabled={interactionBusy} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} className={`absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-lg p-2 text-gray-500 disabled:opacity-50 ${focusClass}`}>{showPassword ? <EyeOff aria-hidden="true" className="mx-auto h-5 w-5" /> : <Eye aria-hidden="true" className="mx-auto h-5 w-5" />}</button></div>{mode === 'register' ? <span id="auth-password-help" className="mt-1 block text-xs text-gray-500">8 ile 72 karakter arasında bir şifre kullanın.</span> : null}</label> : null}

        {mode === 'register' ? <label htmlFor="auth-confirm-password" className="block"><span className="text-sm font-semibold">Şifre Tekrarı</span><div className="relative mt-1"><input id="auth-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.slice(0,72))} minLength={8} maxLength={72} autoComplete="new-password" required disabled={interactionBusy} className={`min-h-12 w-full rounded-xl border bg-transparent px-3 pr-12 disabled:opacity-60 ${focusClass}`} /><button type="button" disabled={interactionBusy} onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? 'Şifre tekrarını gizle' : 'Şifre tekrarını göster'} className={`absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-lg p-2 text-gray-500 disabled:opacity-50 ${focusClass}`}>{showConfirmPassword ? <EyeOff aria-hidden="true" className="mx-auto h-5 w-5" /> : <Eye aria-hidden="true" className="mx-auto h-5 w-5" />}</button></div></label> : null}

        <button type="submit" disabled={interactionBusy} className={`min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}>{busy ? 'İşlem yapılıyor…' : mode === 'login' ? 'Giriş Yap' : mode === 'register' ? 'Hesap Oluştur' : 'Sıfırlama Bağlantısı Gönder'}</button>
      </form>
      </div>

      <div className="mt-4 text-center">
        {mode === 'login' ? <button type="button" disabled={interactionBusy} onClick={() => switchMode('forgot')} className={`min-h-11 px-3 text-sm font-semibold text-brand-green disabled:opacity-50 ${focusClass}`}>Şifremi unuttum</button> : mode === 'forgot' ? <button type="button" disabled={interactionBusy} onClick={() => switchMode('login')} className={`min-h-11 px-3 text-sm font-semibold text-brand-green disabled:opacity-50 ${focusClass}`}>Giriş ekranına dön</button> : null}
      </div>

      {!hasSocialAuth ? <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Google ve Facebook girişleri yalnız ilgili sağlayıcılar Golden Oremar için gerçekten yapılandırıldığında otomatik olarak görünür. Bu sürüm sahte sosyal giriş butonu göstermez.</div> : null}
    </section>
  </main>;
}
