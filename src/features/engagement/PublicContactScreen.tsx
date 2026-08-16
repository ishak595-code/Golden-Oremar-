import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { getPublicContactConfig, submitContactForm } from './api';

type Props = {
  onBack: () => void;
  currentUser?: { email?: string | null; name?: string | null; displayName?: string | null } | null;
  locale?: string;
};

const friendlyError = (message: string) => {
  if (message.includes('rate_limit_exceeded')) return 'Kısa sürede çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin.';
  if (message.includes('invalid_email')) return 'Geçerli bir e-posta adresi yazın.';
  if (message.includes('invalid_name')) return 'Ad soyad alanını kontrol edin.';
  if (message.includes('invalid_subject')) return 'Konu alanını kontrol edin.';
  if (message.includes('invalid_message')) return 'Mesajınız 10 ile 5000 karakter arasında olmalıdır.';
  if (message.includes('origin_not_allowed')) return 'Bu uygulama kaynağından form gönderimine izin verilmiyor.';
  return 'Mesajınız gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.';
};

export default function PublicContactScreen({ onBack, currentUser, locale = 'tr' }: Props) {
  const [config, setConfig] = useState<any>(null);
  const [configError, setConfigError] = useState(false);
  const [name, setName] = useState(currentUser?.name || currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const errorRef = useRef<HTMLDivElement | null>(null);

  async function loadConfig() {
    try {
      setLoading(true);
      setConfigError(false);
      setConfig(await getPublicContactConfig());
    } catch {
      setConfig(null);
      setConfigError(true);
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadConfig(); }, []);
  useEffect(() => { if (error) queueMicrotask(() => errorRef.current?.focus()); }, [error]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSuccess('');
    if (name.trim().length < 2) { setError('Ad soyad alanını doldurun.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Geçerli bir e-posta adresi yazın.'); return; }
    if (subject.trim().length < 2) { setError('Mesaj konusunu yazın.'); return; }
    if (message.trim().length < 10) { setError('Mesajınız en az 10 karakter olmalıdır.'); return; }

    try {
      setBusy(true);
      const result = await submitContactForm({
        name: name.trim(), email: email.trim(), phone: phone.trim(),
        subject: subject.trim(), message: message.trim(), locale, website,
      });
      setSuccess(result?.status === 'received' ? 'Mesajınız Golden Oremar ekibine güvenli şekilde ulaştı.' : 'Mesajınız alındı.');
      setSubject(''); setMessage('');
    } catch (err: any) {
      setError(friendlyError(String(err?.message || err)));
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <button type="button" onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Geri</button>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-brand-green dark:text-brand-gold">İletişim</h1>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Sorularınızı, sipariş dışı taleplerinizi ve geri bildirimlerinizi güvenli form üzerinden iletebilirsiniz.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" aria-label="Yayınlanmış iletişim bilgileri">
          <h2 className="text-lg font-bold">Golden Oremar</h2>
          {loading ? <div role="status" className="text-sm text-gray-500">İletişim bilgileri yükleniyor…</div> : null}
          {configError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Yayınlanmış iletişim bilgileri şu anda alınamadı. Güvenli mesaj formunu kullanabilirsiniz.<button type="button" onClick={() => void loadConfig()} className="mt-3 block min-h-11 rounded-lg border border-amber-400 px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Bilgileri yeniden yükle</button></div> : null}
          {!configError && config?.address ? <div className="flex gap-3 text-sm"><MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" /><span>{config.address}</span></div> : null}
          {!configError && config?.email ? <a href={`mailto:${config.email}`} className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Mail aria-hidden="true" className="h-5 w-5 text-brand-gold" />{config.email}</a> : null}
          {!configError && config?.phone ? <a href={`tel:${config.phone}`} className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Phone aria-hidden="true" className="h-5 w-5 text-brand-gold" />{config.phone}</a> : null}
          {!loading && !configError && !config?.supportChannelsReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              Doğrudan telefon/e-posta destek kanalı henüz yayınlanmadı. Uydurma iletişim bilgisi gösterilmiyor; bu form aktif güvenli iletişim kanalıdır.
            </div>
          ) : null}
        </aside>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" aria-labelledby="contact-form-title">
          <div className="flex items-center gap-2"><MessageCircle aria-hidden="true" className="h-5 w-5 text-brand-gold" /><h2 id="contact-form-title" className="text-xl font-bold">Mesaj Gönder</h2></div>
          {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
          {success ? <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">{success}</div> : null}
          <form onSubmit={submit} aria-busy={busy} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-semibold">Ad Soyad</span><input required minLength={2} maxLength={120} disabled={busy} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /></label>
              <label className="block"><span className="text-sm font-semibold">E-posta</span><input required maxLength={254} disabled={busy} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /></label>
            </div>
            <label className="block"><span className="text-sm font-semibold">Telefon (opsiyonel)</span><input maxLength={32} disabled={busy} inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /></label>
            <label className="block"><span className="text-sm font-semibold">Konu</span><input required minLength={2} value={subject} maxLength={160} disabled={busy} onChange={e => setSubject(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /><span className="mt-1 block text-xs text-gray-500">{subject.length}/160</span></label>
            <label className="block"><span className="text-sm font-semibold">Mesaj</span><textarea required minLength={10} value={message} maxLength={5000} disabled={busy} onChange={e => setMessage(e.target.value)} rows={6} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" /><span className="mt-1 block text-xs text-gray-500">{message.length}/5000 • en az 10 karakter</span></label>
            <label className="sr-only" aria-hidden="true">Web sitesi<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            <button disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Send aria-hidden="true" className="mr-2 inline h-5 w-5" />{busy ? 'Gönderiliyor…' : 'Mesajı Gönder'}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
