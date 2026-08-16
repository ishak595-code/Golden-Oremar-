import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Heart, Leaf, Search, Utensils, X } from 'lucide-react';
import { contentPublicUrl, getPublicContentEntry, listContentFavoriteReferences, listPublicContent, toggleContentFavorite, type ContentType } from './api';

type Props = {
  onBack: () => void;
  authenticated: boolean;
  locale?: string;
  onLoginRequired: () => void;
  onOpenProduct?: (slug: string) => void;
};

const tabs: { key: ContentType; label: string; icon: any }[] = [
  { key: 'health_guide', label: 'Rehberler', icon: BookOpen },
  { key: 'product_health', label: 'Ürün Bilgileri', icon: Leaf },
  { key: 'recipe', label: 'Tarifler', icon: Utensils },
];

export default function PublicHealthScreen({ onBack, authenticated, locale = 'tr', onLoginRequired, onOpenProduct }: Props) {
  const [active, setActive] = useState<ContentType>('health_guide');
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(type: ContentType) {
    if (items[type]) return;
    try {
      setLoading(true); setError('');
      const result = await listPublicContent(type, locale, 50, 0);
      setItems(previous => ({ ...previous, [type]: result.items || [] }));
      setTotals(previous => ({ ...previous, [type]: Number(result.total || 0) }));
    } catch (err: any) { setError(err?.message || 'İçerikler yüklenemedi.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(active); }, [active, locale]);
  useEffect(() => {
    if (!authenticated) { setFavorites(new Set()); return; }
    listContentFavoriteReferences()
      .then(rows => setFavorites(new Set(rows.map((row: any) => String(row.slug || row.id)))))
      .catch(() => setFavorites(new Set()));
  }, [authenticated]);

  const visible = useMemo(() => {
    const list = items[active] || [];
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) return list;
    return list.filter((item: any) => `${item.title} ${item.summary || ''} ${item.category || ''}`.toLocaleLowerCase('tr-TR').includes(needle));
  }, [items, active, query]);

  async function open(reference: string) {
    try { setDetailLoading(true); setError(''); setDetail(await getPublicContentEntry(reference, locale)); }
    catch (err: any) { setError(err?.message || 'İçerik açılamadı.'); }
    finally { setDetailLoading(false); }
  }

  async function favorite(item: any) {
    if (!authenticated) { onLoginRequired(); return; }
    try {
      const result = await toggleContentFavorite(item.slug || item.id);
      setFavorites(previous => {
        const next = new Set(previous);
        if (result?.isFavorite) next.add(String(result.slug || item.slug || item.id));
        else next.delete(String(result.slug || item.slug || item.id));
        return next;
      });
    } catch (err: any) { setError(err?.message || 'Favori işlemi tamamlanamadı.'); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <button onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft className="mr-2 inline h-4 w-4" />Geri</button>
      <header><h1 className="text-3xl font-bold text-brand-green dark:text-brand-gold">Sağlık & Tarifler</h1><p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">Ürün güvenliği, saklama/kullanım rehberleri ve Golden Oremar tarifleri. Sağlık içerikleri tedavi iddiası olarak sunulmaz.</p></header>

      <div className="mt-6 grid grid-cols-3 gap-2" role="tablist" aria-label="İçerik türleri">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.key} role="tab" aria-selected={active === tab.key} onClick={() => { setActive(tab.key); setQuery(''); }} className={`min-h-12 rounded-xl border px-2 text-sm font-bold ${active === tab.key ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : ''}`}><Icon className="mr-1 inline h-4 w-4" />{tab.label}{totals[tab.key] != null ? ` (${totals[tab.key]})` : ''}</button>; })}
      </div>

      <label className="relative mt-5 block"><span className="sr-only">İçeriklerde ara</span><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rehber veya tarif ara" className="min-h-12 w-full rounded-xl border bg-transparent pl-12 pr-4" /></label>
      {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="mt-6 rounded-xl border p-6 text-center text-gray-500">İçerikler yükleniyor…</div> : null}

      {!loading && !visible.length ? <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-gray-500">Bu bölümde eşleşen yayınlanmış içerik bulunmuyor.</div> : null}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {visible.map((item: any) => {
          const image = contentPublicUrl(item.heroImagePath);
          const favoriteKey = String(item.slug || item.id);
          return <article key={item.id} className="overflow-hidden rounded-2xl border bg-white dark:bg-gray-900">
            {image ? <button onClick={() => open(item.slug)} className="block w-full"><img src={image} alt="" className="aspect-[16/9] w-full object-cover" /></button> : null}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3"><button onClick={() => open(item.slug)} className="min-h-11 flex-1 text-left"><h2 className="font-bold text-brand-green dark:text-brand-gold">{item.title}</h2></button><button onClick={() => favorite(item)} aria-label={favorites.has(favoriteKey) ? 'Favorilerden çıkar' : 'Favoriye ekle'} className="min-h-11 min-w-11 rounded-xl border p-2"><Heart className={`mx-auto h-5 w-5 ${favorites.has(favoriteKey) ? 'fill-red-500 text-red-500' : ''}`} /></button></div>
              {item.category ? <div className="mt-1 text-xs font-semibold text-brand-gold">{item.category}</div> : null}
              {item.summary ? <p className="mt-2 line-clamp-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.summary}</p> : null}
              {item.relatedProduct ? <button onClick={() => onOpenProduct?.(item.relatedProduct.slug)} className="mt-3 min-h-11 rounded-xl border px-3 text-sm font-semibold">İlgili ürünü aç</button> : null}
            </div>
          </article>;
        })}
      </section>

      {detailLoading ? <div role="status" className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"><div className="rounded-xl bg-white p-5">İçerik yükleniyor…</div></div> : null}
      {detail ? <ContentDialog detail={detail} onClose={() => setDetail(null)} onOpenProduct={onOpenProduct} /> : null}
    </main>
  );
}

