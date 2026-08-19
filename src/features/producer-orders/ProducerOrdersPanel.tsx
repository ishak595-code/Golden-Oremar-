import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import {
  createProducerShipment,
  getProducerOrderDetail,
  listProducerOrders,
  markProducerOrderItemsProcessing,
  type ProducerOrderDetail,
  type ProducerOrderPage,
  type ProducerOrderScope,
} from './api';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from '../account/ui';

const orderStatus: Record<string, string> = {
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  partially_shipped: 'Kısmen kargoda',
  shipped: 'Kargoda',
  delivered: 'Teslim edildi',
  completed: 'Tamamlandı',
  refunded: 'Geri ödendi',
};

const fulfillmentStatus: Record<string, string> = {
  unfulfilled: 'Hazırlanmadı',
  processing: 'Hazırlanıyor',
  partially_fulfilled: 'Kısmen gönderildi',
  fulfilled: 'Gönderildi',
  cancelled: 'İptal',
  returned: 'İade',
};

const shipmentStatus: Record<string, string> = {
  label_created: 'Etiket oluşturuldu',
  picked_up: 'Teslim alındı',
  in_transit: 'Yolda',
  out_for_delivery: 'Dağıtımda',
  delivered: 'Teslim edildi',
  exception: 'Sorun var',
  returned: 'Geri döndü',
};

type ShipmentSelection = Record<string, { selected: boolean; quantity: string }>;

