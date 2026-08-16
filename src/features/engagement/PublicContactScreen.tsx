import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    let active = true;
    getPublicContactConfig()
      .then(value => { if (active) setConfig(value); })
      .catch(() => { if (active) setConfig(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <button onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft className="mr-2 inline h-4 w-4" />Geri</button>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-brand-green dark:text-brand-gold">İletişim</h1>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Sorularınızı, sipariş dışı taleplerinizi ve geri bildirimlerinizi güvenli form üzerinden iletebilirsiniz.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="space-y-3 rounded-2xl border bg-white p-5 dark:bg-gray-900" aria-label="Yayınlanmış iletişim bilgileri">
          <h2 className="text-lg font-bold">Golden Oremar</h2>
          {loading ? <div role="status" className="text-sm text-gray-500">İletişim bilgileri yükleniyor…</div> : null}
          {config?.address ? <div className="flex gap-3 text-sm"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" /><span>{config.address}</span></div> : null}
          {config?.email ? <a href={`mailto:${config.email}`} className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"><Mail className="h-5 w-5 text-brand-gold" />{config.email}</a> : null}
          {config?.phone ? <a href={`tel:${config.phone}`} className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"><Phone className="h-5 w-5 text-brand-gold" />{config.phone}</a> : null}
          {!loading && !config?.supportChannelsReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Doğrudan telefon/e-posta destek kanalı henüz yayınlanmadı. Uydurma iletişim bilgisi gösterilmiyor; bu form aktif güvenli iletişim kanalıdır.
            </div>
          ) : null}
        </aside>

        <section className="rounded-2xl border bg-white p-5 dark:bg-gray-900" aria-labelledby="contact-form-title">
          <div className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-brand-gold" /><h2 id="contact-form-title" className="text-xl font-bold">Mesaj Gönder</h2></div>
          {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
          {success ? <div role="status" aria-live="polite" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div> : null}
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-semibold">Ad Soyad</span><input autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>
              <label className="block"><span className="text-sm font-semibold">E-posta</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>
            </div>
            <label className="block"><span className="text-sm font-semibold">Telefon (opsiyonel)</span><input inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>
            <label className="block"><span className="text-sm font-semibold">Konu</span><input value={subject} maxLength={160} onChange={e => setSubject(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>
            <label className="block"><span className="text-sm font-semibold">Mesaj</span><textarea value={message} maxLength={5000} onChange={e => setMessage(e.target.value)} rows={6} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
            <label className="sr-only" aria-hidden="true">Web sitesi<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
            <button disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50"><Send className="mr-2 inline h-5 w-5" />{busy ? 'Gönderiliyor…' : 'Mesajı Gönder'}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
