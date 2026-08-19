import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, CheckCircle, CircleDollarSign, Eye, Loader2, MapPin, Package, RefreshCw, Search, ShieldCheck, ShoppingBag, Store, Users, X, XCircle } from 'lucide-react';
import {
  adminListProducers,
  adminSetProducerCommission,
  adminSetProducerOriginVerified,
  adminSetProducerStatus,
  basisPointsToPercent,
  producerAdminErrorMessage,
  type AdminProducer,
  type AdminProducerManagedStatus,
} from './producerAdminApi';

type ActionState =
  | { type: 'commission'; producer: AdminProducer }
  | { type: 'status'; producer: AdminProducer; status: AdminProducerManagedStatus }
  | { type: 'origin'; producer: AdminProducer; verified: boolean }
  | null;

function statusLabel(status: AdminProducer['status']) {
  const labels: Record<AdminProducer['status'], string> = {
    pending: 'Onay bekliyor',
    active: 'Aktif',
    suspended: 'Askıda',
    rejected: 'Reddedildi',
    closed: 'Kapatıldı',
  };
  return labels[status];
}

function statusClass(status: AdminProducer['status']) {
  if (status === 'active') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'suspended') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  if (status === 'pending') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
  if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Bilinmiyor';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Bilinmiyor' : date.toLocaleDateString('tr-TR', { dateStyle: 'medium' });
}