export default function ProducerOrdersPanel({ onBack, onChanged }: { onBack: () => void; onChanged?: () => Promise<void> | void }) {
  const [scope, setScope] = useState<ProducerOrderScope>('open');
  const [page, setPage] = useState<ProducerOrderPage | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ProducerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadList(nextScope = scope) {
    try {
      setLoading(true);
      setError('');
      setPage(await listProducerOrders(nextScope));
    } catch (err: unknown) {
      setError(friendly(err));
    } finally {
      setLoading(false);
    }
  }

  async function open(id: string) {
    try {
      setLoading(true);
      setError('');
      const next = await getProducerOrderDetail(id);
      setSelectedId(next.id);
      setDetail(next);
    } catch (err: unknown) {
      setError(friendly(err));
      setSelectedId('');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadList(scope); }, [scope]);

  async function changed(nextDetail: ProducerOrderDetail) {
    setDetail(nextDetail);
    await loadList(scope);
    await onChanged?.();
  }

  if (loading) return <LoadingState label="Satıcı siparişleri yükleniyor" />;
  if (selectedId && detail) {
    return (
      <OrderDetail
        detail={detail}
        onBack={async () => {
          setSelectedId('');
          setDetail(null);
          await loadList(scope);
        }}
        onChanged={changed}
      />
    );
  }
  if (error && !page) return <ErrorState message={error} onRetry={() => loadList(scope)} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold">
          <ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Satıcı paneline dön
        </button>
        <button type="button" onClick={() => void loadList(scope)} className="min-h-11 rounded-xl border px-4 font-semibold">
          <RefreshCw aria-hidden="true" className="mr-2 inline h-4 w-4" />Yenile
        </button>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{error}</div> : null}

      <Panel title="Sipariş Operasyonu" description="Yalnız size ait, ödemesi doğrulanmış sipariş kalemlerini hazırlayın ve kargoya verin.">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Sipariş filtresi">
          {([['open', 'Hazırlanacak'], ['shipped', 'Gönderilen'], ['all', 'Tümü']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setScope(value)} aria-pressed={scope === value} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${scope === value ? 'border-brand-green bg-brand-green/10 text-brand-green' : ''}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-500">{page ? `${page.total} sipariş` : 'Sipariş sayısı yüklenemedi'}</div>

        {!page?.items.length ? (
          <EmptyState
            title={scope === 'open' ? 'Hazırlanacak sipariş yok' : 'Sipariş bulunamadı'}
            body={scope === 'open' ? 'Yeni, ödemesi onaylanmış satıcı siparişleri burada görünür.' : 'Bu filtrede size ait sipariş bulunmuyor.'}
          />
        ) : (
          <div className="mt-3 space-y-3">
            {page.items.map(order => (
              <button key={order.id} type="button" onClick={() => void open(order.id)} className="min-h-20 w-full rounded-2xl border p-4 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold">{order.orderNumber}</div>
                    <div className="mt-1 text-sm text-gray-500">{orderStatus[order.status] || order.status} · {order.itemCount} size ait kalem</div>
                    <div className="mt-1 text-sm text-gray-500">{order.recipientName || 'Alıcı adı paylaşılmadı'} · {joinLocation(order.destination)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold"><Money minor={order.producerSubtotalMinor} currency={order.currency} /></div>
                    {order.remainingItemCount > 0 ? (
                      <div className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{order.remainingItemCount} kalem bekliyor</div>
                    ) : (
                      <div className="mt-1 text-xs font-semibold text-green-700 dark:text-green-300">Sizin kalemleriniz gönderildi</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>
      <PrivacyNotice />
    </div>
  );
}

function OrderDetail({ detail, onBack, onChanged }: { detail: ProducerOrderDetail; onBack: () => Promise<void> | void; onChanged: (detail: ProducerOrderDetail) => Promise<void> | void }) {
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [shipping, setShipping] = useState<ShipmentSelection>({});
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [eta, setEta] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const fulfillableItems = useMemo(
    () => detail.items.filter(item => item.remainingToShip > 0 && !['cancelled', 'returned', 'fulfilled'].includes(item.fulfillmentStatus)),
    [detail],
  );

  useEffect(() => {
    const nextProcessing: Record<string, boolean> = {};
    const nextShipping: ShipmentSelection = {};
    for (const item of fulfillableItems) {
      nextProcessing[item.id] = item.fulfillmentStatus === 'unfulfilled';
      nextShipping[item.id] = { selected: false, quantity: String(item.remainingToShip) };
    }
    setProcessing(nextProcessing);
    setShipping(nextShipping);
  }, [detail.id, detail.items]);

  const selectedProcessing = Object.entries(processing).filter(([, selected]) => selected).map(([id]) => id);
  const selectedShipmentRows = fulfillableItems.filter(item => shipping[item.id]?.selected);

  async function markProcessing() {
    if (!selectedProcessing.length) {
      setError('Hazırlamaya başlayacağınız en az bir kalemi seçin.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      setStatus('');
      const next = await markProducerOrderItemsProcessing(detail.id, selectedProcessing);
      setStatus('Seçili ürünler hazırlanıyor olarak işaretlendi.');
      await onChanged(next);
    } catch (err: unknown) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function createShipment() {
    if (!selectedShipmentRows.length) {
      setError('Kargoya verilecek en az bir kalemi seçin.');
      return;
    }

    const selectedItems: Array<{ orderItemId: string; quantity: number }> = [];
    for (const item of selectedShipmentRows) {
      const raw = shipping[item.id]?.quantity ?? '';
      const quantity = Number(raw);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.remainingToShip) {
        setError(`${item.productName} için gönderilecek adet 1 ile ${item.remainingToShip} arasında tam sayı olmalıdır.`);
        return;
      }
      selectedItems.push({ orderItemId: item.id, quantity });
    }

    const normalizedCarrier = carrier.trim();
    const normalizedTracking = tracking.trim();
    const normalizedUrl = trackingUrl.trim();
    if (normalizedCarrier.length < 2 || normalizedCarrier.length > 100) {
      setError('Kargo/taşıyıcı adı 2 ile 100 karakter arasında olmalıdır.');
      return;
    }
    if (normalizedTracking.length < 2 || normalizedTracking.length > 160) {
      setError('Takip numarası 2 ile 160 karakter arasında olmalıdır.');
      return;
    }
    if (normalizedUrl && !safeHttpsInput(normalizedUrl)) {
      setError('Takip bağlantısı geçerli bir HTTPS adresi olmalıdır.');
      return;
    }

    let etaIso: string | null = null;
    if (eta) {
      const date = new Date(eta);
      const timestamp = date.getTime();
      if (Number.isNaN(timestamp) || timestamp < Date.now() - 5 * 60_000 || timestamp > Date.now() + 120 * 24 * 60 * 60_000) {
        setError('Tahmini teslim tarihi bugünden itibaren en fazla 120 gün içinde olmalıdır.');
        return;
      }
      etaIso = date.toISOString();
    }

    try {
      setBusy(true);
      setError('');
      setStatus('');
      const next = await createProducerShipment({
        orderId: detail.id,
        items: selectedItems,
        carrier: normalizedCarrier,
        trackingNumber: normalizedTracking,
        trackingUrl: normalizedUrl || null,
        estimatedDeliveryAt: etaIso,
      });
      setCarrier('');
      setTracking('');
      setTrackingUrl('');
      setEta('');
      setStatus('Kargo kaydı oluşturuldu ve müşteriye bildirim gönderildi.');
      await onChanged(next);
    } catch (err: unknown) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  const address = detail.shipping;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => void onBack()} className="min-h-11 rounded-xl border px-4 font-semibold">
          <ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Siparişlere dön
        </button>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold dark:bg-gray-800">{orderStatus[detail.status] || detail.status}</span>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">{error}</div> : null}
      {status ? <div role="status" aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-100">{status}</div> : null}

      <Panel title={`Sipariş ${detail.orderNumber}`} description="Bu ekranda yalnız sizin ürün kalemleriniz ve gönderim için gerekli alıcı bilgileri gösterilir.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Size ait tutar"><Money minor={detail.producerSubtotalMinor} currency={detail.currency} /></Metric>
          <Metric label="Sipariş durumu">{orderStatus[detail.status] || detail.status}</Metric>
          <Metric label="Gönderim durumu">{fulfillmentStatus[detail.fulfillmentStatus] || detail.fulfillmentStatus}</Metric>
        </div>
      </Panel>

      <Panel title="Teslimat Bilgisi" description="Bu bilgiler yalnız bu siparişi gönderebilmeniz için görünür.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Alıcı" value={address.recipientName} />
          <Field label="Telefon" value={address.phone} href={`tel:${address.phone}`} />
          <Field label="Ülke" value={address.countryCode} />
          <Field label="İl / İlçe" value={[address.province, address.district].filter(Boolean).join(' / ') || null} />
          <Field label="Mahalle / köy" value={address.neighborhood} />
          <Field label="Posta kodu" value={address.postalCode} />
          <div className="sm:col-span-2"><Field label="Adres" value={address.addressLine} /></div>
          {address.deliveryNotes ? <div className="sm:col-span-2"><Field label="Teslimat notu" value={address.deliveryNotes} /></div> : null}
        </dl>
      </Panel>

      <Panel title="Size Ait Ürünler">
        <div className="space-y-3">
          {detail.items.map(item => (
            <article key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{item.productName}</div>
                  <div className="text-sm text-gray-500">{item.variantName || 'Varyant adı belirtilmemiş'}{item.sku ? ` · SKU ${item.sku}` : ''}</div>
                  <div className="mt-1 text-sm">Sipariş: {item.quantity} · Gönderilen: {item.shippedQuantity} · Kalan: {item.remainingToShip}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold"><Money minor={item.lineTotalMinor} currency={detail.currency} /></div>
                  <div className="mt-1 text-xs font-semibold">{fulfillmentStatus[item.fulfillmentStatus] || item.fulfillmentStatus}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      {detail.canFulfill && fulfillableItems.length ? (
        <>
          <Panel title="1. Hazırlamaya Başla" description="Yalnız gerçekten hazırlamaya başladığınız kalemleri seçin.">
            <fieldset disabled={busy}>
              <legend className="sr-only">Hazırlanacak kalemler</legend>
              <div className="space-y-2">
                {fulfillableItems.map(item => (
                  <label key={item.id} className="flex min-h-12 items-center gap-3 rounded-xl border p-3">
                    <input type="checkbox" className="h-5 w-5" checked={processing[item.id] === true} onChange={event => setProcessing(current => ({ ...current, [item.id]: event.target.checked }))} />
                    <span className="flex-1"><span className="block font-semibold">{item.productName}</span><span className="text-xs text-gray-500">Kalan {item.remainingToShip} adet</span></span>
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => void markProcessing()} disabled={busy || !selectedProcessing.length} className="mt-3 min-h-12 w-full rounded-xl border border-brand-green font-bold text-brand-green disabled:opacity-50">
                <PackageCheck aria-hidden="true" className="mr-2 inline h-5 w-5" />{busy ? 'İşleniyor…' : 'Seçili ürünleri hazırlanıyor yap'}
              </button>
            </fieldset>
          </Panel>

          <Panel title="2. Kargoya Ver" description="Takip numarası gerçek taşıyıcı kaydı olmalıdır. Sistem müşteriye otomatik bildirim gönderir.">
            <fieldset disabled={busy} className="space-y-4">
              <legend className="sr-only">Kargo oluştur</legend>
              <div className="space-y-2">
                {fulfillableItems.map(item => {
                  const selection = shipping[item.id] ?? { selected: false, quantity: String(item.remainingToShip) };
                  return (
                    <div key={item.id} className="rounded-xl border p-3">
                      <label className="flex min-h-11 items-center gap-3">
                        <input type="checkbox" className="h-5 w-5" checked={selection.selected} onChange={event => setShipping(current => ({ ...current, [item.id]: { ...selection, selected: event.target.checked } }))} />
                        <span className="font-semibold">{item.productName}</span>
                      </label>
                      {selection.selected ? (
                        <label className="mt-2 block">
                          <span className="text-xs font-semibold">Gönderilecek adet (maks. {item.remainingToShip})</span>
                          <input type="number" min="1" max={item.remainingToShip} step="1" inputMode="numeric" value={selection.quantity} onChange={event => setShipping(current => ({ ...current, [item.id]: { ...selection, quantity: event.target.value } }))} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3" />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Kargo / taşıyıcı" value={carrier} onChange={setCarrier} maxLength={100} placeholder="Örn. PTT Kargo" />
                <Input label="Takip numarası" value={tracking} onChange={setTracking} maxLength={160} placeholder="Gerçek takip numarası" />
                <Input label="Takip bağlantısı (HTTPS, isteğe bağlı)" value={trackingUrl} onChange={setTrackingUrl} maxLength={500} inputMode="url" autoCapitalize="none" placeholder="https://..." />
                <label className="block"><span className="text-xs font-semibold">Tahmini teslim (isteğe bağlı)</span><input type="datetime-local" value={eta} onChange={event => setEta(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3" /></label>
              </div>

              <button type="button" onClick={() => void createShipment()} disabled={busy || !selectedShipmentRows.length} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50">
                <Truck aria-hidden="true" className="mr-2 inline h-5 w-5" />{busy ? 'Kaydediliyor…' : 'Kargo kaydını oluştur'}
              </button>
            </fieldset>
          </Panel>
        </>
      ) : null}

      <Panel title="Kargo Geçmişi">
        {!detail.shipments.length ? (
          <p className="text-sm text-gray-500">Henüz size ait kargo kaydı yok.</p>
        ) : (
          <div className="space-y-3">
            {detail.shipments.map(shipment => (
              <article key={shipment.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="font-bold">{shipment.carrier}</div><div className="mt-1 text-sm text-gray-500">Takip: {shipment.trackingNumber}</div></div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold dark:bg-gray-800">{shipmentStatus[shipment.status] || shipment.status}</span>
                </div>
                <div className="mt-2 text-sm text-gray-500">Kargoya verildi: {formatDate(shipment.shippedAt)}{shipment.estimatedDeliveryAt ? ` · Tahmini teslim: ${formatDate(shipment.estimatedDeliveryAt)}` : ''}</div>
                {shipment.trackingUrl ? <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-green">Takibi aç<ExternalLink aria-hidden="true" className="ml-2 h-4 w-4" /></a> : null}
              </article>
            ))}
          </div>
        )}
      </Panel>
      <PrivacyNotice />
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 font-bold">{children}</div></div>;
}

function Field({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  return <div><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 font-semibold">{href && value ? <a href={href} className="underline">{value}</a> : (value || 'Belirtilmemiş')}</dd></div>;
}

function Input({ label, value, onChange, placeholder, maxLength, inputMode, autoCapitalize }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoCapitalize?: string }) {
  return <label className="block"><span className="text-xs font-semibold">{label}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} inputMode={inputMode} autoCapitalize={autoCapitalize} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3" /></label>;
}

function PrivacyNotice() {
  return <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm"><div className="flex gap-3"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" /><p>Satıcı yalnız kendi ürün kalemlerini ve sevkiyat için gerekli teslimat bilgilerini görür. Müşteri e-postası, ödeme yöntemi, diğer satıcıların kalemleri, KYC veya banka verileri paylaşılmaz.</p></div></div>;
}

function joinLocation(value: ProducerOrderPage['items'][number]['destination']) {
  const location = [value.district, value.province, value.countryCode].filter(Boolean).join(', ');
  return location || 'Teslimat bölgesi belirtilmemiş';
}

function formatDate(value?: string | null) {
  if (!value) return 'Belirtilmemiş';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı';
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return 'Tarih doğrulanamadı';
  }
}

function safeHttpsInput(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function friendly(error: unknown) {
  const code = String((error as { message?: unknown } | null)?.message || error || '');
  const messages: Array<[string, string]> = [
    ['verified_active_producer_required', 'Bu ekran için aktif ve doğrulanmış satıcı hesabı gerekir.'],
    ['producer_order_not_found', 'Sipariş bulunamadı veya bu siparişte size ait ürün yok.'],
    ['order_not_fulfillable', 'Bu sipariş artık satıcı tarafından hazırlanamaz.'],
    ['invalid_producer_order_items', 'Seçili sipariş kalemlerinden biri size ait değil veya işlenemez.'],
    ['shipment_quantity_exceeds_remaining', 'Gönderim adedi kalan sipariş miktarını aşıyor.'],
    ['tracking_number_already_used', 'Bu kargo firması ve takip numarası daha önce kullanılmış.'],
    ['invalid_tracking_url', 'Takip bağlantısı geçerli bir HTTPS adresi olmalıdır.'],
  ];
  for (const [needle, message] of messages) if (code.includes(needle)) return message;
  return code || 'Sipariş işlemi tamamlanamadı.';
}
