import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PackageSearch, ShoppingCart, Star } from 'lucide-react';
import { publicCatalogUrl, searchCatalog, type CatalogItem, type CatalogSearchResponse } from './api';

const PAGE_SIZE = 20;

type Props = {
  query: string;
  categorySlug?: string | null;
  producerId?: string | null;
  onBack: () => void;
  onOpenProduct: (slug: string) => void;
  onAddToCart: (item: CatalogItem) => Promise<void> | void;
};

export default function CatalogSearchResults({
  query,
  categorySlug = null,
  producerId = null,
  onBack,
  onOpenProduct,
  onAddToCart,
}: Props) {
  const [sort, setSort] = useState<'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating'>('relevance');
  const [inStock, setInStock] = useState(false);
  const [result, setResult] = useState<CatalogSearchResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  async function load(nextOffset = 0, append = false) {
    const current = ++requestId.current;
    try {
      setLoading(true);
      setError('');
      const next = await searchCatalog({
        query: query.trim() || null,
        categorySlug,
        producerId,
        inStock,
        sort,
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      if (requestId.current !== current) return;
      setOffset(nextOffset);
      setResult(previous => append && previous
        ? { ...next, items: [...previous.items, ...next.items], offset: 0, limit: previous.items.length + next.items.length }
        : next);
    } catch (err: any) {
      if (requestId.current === current) setError(err?.message || 'Katalog sonuçları yüklenemedi.');
    } finally {
      if (requestId.current === current) setLoading(false);
    }
  }

  useEffect(() => { void load(0, false); }, [query, categorySlug, producerId, sort, inStock]);

  const items = result?.items || [];
  const canLoadMore = !!result && items.length < result.total;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8" aria-labelledby="catalog-results-title">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={onBack} aria-label="Arama sonuçlarından geri dön" className="min-h-11 min-w-11 rounded-xl border p-2">
          <ArrowLeft className="mx-auto h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 id="catalog-results-title" className="truncate text-2xl font-bold text-brand-green dark:text-brand-gold">
            {query.trim() ? `“${query.trim()}” sonuçları` : 'Katalog'}
          </h1>
          <p className="text-sm text-gray-500">{result ? `${result.total} gerçek katalog sonucu` : 'Katalog aranıyor'}</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-sm font-semibold">Sırala</span>
          <select value={sort} onChange={e => setSort(e.target.value as any)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3">
            <option value="relevance">En ilgili</option>
            <option value="newest">En yeni</option>
            <option value="price_asc">Fiyat: düşükten yükseğe</option>
            <option value="price_desc">Fiyat: yüksekten düşüğe</option>
            <option value="rating">Değerlendirme</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border px-4">
          <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} className="h-5 w-5" />
          <span className="font-semibold">Sadece stokta</span>
        </label>
      </div>

      <div className="sr-only" aria-live="polite">
        {loading ? 'Katalog sonuçları yükleniyor' : error ? error : `${result?.total || 0} sonuç bulundu`}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p>{error}</p>
          <button onClick={() => load(0, false)} className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 font-semibold">Tekrar dene</button>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-bold">Sonuç bulunamadı</h2>
          <p className="mt-1 text-sm text-gray-500">Yazımı değiştirerek veya stok filtresini kapatarak tekrar deneyin.</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map(item => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <button onClick={() => onOpenProduct(item.slug)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
              <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800">
                {item.imagePath ? <img src={publicCatalogUrl(item.imagePath)} alt={item.name} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="p-4">
                <div className="text-xs font-semibold text-brand-gold">{item.category.name}</div>
                <h2 className="mt-1 line-clamp-2 text-lg font-bold text-brand-text">{item.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{item.producer.name}{item.origin ? ` • ${item.origin}` : ''}</p>
                {item.reviewCount > 0 ? (
                  <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                    <Star className="h-4 w-4 fill-brand-gold text-brand-gold" />
                    <span>{Number(item.averageRating).toFixed(1)} ({item.reviewCount})</span>
                  </div>
                ) : null}
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-brand-green dark:text-brand-gold">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: item.currency }).format(item.variant.priceMinor / 100)}
                    </div>
                    <div className="text-xs text-gray-500">{item.variant.name}</div>
                  </div>
                  {item.stockMode === 'tracked' || item.stockMode === 'seasonal' ? (
                    <span className={`text-xs font-semibold ${Number(item.availableQuantity || 0) > 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {Number(item.availableQuantity || 0) > 0 ? 'Stokta' : 'Tükendi'}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
            <div className="px-4 pb-4">
              <button
                onClick={() => onAddToCart(item)}
                disabled={(item.stockMode === 'tracked' || item.stockMode === 'seasonal') && Number(item.availableQuantity || 0) <= 0}
                className="min-h-11 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart className="mr-2 inline h-4 w-4" /> Sepete Ekle
              </button>
            </div>
          </article>
        ))}
      </div>

      {loading ? <div role="status" className="py-6 text-center text-gray-500">Yükleniyor…</div> : null}
      {!loading && canLoadMore ? (
        <button onClick={() => load(offset + PAGE_SIZE, true)} className="mt-6 min-h-12 w-full rounded-xl border border-brand-gold/30 font-bold text-brand-gold">
          Daha fazla ürün göster
        </button>
      ) : null}
    </section>
  );
}
