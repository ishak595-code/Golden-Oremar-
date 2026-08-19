import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  Calendar,
  Filter,
  Flame,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Users,
} from 'lucide-react';
import CatalogProductCard from '../catalog/CatalogProductCard';
import { useCatalogFilterOptions } from '../catalog/useCatalogFilterOptions';
import { useLiveHomeCatalog, type LegacyHomeProduct } from '../catalog/useLiveHomeCatalog';
import { usePublicStorefrontConfig } from '../storefront/usePublicStorefrontConfig';

type Props = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onProductClick: (product: LegacyHomeProduct) => void;
  onAddToCart: (product: LegacyHomeProduct, quantity: number) => Promise<void> | void;
  onToggleFavorite: (product: LegacyHomeProduct) => Promise<void> | void;
  favorites: string[];
  onShare: (product: LegacyHomeProduct) => Promise<void> | void;
  onGift: (product: LegacyHomeProduct) => Promise<void> | void;
};

type PriceRange = 'all' | '0-250' | '250-500' | '500-plus';
type SortOption = 'featured' | 'rating' | 'price-asc' | 'price-desc';

function catalogPrice(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function catalogRating(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
}

function catalogInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function catalogCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function safeText(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function currencyUnit(currency: string | null) {
  if (!currency) return '';
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).formatToParts(0).find(part => part.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
}

export default function HomeSection({
  searchQuery,
  setSearchQuery,
  onProductClick,
  onAddToCart,
  onToggleFavorite,
  favorites,
  onShare,
  onGift,
}: Props) {
  const {
    staticContent,
    homeSections,
    salesReadiness,
    loading: storefrontLoading,
    error: storefrontConfigError,
  } = usePublicStorefrontConfig('tr');
  const {
    products,
    categories: liveCategories,
    loading: liveCatalogLoading,
    error: liveCatalogError,
  } = useLiveHomeCatalog();
  const {
    categories: filterCategories,
    origins,
    loading: filtersLoading,
    error: filtersError,
  } = useCatalogFilterOptions();

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const interfaceContent = staticContent.interface;
  const storefrontSalesBlocked = salesReadiness?.status === 'blocked_pending_business_identity';
  const currencies = useMemo(
    () => Array.from(new Set(products.map(product => catalogCurrency(product.currency)).filter((value): value is string => Boolean(value)))),
    [products],
  );
  const filterCurrency = currencies.length === 1 ? currencies[0] : null;
  const priceFilterAvailable = filterCurrency !== null;
  const priceUnit = currencyUnit(filterCurrency);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().slice(0, 160).toLocaleLowerCase('tr-TR');
    return [...products]
      .filter(product => {
        const searchable = [
          product.name,
          product.category,
          product.producerName,
          product.origin,
          ...product.tags,
        ]
          .filter((value): value is string => typeof value === 'string')
          .map(value => value.toLocaleLowerCase('tr-TR'));
        const matchesSearch = !normalizedQuery || searchable.some(value => value.includes(normalizedQuery));
        const matchesCategory = !activeFilter || product.categorySlug === activeFilter;
        const matchesOrigin = !activeOrigin || safeText(product.origin, 240).toLocaleLowerCase('tr-TR').includes(activeOrigin.toLocaleLowerCase('tr-TR'));
        const price = catalogPrice(product.price);
        const productCurrency = catalogCurrency(product.currency);
        const comparablePrice = price !== null && filterCurrency !== null && productCurrency === filterCurrency;
        const matchesPrice = priceRange === 'all' || (
          priceFilterAvailable
          && comparablePrice
          && ((priceRange === '0-250' && price <= 250)
            || (priceRange === '250-500' && price > 250 && price <= 500)
            || (priceRange === '500-plus' && price > 500))
        );
        return matchesSearch && matchesCategory && matchesOrigin && matchesPrice;
      })
      .sort((a, b) => {
        if (sortOption === 'price-asc' || sortOption === 'price-desc') {
          const aPrice = catalogPrice(a.price);
          const bPrice = catalogPrice(b.price);
          const aCurrency = catalogCurrency(a.currency);
          const bCurrency = catalogCurrency(b.currency);
          if (aPrice === null || aCurrency === null) return bPrice === null || bCurrency === null ? 0 : 1;
          if (bPrice === null || bCurrency === null) return -1;
          if (aCurrency !== bCurrency) return aCurrency.localeCompare(bCurrency, 'tr');
          return sortOption === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
        }
        if (sortOption === 'rating') {
          const aRating = catalogRating(a.rating);
          const bRating = catalogRating(b.rating);
          if (aRating === null && bRating === null) return 0;
          if (aRating === null) return 1;
          if (bRating === null) return -1;
          return bRating - aRating;
        }
        return Number(b.is_featured) - Number(a.is_featured);
      });
  }, [products, searchQuery, activeFilter, activeOrigin, priceRange, sortOption, filterCurrency, priceFilterAvailable]);

  const quickCategories = useMemo(() => {
    const withProducts = liveCategories.filter(category => category.productCount > 0);
    return (withProducts.length ? withProducts : liveCategories).slice(0, 6);
  }, [liveCategories]);

  const activeCategoryName = filterCategories.find(category => category.id === activeFilter)?.name
    || liveCategories.find(category => category.id === activeFilter)?.name
    || '';

  const isSellable = (product: LegacyHomeProduct) => {
    if (catalogPrice(product.price) === null || catalogCurrency(product.currency) === null || !safeText(product.variantId, 160)) return false;
    if (product.stockMode === 'preorder') return true;
    if (product.stockMode === 'tracked' || product.stockMode === 'seasonal') {
      const stock = catalogInteger(product.stock);
      return stock !== null && stock > 0;
    }
    return true;
  };

  const spotlightProduct = products.find(product => product.is_featured && isSellable(product)) || null;
  const heroProducts = products.filter(product => Boolean(product.image) && isSellable(product)).slice(0, 4);
  const producerCount = new Set(products.map(product => safeText(product.producerId, 160)).filter(Boolean)).size;
  const originCount = new Set(products.map(product => safeText(product.origin, 240)).filter(Boolean)).size;

  function chooseCategory(slug: string) {
    setActiveFilter(slug);
    requestAnimationFrame(() => document.getElementById('products')?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    }));
  }

  function clearFilters() {
    setActiveFilter(null);
    setActiveOrigin(null);
    setPriceRange('all');
  }

  function sectionProducts(id: string) {
    const matches = id === 'featured'
      ? products.filter(product => product.is_featured || product.homeSection === 'featured')
      : id === 'pre_order'
        ? products.filter(product => product.preOrder)
        : id === 'offers'
          ? products.filter(product => {
              if (product.homeSection === 'offers') return true;
              const current = catalogPrice(product.price);
              const original = catalogPrice(product.originalPrice);
              return current !== null && original !== null && original > current;
            })
          : products.filter(product => product.homeSection === id);
    const unique = new Map<string, LegacyHomeProduct>();
    matches.forEach(item => unique.set(item.id, item));
    return Array.from(unique.values()).slice(0, 12);
  }

  function favorite(product: LegacyHomeProduct) {
    return favorites.includes(String(product.legacyId || product.id));
  }

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6" aria-labelledby="home-catalog-title">
        <h1 id="home-catalog-title" className="sr-only">Golden Oremar canlı ürün kataloğu</h1>
        {storefrontConfigError ? <Notice type="error">{storefrontConfigError}</Notice> : null}
        {storefrontSalesBlocked && salesReadiness ? <Notice type="warning">{salesReadiness.message}</Notice> : null}
        {liveCatalogError ? <Notice type="error">{liveCatalogError}</Notice> : null}
        {filtersError ? <Notice type="error">{filtersError}</Notice> : null}
        {(storefrontLoading || liveCatalogLoading || filtersLoading) ? (
          <div role="status" aria-live="polite" className="mb-4 rounded-2xl border bg-white p-4 text-center text-sm font-semibold text-gray-500 dark:bg-gray-900">
            Canlı mağaza verileri doğrulanıyor…
          </div>
        ) : null}

        {!searchQuery && interfaceContent ? (
          <section className="mb-8 overflow-hidden rounded-[2rem] border border-brand-gold/20 bg-gradient-to-br from-brand-green via-brand-green to-[#123c2e] text-white shadow-xl" aria-labelledby="storefront-hero-title">
            <div className="grid min-h-[25rem] lg:grid-cols-[1.1fr_.9fr]">
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.15em]">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-brand-gold" />
                  Canlı katalog
                </div>
                <h2 id="storefront-hero-title" className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
                  {interfaceContent.heroTitle}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
                  {interfaceContent.heroSubtitle}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
                    className="min-h-12 rounded-xl bg-brand-gold px-6 font-bold text-brand-green shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {interfaceContent.heroButtonText}
                    <ArrowRight aria-hidden="true" className="ml-2 inline h-5 w-5" />
                  </button>
                  {quickCategories[0]?.id ? (
                    <button
                      type="button"
                      onClick={() => chooseCategory(quickCategories[0].id)}
                      className="min-h-12 rounded-xl border border-white/30 bg-white/10 px-6 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                    >
                      {quickCategories[0].name}
                    </button>
                  ) : null}
                </div>
                {!liveCatalogLoading ? (
                  <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                    <HeroMetric icon={Star} value={products.length} label="Canlı ürün" />
                    <HeroMetric icon={Users} value={producerCount} label="Üretici" />
                    <HeroMetric icon={MapPin} value={originCount} label="Menşe" />
                  </dl>
                ) : null}
              </div>

              <div className="relative min-h-72 overflow-hidden bg-black/10 p-5 sm:p-7">
                <div className="grid h-full grid-cols-2 gap-3">
                  {heroProducts.length ? heroProducts.map((product, index) => {
                    const context = safeText(product.producerName, 240) || safeText(product.origin, 240) || 'Üretici bilgisi yayınlanmadı';
                    return (
                      <button
                        type="button"
                        key={product.id}
                        onClick={() => onProductClick(product)}
                        aria-label={`${product.name} ürün detayını aç`}
                        className={`group relative min-h-36 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${index === 0 ? 'row-span-2' : ''}`}
                      >
                        <img
                          src={product.image}
                          alt={`${product.name} ürün görseli`}
                          loading={index === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 text-left">
                          <span className="block text-sm font-bold text-white">{product.name}</span>
                          <span className="mt-1 block text-xs text-white/75">{context}</span>
                        </span>
                      </button>
                    );
                  }) : (
                    <div className="col-span-2 grid place-items-center rounded-3xl border border-white/15 bg-white/5 p-8 text-center text-sm text-white/75">
                      {liveCatalogLoading ? 'Canlı ürün görselleri doğrulanıyor.' : 'Doğrulanmış ürün görseli henüz yayınlanmadı.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!searchQuery && interfaceContent && quickCategories.length ? (
          <section className="mb-8" aria-labelledby="quick-categories-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">Kategoriler</div>
                <h2 id="quick-categories-heading" className="mt-1 text-2xl font-bold text-brand-green dark:text-brand-gold">
                  {interfaceContent.categoriesTitle}
                </h2>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 snap-x" role="region" aria-label="Hızlı kategoriler">
              {quickCategories.map(category => {
                const images = products.filter(product => product.categorySlug === category.id && product.image).slice(0, 3);
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => chooseCategory(category.id)}
                    aria-pressed={activeFilter === category.id}
                    className={`min-w-[15rem] snap-start rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:bg-gray-900 ${activeFilter === category.id ? 'border-brand-gold ring-1 ring-brand-gold/30' : 'border-gray-100 dark:border-gray-800'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gold/10 text-brand-gold">
                        <Star aria-hidden="true" className="h-6 w-6" />
                      </div>
                      {images.length ? (
                        <div className="flex -space-x-2">
                          {images.map((product, index) => (
                            <img
                              key={`${product.id}:${index}`}
                              src={product.image}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              decoding="async"
                              className="h-10 w-10 rounded-full border-2 border-white object-cover dark:border-gray-900"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-5 text-lg font-bold text-brand-green dark:text-brand-gold">{category.name}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {category.description || `${category.productCount} canlı ürün`}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <SlidersHorizontal aria-hidden="true" className="h-5 w-5 text-brand-gold" />
                Katalog filtreleri
              </div>
              <p className="mt-1 text-sm text-gray-500">Kategori, menşe ve doğrulanmış fiyatla canlı sonuçları daraltın.</p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(value => !value)}
              aria-expanded={filtersOpen}
              aria-controls="home-filter-controls"
              disabled={filtersLoading}
              className="min-h-11 rounded-xl border px-4 font-semibold disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <Filter aria-hidden="true" className="mr-2 inline h-4 w-4" />
              {filtersLoading ? 'Filtreler yükleniyor' : filtersOpen ? 'Filtreleri gizle' : 'Filtrele'}
            </button>
          </div>

          {filtersOpen ? (
            <div id="home-filter-controls" className="mt-5 grid gap-5 lg:grid-cols-3">
              <fieldset>
                <legend className="text-sm font-bold">Kategori</legend>
                <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  <FilterChip active={!activeFilter} onClick={() => setActiveFilter(null)}>Tümü</FilterChip>
                  {filterCategories.map(category => (
                    <FilterChip key={category.id} active={activeFilter === category.id} onClick={() => setActiveFilter(category.id)}>
                      {category.name}
                    </FilterChip>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-bold">Menşe / üretim yeri</legend>
                <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  <FilterChip active={!activeOrigin} onClick={() => setActiveOrigin(null)}>Tümü</FilterChip>
                  {origins.map(origin => (
                    <FilterChip key={origin} active={activeOrigin === origin} onClick={() => setActiveOrigin(origin)}>
                      {origin}
                    </FilterChip>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={!priceFilterAvailable}>
                <legend className="text-sm font-bold">Fiyat aralığı{filterCurrency ? ` (${filterCurrency})` : ''}</legend>
                {priceFilterAvailable ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <FilterChip active={priceRange === 'all'} onClick={() => setPriceRange('all')}>Tümü</FilterChip>
                    <FilterChip active={priceRange === '0-250'} onClick={() => setPriceRange('0-250')}>0 - 250 {priceUnit}</FilterChip>
                    <FilterChip active={priceRange === '250-500'} onClick={() => setPriceRange('250-500')}>250 - 500 {priceUnit}</FilterChip>
                    <FilterChip active={priceRange === '500-plus'} onClick={() => setPriceRange('500-plus')}>500 {priceUnit} ve üzeri</FilterChip>
                  </div>
                ) : (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    Tek ve doğrulanmış katalog para birimi belirlenemediği için fiyat filtresi kapalıdır.
                  </p>
                )}
              </fieldset>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 dark:border-gray-800">
            <div role="status" aria-live="polite" className="text-sm text-gray-500">
              {liveCatalogLoading ? 'Ürünler doğrulanıyor' : `${filteredProducts.length} ürün gösteriliyor${activeCategoryName ? ` • ${activeCategoryName}` : ''}`}
            </div>
            <div className="flex flex-wrap gap-2">
              {(activeFilter || activeOrigin || priceRange !== 'all') ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-11 rounded-xl border border-red-200 px-4 font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"
                >
                  Filtreleri temizle
                </button>
              ) : null}
              <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 font-semibold">
                <ArrowDownUp aria-hidden="true" className="h-4 w-4 text-brand-gold" />
                <span className="sr-only">Sıralama</span>
                <select
                  value={sortOption}
                  onChange={event => setSortOption(event.target.value as SortOption)}
                  className="bg-transparent py-2 outline-none"
                >
                  <option value="featured">Öne çıkanlar</option>
                  <option value="rating">En yüksek puan</option>
                  <option value="price-asc">Fiyat artan</option>
                  <option value="price-desc">Fiyat azalan</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>

      {!searchQuery && !activeFilter && interfaceContent ? (
        <section className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6">
          {spotlightProduct ? (
            <div className="grid gap-7 rounded-3xl border border-brand-gold/20 bg-brand-gold/5 p-6 lg:grid-cols-[1fr_22rem] lg:items-center lg:p-9">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold">Öne çıkan ürün</div>
                <h2 className="mt-3 text-3xl font-bold text-brand-green dark:text-brand-gold">{interfaceContent.featuredTitle}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300">
                  Ürün, üretici, menşe, varyant, stok ve güven bilgilerini tek ekranda inceleyin. Gösterilen veriler canlı katalogdan gelir.
                </p>
              </div>
              <CatalogProductCard
                product={spotlightProduct}
                onClick={() => onProductClick(spotlightProduct)}
                onAddToCart={onAddToCart}
                onToggleFavorite={() => onToggleFavorite(spotlightProduct)}
                isFavorite={favorite(spotlightProduct)}
                onShare={() => onShare(spotlightProduct)}
                onGift={() => onGift(spotlightProduct)}
              />
            </div>
          ) : null}

          {homeSections.filter(section => section.active).map(section => {
            const items = sectionProducts(section.id);
            if (!items.length) return null;
            const seasonal = section.id === 'seasonal';
            const offers = section.id === 'offers';
            const preorder = section.id === 'pre_order';
            return (
              <section
                key={section.id}
                className={`rounded-3xl ${seasonal ? 'border border-green-100 bg-green-50/70 p-6 dark:border-green-900/40 dark:bg-green-950/10' : offers ? 'border border-red-100 bg-red-50/60 p-6 dark:border-red-900/40 dark:bg-red-950/10' : 'py-2'}`}
                aria-labelledby={`home-section-${section.id}`}
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold">
                    {offers ? <Flame aria-hidden="true" className="h-5 w-5" />
                      : preorder ? <Calendar aria-hidden="true" className="h-5 w-5" />
                        : seasonal ? <Sun aria-hidden="true" className="h-5 w-5" />
                          : <Star aria-hidden="true" className="h-5 w-5" />}
                  </span>
                  <h2 id={`home-section-${section.id}`} className="text-2xl font-bold text-brand-green dark:text-brand-gold">
                    {section.title}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {items.slice(0, 8).map(product => (
                    <CatalogProductCard
                      key={product.id}
                      product={product}
                      onClick={() => onProductClick(product)}
                      onAddToCart={onAddToCart}
                      onToggleFavorite={() => onToggleFavorite(product)}
                      isFavorite={favorite(product)}
                      onShare={() => onShare(product)}
                      onGift={() => onGift(product)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="text-center">
            <button
              type="button"
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
              className="min-h-12 rounded-full bg-brand-green px-7 font-bold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              Tüm ürünleri keşfet
              <ArrowRight aria-hidden="true" className="ml-2 inline h-5 w-5" />
            </button>
          </div>
        </section>
      ) : null}

      <section id="products" className="mx-auto mb-24 mt-10 max-w-7xl scroll-mt-28 px-4 sm:px-6" aria-labelledby="products-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">Canlı katalog</div>
            <h2 id="products-heading" className="mt-1 text-2xl font-bold text-brand-green dark:text-brand-gold">
              {searchQuery ? `“${searchQuery.trim().slice(0, 160)}” sonuçları` : activeCategoryName || 'Tüm ürünler'}
            </h2>
          </div>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              Aramayı temizle
            </button>
          ) : null}
        </div>

        {liveCatalogLoading ? (
          <ProductGridSkeleton />
        ) : !filteredProducts.length ? (
          <div className="rounded-3xl border border-dashed p-10 text-center">
            <Search aria-hidden="true" className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-600 dark:text-gray-300">Seçtiğiniz ölçütlere uyan canlı ürün bulunamadı.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); clearFilters(); }}
              className="mt-4 min-h-11 rounded-xl bg-brand-green px-5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              Tüm ürünleri göster
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map(product => (
              <CatalogProductCard
                key={product.id}
                product={product}
                onClick={() => onProductClick(product)}
                onAddToCart={onAddToCart}
                onToggleFavorite={() => onToggleFavorite(product)}
                isFavorite={favorite(product)}
                onShare={() => onShare(product)}
                onGift={() => onGift(product)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function HeroMetric({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>; value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
      <Icon aria-hidden="true" className="h-5 w-5 text-brand-gold" />
      <dt className="mt-2 text-xl font-black">{formatNumber(value)}</dt>
      <dd className="text-xs text-white/70">{label}</dd>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${active ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
    >
      {children}
    </button>
  );
}

function ProductGridSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Canlı ürünler yükleniyor" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} aria-hidden="true" className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="aspect-[4/3] animate-pulse bg-gray-100 dark:bg-gray-800" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
      <span className="sr-only">Canlı ürünler yükleniyor.</span>
    </div>
  );
}

function Notice({ type, children }: { type: 'error' | 'warning'; children: React.ReactNode }) {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`mb-4 rounded-2xl border p-4 text-sm ${type === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'}`}
    >
      {children}
    </div>
  );
}

function formatNumber(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) return 'Doğrulanamadı';
  try {
    return new Intl.NumberFormat('tr-TR').format(value);
  } catch {
    return String(value);
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
