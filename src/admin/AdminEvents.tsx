import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Edit2, Loader2, MapPin, Plus, RefreshCw, Search, Users, X, XCircle } from 'lucide-react';
import { adminArchiveEvent, adminCancelEventReservation, adminListEvents, adminSaveEvent, eventAdminErrorMessage, type AdminEvent, type AdminEventReservation } from './eventAdminApi';

type FormState = { title: string; description: string; image: string; location: string; startsAt: string };
const emptyForm = (): FormState => ({ title: '', description: '', image: '', location: '', startsAt: '' });

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminEvents({ setActiveTab: _setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [reservations, setReservations] = useState<AdminEventReservation[]>([]);
  const [tab, setTab] = useState<'events' | 'reservations'>('events');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<AdminEvent | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminEventReservation | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await adminListEvents();
      setEvents(data.events);
      setReservations(data.reservations);
    } catch (err) {
      setError(eventAdminErrorMessage(err, 'Etkinlikler yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    if (!q) return events;
    return events.filter(event => `${event.title} ${event.location_name || ''} ${event.description || ''}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [events, searchTerm]);

  const filteredReservations = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    if (!q) return reservations;
    return reservations.filter(reservation => `${reservation.reservation_code} ${reservation.guest_name} ${reservation.guest_email} ${reservation.event_title}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [reservations, searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm(), startsAt: toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()) });
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (event: AdminEvent) => {
    setEditing(event);
    setForm({ title: event.title, description: event.description || '', image: event.image_path || '', location: event.location_name || '', startsAt: toLocalInput(event.starts_at) });
    setError('');
    setEditorOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(editing?.id || 'new');
    setError('');
    try {
      await adminSaveEvent({ reference: editing?.id || null, title: form.title, description: form.description, image: form.image, location: form.location, startsAt: form.startsAt });
      showToast(editing ? 'Etkinlik güncellendi.' : 'Etkinlik oluşturuldu.');
      setEditorOpen(false);
      setEditing(null);
      await load(true);
    } catch (err) {
      setError(eventAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const archive = async () => {
    if (!archiveTarget || busy) return;
    setBusy(archiveTarget.id);
    setError('');
    try {
      await adminArchiveEvent(archiveTarget.id);
      setArchiveTarget(null);
      showToast('Etkinlik iptal edildi.');
      await load(true);
    } catch (err) {
      setError(eventAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const cancelReservation = async () => {
    if (!cancelTarget || busy) return;
    setBusy(cancelTarget.id);
    setError('');
    try {
      await adminCancelEventReservation(cancelTarget.id);
      setCancelTarget(null);
      showToast('Rezervasyon iptal edildi.');
      await load(true);
    } catch (err) {
      setError(eventAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const activeReservations = reservations.filter(reservation => reservation.status !== 'cancelled');
  const totalGuests = activeReservations.reduce((sum, reservation) => sum + reservation.guest_count, 0);

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Etkinlik ve Rezervasyon Yönetimi</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Etkinlikler ve rezervasyonlar canlı Supabase verisidir. Yeni etkinlikte geçici stok görseli kullanılmaz, rezervasyon iptalleri silinmek yerine durum kaydıyla korunur.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border px-4 dark:border-gray-700"><RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Yenile</button><button type="button" onClick={openCreate} className="min-h-11 rounded-xl bg-brand-green px-4 font-semibold text-white"><Plus className="mr-2 inline h-4 w-4"/>Yeni etkinlik</button></div></header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Toplam etkinlik" value={events.length}/><Metric label="Yayınlanan" value={events.filter(event => event.status === 'published').length}/><Metric label="Aktif rezervasyon" value={activeReservations.length}/><Metric label="Toplam misafir" value={totalGuests}/></div>

    {error && !editorOpen && !archiveTarget && !cancelTarget && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

    <div className="flex gap-2 border-b dark:border-gray-700"><button type="button" onClick={() => { setTab('events'); setSearchTerm(''); }} className={`min-h-11 border-b-2 px-4 font-semibold ${tab === 'events' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500'}`}>Etkinlikler</button><button type="button" onClick={() => { setTab('reservations'); setSearchTerm(''); }} className={`min-h-11 border-b-2 px-4 font-semibold ${tab === 'reservations' ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500'}`}>Rezervasyonlar ({activeReservations.length})</button></div>

    <label className="relative block max-w-xl"><span className="sr-only">Ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={tab === 'events' ? 'Etkinlik adı, konum veya açıklama ara...' : 'Rezervasyon kodu, misafir veya etkinlik ara...'} className="min-h-11 w-full rounded-xl border bg-gray-50 pl-10 pr-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"/></label>

    {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin"/>Veriler yükleniyor...</div> : tab === 'events' ? <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{filteredEvents.map(event => <article key={event.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{event.status}</span><h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{event.title}</h3></div><button type="button" onClick={() => openEdit(event)} className="min-h-11 min-w-11 rounded-xl border text-blue-600 dark:border-gray-700" aria-label={`${event.title} etkinliğini düzenle`}><Edit2 className="mx-auto h-4 w-4"/></button></div><div className="mt-4 space-y-2 text-sm text-gray-500"><div className="flex gap-2"><Calendar className="h-4 w-4"/>{new Date(event.starts_at).toLocaleString('tr-TR')}</div><div className="flex gap-2"><MapPin className="h-4 w-4"/>{event.location_name || 'Konum belirtilmemiş'}</div><div className="flex gap-2"><Users className="h-4 w-4"/>{event.reserved_guests}{event.capacity ? ` / ${event.capacity}` : ''} misafir · {event.reservation_count} rezervasyon</div></div><p className="mt-4 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">{event.description || 'Açıklama yok'}</p>{event.status !== 'cancelled' && <button type="button" onClick={() => { setError(''); setArchiveTarget(event); }} className="mt-4 min-h-11 w-full rounded-xl border border-red-200 font-semibold text-red-700">Etkinliği iptal et</button>}</article>)}{filteredEvents.length === 0 && <div className="lg:col-span-2 xl:col-span-3 p-10 text-center text-gray-500">Etkinlik bulunamadı.</div>}</div> : <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="divide-y dark:divide-gray-700">{filteredReservations.map(reservation => <article key={reservation.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900 dark:text-white">{reservation.guest_name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{reservation.status}</span></div><p className="mt-1 text-xs text-gray-500">{reservation.reservation_code} · {reservation.guest_email}{reservation.guest_phone ? ` · ${reservation.guest_phone}` : ''}</p><p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{reservation.event_title} · {new Date(reservation.event_starts_at).toLocaleString('tr-TR')} · {reservation.guest_count} kişi</p>{reservation.notes && <p className="mt-2 text-sm text-gray-500">Not: {reservation.notes}</p>}</div>{reservation.status !== 'cancelled' && <button type="button" onClick={() => { setError(''); setCancelTarget(reservation); }} className="min-h-11 rounded-xl border border-red-200 px-4 font-semibold text-red-700"><XCircle className="mr-2 inline h-4 w-4"/>Rezervasyonu iptal et</button>}</article>)}{filteredReservations.length === 0 && <div className="p-10 text-center text-gray-500">Rezervasyon bulunamadı.</div>}</div></section>}

    {editorOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditorOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="event-editor-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><div className="flex justify-between gap-3"><div><h3 id="event-editor-title" className="text-lg font-bold dark:text-white">{editing ? 'Etkinliği düzenle' : 'Yeni etkinlik'}</h3></div><button type="button" onClick={() => setEditorOpen(false)} disabled={Boolean(busy)} className="min-h-11 min-w-11 rounded-xl" aria-label="Kapat"><X className="mx-auto h-5 w-5"/></button></div><form onSubmit={submit} className="mt-4 space-y-4"><Field label="Etkinlik adı"><input autoFocus required minLength={2} maxLength={180} value={form.title} onChange={event => setForm({...form,title:event.target.value})}/></Field><Field label="Başlangıç"><input type="datetime-local" required value={form.startsAt} onChange={event => setForm({...form,startsAt:event.target.value})}/></Field><Field label="Konum"><input maxLength={500} value={form.location} onChange={event => setForm({...form,location:event.target.value})}/></Field><Field label="Açıklama"><textarea rows={5} maxLength={20000} value={form.description} onChange={event => setForm({...form,description:event.target.value})}/></Field><Field label="Kalıcı görsel yolu veya HTTPS URL"><input maxLength={2048} value={form.image} onChange={event => setForm({...form,image:event.target.value})}/></Field>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<div className="flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => setEditorOpen(false)} className="min-h-11 flex-1 rounded-xl border dark:border-gray-700">Vazgeç</button><button type="submit" disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl bg-brand-green font-semibold text-white disabled:opacity-50">{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></div></form></section></div>}

    {archiveTarget && <Confirm title="Etkinliği iptal et" body={`${archiveTarget.title} yayından kaldırılacak ve durum kaydı cancelled olacak.`} busy={Boolean(busy)} error={error} onCancel={() => { if (!busy) { setArchiveTarget(null); setError(''); } }} onConfirm={() => void archive()}/>} 
    {cancelTarget && <Confirm title="Rezervasyonu iptal et" body={`${cancelTarget.guest_name} adına ${cancelTarget.guest_count} kişilik rezervasyon iptal edilecek. Kayıt silinmeyecek.`} busy={Boolean(busy)} error={error} onCancel={() => { if (!busy) { setCancelTarget(null); setError(''); } }} onConfirm={() => void cancelReservation()}/>} 
    {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400"/>{toast}</div>}
    <style>{`.event-field{width:100%;min-height:44px;border:1px solid rgb(209 213 219);border-radius:.75rem;padding:.7rem .8rem;background:transparent}.dark .event-field{border-color:rgb(55 65 81)}`}</style>
  </div>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString('tr-TR')}</div></div>}
function Field({label,children}:{label:string;children:React.ReactElement<{className?:string}>}){return <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>{React.cloneElement(children,{className:'event-field'})}</label>}
function Confirm({title,body,busy,error,onCancel,onConfirm}:{title:string;body:string;busy:boolean;error:string;onCancel:()=>void;onConfirm:()=>void}){return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><h3 className="text-lg font-bold dark:text-white">{title}</h3><p className="mt-2 text-sm text-gray-500">{body}</p>{error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<div className="mt-5 flex gap-3"><button type="button" onClick={onCancel} disabled={busy} className="min-h-11 flex-1 rounded-xl border dark:border-gray-700">Vazgeç</button><button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 flex-1 rounded-xl bg-red-700 font-semibold text-white disabled:opacity-50">{busy ? 'İşleniyor...' : 'Onayla'}</button></div></section></div>}
