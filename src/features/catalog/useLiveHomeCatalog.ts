import { useEffect, useState } from 'react';
import { getPublicHomeCatalog, listPublicCategories, publicCatalogUrl } from './api';

export type LegacyHomeProduct = {
  id: string;
  legacyId?: string | null;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  categorySlug: string;
  price: number;
  originalPrice?: number | null;
  currency: string;
  image: string;
  origin?: string | null;
  unit?: string | null;
  tags: string[];
  rating: number;
  reviewCount: number;
  stock?: number | null;
  stockMode: string;
  is_approved: true;
  is_featured: boolean;
  homeSection?: string;
  preOrder: boolean;
  variantId: string;
  variantName: string;
  vendor_id: string;
  producerName: string;
};

export type LegacyHomeCategory = {
  id: string;
  databaseId: string;
  name: string;
  description: string;
  icon?: string | null;
  image?: string;
  productCount: number;
};

export function useLiveHomeCatalog() {
  const [products, setProducts] = useState<LegacyHomeProduct[]>([]);
  const [categories, setCategories] = useState<LegacyHomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        setProducts((catalog.items || []).map((item: any) => ({
          id: item.id,
          legacyId: item.legacyId ?? null,
          slug: item.slug,
          name: item.name,
          description: item.shortDescription || '',
          shortDescription: item.shortDescription || '',
          category: item.category.name,
          categorySlug: item.category.slug,
          price: Number(item.variant.priceMinor || 0) / 100,
          originalPrice: item.variant.compareAtPriceMinor ? Number(item.variant.compareAtPriceMinor) / 100 : null,
          currency: String(item.currency || 'TRY').toUpperCase(),
          image: publicCatalogUrl(item.imagePath),
          origin: item.origin || null,
          unit: item.unitLabel || item.variant.name,
          tags: [],
          rating: Number(item.averageRating || 0),
          reviewCount: Number(item.reviewCount || 0),
          stock: item.availableQuantity ?? null,
          stockMode: item.stockMode,
          is_approved: true as const,
          is_featured: !!item.featured,
          homeSection: item.homeSection || (item.featured ? 'featured' : 'regular'),
          preOrder: item.stockMode === 'preorder',
          variantId: item.variant.id,
          variantName: item.variant.name,
          vendor_id: item.producer.id,
          producerName: item.producer.name,
        })));

        setCategories((categoryRows || []).map(category => ({
          id: category.slug,
          databaseId: category.id,
          name: category.name,
          description: category.description || '',
          icon: category.icon || null,
          image: publicCatalogUrl(category.imagePath),
          productCount: Number(category.productCount || 0),
        })));
      } catch (err: any) {
        if (active) {
          setProducts([]);
          setCategories([]);
          setError(err?.message || 'Canlı katalog yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { products, categories, loading, error };
}
