import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { signOutCurrentSession, updatePassword } from './api';

function recoveryErrorMessage(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes('same_password')) return 'Yeni şifreniz mevcut şifrenizden farklı olmalıdır.';
  if (value.includes('password should be at least')) return 'Şifre yeterince güçlü değil.';
  if (value.includes('auth session missing') || value.includes('session') || value.includes('jwt') || value.includes('user not found')) return 'Şifre sıfırlama bağlantısının oturumu geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyin.';
  return raw || 'Şifre güncellenemedi.';
}

export default function PasswordRecoveryScreen({
  onCompleted,
  onCancelled,
}: {
  onCompleted?: () => void;
  onCancelled?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => passwordRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function reportError(message: string) {
    setError(message);
    queueMicrotask(() => errorRef.current?.focus());
  }

  async function verifyRecoverySession() {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!data.user?.id) throw new Error('auth session missing');
    return data.user;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8 || password.length > 72 || /[\u0000-\u001F\u007F]/.test(password)) {
      reportError('Şifre 8-72 karakter arasında olmalı ve kontrol karakteri içermemelidir.');
      return;
    }
    if (password !== confirmPassword) {
      reportError('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    try {
      setBusy(true);
      await verifyRecoverySession();
      await updatePassword(password);
      setPassword('');
      setConfirmPassword('');
      onCompleted?.();
    } catch (e: any) {
      reportError(recoveryErrorMessage(String(e?.message || e)));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRecovery() {
    try {
      setBusy(true);
      await signOutCurrentSession();
      onCancelled?.();
    } catch (e: any) {
      reportError(recoveryErrorMessage(String(e?.message || e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center p-4 sm:p-6" aria-labelledby="password-recovery-title">
      <section className="w-full rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7" aria-busy={busy}>
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-gold/10 text-brand-gold" aria-hidden="true">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 id="password-recovery-title" className="mt-4 text-2xl font-bold">Yeni Şifre Belirle</h1>
          <p className="mt-2 text-sm text-gray-500">Hesabınız için yeni bir şifre oluşturun. Şifre kaydedilmeden hemen önce sıfırlama oturumu sunucudan yeniden doğrulanır.</p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {error ? (
            <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <label className="block" htmlFor="recovery-new-password">
            <span className="text-sm font-semibold">Yeni şifre</span>
            <div className="relative mt-1">
              <input
                id="recovery-new-password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value.slice(0, 72))}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                disabled={busy}
                aria-describedby="new-password-help"
                className="min-h-12 w-full rounded-xl border bg-transparent px-3 pr-12 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                className="absolute right-1 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-lg p-2 text-gray-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="mx-auto h-5 w-5" /> : <Eye aria-hidden="true" className="mx-auto h-5 w-5" />}
              </button>
            </div>
            <span id="new-password-help" className="mt-1 block text-xs text-gray-500">8-72 karakter arasında yeni bir şifre kullanın.</span>
          </label>

          <label className="block" htmlFor="recovery-confirm-password">
            <span className="text-sm font-semibold">Yeni şifreyi tekrar yazın</span>
            <input
              id="recovery-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value.slice(0, 72))}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
              disabled={busy}
              className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            />
          </label>

          <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
            {busy ? 'Şifre ve oturum doğrulanıyor…' : 'Şifremi Güncelle'}
          </button>
          <button type="button" disabled={busy} onClick={cancelRecovery} className="min-h-11 w-full rounded-xl border px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
            İşlemi İptal Et ve Bu Cihazdan Çıkış Yap
          </button>
        </form>
      </section>
    </main>
  );
}
