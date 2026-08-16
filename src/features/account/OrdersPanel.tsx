
import React, { useEffect, useState } from 'react';
import { cancelOrder, getOrderDetail, listOrders } from './api';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from './ui';

const statusText: Record<string,string> = {
  pending_payment: 'Ödeme bekleniyor', confirmed: 'Onaylandı', preparing: 'Hazırlanıyor',
  partially_shipped: 'Kısmen gönderildi', shipped: 'Kargoda', delivered: 'Teslim edildi',
  completed: 'Tamamlandı', cancelled: 'İptal edildi'
};

export default function OrdersPanel() {
  const [page, setPage] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try { setLoading(true); setError(''); setPage(await listOrders()); }
    catch (e:any) { setError(e?.message || 'Siparişler yüklenemedi.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function open(id: string) {
    try { setError(''); setDetail(await getOrderDetail(id)); }
    catch (e:any) { setError(e?.message || 'Sipariş detayı yüklenemedi.'); }
  }

  async function cancel(id: string) {
    try { await cancelOrder(id); setDetail(null); await load(); }
    catch (e:any) { setError(e?.message || 'Sipariş iptal edilemedi.'); }
  }

  if (loading) return <LoadingState label="Siparişler yükleniyor" />;
  return (
    <Panel title="Siparişlerim" description="Sipariş, ödeme, kargo, iade ve geri ödeme durumlarını tek yerden izleyin.">
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!page?.items?.length ? <EmptyState title="Henüz sipariş yok" body="Sipariş verdiğinizde tüm durum geçmişi burada görünecek." /> : (
        <div className="space-y-3">
          {page.items.map((o:any) => (
            <button key={o.id} onClick={() => open(o.id)} className="min-h-14 w-full rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-bold">{o.orderNumber} {o.gift ? <span className="text-xs text-brand-gold">• Hediye</span> : null}</div>
                  <div className="mt-1 text-sm text-gray-500">{statusText[o.status] || o.status} • {o.itemCount} ürün</div>
                  {o.trackingNumber ? <div className="mt-1 text-xs text-gray-500">Takip: {o.trackingNumber}</div> : null}
                </div>
                <div className="font-bold"><Money minor={o.totalMinor} currency={o.currency} /></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detail ? (
        <div role="dialog" aria-modal="true" aria-label="Sipariş detayı" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-xl font-bold">{detail.orderNumber}</h3><p className="text-sm text-gray-500">{statusText[detail.status] || detail.status}</p></div>
              <button onClick={() => setDetail(null)} aria-label="Sipariş detayını kapat" className="min-h-11 rounded-lg border px-4">Kapat</button>
            </div>

            <div className="mt-5 space-y-3">
              {detail.items?.map((i:any) => (
                <div key={i.id} className="rounded-xl border p-3">
                  <div className="font-semibold">{i.productName}</div>
                  <div className="text-sm text-gray-500">{i.variantName || 'Standart'} • {i.quantity} adet</div>
                  <div className="mt-1 font-bold"><Money minor={i.lineTotalMinor} currency={detail.currency} /></div>
                </div>
              ))}
            </div>

            {detail.gift ? (
              <div className="mt-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4">
                <div className="font-bold">Hediye bilgisi</div>
                <p className="mt-1 text-sm">Alıcı: {detail.gift.recipientName}</p>
                {detail.gift.message ? <p className="mt-2 text-sm italic">“{detail.gift.message}”</p> : null}
              </div>
            ) : null}

            {detail.shipments?.length ? (
              <div className="mt-5"><h4 className="font-bold">Kargo</h4>{detail.shipments.map((s:any) => (
                <div key={s.id} className="mt-2 rounded-xl border p-3 text-sm">
                  {s.carrier || 'Kargo'} • {s.status}{s.trackingNumber ? ` • ${s.trackingNumber}` : ''}
                </div>
              ))}</div>
            ) : null}

            <div className="mt-5 rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
              <div className="flex justify-between"><span>Ara toplam</span><Money minor={detail.subtotalMinor} currency={detail.currency} /></div>
              <div className="mt-1 flex justify-between"><span>İndirim</span><Money minor={-Number(detail.discountMinor || 0)} currency={detail.currency} /></div>
              <div className="mt-1 flex justify-between"><span>Kargo</span><Money minor={detail.shippingMinor} currency={detail.currency} /></div>
              <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Toplam</span><Money minor={detail.totalMinor} currency={detail.currency} /></div>
            </div>

            {detail.status === 'pending_payment' ? (
              <button onClick={() => cancel(detail.id)} className="mt-5 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700">
                Siparişi iptal et
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
