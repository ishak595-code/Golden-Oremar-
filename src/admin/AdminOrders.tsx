import React, { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle, Clock3, CreditCard, Eye, Loader2, MapPin, RefreshCw, RotateCcw, Search, ShoppingBag, Truck, X } from 'lucide-react';
import {
  allowedAdminOrderTransitions,
  formatOrderMoney,
  managementOrdersSnapshot,
  managementUpdateOrderStatus,
  orderAddressLabel,
  orderAdminErrorMessage,
  type ManagedOrder,
  type ManagedOrderStatus,
} from './orderAdminApi';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';

function statusLabel(status: ManagedOrderStatus) {
  const labels: Record<ManagedOrderStatus, string> = {
    draft: 'Taslak',
    pending_payment: 'Ödeme bekliyor',
    confirmed: 'Onaylandı',
    preparing: 'Hazırlanıyor',
    partially_shipped: 'Kısmen kargoda',
    shipped: 'Kargoda',
    delivered: 'Teslim edildi',
    completed: 'Tamamlandı',
    cancelled: 'İptal edildi',
    refunded: 'Geri ödendi',
  };
  return labels[status];
}

function statusClass(status: ManagedOrderStatus) {
  if (status === 'completed' || status === 'delivered') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'shipped' || status === 'partially_shipped') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
  if (status === 'confirmed' || status === 'preparing') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  if (status === 'cancelled' || status === 'refunded') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
}

function paymentLabel(status: string) {
  const map: Record<string, string> = {
    unpaid: 'Ödenmedi',
    authorized: 'Provizyonda',
    partially_paid: 'Kısmi ödeme',
    paid: 'Ödendi',
    partially_refunded: 'Kısmi iade',
    refunded: 'Geri ödendi',
    failed: 'Başarısız',
    disputed: 'İtirazlı',
  };
  return map[status] || status;
}

function transitionLabel(status: ManagedOrderStatus) {
  const labels: Partial<Record<ManagedOrderStatus, string>> = {
    pending_payment: 'Ödeme aşamasına geçir',
    confirmed: 'Siparişi onayla',
    preparing: 'Hazırlamaya al',
    shipped: 'Kargoya ver',
    delivered: 'Teslim edildi olarak işaretle',
    completed: 'Siparişi tamamla',
    cancelled: 'Siparişi iptal et',
  };
  return labels[status] || statusLabel(status);
}

function formatOrderDate(value: unknown, includeTime = false) {
  const raw = String(value || '').trim();
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı';
  try {
    return includeTime ? date.toLocaleString('tr-TR') : date.toLocaleDateString('tr-TR');
  } catch {
    return 'Tarih doğrulanamadı';
  }
}