export function AdminVendors({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [producers, setProducers] = useState<AdminProducer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminProducer['status']>('all');
  const [selected, setSelected] = useState<AdminProducer | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [reason, setReason] = useState('');
  const [commissionPercent, setCommissionPercent] = useState(10);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await adminListProducers();
      setProducers(rows);
      setSelected(current => current ? rows.find(row => row.id === current.id) || null : null);
    } catch (err) {
      setError(producerAdminErrorMessage(err, 'Satıcılar yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return producers.filter(producer => {
      if (statusFilter !== 'all' && producer.status !== statusFilter) return false;
      if (!q) return true;
      return `${producer.display_name} ${producer.email} ${producer.phone || ''} ${producer.production_location || ''} ${producer.production_village || ''} ${producer.production_district || ''} ${producer.production_province || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [producers, searchTerm, statusFilter]);

  const totals = useMemo(() => ({
    active: producers.filter(item => item.status === 'active').length,
    verified: producers.filter(item => item.is_verified).length,
    originVerified: producers.filter(item => item.origin_verified).length,
    followers: producers.reduce((sum, item) => sum + item.follower_count, 0),
  }), [producers]);

  const openAction = (next: NonNullable<ActionState>) => {
    setAction(next);
    setReason('');
    setError('');
    if (next.type === 'commission') setCommissionPercent(basisPointsToPercent(next.producer.commission_basis_points));
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action || busyId) return;
    setBusyId(action.producer.id);
    setError('');
    try {
      if (action.type === 'commission') {
        await adminSetProducerCommission(action.producer.id, commissionPercent);
        showToast(`Platform komisyonu %${commissionPercent.toLocaleString('tr-TR')} olarak güncellendi.`);
      } else if (action.type === 'status') {
        await adminSetProducerStatus(action.producer.id, action.status, reason);
        showToast(action.status === 'active' ? 'Satıcı yeniden etkinleştirildi.' : 'Satıcı askıya alındı.');
      } else {
        await adminSetProducerOriginVerified(action.producer.id, action.verified, reason);
        showToast(action.verified ? 'Üretim menşei doğrulandı.' : 'Üretim menşei doğrulaması kaldırıldı.');
      }
      setAction(null);
      await load(true);
    } catch (err) {
      setError(producerAdminErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const actionTitle = action?.type === 'commission'
    ? 'Platform komisyonunu güncelle'
    : action?.type === 'status'
      ? action.status === 'active' ? 'Satıcıyı yeniden etkinleştir' : 'Satıcıyı askıya al'
      : action?.verified ? 'Üretim menşeini doğrula' : 'Menşe doğrulamasını kaldır';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Satıcı Yönetimi</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Satıcı profilleri gerçek Supabase hesaplarından gelir. Kimlik doğrulaması, köy ve üretim menşei, komisyon, sipariş, ürün ve takipçi metrikleri ayrı güven katmanları olarak yönetilir.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
          <button type="button" onClick={() => setActiveTab?.('vendor-applications')} className="min-h-11 rounded-xl bg-brand-green px-4 py-2 font-semibold text-white hover:bg-green-700"><Store className="mr-2 inline h-4 w-4" aria-hidden="true" /> Satıcı başvuruları</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Aktif mağaza</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.active}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Kimliği doğrulanmış</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.verified}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Menşei doğrulanmış</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.originVerified}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Toplam takipçi</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.followers.toLocaleString('tr-TR')}</div></div>
      </div>

      {error && !action && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_200px]">
        <label className="relative"><span className="sr-only">Satıcı ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Mağaza, e-posta, telefon, köy veya il ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label><span className="sr-only">Satıcı durumu</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm durumlar</option><option value="pending">Onay bekleyen</option><option value="active">Aktif</option><option value="suspended">Askıda</option><option value="rejected">Reddedildi</option><option value="closed">Kapatıldı</option></select></label>
      </div>

      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Satıcılar yükleniyor...</div> : <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Satıcı listesi">
        <div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">
          {filtered.map(producer => <article key={producer.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green"><Store className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0"><h3 className="truncate font-bold text-gray-900 dark:text-white">{producer.display_name}</h3><p className="truncate text-xs text-gray-500">{producer.production_location || 'Üretim yeri belirtilmemiş'}</p></div></div><button type="button" onClick={() => setSelected(producer)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${producer.display_name} satıcısını incele`}><Eye className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-semibold ${statusClass(producer.status)}`}>{statusLabel(producer.status)}</span>{producer.is_verified && <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Kimlik doğrulandı</span>}{producer.origin_verified && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Menşe doğrulandı</span>}</div><dl className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-[11px] text-gray-500">Ürün</dt><dd className="font-bold text-gray-900 dark:text-white">{producer.product_count}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-[11px] text-gray-500">Sipariş</dt><dd className="font-bold text-gray-900 dark:text-white">{producer.order_count}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-[11px] text-gray-500">Takipçi</dt><dd className="font-bold text-gray-900 dark:text-white">{producer.follower_count}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-[11px] text-gray-500">Komisyon</dt><dd className="font-bold text-gray-900 dark:text-white">%{basisPointsToPercent(producer.commission_basis_points).toLocaleString('tr-TR')}</dd></div></dl></article>)}
        </div>

        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Mağaza</th><th className="px-6 py-4">Doğrulama</th><th className="px-6 py-4">Metrikler</th><th className="px-6 py-4">Komisyon</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(producer => <tr key={producer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{producer.display_name}</div><div className="mt-1 text-xs text-gray-500">{producer.email}</div><div className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {producer.production_location || 'Belirtilmemiş'}</div></td><td className="px-6 py-4"><div className="space-y-1 text-xs"><div className={producer.is_verified ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500'}>{producer.is_verified ? 'Kimlik doğrulandı' : 'Kimlik doğrulanmadı'}</div><div className={producer.origin_verified ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}>{producer.origin_verified ? 'Menşe doğrulandı' : 'Menşe doğrulanmadı'}</div></div></td><td className="px-6 py-4"><div className="grid grid-cols-3 gap-3 text-center text-xs"><div><div className="font-bold text-gray-900 dark:text-white">{producer.product_count}</div><div className="text-gray-500">ürün</div></div><div><div className="font-bold text-gray-900 dark:text-white">{producer.order_count}</div><div className="text-gray-500">sipariş</div></div><div><div className="font-bold text-gray-900 dark:text-white">{producer.follower_count}</div><div className="text-gray-500">takipçi</div></div></div></td><td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">%{basisPointsToPercent(producer.commission_basis_points).toLocaleString('tr-TR')}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(producer.status)}`}>{statusLabel(producer.status)}</span></td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelected(producer)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${producer.display_name} satıcısını incele`}><Eye className="mx-auto h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
        {filtered.length === 0 && <div className="p-10 text-center text-gray-500">Filtrelerle eşleşen satıcı yok.</div>}
      </section>}

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="producer-detail-title" className="max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="producer-detail-title" className="text-xl font-bold text-gray-900 dark:text-white">{selected.display_name}</h3><p className="mt-1 text-sm text-gray-500">{selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</p></div><button type="button" onClick={() => setSelected(null)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Satıcı detayını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="flex items-center gap-2 text-xs text-gray-500"><Package className="h-4 w-4" aria-hidden="true" /> Ürün</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.product_count}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="flex items-center gap-2 text-xs text-gray-500"><ShoppingBag className="h-4 w-4" aria-hidden="true" /> Sipariş</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.order_count}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="flex items-center gap-2 text-xs text-gray-500"><Users className="h-4 w-4" aria-hidden="true" /> Takipçi</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.follower_count}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="flex items-center gap-2 text-xs text-gray-500"><CircleDollarSign className="h-4 w-4" aria-hidden="true" /> Komisyon</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">%{basisPointsToPercent(selected.commission_basis_points).toLocaleString('tr-TR')}</div></div></div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Doğrulama ve durum</h4><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Mağaza durumu</span><span className="font-semibold text-gray-900 dark:text-white">{statusLabel(selected.status)}</span></div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Kimlik doğrulama</span><span className={selected.is_verified ? 'font-semibold text-blue-700 dark:text-blue-300' : 'font-semibold text-red-700 dark:text-red-300'}>{selected.is_verified ? 'Doğrulandı' : 'Doğrulanmadı'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Menşe doğrulama</span><span className={selected.origin_verified ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-semibold text-gray-700 dark:text-gray-200'}>{selected.origin_verified ? 'Doğrulandı' : 'Doğrulanmadı'}</span></div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Kimlik doğrulama tarihi</span><span className="text-right text-gray-900 dark:text-white">{formatDate(selected.verified_at)}</span></div><div className="flex items-center justify-between gap-3"><span className="text-gray-500">Yeniden doğrulama</span><span className="text-right text-gray-900 dark:text-white">{formatDate(selected.verification_due_at)}</span></div></div></section>

          <section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Üretim menşei</h4><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Tam konum</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.production_location || 'Belirtilmemiş'}</dd></div><div><dt className="text-xs text-gray-500">Köy</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.production_village || 'Belirtilmemiş'}{selected.production_village_is_custom ? ' · kullanıcı girişi' : ''}</dd></div><div><dt className="text-xs text-gray-500">İlçe / il / ülke</dt><dd className="mt-1 text-gray-900 dark:text-white">{[selected.production_district, selected.production_province, selected.production_country_code].filter(Boolean).join(' / ') || 'Belirtilmemiş'}</dd></div><div><dt className="text-xs text-gray-500">Menşe doğrulama temeli</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.origin_verification_basis || 'Henüz doğrulanmadı'}</dd></div></dl></section>
        </div>

        <section className="mt-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Mağaza açıklaması</h4><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{selected.description || 'Açıklama girilmemiş.'}</p><div className="mt-3 text-xs text-gray-500">Mağaza oluşturma tarihi: {formatDate(selected.created_at)} · Puan: {selected.rating_average.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} / 5 ({selected.rating_count} değerlendirme)</div></section>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><button type="button" onClick={() => openAction({ type: 'commission', producer: selected })} className="min-h-11 rounded-xl border border-gray-200 px-3 py-2 font-semibold text-gray-700 hover:border-brand-green hover:text-brand-green dark:border-gray-700 dark:text-gray-200">Komisyonu düzenle</button>{selected.status === 'active' ? <button type="button" onClick={() => openAction({ type: 'status', producer: selected, status: 'suspended' })} className="min-h-11 rounded-xl border border-red-200 px-3 py-2 font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"><XCircle className="mr-1 inline h-4 w-4" aria-hidden="true" /> Askıya al</button> : selected.status === 'suspended' ? <button type="button" onClick={() => openAction({ type: 'status', producer: selected, status: 'active' })} className="min-h-11 rounded-xl border border-green-200 px-3 py-2 font-semibold text-green-700 hover:bg-green-50 dark:border-green-900/50 dark:text-green-300 dark:hover:bg-green-950/30"><CheckCircle className="mr-1 inline h-4 w-4" aria-hidden="true" /> Etkinleştir</button> : <div className="flex min-h-11 items-center rounded-xl border border-gray-200 px-3 text-xs font-medium text-gray-500 dark:border-gray-700">Bu statü başvuru veya hesap yaşam döngüsünden yönetilir.</div>}{selected.origin_verified ? <button type="button" onClick={() => openAction({ type: 'origin', producer: selected, verified: false })} className="min-h-11 rounded-xl border border-orange-200 px-3 py-2 font-semibold text-orange-700 hover:bg-orange-50 dark:border-orange-900/50 dark:text-orange-300">Menşe onayını kaldır</button> : <button type="button" disabled={!selected.is_verified} onClick={() => openAction({ type: 'origin', producer: selected, verified: true })} className="min-h-11 rounded-xl border border-emerald-200 px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-900/50 dark:text-emerald-300"><BadgeCheck className="mr-1 inline h-4 w-4" aria-hidden="true" /> Menşei doğrula</button>}<button type="button" onClick={() => setActiveTab?.('vendor-applications')} className="min-h-11 rounded-xl bg-gray-900 px-3 py-2 font-semibold text-white hover:bg-black dark:bg-gray-600 dark:hover:bg-gray-500">Başvuru kaydı</button></div>
      </section></div>}

      {action && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setAction(null); }}><section role="dialog" aria-modal="true" aria-labelledby="producer-action-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><h3 id="producer-action-title" className="text-lg font-bold text-gray-900 dark:text-white">{actionTitle}</h3><p className="mt-1 text-sm text-gray-500">{action.producer.display_name}</p></div><button type="button" onClick={() => setAction(null)} disabled={Boolean(busyId)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700" aria-label="İşlem penceresini kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>{error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<form onSubmit={submitAction} className="mt-4 space-y-4">{action.type === 'commission' ? <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Platform komisyonu (%)</span><input autoFocus type="number" min="0" max="30" step="0.01" value={commissionPercent} onChange={event => setCommissionPercent(Number(event.target.value))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /><span className="mt-1 block text-xs text-gray-500">Sunucuya basis point olarak kaydedilir. %10 = 1000.</span></label> : <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Yönetim gerekçesi</span><textarea autoFocus required={action.type === 'origin' || (action.type === 'status' && action.status === 'suspended')} minLength={action.type === 'origin' || (action.type === 'status' && action.status === 'suspended') ? 10 : undefined} maxLength={1000} rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="Denetlenebilir karar gerekçesini yazın..." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>}<div className="flex gap-3"><button type="button" disabled={Boolean(busyId)} onClick={() => setAction(null)} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">İptal</button><button type="submit" disabled={Boolean(busyId)} className={`min-h-11 flex-1 rounded-xl px-4 font-semibold text-white disabled:opacity-50 ${action.type === 'status' && action.status === 'suspended' ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-green hover:bg-green-700'}`}>{busyId ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> İşleniyor</span> : <span className="flex items-center justify-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Onayla</span>}</button></div></form></section></div>}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
