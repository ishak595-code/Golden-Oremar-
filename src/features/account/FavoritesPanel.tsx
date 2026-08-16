import React, { useEffect, useState } from 'react';
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

  return <Panel title="Favorilerim" description="Kaydettiğiniz ürünleri burada görüntüleyin ve yönetin.">
    {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
    {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}
    {!items.length ? <EmptyState title="Favoriniz yok" body="Beğendiğiniz ürünleri kalp düğmesiyle burada toplayabilirsiniz." /> :
      <div className="grid gap-3 sm:grid-cols-2">{items.map(i => {
        const id = String(i.productId || i.slug);
        const busy = busyId === id;
        return <article key={id} aria-busy={busy} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          {i.imagePath ? <img src={catalogPublicUrl(i.imagePath)} alt="" loading="lazy" className="h-36 w-full rounded-xl object-cover" /> : <div className="grid h-36 w-full place-items-center rounded-xl bg-gray-100 text-sm text-gray-500 dark:bg-gray-800">Görsel henüz eklenmedi</div>}
          <h3 className="mt-3 line-clamp-2 font-bold">{i.name}</h3>
          <p className="mt-1 text-sm text-gray-500">{i.producer?.name || 'Üretici bilgisi'}</p>
          <div className="mt-2 font-bold text-brand-green dark:text-brand-gold"><Money minor={i.variant?.priceMinor || 0} currency={i.currency} /></div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={() => onOpenProduct?.(i.slug)} className="min-h-11 rounded-xl bg-brand-green px-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünü aç</button>
            <button type="button" disabled={busy} onClick={() => void remove(i)} aria-label={`${i.name} ürününü favorilerden çıkar`} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{busy ? 'Çıkarılıyor…' : 'Çıkar'}</button>
          </div>
        </article>;
      })}</div>}
  </Panel>;
}
