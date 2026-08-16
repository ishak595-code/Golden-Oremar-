import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Users, X } from 'lucide-react';
import { listPublicEvents, publicContentUrl, submitEventReservation } from './api';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';

type Props = {
  onBack: () => void;
  currentUser?: { email?: string | null; name?: string | null; displayName?: string | null } | null;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bilgisi yok';
  try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' }).format(date); }
  catch { return 'Tarih bilgisi yok'; }
};

const reservationError = (message: string) => {
  if (message.includes('rate_limit_exceeded')) return 'Kısa sürede çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.';
  if (message.includes('duplicate_reservation')) return 'Bu e-posta adresiyle etkinliğe zaten aktif bir kayıt bulunuyor.';
  if (message.includes('event_not_available')) return 'Bu etkinlik artık kayıt kabul etmiyor.';
  if (message.includes('reservation_deadline_passed')) return 'Etkinlik kayıt süresi sona erdi.';
  if (message.includes('invalid_phone')) return 'Geçerli bir telefon numarası yazın.';
  if (message.includes('invalid_email')) return 'Geçerli bir e-posta adresi yazın.';
  return 'Etkinlik kaydı tamamlanamadı. Lütfen bilgileri kontrol edip tekrar deneyin.';
};

export default function PublicEventsScreen({ onBack, currentUser }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try { setLoading(true); setError(''); setData(await listPublicEvents(true)); }
    catch (err: any) { setError(err?.message || 'Etkinlikler yüklenemedi.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (error) queueMicrotask(() => errorRef.current?.focus()); }, [error]);

  const upcoming = useMemo(() => (data?.items || []).filter((event: any) => new Date(event.endsAt).getTime() >= Date.now()), [data]);
  const past = useMemo(() => (data?.items || []).filter((event: any) => new Date(event.endsAt).getTime() < Date.now()), [data]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <button type="button" onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Geri</button>
      <header className="mb-6"><h1 className="text-3xl font-bold text-brand-green dark:text-brand-gold">Etkinlikler</h1><p className="mt-2 text-gray-600 dark:text-gray-300">Golden Oremar’ın yayınlanmış etkinlikleri ve kayıt durumları.</p></header>
      {loading ? <div role="status" aria-live="polite" className="rounded-xl border p-5 text-center text-gray-500">Etkinlikler yükleniyor…</div> : null}
      {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}<button type="button" onClick={() => void load()} className="mt-3 block min-h-11 rounded-lg border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tekrar dene</button></div> : null}

      {!loading && !error ? <>
        <section aria-labelledby="upcoming-events-title">
          <h2 id="upcoming-events-title" className="text-2xl font-bold">Yaklaşan Etkinlikler</h2>
          {!upcoming.length ? <div className="mt-4 rounded-2xl border border-dashed p-7 text-center text-gray-500">Şu anda yayınlanmış yaklaşan etkinlik bulunmuyor.</div> : <div className="mt-4 grid gap-4 md:grid-cols-2">{upcoming.map((event: any) => <EventCard key={event.id} event={event} onReserve={() => setSelected(event)} />)}</div>}
        </section>

        <section className="mt-9" aria-labelledby="past-events-title">
          <h2 id="past-events-title" className="text-2xl font-bold">Geçmiş Etkinlikler</h2>
          {!past.length ? <div className="mt-4 rounded-2xl border border-dashed p-7 text-center text-gray-500">Geçmiş etkinlik kaydı bulunmuyor.</div> : <div className="mt-4 grid gap-4 md:grid-cols-2">{past.map((event: any) => <EventCard key={event.id} event={event} />)}</div>}
        </section>
      </> : null}

      {selected ? <ReservationDialog event={selected} currentUser={currentUser} onClose={() => setSelected(null)} /> : null}
    </main>
  );
}

function EventCard({ event, onReserve }: { event: any; onReserve?: () => void }) {
  const image = publicContentUrl(event.imagePath);
  return <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    {image ? <img src={image} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover" /> : null}
    <div className="p-5">
      <h3 className="text-xl font-bold text-brand-green dark:text-brand-gold">{event.title}</h3>
      <div className="mt-3 space-y-2 text-sm text-gray-500">
        <div className="flex gap-2"><Calendar aria-hidden="true" className="h-4 w-4 text-brand-gold" />{formatDate(event.startsAt)}</div>
        <div className="flex gap-2"><MapPin aria-hidden="true" className="h-4 w-4 text-brand-gold" />{event.locationName}</div>
        {event.capacity != null ? <div className="flex gap-2"><Users aria-hidden="true" className="h-4 w-4 text-brand-gold" />{event.remainingCapacity > 0 ? `${event.remainingCapacity} kişilik yer` : 'Kontenjan dolu'}</div> : null}
      </div>
      <p className="mt-4 line-clamp-4 leading-7 text-gray-600 dark:text-gray-300">{event.description}</p>
      {event.reservable && onReserve ? <button type="button" onClick={onReserve} className="mt-5 min-h-11 w-full rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{event.waitlistOnly ? 'Bekleme Listesine Katıl' : 'Kayıt Ol'}</button> : <div className="mt-5 rounded-xl bg-gray-50 p-3 text-center text-sm font-semibold text-gray-500 dark:bg-gray-800">{event.status === 'completed' ? 'Etkinlik tamamlandı' : 'Kayıt kapalı'}</div>}
    </div>
  </article>;
}

function ReservationDialog({ event, currentUser, onClose }: { event: any; currentUser: any; onClose: () => void }) {
  const [name, setName] = useState(currentUser?.name || currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(true, () => { if (!busy) onClose(); });

  useEffect(() => { if (error) queueMicrotask(() => errorRef.current?.focus()); }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    try {
      setBusy(true);
      setResult(await submitEventReservation({ eventReference: event.slug || event.id, guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim(), guestCount, notes: notes.trim(), website }));
    } catch (err: any) { setError(reservationError(String(err?.message || err))); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-4"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="reservation-title" tabIndex={-1} className="mx-auto my-5 max-w-lg rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900">
    <div className="flex items-start justify-between gap-3"><div><h2 id="reservation-title" className="text-xl font-bold">Etkinlik Kaydı</h2><p className="mt-1 text-sm text-gray-500">{event.title}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Kayıt penceresini kapat" className="grid min-h-11 min-w-11 place-items-center rounded-full border disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5" /></button></div>
    {result ? <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100"><div className="font-bold">Kaydınız alındı.</div><p className="mt-2 text-sm">Kayıt kodu: {result.reservationCode}</p><p className="mt-1 text-sm">Durum: {result.status === 'waitlisted' ? 'Bekleme listesi' : 'İnceleme/onay bekliyor'}</p><button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tamam</button></div> : <form onSubmit={submit} aria-busy={busy} className="mt-5 space-y-4">
      {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
      <label className="block"><span className="text-sm font-semibold">Ad Soyad</span><input value={name} minLength={2} maxLength={120} disabled={busy} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" required /></label>
      <label className="block"><span className="text-sm font-semibold">E-posta</span><input type="email" value={email} maxLength={254} disabled={busy} onChange={e => setEmail(e.target.value)} autoComplete="email" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" required /></label>
      <label className="block"><span className="text-sm font-semibold">Telefon</span><input value={phone} maxLength={32} disabled={busy} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" required /></label>
      <label className="block"><span className="text-sm font-semibold">Kişi Sayısı</span><input type="number" min="1" max="20" value={guestCount} disabled={busy} onChange={e => setGuestCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /></label>
      <label className="block"><span className="text-sm font-semibold">Not (opsiyonel)</span><textarea value={notes} maxLength={1000} disabled={busy} onChange={e => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" /><span className="mt-1 block text-xs text-gray-500">{notes.length}/1000</span></label>
      <label className="sr-only" aria-hidden="true">Web sitesi<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
      <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"><Clock aria-hidden="true" className="mr-2 inline h-4 w-4 text-brand-gold" />Başlangıç: {formatDate(event.startsAt)}</div>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{busy ? 'Kaydınız gönderiliyor…' : event.waitlistOnly ? 'Bekleme Listesine Katıl' : 'Kaydı Gönder'}</button>
    </form>}
  </div></div>;
}
