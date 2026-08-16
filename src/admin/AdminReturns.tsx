import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle, Eye, FileText, Loader2, Package, RefreshCw, RotateCcw, Search, X, XCircle } from 'lucide-react';
import {
  adminGetReturnDetail,
  adminListReturns,
  adminUpdateReturn,
  allowedReturnTransitions,
  createReturnEvidenceUrl,
  returnAdminErrorMessage,
  returnMoney,
  type AdminReturnDetail,
  type AdminReturnRow,
  type AdminReturnStatus,
  type ReturnResolution,
} from './returnAdminApi';

function statusLabel(status: AdminReturnStatus) {
  const map: Record<AdminReturnStatus, string> = {
    requested: 'Talep edildi',
    under_review: 'İnceleniyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
    in_transit: 'İade kargoda',
    received: 'Teslim alındı',
    closed: 'Kapatıldı',
    refunded: 'Geri ödendi',
  };
  return map[status] || status;
}

function statusClass(status: AdminReturnStatus) {
  if (status === 'closed' || status === 'refunded') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'approved' || status === 'received') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
  if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  return 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200';
}

function resolutionLabel(value: ReturnResolution | null) {
  if (!value) return 'Belirlenmedi';
  return ({ refund: 'Tam geri ödeme', replacement: 'Ürün değişimi', partial_refund: 'Kısmi geri ödeme', store_credit: 'Mağaza kredisi', none: 'Finansal çözüm yok' } as const)[value];
}

