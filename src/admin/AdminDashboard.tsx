import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Boxes, Check, CircleDollarSign, Clock3, FileCheck2, Loader2, Package, RefreshCw, RotateCcw, ShoppingBag, Store, Users } from 'lucide-react';
import { useCustomerSession } from '../features/auth/useCustomerSession';
import {
  dashboardErrorMessage,
  formatMinor,
  getAdminOperationsOverview,
  getMyProducerDashboardV2,
  type AdminOperationsOverview,
  type ProducerDashboardV2,
} from './dashboardApi';

interface AdminDashboardProps {
  setActiveTab?: (tab: string) => void;
}

function StatCard({ label, value, helper, icon }: { label: string; value: React.ReactNode; helper?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</div>
          <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
          {helper && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</div>}
        </div>
        <div className="rounded-xl bg-brand-green/10 p-2.5 text-brand-green">{icon}</div>
      </div>
    </div>
  );
}

function AdminOverview({ data, setActiveTab }: { data: AdminOperationsOverview; setActiveTab?: (tab: string) => void }) {
  const queueRows = [
    { key: 'vendor-applications', label: 'Satıcı başvuruları', value: data.counts.producer_applications, helper: 'Gönderilen, incelenen veya ek bilgi bekleyen', icon: <Store className="h-5 w-5" aria-hidden="true" /> },
    { key: 'product-approvals', label: 'Ürün incelemeleri', value: data.counts.product_reviews, helper: 'Yayın öncesi onay bekleyen ürünler', icon: <Package className="h-5 w-5" aria-hidden="true" /> },
    { key: 'reviews', label: 'Yorum moderasyonu', value: data.counts.review_moderation, helper: 'Onay bekleyen müşteri yorumları', icon: <FileCheck2 className="h-5 w-5" aria-hidden="true" /> },
    { key: 'orders', label: 'Açık siparişler', value: data.counts.open_orders, helper: 'Aktif sipariş yaşam döngüsündeki kayıtlar', icon: <ShoppingBag className="h-5 w-5" aria-hidden="true" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif kullanıcı" value={data.counts.active_users.toLocaleString('tr-TR')} helper="Silinmemiş aktif hesaplar" icon={<Users className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Doğrulanmış üretici" value={data.counts.verified_producers.toLocaleString('tr-TR')} helper="Aktif ve kimliği doğrulanmış" icon={<BadgeCheck className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Yayındaki ürün" value={data.counts.published_products.toLocaleString('tr-TR')} helper="Aktif katalog ürünleri" icon={<Boxes className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="İade talepleri" value={data.counts.return_requests.toLocaleString('tr-TR')} helper="Açık iade iş akışları" icon={<RotateCcw className="h-5 w-5" aria-hidden="true" />} />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="finance-summary-title">
        <div className="flex items-start justify-between gap-3">
          <div><h3 id="finance-summary-title" className="text-lg font-bold text-gray-900 dark:text-white">Tahsilat Özeti</h3><p className="mt-1 text-xs text-gray-500">Gerçek ödeme ve başarılı iade hareketlerinden hesaplanır.</p></div>
          <CircleDollarSign className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.finance_by_currency.map(row => <div key={row.currency} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs font-semibold text-gray-500">{row.currency}</div><div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{formatMinor(row.net_collected_minor, row.currency)}</div><div className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><span className="text-gray-500">Tahsil</span><div className="font-medium text-gray-800 dark:text-gray-200">{formatMinor(row.captured_minor, row.currency)}</div></div><div><span className="text-gray-500">İade</span><div className="font-medium text-gray-800 dark:text-gray-200">{formatMinor(row.refunded_minor, row.currency)}</div></div></div></div>)}
          {data.finance_by_currency.length === 0 && <div className="sm:col-span-2 xl:col-span-3 py-5 text-center text-sm text-gray-500">Henüz doğrulanmış ödeme hareketi yok.</div>}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Operasyon kuyrukları">
        {queueRows.map(row => <button key={row.key} type="button" onClick={() => setActiveTab?.(row.key)} className="min-h-32 rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:border-brand-green/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green dark:border-gray-700 dark:bg-gray-800"><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-brand-green/10 p-2.5 text-brand-green">{row.icon}</div><div className="text-2xl font-black text-gray-900 dark:text-white">{row.value}</div></div><div className="mt-4 font-semibold text-gray-900 dark:text-white">{row.label}</div><div className="mt-1 text-xs text-gray-500">{row.helper}</div></button>)}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="recent-orders-title">
          <div className="border-b border-gray-100 p-5 dark:border-gray-700"><h3 id="recent-orders-title" className="font-bold text-gray-900 dark:text-white">Son Siparişler</h3><p className="mt-1 text-xs text-gray-500">En yeni 10 gerçek sipariş.</p></div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">{data.recent_orders.map(order => <div key={order.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="truncate font-semibold text-gray-900 dark:text-white">{order.order_number}</div><div className="mt-1 text-xs text-gray-500">{order.status} · {order.payment_status} · {order.fulfillment_status}</div></div><div className="shrink-0 text-right"><div className="font-semibold text-gray-900 dark:text-white">{formatMinor(order.total_minor, order.currency)}</div><div className="mt-1 text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('tr-TR')}</div></div></div>)}{data.recent_orders.length === 0 && <div className="p-8 text-center text-sm text-gray-500">Henüz sipariş yok.</div>}</div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="admin-queue-title">
          <h3 id="admin-queue-title" className="font-bold text-gray-900 dark:text-white">Diğer Yönetim Kuyrukları</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Ürün değişiklik talepleri</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{data.counts.product_change_requests}</div></div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Destek konuşmaları</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{data.counts.support_conversations}</div></div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Hesap kapatma talepleri</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{data.counts.account_closures}</div></div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">İşlenen satıcı ödemeleri</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{data.counts.producer_payouts}</div></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProducerOverview({ data, setActiveTab }: { data: ProducerDashboardV2; setActiveTab?: (tab: string) => void }) {
  const primaryBalance = data.finance.balances[0];
  const profile = data.profile;
  const summary = data.summary;
  const commerce = data.commerce;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.display_name}</h2>{profile.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-950/40 dark:text-green-200"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Doğrulanmış satıcı</span>}</div><p className="mt-1 text-sm text-gray-500">{profile.production_location || 'Üretim yeri henüz belirtilmemiş'}</p></div><button type="button" onClick={() => setActiveTab?.('profile')} className="min-h-11 rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-700 hover:border-brand-green hover:text-brand-green dark:border-gray-700 dark:text-gray-200">Mağaza profilini düzenle</button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Takipçi" value={commerce.followerCount.toLocaleString('tr-TR')} helper="Gerçek mağaza takipleri" icon={<Users className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Müşteri" value={commerce.customerCount.toLocaleString('tr-TR')} helper="Sipariş vermiş benzersiz müşteri" icon={<Users className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Açık sipariş" value={commerce.openOrderCount.toLocaleString('tr-TR')} helper="Hazırlama ve sevkiyat sürecinde" icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="Yayındaki ürün" value={summary.publishedProducts.toLocaleString('tr-TR')} helper={`${summary.lowStockVariants} düşük stok varyantı`} icon={<Package className="h-5 w-5" aria-hidden="true" />} />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="producer-finance-title">
        <div className="flex items-start justify-between gap-3"><div><h3 id="producer-finance-title" className="font-bold text-gray-900 dark:text-white">Satıcı Finans Özeti</h3><p className="mt-1 text-xs text-gray-500">Komisyon, bekleyen bakiye ve ödenebilir bakiye gerçek ledger kayıtlarından gelir.</p></div><CircleDollarSign className="h-5 w-5 text-gray-400" aria-hidden="true" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Platform komisyonu</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">%{(data.finance.commissionBasisPoints / 100).toLocaleString('tr-TR')}</div></div>{primaryBalance ? <><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Bekleyen bakiye</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{formatMinor(primaryBalance.pendingMinor, primaryBalance.currency)}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Ödenebilir bakiye</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{formatMinor(primaryBalance.availableToPayoutMinor, primaryBalance.currency)}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Toplam net gelir</div><div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{formatMinor(primaryBalance.lifetimeNetMinor, primaryBalance.currency)}</div></div></> : <div className="sm:col-span-2 lg:col-span-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900/60">Henüz finansal hareket yok.</div>}</div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ürün ve izlenebilirlik durumları">
        <button type="button" onClick={() => setActiveTab?.('products')} className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Onay bekleyen ürün</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summary.reviewProducts}</div></button>
        <button type="button" onClick={() => setActiveTab?.('products')} className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Reddedilen ürün</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summary.rejectedProducts}</div></button>
        <button type="button" onClick={() => setActiveTab?.('products')} className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Bekleyen değişiklik</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summary.pendingChanges}</div></button>
        <button type="button" onClick={() => setActiveTab?.('stock')} className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">İncelemedeki parti</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summary.reviewBatches}</div></button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="producer-recent-orders-title">
        <div className="border-b border-gray-100 p-5 dark:border-gray-700"><h3 id="producer-recent-orders-title" className="font-bold text-gray-900 dark:text-white">Mağazanın Son Siparişleri</h3><p className="mt-1 text-xs text-gray-500">Yalnızca bu üreticiye ait sipariş kalemlerinin tutarı gösterilir.</p></div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">{commerce.recentOrders.map(order => <button key={order.id} type="button" onClick={() => setActiveTab?.('orders')} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"><div className="min-w-0"><div className="truncate font-semibold text-gray-900 dark:text-white">{order.orderNumber}</div><div className="mt-1 text-xs text-gray-500">{order.status} · {order.fulfillmentStatus}</div></div><div className="shrink-0 text-right"><div className="font-semibold text-gray-900 dark:text-white">{formatMinor(order.producerTotalMinor, order.currency)}</div><div className="mt-1 text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('tr-TR')}</div></div></button>)}{commerce.recentOrders.length === 0 && <div className="p-8 text-center text-sm text-gray-500">Henüz mağaza siparişi yok.</div>}</div>
      </section>
    </div>
  );
}

