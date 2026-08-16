import React, { useEffect, useState } from 'react';
import { Grid2X2, ShoppingCart } from 'lucide-react';
import { listPublicCategories, publicCatalogUrl, searchCatalog, type CatalogItem, type PublicCategory } from './api';

type Props = {
  onOpenProduct: (slug: string) => void;
  onAddToCart: (item: CatalogItem) => Promise<void> | void;
};

export default function CategoryDirectoryScreen({ onOpenProduct, onAddToCart }: Props) {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating'>('relevance');
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true); setError('');
        const next = await listPublicCategories();
        if (active) setCategories(next);
      } catch (err: any) {
        if (active) setError(err?.message || 'Kategoriler yüklenemedi.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true); setError('');
        const result = await searchCatalog({ categorySlug: selected, sort, inStock, limit: 50, offset: 0 });
        if (active) { setItems(result.items || []); setTotal(result.total || 0); }
      } catch (err: any) {
        if (active) setError(err?.message || 'Kategori ürünleri yüklenemedi.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [selected, sort, inStock]);

  const selectedCategory = categories.find(item => item.slug === selected);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8" aria-labelledby="category-directory-title">
      <div className="text-center">
        <h1 id="category-directory-title" className="text-3xl font-bold text-brand-green dark:text-brand-gold">Kategoriler</h1>
        <p className="mt-2 text-sm text-gray-500">Yalnız aktif kategoriler ve doğrulanmış üreticilerin yayındaki ürünleri gösterilir.</p>
      </div>

      {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div> : null}

      <div className="mt-6 flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Ürün kategorileri">
        <button role="listitem" onClick={() => setSelected(null)} aria-pressed={selected === null} className={`min-h-14 min-w-[150px] rounded-2xl border p-3 text-left ${selected === null ? 'border-brand-gold bg-brand-gold/10' : ''}`}>
          <div className="flex items-center gap-2 font-bold"><Grid2X2 className="h-5 w-5 text-brand-gold" />Tüm Ürünler</div>
          <div className="mt-1 text-xs text-gray-500">Canlı katalog</div>
        </button>
        {categories.map(category => (
          <button key={category.id} role="listitem" onClick={() => setSelected(category.slug)} aria-pressed={selected === category.slug} className={`min-h-14 min-w-[190px] rounded-2xl border p-3 text-left ${selected === category.slug ? 'border-brand-gold bg-brand-gold/10' : ''}`}>
            <div className="font-bold">{category.name}</div>
            <div className="mt-1 text-xs text-gray-500">{category.productCount} ürün</div>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-bold">{selectedCategory?.name || 'Tüm Ürünler'}</h2><p className="text-sm text-gray-500">{total} ürün</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label><span className="sr-only">Sıralama</span><select value={sort} onChange={event => setSort(event.target.value as any)} className="min-h-11 rounded-xl border bg-transparent px-3"><option value="relevance">Önerilen</option><option value="newest">En yeni</option><option value="price_asc">Fiyat: düşükten yükseğe</option><option value="price_desc">Fiyat: yüksekten düşüğe</option><option value="rating">Değerlendirme</option></select></label>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3"><input type="checkbox" checked={inStock} onChange={event => setInStock(event.target.checked)} className="h-5 w-5" /><span className="font-semibold">Stokta</span></label>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">{loading ? 'Kategori ürünleri yükleniyor' : `${total} ürün gösteriliyor`}</div>
      {loading ? <div role="status" className="py-8 text-center text-gray-500">Yükleniyor…</div> : null}
      {!loading && !items.length ? <div className="mt-5 rounded-2xl border border-dashed p-9 text-center text-gray-500">Bu seçimde yayında ürün bulunmuyor.</div> : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map(item => (
          <article key={item.id} className="overflow-hidden rounded-2xl border bg-white dark:bg-gray-900">
            <button onClick={() => onOpenProduct(item.slug)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
              <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800">{item.imagePath ? <img src={publicCatalogUrl(item.imagePath)} alt={item.name} className="h-full w-full object-cover" /> : null}</div>
              <div className="p-4"><div className="text-xs font-semibold text-brand-gold">{item.category.name}</div><h3 className="mt-1 line-clamp-2 font-bold">{item.name}</h3><p className="mt-1 text-sm text-gray-500">{item.producer.name}</p><div className="mt-3 font-bold text-brand-green dark:text-brand-gold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: item.currency }).format(item.variant.priceMinor / 100)}</div></div>
            </button>
            <div className="px-4 pb-4"><button onClick={() => onAddToCart(item)} disabled={(item.stockMode === 'tracked' || item.stockMode === 'seasonal') && Number(item.availableQuantity || 0) <= 0} className="min-h-11 w-full rounded-xl bg-brand-green px-3 font-bold text-white disabled:opacity-50"><ShoppingCart className="mr-2 inline h-4 w-4" />Sepete Ekle</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}