export function AdminOrders({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ManagedOrderStatus>('all');
  const [selected, setSelected] = useState<ManagedOrder | null>(null);
  const [transition, setTransition] = useState<ManagedOrderStatus | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const orderDetailRef = useAccessibleDialog<HTMLDivElement>(Boolean(selected), () => {
    if (!busyId && !transition) setSelected(null);
  });
  const transitionDialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(transition && selected), () => {
    if (!busyId) {
      setTransition(null);
      setError('');
    }
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const snapshot = await managementOrdersSnapshot();
      if (snapshot.role !== 'admin') throw new Error('Bu ekran yalnızca yönetici sipariş görünümünü kabul eder.');
      setOrders(snapshot.orders);
      setSelected(current => current ? snapshot.orders.find(order => order.id === current.id) || null : null);
    } catch (err) {
      setError(orderAdminErrorMessage(err, 'Siparişler yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!q) return true;
      return `${order.orderNumber} ${order.customer} ${order.customerEmail || ''} ${order.trackingNumber || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [orders, searchTerm, statusFilter]);

  const counts = useMemo(() => ({
    payment: orders.filter(order => order.status === 'pending_payment').length,
    preparing: orders.filter(order => ['confirmed', 'preparing'].includes(order.status)).length,
    shipping: orders.filter(order => ['partially_shipped', 'shipped'].includes(order.status)).length,
    returns: orders.filter(order => Boolean(order.returnStatus) && order.returnStatus !== 'Completed').length,
  }), [orders]);

  const openTransition = (status: ManagedOrderStatus) => {
    setTransition(status);
    setTrackingNumber('');
    setNote('');
    setError('');
  };

  const submitTransition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !transition || busyId) return;
    setBusyId(selected.id);
    setError('');
    try {
      await managementUpdateOrderStatus({
        orderId: selected.id,
        status: transition,
        trackingNumber: transition === 'shipped' ? trackingNumber : null,
        note,
      });
      showToast(transition === 'completed' ? 'Sipariş tamamlandı. Satıcı hakedişleri otomatik olarak kullanılabilir bakiyeye geçti.' : `Sipariş durumu ${statusLabel(transition).toLocaleLowerCase('tr-TR')} olarak güncellendi.`);
      setTransition(null);
      await load(true);
    } catch (err) {
      setError(orderAdminErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const visibleTransitions = selected
    ? allowedAdminOrderTransitions(selected.status).filter(status => status !== 'partially_shipped')
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sipariş Yönetimi</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Sipariş durumu serbestçe değiştirilemez. Ödeme doğrulaması, stok tüketimi, kargo takibi, müşteri bildirimi ve satıcı hakedişi sunucu tarafındaki güvenli durum makinesi tarafından yönetilir.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Ödeme bekliyor</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.payment}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Hazırlama kuyruğu</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.preparing}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Kargoda</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.shipping}</div></div>
        <button type="button" onClick={() => setActiveTab?.('returns')} className="rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Açık iade</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.returns}</div></button>
      </div>

      {error && !transition && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <section className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_220px]" aria-label="Sipariş filtreleri">
        <label className="relative"><span className="sr-only">Sipariş ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" maxLength={160} value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Sipariş no, müşteri, e-posta veya takip no ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label><span className="sr-only">Sipariş durumu</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm durumlar</option><option value="pending_payment">Ödeme bekliyor</option><option value="confirmed">Onaylandı</option><option value="preparing">Hazırlanıyor</option><option value="partially_shipped">Kısmen kargoda</option><option value="shipped">Kargoda</option><option value="delivered">Teslim edildi</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal edildi</option><option value="refunded">Geri ödendi</option></select></label>
      </section>

      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Siparişler yükleniyor...</div> : <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Sipariş listesi">
        <div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">{filtered.map(order => <article key={order.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-gray-900 dark:text-white">{order.orderNumber}</h3><p className="mt-1 truncate text-xs text-gray-500">{order.customer}{order.customerEmail ? ` · ${order.customerEmail}` : ''}</p></div><button type="button" onClick={() => setSelected(order)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${order.orderNumber} siparişini incele`}><Eye className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">{paymentLabel(order.paymentStatus)}</span>{order.returnStatus && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800 dark:bg-orange-950/40 dark:text-orange-200">İade: {order.returnStatus}</span>}</div><div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-xs text-gray-500">{order.items.length} kalem · {formatOrderDate(order.date)}</div>{order.trackingNumber && <div className="mt-1 text-xs text-gray-500">Takip: {order.trackingNumber}</div>}</div><div className="font-bold text-gray-900 dark:text-white">{formatOrderMoney(order.totalMinor, order.currency)}</div></div></article>)}</div>

        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Sipariş</th><th className="px-6 py-4">Müşteri</th><th className="px-6 py-4">Ödeme</th><th className="px-6 py-4">Tutar</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(order => <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{order.orderNumber}</div><div className="mt-1 text-xs text-gray-500">{formatOrderDate(order.date, true)} · {order.items.length} kalem</div>{order.trackingNumber && <div className="mt-1 text-xs text-blue-600">Takip: {order.trackingNumber}</div>}</td><td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{order.customer}</div><div className="mt-1 text-xs text-gray-500">{order.customerEmail || 'E-posta gizli veya yok'}</div></td><td className="px-6 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{paymentLabel(order.paymentStatus)}</span></td><td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{formatOrderMoney(order.totalMinor, order.currency)}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>{order.returnStatus && <div className="mt-1 text-xs text-orange-600">İade: {order.returnStatus}</div>}</td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelected(order)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${order.orderNumber} siparişini incele`}><Eye className="mx-auto h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
        {filtered.length === 0 && <div className="p-10 text-center text-gray-500"><ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" /> Filtrelerle eşleşen sipariş yok.</div>}
      </section>}

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId && !transition) setSelected(null); }}><div ref={orderDetailRef} role="dialog" aria-modal="true" aria-labelledby="order-detail-title" aria-describedby="order-detail-summary" tabIndex={-1} className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="order-detail-title" className="text-xl font-bold text-gray-900 dark:text-white">{selected.orderNumber}</h3><p id="order-detail-summary" className="mt-1 text-sm text-gray-500">{formatOrderDate(selected.date, true)} · {statusLabel(selected.status)}</p></div><button type="button" disabled={Boolean(busyId) || Boolean(transition)} onClick={() => { setTransition(null); setSelected(null); setError(''); }} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700" aria-label="Sipariş detayını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><MapPin className="h-4 w-4 text-brand-green" aria-hidden="true" /> Teslimat</h4>{(() => { const address = orderAddressLabel(selected.shippingAddress); return <div className="mt-3 text-sm"><div className="font-semibold text-gray-900 dark:text-white">{address.recipient || selected.customer}</div><div className="mt-1 text-gray-600 dark:text-gray-300">{address.address || 'Teslimat adresi kayıtlı ancak okunabilir adres satırı bulunamadı.'}</div>{address.phone && <div className="mt-2 text-gray-500">Telefon: {address.phone}</div>}</div>; })()}</section><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><CreditCard className="h-4 w-4 text-brand-green" aria-hidden="true" /> Ödeme ve sipariş</h4><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Ödeme</dt><dd className="font-semibold text-gray-900 dark:text-white">{paymentLabel(selected.paymentStatus)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Fulfillment</dt><dd className="font-semibold text-gray-900 dark:text-white">{selected.fulfillmentStatus}</dd></div><div className="flex justify-between gap-3 border-t border-gray-100 pt-2 dark:border-gray-700"><dt className="font-semibold text-gray-900 dark:text-white">Toplam</dt><dd className="font-bold text-brand-green">{formatOrderMoney(selected.totalMinor, selected.currency)}</dd></div></dl></section></div>

        {selected.customerNote && <section className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><strong>Müşteri notu:</strong> {selected.customerNote}</section>}

        <section className="mt-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Sipariş İçeriği</h4><div className="mt-3 space-y-2">{selected.items.map(item => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><div className="min-w-0"><div className="font-semibold text-gray-900 dark:text-white">{item.name}</div><div className="mt-1 text-xs text-gray-500">{item.variantName || 'Standart varyant'} · {item.quantity} adet · {item.fulfillmentStatus}</div></div><div className="shrink-0 text-right"><div className="font-semibold text-gray-900 dark:text-white">{item.lineTotal.toLocaleString('tr-TR', { style: 'currency', currency: selected.currency })}</div><div className="mt-1 text-xs text-gray-500">Birim {item.price.toLocaleString('tr-TR', { style: 'currency', currency: selected.currency })}</div></div></div>)}</div></section>

        {selected.returnStatus && <section className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-orange-950 dark:text-orange-100">İade süreci: {selected.returnStatus}</h4><p className="mt-1 text-sm text-orange-800 dark:text-orange-200">{selected.returnReason || 'Müşteri iade talebi oluşturmuş.'}</p></div><RotateCcw className="h-5 w-5 text-orange-600" aria-hidden="true" /></div><button type="button" onClick={() => setActiveTab?.('returns')} className="mt-3 min-h-11 rounded-xl border border-orange-300 px-4 font-semibold text-orange-900 dark:text-orange-100">İade yönetimine git</button></section>}

        {selected.trackingNumber && <section className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><Truck className="mr-2 inline h-4 w-4" aria-hidden="true" /> Kargo takip numarası: <strong>{selected.trackingNumber}</strong>{selected.trackingUrl && <a href={selected.trackingUrl} target="_blank" rel="noreferrer" className="ml-2 underline">Takibi aç</a>}</section>}

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{visibleTransitions.map(status => <button key={status} type="button" onClick={() => openTransition(status)} className={`min-h-11 rounded-xl px-4 py-2 font-semibold ${status === 'cancelled' ? 'border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300' : status === 'completed' ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-brand-green text-white hover:bg-green-700'}`}>{status === 'shipped' && <Truck className="mr-2 inline h-4 w-4" aria-hidden="true" />}{status === 'completed' && <CheckCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />}{status === 'pending_payment' && <Clock3 className="mr-2 inline h-4 w-4" aria-hidden="true" />}{transitionLabel(status)}</button>)}</div>
        {visibleTransitions.length === 0 && <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900/60">Bu sipariş mevcut durumunda yönetim panelinden ileri taşınacak bir adıma sahip değil.</div>}
      </div></div>}

      {transition && selected && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) { setTransition(null); setError(''); } }}><div ref={transitionDialogRef} role="dialog" aria-modal="true" aria-labelledby="order-transition-title" aria-describedby="order-transition-description" tabIndex={-1} className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl"><h3 id="order-transition-title" className="text-lg font-bold text-gray-900 dark:text-white">{transitionLabel(transition)}</h3><p id="order-transition-description" className="mt-1 text-sm text-gray-500">{selected.orderNumber} · {statusLabel(selected.status)} → {statusLabel(transition)}</p>{transition === 'completed' && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">Bu adım satıcı satış kayıtlarının bekleyen hakedişlerini otomatik olarak kullanılabilir duruma geçirir. Ödeme sağlayıcısı doğrulanmadan bu noktaya gelinemez.</div>}{transition === 'cancelled' && selected.paymentStatus !== 'unpaid' && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-100">Bu siparişin ödeme durumu {paymentLabel(selected.paymentStatus)}. Ödemesi alınmış sipariş doğrudan iptal edilemez, geri ödeme akışı kullanılmalıdır.</div>}{error && <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<form onSubmit={submitTransition} className="mt-4 space-y-4">{transition === 'shipped' && <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kargo takip numarası</span><input required minLength={4} maxLength={120} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>}<label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">İşlem notu (isteğe bağlı)</span><textarea maxLength={1000} rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="Müşteriye görünür durum geçmişi için kısa bir not..." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="flex gap-3"><button type="button" disabled={Boolean(busyId)} onClick={() => { setTransition(null); setError(''); }} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">Vazgeç</button><button type="submit" disabled={Boolean(busyId) || (transition === 'shipped' && trackingNumber.trim().length < 4) || (transition === 'cancelled' && selected.paymentStatus !== 'unpaid')} className={`min-h-11 flex-1 rounded-xl px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${transition === 'cancelled' ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-green hover:bg-green-700'}`}>{busyId ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> İşleniyor</span> : 'Onayla'}</button></div></form></div></div>}

      {toast && <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