export function AdminDashboard({ setActiveTab }: AdminDashboardProps = {}) {
  const { currentUser, authReady } = useCustomerSession();
  const roles = useMemo(() => Array.isArray(currentUser?.roles) ? currentUser.roles.map(String) : [], [currentUser?.roles]);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isProducer = roles.includes('producer') || currentUser?.role === 'vendor';
  const [adminData, setAdminData] = useState<AdminOperationsOverview | null>(null);
  const [producerData, setProducerData] = useState<ProducerDashboardV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    if (!authReady || !currentUser) return;
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        setAdminData(await getAdminOperationsOverview());
        setProducerData(null);
      } else if (isProducer) {
        setProducerData(await getMyProducerDashboardV2());
        setAdminData(null);
      } else {
        throw new Error('Bu hesap yönetim paneline bağlı değil.');
      }
    } catch (err) {
      setError(dashboardErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authReady && currentUser) void load();
  }, [authReady, currentUser?.id, isAdmin, isProducer]);

  const refresh = async () => {
    await load();
    setToast('Panel verileri yenilendi.');
    window.setTimeout(() => setToast(''), 2500);
  };

  if (!authReady || loading) return <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Canlı panel verileri yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel Genel Bakış</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sahte sayaç veya rastgele metrik yok. Bu ekran yalnızca canlı Supabase sözleşmelerini gösterir.</p></div><button type="button" onClick={() => void refresh()} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Yenile</button></header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> <span>{error}</span></div>}
      {!error && isAdmin && adminData && <AdminOverview data={adminData} setActiveTab={setActiveTab} />}
      {!error && !isAdmin && producerData && <ProducerOverview data={producerData} setActiveTab={setActiveTab} />}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
