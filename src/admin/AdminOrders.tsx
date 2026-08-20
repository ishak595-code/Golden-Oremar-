import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, CreditCard, Eye, Gift, Loader2, LockKeyhole, MapPin, RefreshCw, RotateCcw, Search, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react';
import {
  allowedAdminOrderTransitions,
  formatOrderMoney,
  managementOrdersSnapshot,
  managementUpdateOrderStatus,
  orderAddressLabel,
  orderAdminErrorMessage,
  releaseOrderSettlement,
  settlementLabel,
  settlementReason,
  type ManagedOrder,
  type ManagedOrderStatus,
} from './orderAdminApi';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';

function statusLabel(status: ManagedOrderStatus) {
  const labels: Record<ManagedOrderStatus, string> = { draft: 'Taslak', pending_payment: 'Ödeme bekliyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor', partially_shipped: 'Kısmen kargoda', shipped: 'Kargoda', delivered: 'Teslim edildi', completed: 'Tamamlandı', cancelled: 'İptal edildi', refunded: 'Geri ödendi' };
  return labels[status];
}
function statusClass(status: ManagedOrderStatus) {
  if (status === 'completed' || status === 'delivered') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'shipped' || status === 'partially_shipped') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
  if (status === 'confirmed' || status === 'preparing') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  if (status === 'cancelled' || status === 'refunded') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
}
function paymentLabel(status: string) { return ({ unpaid: 'Ödenmedi', authorized: 'Provizyonda', partially_paid: 'Kısmi ödeme', paid: 'Ödendi', partially_refunded: 'Kısmi iade', refunded: 'Geri ödendi', failed: 'Başarısız', disputed: 'İtirazlı' } as Record<string, string>)[status] || status; }
function transitionLabel(status: ManagedOrderStatus) { return ({ pending_payment: 'Ödeme aşamasına geçir', confirmed: 'Siparişi onayla', preparing: 'Hazırlamaya al', shipped: 'Kargoya ver', delivered: 'Teslim edildi olarak işaretle', completed: 'Siparişi tamamla', cancelled: 'Siparişi iptal et' } as Partial<Record<ManagedOrderStatus, string>>)[status] || statusLabel(status); }
function formatDate(value: string | null | undefined, includeTime = false) { if (!value || Number.isNaN(Date.parse(value))) return 'Tarih doğrulanamadı'; const date = new Date(value); return includeTime ? date.toLocaleString('tr-TR') : date.toLocaleDateString('tr-TR'); }
function maskedPaymentLabel(order: ManagedOrder) { const method = order.paymentMethod; if (!method) return null; const expiry = method.expMonth && method.expYear ? ` · ${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}` : ''; return `${method.nickname || method.brand} •••• ${method.last4}${expiry}`; }
function giftOccasion(value: string | null) { return ({ just_because: 'İçimden geldi', birthday: 'Doğum günü', love: 'Sevgi', thank_you: 'Teşekkür', celebration: 'Kutlama', get_well: 'Geçmiş olsun', new_home: 'Yeni ev', new_baby: 'Yeni bebek' } as Record<string, string>)[value || ''] || value || 'Belirtilmedi'; }
function giftStyle(value: string | null) { return ({ oremar_gold: 'Oremar Altın', mountain_warmth: 'Dağ Sıcaklığı', minimal_elegance: 'Minimal Zarafet' } as Record<string, string>)[value || ''] || value || 'Standart sunum'; }

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
  const [settlementConfirm, setSettlementConfirm] = useState(false);
  const detailRef = useAccessibleDialog<HTMLDivElement>(Boolean(selected), () => { if (!busyId && !transition && !settlementConfirm) setSelected(null); });
  const transitionRef = useAccessibleDialog<HTMLDivElement>(Boolean(transition && selected), () => { if (!busyId) setTransition(null); });
  const settlementRef = useAccessibleDialog<HTMLDivElement>(Boolean(settlementConfirm && selected), () => { if (!busyId) setSettlementConfirm(false); });

  function show(message: string) { setToast(message); window.setTimeout(() => setToast(''), 3500); }
  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const snapshot = await managementOrdersSnapshot();
      if (snapshot.role !== 'admin') throw new Error('Bu ekran yalnız yönetici sipariş görünümünü kabul eder.');
      setOrders(snapshot.orders);
      setSelected(current => current ? snapshot.orders.find(order => order.id === current.id) || null : null);
    } catch (next) { setError(orderAdminErrorMessage(next, 'Siparişler yüklenemedi.')); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!q) return true;
      const gift = order.gift ? `${order.gift.recipientName} ${order.gift.senderName || ''} ${order.gift.cardTitle || ''}` : '';
      const payment = order.paymentMethod ? `${order.paymentMethod.nickname || ''} ${order.paymentMethod.brand} ${order.paymentMethod.last4}` : '';
      return `${order.orderNumber} ${order.customer} ${order.customerEmail || ''} ${order.trackingNumber || ''} ${gift} ${payment}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [orders, searchTerm, statusFilter]);

  const counts = useMemo(() => ({
    payment: orders.filter(order => order.status === 'pending_payment').length,
    preparing: orders.filter(order => ['confirmed', 'preparing'].includes(order.status)).length,
    shipping: orders.filter(order => ['partially_shipped', 'shipped'].includes(order.status)).length,
    returns: orders.filter(order => Boolean(order.returnStatus) && order.returnStatus !== 'Completed').length,
    settlement: orders.filter(order => order.settlement?.status === 'pending_approval' || order.settlement?.status === 'failed').length,
  }), [orders]);

  function openTransition(next: ManagedOrderStatus) { setTransition(next); setTrackingNumber(''); setNote(''); setError(''); }
  async function submitTransition(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !transition || busyId) return;
    setBusyId(selected.id); setError('');
    try {
      await managementUpdateOrderStatus({ orderId: selected.id, status: transition, trackingNumber: transition === 'shipped' ? trackingNumber : null, note });
      show(transition === 'completed' ? 'Sipariş tamamlandı. Satıcı hakedişi korumalı havuzda Super Admin onayını bekliyor.' : `Sipariş durumu ${statusLabel(transition).toLocaleLowerCase('tr-TR')} olarak güncellendi.`);
      setTransition(null); await load(true);
    } catch (next) { setError(orderAdminErrorMessage(next)); }
    finally { setBusyId(''); }
  }

  async function releaseSettlement() {
    if (!selected || busyId) return;
    setBusyId(selected.id); setError('');
    try { await releaseOrderSettlement(selected.id); setSettlementConfirm(false); show('Sağlayıcı kırılımları onaylandı. Satıcı hakedişi kullanılabilir bakiyeye geçti.'); await load(true); }
    catch (next) { setError(orderAdminErrorMessage(next)); }
    finally { setBusyId(''); }
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sipariş ve Hakediş Kontrolü</h2><p className="mt-1 max-w-4xl text-sm text-gray-500">Ödeme, stok, kargo, iade ve satıcı hakedişi birbirinden ayrı doğrulanır. Sipariş tamamlanınca para otomatik olarak satıcıya açılmaz; korumalı havuzdan yalnız Super Admin onayıyla çıkar.</p></div><button type="button" onClick={() => void load()} disabled={loading || Boolean(busyId)} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50"><RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true"/>Yenile</button></header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Metric label="Ödeme bekliyor" value={counts.payment}/><Metric label="Hazırlama" value={counts.preparing}/><Metric label="Kargoda" value={counts.shipping}/>
      <button type="button" onClick={() => setActiveTab?.('returns')} className="rounded-2xl border bg-white p-4 text-left shadow-sm dark:bg-gray-800"><div className="text-xs text-gray-500">Açık iade</div><div className="mt-1 text-2xl font-bold">{counts.returns}</div></button>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30"><div className="text-xs text-amber-800 dark:text-amber-200">Havuz onayı bekliyor</div><div className="mt-1 text-2xl font-bold text-amber-950 dark:text-amber-50">{counts.settlement}</div></div>
    </div>

    {error && !transition && !settlementConfirm ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
    <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_220px]" aria-label="Sipariş filtreleri"><label className="relative"><span className="sr-only">Sipariş ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true"/><input type="search" maxLength={160} value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Sipariş, müşteri, hediye, kart veya takip no ara" className="min-h-11 w-full rounded-xl border bg-gray-50 py-2 pl-10 pr-4 dark:bg-gray-900"/></label><select aria-label="Sipariş durumu" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 rounded-xl border bg-gray-50 px-4 dark:bg-gray-900"><option value="all">Tüm durumlar</option>{(['pending_payment','confirmed','preparing','partially_shipped','shipped','delivered','completed','cancelled','refunded'] as ManagedOrderStatus[]).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></section>

    {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true"/>Siparişler yükleniyor...</div> : <OrderList orders={filtered} onOpen={setSelected}/>} 

    {selected ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId && !transition && !settlementConfirm) setSelected(null); }}><div ref={detailRef} role="dialog" aria-modal="true" aria-labelledby="order-detail-title" tabIndex={-1} className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h3 id="order-detail-title" className="text-xl font-bold">{selected.orderNumber}</h3><p className="mt-1 text-sm text-gray-500">{formatDate(selected.date, true)} · {statusLabel(selected.status)}</p></div><button type="button" disabled={Boolean(busyId)} onClick={() => setSelected(null)} className="min-h-11 min-w-11 rounded-xl p-2" aria-label="Sipariş detayını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true"/></button></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2"><DeliveryCard order={selected}/><PaymentCard order={selected}/></div>
      <SettlementCard order={selected} busy={Boolean(busyId)} onRelease={() => setSettlementConfirm(true)}/>
      {selected.customerNote ? <section className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><strong>Müşteri notu:</strong> {selected.customerNote}</section> : null}
      {selected.gift ? <GiftCard order={selected}/> : null}
      <section className="mt-4 rounded-2xl border p-4"><h4 className="font-bold">Sipariş İçeriği</h4><div className="mt-3 space-y-2">{selected.items.map(item => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><div className="min-w-0"><div className="font-semibold">{item.name}</div><div className="mt-1 text-xs text-gray-500">{item.variantName || 'Standart varyant'} · {item.quantity} adet · {item.fulfillmentStatus}</div></div><div className="shrink-0 font-semibold">{item.lineTotal.toLocaleString('tr-TR',{style:'currency',currency:selected.currency})}</div></div>)}</div></section>
      {selected.returnStatus ? <section className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold">İade süreci: {selected.returnStatus}</h4>{selected.returnReason ? <p className="mt-1 text-sm">{selected.returnReason}</p> : null}</div><button type="button" onClick={() => setActiveTab?.('returns')} className="min-h-11 rounded-xl border border-orange-300 px-4 font-semibold"><RotateCcw className="mr-2 inline h-4 w-4" aria-hidden="true"/>İadeye git</button></div></section> : null}
      <section className="mt-5 border-t pt-5"><h4 className="font-bold">Güvenli durum işlemleri</h4><div className="mt-3 flex flex-wrap gap-2">{allowedAdminOrderTransitions(selected.status).filter(status => status !== 'partially_shipped').map(status => <button key={status} type="button" disabled={Boolean(busyId)} onClick={() => openTransition(status)} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50">{transitionLabel(status)}</button>)}{allowedAdminOrderTransitions(selected.status).length === 0 ? <span className="text-sm text-gray-500">Sipariş yaşam döngüsü için başka durum geçişi yok.</span> : null}</div></section>
    </div></div> : null}

    {transition && selected ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4"><form ref={transitionRef} onSubmit={submitTransition} role="alertdialog" aria-modal="true" aria-labelledby="transition-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-800"><h3 id="transition-title" className="text-lg font-bold">{transitionLabel(transition)}</h3><p className="mt-2 text-sm text-gray-500">{selected.orderNumber} için bu durum değişikliği sunucu kurallarına göre doğrulanacaktır.</p>{transition === 'shipped' ? <label className="mt-4 block"><span className="mb-1 block text-sm font-semibold">Takip numarası</span><input required minLength={4} maxLength={120} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} className="min-h-11 w-full rounded-xl border px-3"/></label> : null}<label className="mt-4 block"><span className="mb-1 block text-sm font-semibold">İşlem notu</span><textarea maxLength={1000} value={note} onChange={event => setNote(event.target.value)} rows={3} className="w-full rounded-xl border p-3"/></label>{error ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}<div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={Boolean(busyId)} onClick={() => setTransition(null)} className="min-h-11 rounded-xl border font-semibold">Vazgeç</button><button type="submit" disabled={Boolean(busyId)} className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green disabled:opacity-50">{busyId ? 'İşleniyor...' : 'Onayla'}</button></div></form></div> : null}

    {settlementConfirm && selected?.settlement ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4"><div ref={settlementRef} role="alertdialog" aria-modal="true" aria-labelledby="settlement-confirm-title" aria-describedby="settlement-confirm-desc" tabIndex={-1} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl outline-none dark:bg-gray-800"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-brand-green" aria-hidden="true"/><div><h3 id="settlement-confirm-title" className="text-lg font-bold">Satıcı hakedişini serbest bırak</h3><p id="settlement-confirm-desc" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Bu işlem iyzico korumalı havuzundaki bekleyen ürün kırılımlarını onaylar. Açık iade veya geri ödeme varsa sunucu işlemi reddeder.</p></div></div><div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-sm text-gray-500">Serbest bırakılacak satıcı hakedişi</div><div className="mt-1 text-xl font-bold">{formatOrderMoney(selected.settlement.pendingSellerMinor, selected.settlement.currency)}</div><div className="mt-1 text-xs text-gray-500">{selected.settlement.pendingSplitCount} sağlayıcı kırılımı bekliyor.</div></div>{error ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}<div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={Boolean(busyId)} onClick={() => setSettlementConfirm(false)} className="min-h-11 rounded-xl border font-semibold">Vazgeç</button><button type="button" disabled={Boolean(busyId)} onClick={() => void releaseSettlement()} className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green disabled:opacity-50">{busyId ? 'Sağlayıcı onaylanıyor...' : 'Hakedişi serbest bırak'}</button></div></div></div> : null}
    {toast ? <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[80] flex max-w-md items-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true"/>{toast}</div> : null}
  </div>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>}
function OrderList({orders,onOpen}:{orders:ManagedOrder[];onOpen:(order:ManagedOrder)=>void}){if(!orders.length)return <div className="rounded-2xl border p-10 text-center text-gray-500"><ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true"/>Filtrelerle eşleşen sipariş yok.</div>;return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-gray-800" aria-label="Sipariş listesi"><div className="divide-y lg:hidden">{orders.map(order=><article key={order.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{order.orderNumber}</div><div className="mt-1 text-xs text-gray-500">{order.customer}</div></div><button type="button" onClick={()=>onOpen(order)} className="min-h-11 min-w-11 rounded-xl" aria-label={`${order.orderNumber} siparişini incele`}><Eye className="mx-auto h-5 w-5" aria-hidden="true"/></button></div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs">{paymentLabel(order.paymentStatus)}</span>{order.settlement?.status==='pending_approval'||order.settlement?.status==='failed'?<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Havuz onayı</span>:null}</div><div className="mt-4 flex justify-between gap-3"><span className="text-xs text-gray-500">{formatDate(order.date)} · {order.items.length} kalem</span><strong>{formatOrderMoney(order.totalMinor,order.currency)}</strong></div></article>)}</div><div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/50"><tr><th className="px-5 py-4">Sipariş</th><th className="px-5 py-4">Müşteri</th><th className="px-5 py-4">Ödeme</th><th className="px-5 py-4">Hakediş</th><th className="px-5 py-4">Tutar</th><th className="px-5 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y">{orders.map(order=><tr key={order.id}><td className="px-5 py-4"><strong>{order.orderNumber}</strong><div className="mt-1 text-xs text-gray-500">{formatDate(order.date,true)} · {statusLabel(order.status)}</div></td><td className="px-5 py-4">{order.customer}<div className="text-xs text-gray-500">{order.customerEmail||'E-posta yok'}</div></td><td className="px-5 py-4">{paymentLabel(order.paymentStatus)}{maskedPaymentLabel(order)?<div className="text-xs text-gray-500">{maskedPaymentLabel(order)}</div>:null}</td><td className="px-5 py-4 text-xs font-semibold">{order.settlement?settlementLabel(order.settlement.status):'Uygulanmıyor'}</td><td className="px-5 py-4 font-semibold">{formatOrderMoney(order.totalMinor,order.currency)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={()=>onOpen(order)} className="min-h-11 min-w-11 rounded-xl" aria-label={`${order.orderNumber} siparişini incele`}><Eye className="mx-auto h-4 w-4" aria-hidden="true"/></button></td></tr>)}</tbody></table></div></section>}
function DeliveryCard({order}:{order:ManagedOrder}){const address=orderAddressLabel(order.shippingAddress);return <section className="rounded-2xl border p-4"><h4 className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand-green" aria-hidden="true"/>Teslimat</h4><div className="mt-3 text-sm"><div className="font-semibold">{address.recipient||order.customer}</div><div className="mt-1 text-gray-600 dark:text-gray-300">{address.address||'Adres satırı okunamadı.'}</div>{address.phone?<div className="mt-2 text-gray-500">Telefon: {address.phone}</div>:null}{order.trackingNumber?<div className="mt-2 flex items-center gap-2 text-gray-500"><Truck className="h-4 w-4" aria-hidden="true"/>Takip: {order.trackingNumber}</div>:null}</div></section>}
function PaymentCard({order}:{order:ManagedOrder}){return <section className="rounded-2xl border p-4"><h4 className="flex items-center gap-2 font-bold"><CreditCard className="h-4 w-4 text-brand-green" aria-hidden="true"/>Ödeme</h4><dl className="mt-3 space-y-2 text-sm"><Row label="Durum" value={paymentLabel(order.paymentStatus)}/>{order.paymentMethod?<><Row label="Kart" value={maskedPaymentLabel(order)||''}/><Row label="Sağlayıcı" value={order.paymentMethod.provider}/></>:null}<Row label="Gönderim" value={order.fulfillmentStatus}/><Row label="Toplam" value={formatOrderMoney(order.totalMinor,order.currency)} strong/></dl><p className="mt-3 text-xs text-gray-500">Tam kart numarası, CVC ve yeniden kullanılabilir ödeme referansı yönetim ekranına açılmaz.</p></section>}
function SettlementCard({order,busy,onRelease}:{order:ManagedOrder;busy:boolean;onRelease:()=>void}){const s=order.settlement;if(!s)return null;const released=s.status==='released';const pending=s.status==='pending_approval'||s.status==='failed';return <section className={`mt-4 rounded-2xl border p-4 ${released?'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20':pending?'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20':'border-gray-200'}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3">{released?<ShieldCheck className="h-6 w-6 shrink-0 text-green-700" aria-hidden="true"/>:<LockKeyhole className="h-6 w-6 shrink-0 text-amber-700" aria-hidden="true"/>}<div><h4 className="font-bold">Korumalı Hakediş Havuzu</h4><div className="mt-1 text-sm font-semibold">{settlementLabel(s.status)}</div><p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{settlementReason(s.reason)}</p>{s.lastError?<p className="mt-2 text-xs text-red-700 dark:text-red-300">Son sağlayıcı hatası: {s.lastError}</p>:null}</div></div><div className="shrink-0 text-left sm:text-right"><div className="text-xs text-gray-500">Bekleyen satıcı hakkı</div><div className="font-bold">{formatOrderMoney(s.pendingSellerMinor,s.currency)}</div><div className="mt-1 text-xs text-gray-500">{s.approvedSplitCount}/{s.splitCount} kırılım onaylandı</div></div></div>{s.canRelease&&s.eligible&&pending?<button type="button" disabled={busy} onClick={onRelease} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green px-4 font-bold text-brand-on-green disabled:opacity-50"><Banknote className="mr-2 inline h-4 w-4" aria-hidden="true"/>Satıcı hakedişini serbest bırak</button>:null}{!s.canRelease&&s.eligible?<p className="mt-3 text-xs text-gray-500">Bu işlemi yalnız Super Admin gerçekleştirebilir.</p>:null}</section>}
function GiftCard({order}:{order:ManagedOrder}){const gift=order.gift!;return <section className="mt-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/70 p-4 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20"><h4 className="flex items-center gap-2 font-bold"><Gift className="h-5 w-5" aria-hidden="true"/>Hediye hazırlama talimatı</h4><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><Info label="Alıcı" value={gift.recipientName}/><Info label="Gönderen" value={gift.senderName||'İsimsiz gönderim'}/><Info label="Özel gün" value={giftOccasion(gift.occasion)}/><Info label="Sunum" value={giftStyle(gift.presentationStyle)}/><Info label="Kart başlığı" value={gift.cardTitle||'Varsayılan'}/><Info label="Fiyat" value={gift.hidePrice?'Pakette gizlenecek':'Gizleme talebi yok'}/></dl>{gift.message?<p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-sm dark:bg-gray-900/60">{gift.message}</p>:null}</section>}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className={`text-right ${strong?'font-bold text-brand-green':'font-semibold'}`}>{value}</dd></div>}
function Info({label,value}:{label:string;value:string}){return <div><dt className="text-xs font-semibold text-gray-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>}
