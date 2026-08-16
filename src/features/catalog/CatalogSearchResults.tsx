import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { getProducerFollowMetrics, publicCatalogUrl, searchCatalog, type CatalogItem, type CatalogSearchResponse, type ProducerFollowMetric } from './api';
import CatalogProductCard from './CatalogProductCard';

const PAGE_SIZE = 20;

type Props = {
  query: string;
  categorySlug?: string | null;
  producerId?: string | null;
  onBack: () => void;
  onOpenProduct: (slug: string) => void;
  onAddToCart: (item: CatalogItem, quantity: number) => Promise<void> | void;
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
  const [producerMetrics, setProducerMetrics] = useState<Record<string, ProducerFollowMetric>>({});
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

      const metrics = await getProducerFollowMetrics(next.items.map(item => item.producer.id)).catch(metricsError => {
        console.warn('Producer metrics unavailable for catalog search.', metricsError);
        return [];
      });
      if (requestId.current !== current) return;
      const nextMetrics = Object.fromEntries(metrics.map(metric => [metric.producerId, metric]));
      setProducerMetrics(previous => append ? { ...previous, ...nextMetrics } : nextMetrics);
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
          <ArrowLeft aria-hidden="true" className="mx-auto h-5 w-5" />
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
          <PackageSearch aria-hidden="true" className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-bold">Sonuç bulunamadı</h2>
          <p className="mt-1 text-sm text-gray-500">Yazımı değiştirerek veya stok filtresini kapatarak tekrar deneyin.</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map(item => {
          const metric = producerMetrics[item.producer.id];
          const origin = item.origin || [item.producer.village, item.producer.district, item.producer.province].filter(Boolean).join(', ') || null;
          const cardProduct = {
            id: item.id,
            legacyId: item.legacyId ?? null,
            slug: item.slug,
            name: item.name,
            description: item.shortDescription || '',
            shortDescription: item.shortDescription || '',
            category: item.category.name,
            price: Number(item.variant.priceMinor || 0) / 100,
            originalPrice: item.variant.compareAtPriceMinor ? Number(item.variant.compareAtPriceMinor) / 100 : null,
            currency: item.currency,
            image: publicCatalogUrl(item.imagePath),
            origin,
            unit: item.unitLabel || item.variant.name,
            rating: Number(item.averageRating || 0),
            reviewCount: Number(item.reviewCount || 0),
            stock: item.availableQuantity ?? null,
            stockMode: item.stockMode,
            is_featured: !!item.featured,
            preOrder: item.stockMode === 'preorder',
            variantId: item.variant.id,
            variantName: item.variant.name,
            vendor_id: item.producer.id,
            producerName: item.producer.name,
            producerFollowerCount: metric?.followerCount ?? null,
            producerVerified: metric?.verified ?? true,
            producerOriginVerified: metric?.originVerified ?? false,
          };
          return <CatalogProductCard
            key={item.id}
            product={cardProduct}
            onClick={() => onOpenProduct(item.slug)}
            onAddToCart={(_, quantity) => onAddToCart(item, quantity)}
          />;
        })}
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
