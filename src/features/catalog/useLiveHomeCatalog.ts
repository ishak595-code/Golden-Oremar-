import { useEffect, useState } from 'react';
import { getProducerFollowMetrics, getPublicHomeCatalog, listPublicCategories, publicCatalogUrl } from './api';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';

export type LegacyHomeProduct = {
  id: string;
  legacyId?: string | null;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  categorySlug: string;
  price: number | null;
  originalPrice?: number | null;
  currency: string | null;
  image: string;
  origin?: string | null;
  unit?: string | null;
  tags: string[];
  rating: number | null;
  reviewCount: number | null;
  stock?: number | null;
  stockMode: string;
  is_approved: true;
  is_featured: boolean;
  homeSection?: string;
  preOrder: boolean;
  variantId: string;
  variantName: string;
  vendor_id: string;
  producerId: string;
  producerName: string;
  producerFollowerCount: number | null;
  producerVerified: boolean;
  producerOriginVerified: boolean;
};

export type LegacyHomeCategory = {
  id: string;
  databaseId: string;
  name: string;
  description: string;
  icon?: string | null;
  image?: string;
  productCount: number;
  sortOrder: number;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function safeText(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function safeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function safeRating(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
}
function safeCurrency(value: unknown) {
  const currency = safeText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}
function compactSearchTerms(values: unknown[]) {
  return Array.from(new Set(
    values
      .flatMap(value => typeof value === 'string' ? value.split(/[\s,;/|]+/g) : [])
      .map(value => value.trim())
      .filter(value => value.length > 1 && value.length <= 120)
  ));
}

export function useLiveHomeCatalog() {
  const [products, setProducts] = useState<LegacyHomeProduct[]>([]);
  const [categories, setCategories] = useState<LegacyHomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadSequence, setReloadSequence] = useState(0);

  useEffect(() => {
    const restore = () => setReloadSequence(value => value + 1);
    window.addEventListener(NETWORK_RESTORED_EVENT, restore);
    return () => window.removeEventListener(NETWORK_RESTORED_EVENT, restore);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [catalog, categoryRows] = await Promise.all([
          getPublicHomeCatalog(),
          listPublicCategories(),
        ]);
        if (!active) return;

        if (!isRecord(catalog) || !Array.isArray(catalog.items)) throw new Error('Ana katalog ürünleri sunucudan doğrulanamadı.');
        const catalogItems = catalog.items;
        const coreInvalid = catalogItems.some((item: any) => !isRecord(item) || !safeText(item.id,160) || !safeText(item.slug,220) || !safeText(item.name,300) || !isRecord(item.category) || !safeText(item.category.slug,220) || !safeText(item.category.name,160) || !isRecord(item.producer) || !safeText(item.producer.id,160) || !safeText(item.producer.name,240) || !isRecord(item.variant) || !safeText(item.variant.id,160) || !safeText(item.variant.name,240));
        if (coreInvalid) throw new Error('Ana katalogda kimliği doğrulanamayan ürün bulundu. Liste güvenli şekilde gösterilemedi.');

        const producerIds: string[] = Array.from(new Set<string>(catalogItems.map((item: any) => safeText(item.producer.id,160)).filter(Boolean)));
        const metrics = await getProducerFollowMetrics(producerIds).catch(metricsError => {
          console.warn('Producer metrics hydration failed; catalog remains usable without trust badges.', metricsError);
          return [];
        });
        if (!active) return;
        const metricByProducer = new Map(metrics.map(metric => [metric.producerId, metric] as const));

        setProducts(catalogItems.map((item: any) => {
          const producerId = safeText(item.producer.id,160);
          const producerMetric = metricByProducer.get(producerId);
          const origin = safeText(item.origin,240) || null;
          const priceMinor = safeInteger(item.variant.priceMinor);
          const compareAtMinor = safeInteger(item.variant.compareAtPriceMinor);
          const currency = safeCurrency(item.currency);
          const availableQuantity = item.availableQuantity == null ? null : safeInteger(item.availableQuantity);
          const stockMode = safeText(item.stockMode,80);
          const rating = safeRating(item.averageRating);
          const reviewCount = safeInteger(item.reviewCount);
          const tags = compactSearchTerms([
            safeText(item.name,300),
            safeText(item.category.name,160),
            safeText(item.category.slug,220),
            safeText(item.producer.name,240),
            safeText(item.producer.village,160),
            safeText(item.producer.district,160),
            safeText(item.producer.province,160),
            origin,
            safeText(item.unitLabel,120),
            safeText(item.variant.name,240),
          ]);
          return {
            id: safeText(item.id,160),
            legacyId: safeText(item.legacyId,160) || null,
            slug: safeText(item.slug,220),
            name: safeText(item.name,300),
            description: safeText(item.shortDescription,1000),
            shortDescription: safeText(item.shortDescription,1000),
            category: safeText(item.category.name,160),
            categorySlug: safeText(item.category.slug,220),
            price: priceMinor === null ? null : priceMinor / 100,
            originalPrice: compareAtMinor === null ? null : compareAtMinor / 100,
            currency,
            image: publicCatalogUrl(item.imagePath),
            origin,
            unit: safeText(item.unitLabel,120) || safeText(item.variant.name,120) || null,
            tags,
            rating,
            reviewCount,
            stock: availableQuantity,
            stockMode,
            is_approved: true as const,
            is_featured: item.featured === true,
            homeSection: safeText(item.homeSection,80) || (item.featured === true ? 'featured' : 'regular'),
            preOrder: stockMode === 'preorder',
            variantId: safeText(item.variant.id,160),
            variantName: safeText(item.variant.name,240),
            vendor_id: producerId,
            producerId,
            producerName: safeText(item.producer.name,240),
            producerFollowerCount: producerMetric ? producerMetric.followerCount : null,
            producerVerified: producerMetric?.verified === true,
            producerOriginVerified: producerMetric?.originVerified === true,
          };
        }));

        if (!Array.isArray(categoryRows)) throw new Error('Kategori listesi sunucudan doğrulanamadı.');
        const normalizedCategories = categoryRows.map(category => {
          if (!isRecord(category)) throw new Error('Kategori kaydı doğrulanamadı.');
          const id = safeText(category.slug,220);
          const databaseId = safeText(category.id,160);
          const name = safeText(category.name,160);
          const productCount = safeInteger(category.productCount);
          const sortOrder = safeInteger(category.sortOrder);
          if (!id || !databaseId || !name || productCount === null || sortOrder === null) throw new Error('Kategori kimliği veya sayacı doğrulanamadı.');
          return {
            id,
            databaseId,
            name,
            description: safeText(category.description,1000),
            icon: safeText(category.icon,120) || null,
            image: publicCatalogUrl(category.imagePath),
            productCount,
            sortOrder,
          };
        });
        setCategories(normalizedCategories.sort((a, b) => a.sortOrder - b.sortOrder || b.productCount - a.productCount || a.name.localeCompare(b.name, 'tr')));
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Canlı katalog yüklenemedi.');
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadSequence]);

  return { products, categories, loading, error };
}
