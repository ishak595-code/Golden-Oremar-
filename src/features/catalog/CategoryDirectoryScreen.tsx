import React, { useEffect, useRef, useState } from 'react';
import { Grid2X2, PackageSearch } from 'lucide-react';
import {
  getProducerFollowMetrics,
  listPublicCategories,
  publicCatalogUrl,
  searchCatalog,
  type CatalogItem,
  type ProducerFollowMetric,
  type PublicCategory,
} from './api';
import CatalogProductCard from './CatalogProductCard';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';

const PAGE_SIZE = 24;

type Props = {
  onOpenProduct: (slug: string) => void;
  onAddToCart: (item: CatalogItem, quantity: number) => Promise<void> | void;
};

export default function CategoryDirectoryScreen({ onOpenProduct, onAddToCart }: Props) {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [producerMetrics, setProducerMetrics] = useState<Record<string, ProducerFollowMetric>>({});
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating'>('relevance');
  const [inStock, setInStock] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [productError, setProductError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const requestId = useRef(0);

  async function loadCategories() {
    try {
      setCategoryLoading(true);
      setCategoryError('');
      setCategories(await listPublicCategories());
    } catch (err: any) {
      setCategoryError(err?.message || 'Kategoriler yüklenemedi.');
    } finally {
      setCategoryLoading(false);
    }
  }

  async function loadProducts(append = false) {
    const current = ++requestId.current;
    const offset = append ? items.length : 0;
    try {
      if (append) setLoadingMore(true);
      else setProductLoading(true);
      if (append) setLoadMoreError('');
      else setProductError('');

      const result = await searchCatalog({
        categorySlug: selected,
        sort,
        inStock,
        limit: PAGE_SIZE,
        offset,
      });
      if (requestId.current !== current) return;

      const metrics = await getProducerFollowMetrics(result.items.map(item => item.producer.id)).catch(error => {
        console.warn('Producer metrics unavailable for category directory.', error);
        return [];
      });
      if (requestId.current !== current) return;

      const nextMetrics = Object.fromEntries(metrics.map(metric => [metric.producerId, metric]));
      setProducerMetrics(previous => append ? { ...previous, ...nextMetrics } : nextMetrics);
      setItems(previous => {
        if (!append) return result.items || [];
        const unique = new Map<string, CatalogItem>();
        [...previous, ...(result.items || [])].forEach(item => unique.set(`${item.id}:${item.variant.id}`, item));
        return Array.from(unique.values());
      });
      setTotal(result.total || 0);
    } catch (err: any) {
      if (requestId.current === current) {
        const message = err?.message || 'Kategori ürünleri yüklenemedi.';
        if (append) {
          setLoadMoreError(message);
        } else {
          setItems([]);
          setProducerMetrics({});
          setTotal(0);
          setProductError(message);
        }
      }
    } finally {
      if (requestId.current === current) {
        setProductLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => { void loadCategories(); }, []);
  useEffect(() => { setLoadMoreError(''); void loadProducts(false); }, [selected, sort, inStock]);
  useEffect(() => {
    const restore = () => {
      setLoadMoreError('');
      void Promise.all([loadCategories(), loadProducts(false)]);
    };
    window.addEventListener(NETWORK_RESTORED_EVENT, restore);
    return () => window.removeEventListener(NETWORK_RESTORED_EVENT, restore);
  }, [selected, sort, inStock]);

  const selectedCategory = categories.find(item => item.slug === selected);
  const hasMore = !productLoading && !productError && items.length < total;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8" aria-labelledby="category-directory-title">
      <div className="mx-auto max-w-2xl text-center">
        <h1 id="category-directory-title" className="text-2xl font-bold tracking-tight text-brand-green dark:text-brand-gold sm:text-3xl">Kategoriler</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">Yalnız aktif kategoriler ve doğrulanmış üreticilerin yayındaki ürünleri gösterilir.</p>
      </div>

      <div className="sr-only" aria-live="polite">
        {categoryLoading ? 'Kategoriler yükleniyor.' : categoryError ? categoryError : `${categories.length} kategori yüklendi.`}
        {' '}
        {productLoading ? 'Ürünler yükleniyor.' : productError ? productError : `${items.length} ürün gösteriliyor. Toplam ${total} ürün var.`}
        {' '}{loadingMore ? 'Daha fazla ürün yükleniyor.' : loadMoreError || ''}
      </div>

      {categoryError ? (
        <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <p>{categoryError}</p>
          <button type="button" onClick={() => void loadCategories()} className="mt-3 min-h-11 rounded-xl border border-red-300 px-4 font-semibold dark:border-red-800">Tekrar dene</button>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto pb-2 [scrollbar-width:thin]" aria-label="Ürün kategorileri">
        <div className="flex min-w-max gap-3" role="list">
          <div role="listitem">
            <button type="button" onClick={() => setSelected(null)} aria-pressed={selected === null} aria-controls="category-products" className={`min-h-16 min-w-[150px] rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${selected === null ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
              <span className="flex items-center gap-2 font-bold"><Grid2X2 aria-hidden="true" className="h-5 w-5 text-brand-gold" />Tüm Ürünler</span>
              <span className="mt-1 block text-xs text-gray-500">Canlı katalog</span>
            </button>
          </div>
          {categoryLoading ? <div role="status" className="flex min-h-16 min-w-[190px] items-center rounded-2xl border border-dashed px-4 text-sm text-gray-500">Kategoriler yükleniyor…</div> : null}
          {categories.map(category => (
            <div key={category.id} role="listitem">
              <button type="button" onClick={() => setSelected(category.slug)} aria-pressed={selected === category.slug} aria-controls="category-products" className={`min-h-16 min-w-[190px] max-w-[230px] rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${selected === category.slug ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
                <span className="line-clamp-1 font-bold">{category.name}</span>
                <span className="mt-1 block text-xs text-gray-500">{category.productCount} ürün</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-brand-text">{selectedCategory?.name || 'Tüm Ürünler'}</h2>
          <p className="mt-1 text-sm text-gray-500">{productLoading ? 'Ürünler güncelleniyor…' : `${items.length} / ${total} ürün gösteriliyor`}</p>
        </div>
        <div className="mt-4 grid gap-3 sm:mt-0 sm:grid-cols-[minmax(190px,1fr)_auto]">
          <label className="block">
            <span className="sr-only">Ürünleri sırala</span>
            <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="min-h-12 w-full rounded-xl border border-gray-200 bg-transparent px-3 font-medium dark:border-gray-700">
              <option value="relevance">En ilgili</option><option value="newest">En yeni</option><option value="price_asc">Fiyat: düşükten yükseğe</option><option value="price_desc">Fiyat: yüksekten düşüğe</option><option value="rating">En yüksek puan</option>
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 px-4 dark:border-gray-700">
            <input type="checkbox" checked={inStock} onChange={event => setInStock(event.target.checked)} className="h-5 w-5" />
            <span className="font-semibold">Sadece stokta</span>
          </label>
        </div>
      </div>

      {productError ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p>{productError}</p><button type="button" onClick={() => void loadProducts(false)} className="mt-3 min-h-11 rounded-xl border border-red-300 px-4 font-semibold dark:border-red-800">Tekrar dene</button></div> : null}
      {productLoading ? <div role="status" className="py-8 text-center text-sm font-medium text-gray-500">Ürünler yükleniyor…</div> : null}
      {!productLoading && !productError && !items.length ? <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-9 text-center dark:border-gray-700"><PackageSearch aria-hidden="true" className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" /><h3 className="mt-3 font-bold text-brand-text">Bu seçimde ürün bulunamadı</h3><p className="mt-1 text-sm text-gray-500">Başka bir kategori seçin veya stok filtresini kapatın.</p></div> : null}

      <div id="category-products" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map(item => {
          const metric = producerMetrics[item.producer.id];
          const origin = item.origin || [item.producer.village, item.producer.district, item.producer.province].filter(Boolean).join(', ') || null;
          const cardProduct = { id:item.id, legacyId:item.legacyId??null, slug:item.slug, name:item.name, description:item.shortDescription||'', shortDescription:item.shortDescription||'', category:item.category.name, price:Number(item.variant.priceMinor||0)/100, originalPrice:item.variant.compareAtPriceMinor?Number(item.variant.compareAtPriceMinor)/100:null, currency:item.currency, image:publicCatalogUrl(item.imagePath), origin, unit:item.unitLabel||item.variant.name, rating:Number(item.averageRating||0), reviewCount:Number(item.reviewCount||0), stock:item.availableQuantity??null, stockMode:item.stockMode, is_featured:!!item.featured, preOrder:item.stockMode==='preorder', variantId:item.variant.id, variantName:item.variant.name, vendor_id:item.producer.id, producerName:item.producer.name, producerFollowerCount:metric?.followerCount??null, producerVerified:metric?.verified===true, producerOriginVerified:metric?.originVerified===true };
          return <CatalogProductCard key={`${item.id}:${item.variant.id}`} product={cardProduct} onClick={() => onOpenProduct(item.slug)} onAddToCart={(_, quantity) => onAddToCart(item, quantity)} />;
        })}
      </div>

      {loadMoreError ? <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><p>Daha fazla ürün yüklenemedi. Mevcut ürünler korunuyor.</p><p className="mt-1 text-xs opacity-80">{loadMoreError}</p><button type="button" disabled={loadingMore} onClick={() => void loadProducts(true)} className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold disabled:opacity-50 dark:border-amber-800">Yüklemeyi tekrar dene</button></div> : null}
      {hasMore ? <div className="mt-7 flex justify-center"><button type="button" disabled={loadingMore} onClick={() => void loadProducts(true)} aria-controls="category-products" className="min-h-12 min-w-48 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore ? 'Daha fazla ürün yükleniyor…' : `Daha fazla ürün göster (${items.length}/${total})`}</button></div> : null}
    </section>
  );
}
