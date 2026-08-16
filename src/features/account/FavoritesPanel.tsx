
import React, { useEffect, useState } from 'react';
import { catalogPublicUrl, listFavorites, toggleFavorite } from './api';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from './ui';

export default function FavoritesPanel({ onOpenProduct }: { onOpenProduct?: (slug: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() { try { setLoading(true); setItems(await listFavorites()); } catch(e:any){ setError(e?.message || 'Favoriler yüklenemedi.'); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  if (loading) return <LoadingState />;
  return <Panel title="Favorilerim">
    {error ? <ErrorState message={error} onRetry={load} /> : null}
    {!items.length ? <EmptyState title="Favoriniz yok" body="Beğendiğiniz ürünleri kalp düğmesiyle burada toplayabilirsiniz." /> :
      <div className="grid gap-3 sm:grid-cols-2">{items.map(i => (
        <article key={i.productId} className="rounded-xl border p-3">
          {i.imagePath ? <img src={catalogPublicUrl(i.imagePath)} alt="" className="h-32 w-full rounded-lg object-cover" /> : null}
          <h3 className="mt-3 font-bold">{i.name}</h3>
          <p className="text-sm text-gray-500">{i.producer?.name}</p>
          <div className="mt-2 font-bold"><Money minor={i.variant?.priceMinor || 0} currency={i.currency} /></div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onOpenProduct?.(i.slug)} className="min-h-11 flex-1 rounded-lg bg-brand-green px-3 font-bold text-white">Ürünü aç</button>
            <button onClick={async () => { await toggleFavorite(i.slug); await load(); }} className="min-h-11 rounded-lg border px-3 font-semibold">Çıkar</button>
          </div>
        </article>
      ))}</div>}
  </Panel>;
}
