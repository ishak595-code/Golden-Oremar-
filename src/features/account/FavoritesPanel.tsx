import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { catalogPublicUrl, listFavorites, toggleFavorite } from './api';
import type { FavoriteItem } from './types';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from './ui';

export default function FavoritesPanel({ onOpenProduct }: { onOpenProduct?: (slug: string) => void }) {
  const [items, setItems] = useState<FavoriteItem[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError('');
      setItems(await listFavorites());
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : 'Favoriler yüklenemedi.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(item: FavoriteItem) {
    if (busyId) return;
    try {
      setBusyId(item.productId);
      setError('');
      setStatus('');
      const result = await toggleFavorite(item.slug);
      if (result.isFavorite) throw new Error('Favori işlem sonucu kaldırma işlemiyle eşleşmiyor.');
      setItems(current => current ? current.filter(row => row.productId !== item.productId) : current);
      setStatus(`${item.name} favorilerinizden çıkarıldı.`);
      await load(true);
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : 'Ürün favorilerden çıkarılamadı.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingState label="Favoriler yükleniyor" />;
  if (!items) return <Panel title="Favorilerim" description="Kaydettiğiniz ürünleri canlı fiyat, üretici doğrulaması ve satış durumu ile yönetin."><ErrorState message={error || 'Favori listesi doğrulanamadı.'} onRetry={() => void load()} /></Panel>;

  return <Panel title="Favorilerim" description="Kaydettiğiniz ürünleri canlı fiyat, üretici doğrulaması ve satış durumu ile yönetin.">
    {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
    {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}
    <div className="sr-only" role="status" aria-live="polite">{busyId ? 'Favori işlemi yapılıyor.' : ''}</div>
    {!items.length ? <EmptyState title="Favoriniz yok" body="Beğendiğiniz ürünleri kalp düğmesiyle burada toplayabilirsiniz." /> :
      <div className="grid gap-4 sm:grid-cols-2">{items.map(i => {
        const busy = busyId === i.productId;
        const saleReady = i.available && Boolean(i.variant);
        return <article key={i.productId} aria-busy={busy} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {i.imagePath ? <img src={catalogPublicUrl(i.imagePath)} alt={`${i.name} görseli`} loading="lazy" decoding="async" className="h-40 w-full object-cover" /> : <div role="img" aria-label={`${i.name} için görsel henüz eklenmedi`} className="grid h-40 w-full place-items-center bg-gray-100 text-sm text-gray-500 dark:bg-gray-800">Görsel henüz eklenmedi</div>}
          <div className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className={`rounded-full px-2.5 py-1 ${saleReady ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{saleReady ? 'Satışta' : 'Şu an satışta değil'}</span>
              {i.producer.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Doğrulanmış üretici</span> : null}
              {i.producer.originVerified ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/10 px-2.5 py-1 text-brand-gold"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Menşe doğrulandı</span> : null}
            </div>
            <h3 className="line-clamp-2 text-lg font-bold">{i.name}</h3>
            {i.shortDescription ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">{i.shortDescription}</p> : null}
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{i.producer.name}</p>
            {i.origin ? <p className="mt-1 text-xs text-gray-500">Menşe: {i.origin}</p> : null}
            {i.variant ? <div className="mt-3 flex items-end gap-2"><div className="font-bold text-brand-green dark:text-brand-gold"><Money minor={i.variant.priceMinor} currency={i.currency} /></div>{i.variant.compareAtPriceMinor !== null && i.variant.compareAtPriceMinor > i.variant.priceMinor ? <div className="text-sm text-gray-400 line-through"><Money minor={i.variant.compareAtPriceMinor} currency={i.currency} /></div> : null}</div> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Aktif satış varyantı bulunmuyor.</p>}
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <button type="button" disabled={!onOpenProduct} onClick={() => onOpenProduct?.(i.slug)} className="min-h-11 rounded-xl bg-brand-green px-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünü aç</button>
              <button type="button" disabled={busy} onClick={() => void remove(i)} aria-label={`${i.name} ürününü favorilerden çıkar`} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{busy ? 'Çıkarılıyor…' : 'Çıkar'}</button>
            </div>
          </div>
        </article>;
      })}</div>}
  </Panel>;
}