export function AdminReturns() {
  const [rows, setRows] = useState<AdminReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminReturnStatus>('all');
  const [selected, setSelected] = useState<AdminReturnDetail | null>(null);
  const [action, setAction] = useState<Exclude<AdminReturnStatus, 'requested' | 'refunded'> | null>(null);
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState<ReturnResolution | ''>('');
  const [restockApproved, setRestockApproved] = useState<'yes' | 'no' | ''>('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setRows(await adminListReturns());
    } catch (err) {
      setError(returnAdminErrorMessage(err, 'İade talepleri yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return rows.filter(row => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      return `${row.return_number} ${row.order_number} ${row.customer_name} ${row.reason_code} ${row.customer_message || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [rows, searchTerm, statusFilter]);

  const counts = useMemo(() => ({
    open: rows.filter(row => ['requested', 'under_review'].includes(row.status)).length,
    approved: rows.filter(row => ['approved', 'in_transit'].includes(row.status)).length,
    received: rows.filter(row => row.status === 'received').length,
    refundedMinor: rows.reduce((sum, row) => sum + row.succeeded_refund_minor, 0),
  }), [rows]);

  const openDetail = async (row: AdminReturnRow) => {
    if (busy) return;
    setBusy(row.id);
    setError('');
    try {
      setSelected(await adminGetReturnDetail(row.id));
    } catch (err) {
      setError(returnAdminErrorMessage(err, 'İade detayı yüklenemedi.'));
    } finally {
      setBusy('');
    }
  };

  const openAction = (next: Exclude<AdminReturnStatus, 'requested' | 'refunded'>) => {
    setAction(next);
    setReason('');
    setResolution(selected?.resolution || '');
    setRestockApproved('');
    setError('');
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !action || busy) return;
    setBusy(selected.id);
    setError('');
    try {
      await adminUpdateReturn({
        returnId: selected.id,
        status: action,
        reason,
        resolution: resolution || selected.resolution || null,
        restockApproved: action === 'received' ? restockApproved === 'yes' : null,
      });
      showToast(`İade durumu ${statusLabel(action).toLocaleLowerCase('tr-TR')} olarak güncellendi.`);
      const refreshed = await adminGetReturnDetail(selected.id);
      setSelected(refreshed);
      setAction(null);
      await load(true);
    } catch (err) {
      setError(returnAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const openEvidence = async (path: string) => {
    if (busy) return;
    setBusy(path);
    setError('');
    try {
      const url = await createReturnEvidenceUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(returnAdminErrorMessage(err, 'İade kanıtı açılamadı.'));
    } finally {
      setBusy('');
    }
  };

  const transitions = selected ? allowedReturnTransitions(selected.status) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">İade Yönetimi</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">İade kararları ürün bazında talep, kanıt, çözüm, teslim alma ve yeniden stoklama durumuyla yönetilir. Başarılı geri ödemeler ayrıca ödeme kayıtlarından doğrulanır.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">İnceleme kuyruğu</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.open}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Onaylı / kargoda</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.approved}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Teslim alınan</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.received}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Başarılı geri ödeme</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{returnMoney(counts.refundedMinor, 'TRY')}</div><div className="mt-1 text-[11px] text-gray-500">Özet kartı TRY kayıtlarını temel alır, detayda gerçek para birimi gösterilir.</div></div>
      </div>

      {error && !action && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <section className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_220px]" aria-label="İade filtreleri"><label className="relative"><span className="sr-only">İade ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="İade no, sipariş no, müşteri veya neden ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><label><span className="sr-only">İade durumu</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm durumlar</option><option value="requested">Talep edildi</option><option value="under_review">İnceleniyor</option><option value="approved">Onaylandı</option><option value="rejected">Reddedildi</option><option value="in_transit">İade kargoda</option><option value="received">Teslim alındı</option><option value="closed">Kapatıldı</option></select></label></section>

      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> İade talepleri yükleniyor...</div> : <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="İade talepleri"><div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">{filtered.map(row => <article key={row.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-gray-900 dark:text-white">{row.return_number}</h3><p className="mt-1 truncate text-xs text-gray-500">{row.order_number} · {row.customer_name}</p></div><button type="button" disabled={Boolean(busy)} onClick={() => void openDetail(row)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-950/30" aria-label={`${row.return_number} iadesini incele`}><Eye className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>{row.resolution && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">{resolutionLabel(row.resolution)}</span>}</div><div className="mt-4 flex items-end justify-between gap-3"><div className="text-xs text-gray-500">{row.item_count} kalem · {row.requested_quantity} adet · {new Date(row.requested_at).toLocaleDateString('tr-TR')}</div><div className="font-bold text-gray-900 dark:text-white">{returnMoney(row.requested_refund_minor, row.currency)}</div></div></article>)}</div><div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">İade / sipariş</th><th className="px-6 py-4">Müşteri</th><th className="px-6 py-4">Talep</th><th className="px-6 py-4">Çözüm</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">Detay</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(row => <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{row.return_number}</div><div className="mt-1 text-xs text-gray-500">{row.order_number} · {new Date(row.requested_at).toLocaleString('tr-TR')}</div></td><td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{row.customer_name}</div><div className="mt-1 text-xs text-gray-500">{row.customer_phone || 'Telefon yok'}</div></td><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{returnMoney(row.requested_refund_minor, row.currency)}</div><div className="mt-1 text-xs text-gray-500">{row.item_count} kalem · {row.requested_quantity} adet · {row.reason_code}</div></td><td className="px-6 py-4">{resolutionLabel(row.resolution)}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td><td className="px-6 py-4 text-right"><button type="button" disabled={Boolean(busy)} onClick={() => void openDetail(row)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-950/30" aria-label={`${row.return_number} iadesini incele`}><Eye className="mx-auto h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="p-10 text-center text-gray-500"><RotateCcw className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" /> Filtrelerle eşleşen iade talebi yok.</div>}</section>}

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="return-detail-title" className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="return-detail-title" className="text-xl font-bold text-gray-900 dark:text-white">{selected.returnNumber}</h3><p className="mt-1 text-sm text-gray-500">{selected.orderNumber} · {selected.customer.displayName || 'Müşteri'} · {statusLabel(selected.status)}</p></div><button type="button" onClick={() => setSelected(null)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="İade detayını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Müşteri talebi</h4><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Neden kodu</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.reasonCode}</dd></div><div><dt className="text-xs text-gray-500">Mesaj</dt><dd className="mt-1 whitespace-pre-wrap text-gray-900 dark:text-white">{selected.customerMessage || 'Mesaj yok'}</dd></div><div><dt className="text-xs text-gray-500">Telefon</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.customer.phone || 'Yok'}</dd></div></dl></section><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Karar ve çözüm</h4><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Çözüm</dt><dd className="mt-1 text-gray-900 dark:text-white">{resolutionLabel(selected.resolution)}</dd></div><div><dt className="text-xs text-gray-500">İnceleme gerekçesi</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.reviewReason || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">Yeniden stok</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.restockApproved == null ? 'Karar verilmedi' : selected.restockApproved ? 'Onaylandı' : 'Reddedildi'}</dd></div></dl></section></div><section className="mt-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">İade edilen ürünler</h4><div className="mt-3 space-y-3">{selected.items.map(item => <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-gray-900 dark:text-white">{item.productName}</div><div className="mt-1 text-xs text-gray-500">{item.variantName || 'Standart'} · {item.quantity}/{item.purchasedQuantity} adet · {item.condition || 'Durum belirtilmemiş'}</div></div><div className="font-bold text-gray-900 dark:text-white">{returnMoney(item.refundAmountMinor, item.currency)}</div></div>{item.evidencePaths.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.evidencePaths.map((path, index) => <button key={path} type="button" disabled={Boolean(busy)} onClick={() => void openEvidence(path)} className="min-h-11 rounded-lg border border-gray-200 px-3 text-sm font-medium text-blue-700 disabled:opacity-50 dark:border-gray-700 dark:text-blue-300"><FileText className="mr-1 inline h-4 w-4" aria-hidden="true" /> Kanıt {index + 1}</button>)}</div>}</div>)}</div></section><section className="mt-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Geri ödeme kayıtları</h4><div className="mt-3 space-y-2">{selected.refunds.map(refund => <div key={refund.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/60"><div><div className="font-medium text-gray-900 dark:text-white">{refund.status}</div><div className="mt-1 text-xs text-gray-500">{refund.reason || 'Neden kaydı yok'}{refund.processedAt ? ` · ${new Date(refund.processedAt).toLocaleString('tr-TR')}` : ''}</div></div><div className="font-bold text-gray-900 dark:text-white">{returnMoney(refund.amountMinor, refund.currency)}</div></div>)}{selected.refunds.length === 0 && <div className="text-sm text-gray-500">Henüz geri ödeme kaydı yok. İade onayı tek başına ödeme sağlayıcısında geri ödeme yapılmış anlamına gelmez.</div>}</div></section><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{transitions.map(next => <button key={next} type="button" onClick={() => openAction(next)} className={`min-h-11 rounded-xl px-4 font-semibold ${next === 'rejected' ? 'border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300' : 'bg-brand-green text-white hover:bg-green-700'}`}>{next === 'rejected' ? <XCircle className="mr-1 inline h-4 w-4" aria-hidden="true" /> : <CheckCircle className="mr-1 inline h-4 w-4" aria-hidden="true" />}{statusLabel(next)}</button>)}</div>{transitions.length === 0 && <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900/60">Bu iade kaydı mevcut durumunda yönetim akışında yeni bir duruma geçirilemez.</div>}</section></div>}

      {action && selected && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="return-action-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><h3 id="return-action-title" className="text-lg font-bold text-gray-900 dark:text-white">İade durumunu güncelle: {statusLabel(action)}</h3><p className="mt-1 text-sm text-gray-500">{selected.returnNumber}</p>{error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<form onSubmit={submitAction} className="mt-4 space-y-4">{action === 'approved' && <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Çözüm türü</span><select required value={resolution} onChange={event => setResolution(event.target.value as ReturnResolution)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="">Seçin</option><option value="refund">Tam geri ödeme</option><option value="partial_refund">Kısmi geri ödeme</option><option value="replacement">Ürün değişimi</option><option value="store_credit">Mağaza kredisi</option><option value="none">Finansal çözüm yok</option></select></label>}{action === 'received' && <fieldset><legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Ürün yeniden satılabilir stoğa alınsın mı?</legend><div className="grid grid-cols-2 gap-2"><label className="flex min-h-11 items-center gap-2 rounded-xl border p-3"><input type="radio" name="restock" value="yes" checked={restockApproved === 'yes'} onChange={() => setRestockApproved('yes')} /> Evet</label><label className="flex min-h-11 items-center gap-2 rounded-xl border p-3"><input type="radio" name="restock" value="no" checked={restockApproved === 'no'} onChange={() => setRestockApproved('no')} /> Hayır</label></div></fieldset>}<label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{action === 'rejected' ? 'Ret gerekçesi' : 'İşlem notu'}</span><textarea required={action === 'rejected'} minLength={action === 'rejected' ? 8 : undefined} maxLength={3000} rows={4} value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => { setAction(null); setError(''); }} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">Vazgeç</button><button type="submit" disabled={Boolean(busy) || (action === 'rejected' && reason.trim().length < 8) || (action === 'approved' && !resolution) || (action === 'received' && !restockApproved)} className={`min-h-11 flex-1 rounded-xl px-4 font-semibold text-white disabled:opacity-50 ${action === 'rejected' ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-green hover:bg-green-700'}`}>{busy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> İşleniyor</span> : 'Onayla'}</button></div></form></section></div>}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
