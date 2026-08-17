import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { catalogPublicUrl, listFavorites, toggleFavorite } from './api';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from './ui';

export default function FavoritesPanel({ onOpenProduct }: { onOpenProduct?: (slug: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError('');
      const next = await listFavorites();
      setItems(next);
    } catch (e: any) {
      setError(e?.message || 'Favoriler yüklenemedi.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(item: any) {
    const id = String(item.productId || item.slug || '');
    if (!id || busyId) return;
    try {
      setBusyId(id);
      setError('');
      setStatus('');
      await toggleFavorite(item.slug);
      setItems(current => current.filter(row => String(row.productId || row.slug) !== id));
      setStatus(`${item.name || 'Ürün'} favorilerinizden çıkarıldı.`);
      await load(true);
    } catch (e: any) {
      setError(e?.message || 'Ürün favorilerden çıkarılamadı.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingState label="Favoriler yükleniyor" />;

  return <Panel title="Favorilerim" description="Kaydettiğiniz ürünleri canlı fiyat, üretici doğrulaması ve satış durumu ile yönetin.">
    {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
    {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}
    <div className="sr-only" role="status" aria-live="polite">{busyId ? 'Favori işlemi yapılıyor.' : ''}</div>
    {!items.length ? <EmptyState title="Favoriniz yok" body="Beğendiğiniz ürünleri kalp düğmesiyle burada toplayabilirsiniz." /> :
      <div className="grid gap-4 sm:grid-cols-2">{items.map(i => {
        const id = String(i.productId || i.slug);
        const busy = busyId === id;
        const available = i.available === true && Boolean(i.variant?.id);
        const compareMinor = Number(i.variant?.compareAtPriceMinor || 0);
        const priceMinor = Number(i.variant?.priceMinor || 0);
        return <article key={id} aria-busy={busy} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {i.imagePath ? <img src={catalogPublicUrl(i.imagePath)} alt={`${i.name || 'Ürün'} görseli`} loading="lazy" decoding="async" className="h-40 w-full object-cover" /> : <div role="img" aria-label={`${i.name || 'Ürün'} için görsel henüz eklenmedi`} className="grid h-40 w-full place-items-center bg-gray-100 text-sm text-gray-500 dark:bg-gray-800">Görsel henüz eklenmedi</div>}
          <div className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${available ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{available ? 'Satışta' : 'Şu an satışta değil'}</span>
              {i.producer?.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Doğrulanmış üretici</span> : null}
              {i.producer?.originVerified ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/10 px-2.5 py-1 text-brand-gold"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Menşe doğrulandı</span> : null}
            </div>
            <h3 className="line-clamp-2 text-lg font-bold">{i.name}</h3>
            {i.shortDescription ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">{i.shortDescription}</p> : null}
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{i.producer?.name || 'Üretici bilgisi'}</p>
            {i.origin ? <p className="mt-1 text-xs text-gray-500">Menşe: {i.origin}</p> : null}
            <div className="mt-3 flex items-end gap-2">
              <div className="font-bold text-brand-green dark:text-brand-gold"><Money minor={priceMinor} currency={i.currency} /></div>
              {compareMinor > priceMinor ? <div className="text-sm text-gray-400 line-through"><Money minor={compareMinor} currency={i.currency} /></div> : null}
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <button type="button" disabled={!onOpenProduct || !i.slug} onClick={() => onOpenProduct?.(i.slug)} className="min-h-11 rounded-xl bg-brand-green px-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünü aç</button>
              <button type="button" disabled={busy} onClick={() => void remove(i)} aria-label={`${i.name} ürününü favorilerden çıkar`} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{busy ? 'Çıkarılıyor…' : 'Çıkar'}</button>
            </div>
          </div>
        </article>;
      })}</div>}
  </Panel>;
}