function ContentDialog({ detail, onClose, onOpenProduct }: { detail: any; onClose: () => void; onOpenProduct?: (slug: string) => void }) {
  const image = contentPublicUrl(detail.heroImagePath);
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-4"><article role="dialog" aria-modal="true" aria-labelledby="content-dialog-title" className="mx-auto my-5 max-w-3xl overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
    <div className="flex items-start justify-between gap-3 border-b p-5"><div><div className="text-xs font-bold uppercase tracking-wide text-brand-gold">{detail.type === 'recipe' ? 'Tarif' : detail.type === 'product_health' ? 'Ürün Bilgisi' : 'Rehber'}</div><h2 id="content-dialog-title" className="mt-1 text-2xl font-bold">{detail.title}</h2></div><button onClick={onClose} aria-label="İçeriği kapat" className="min-h-11 min-w-11 rounded-full border p-2"><X className="mx-auto h-5 w-5" /></button></div>
    {image ? <img src={image} alt="" className="max-h-80 w-full object-cover" /> : null}
    <div className="p-5 sm:p-7">
      {detail.summary ? <p className="mb-5 text-lg leading-7 text-gray-600 dark:text-gray-300">{detail.summary}</p> : null}
      {detail.sanitizedHtml ? <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: detail.sanitizedHtml }} /> : <div className="whitespace-pre-wrap leading-7 text-gray-700 dark:text-gray-300">{detail.markdown}</div>}
      {detail.type !== 'recipe' ? <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Bu içerik genel ürün kullanımı ve gıda güvenliği bilgisidir; tanı veya tedavi önerisi değildir.</div> : null}
      {detail.relatedProduct ? <button onClick={() => { onClose(); onOpenProduct?.(detail.relatedProduct.slug); }} className="mt-5 min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white">İlgili ürünü aç</button> : null}
    </div>
  </article></div>;
}
