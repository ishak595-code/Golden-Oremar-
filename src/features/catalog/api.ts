import { supabase } from '../../lib/supabase';

export type CatalogSuggestion = {
  kind: 'product' | 'producer' | 'category';
  id: string;
  label: string;
  value: string;
};

export type CatalogItem = {
  id: string;
  legacyId?: string | null;
  slug: string;
  name: string;
  shortDescription?: string | null;
  origin?: string | null;
  unitLabel?: string | null;
  category: { id: string; slug: string; name: string };
  producer: { id: string; name: string; province?: string | null; district?: string | null; village?: string | null };
  variant: { id: string; name: string; sku?: string | null; priceMinor: number; compareAtPriceMinor?: number | null };
  currency: string;
  stockMode: string;
  availableQuantity?: number | null;
  featured: boolean;
  imagePath?: string | null;
  averageRating: number;
  reviewCount: number;
};

export type CatalogSearchResponse = {
  total: number;
  query: string;
  limit: number;
  offset: number;
  items: CatalogItem[];
};

export type CatalogSearchInput = {
  query?: string | null;
  categorySlug?: string | null;
  producerId?: string | null;
  province?: string | null;
  district?: string | null;
  village?: string | null;
  minPriceMinor?: number | null;
  maxPriceMinor?: number | null;
  inStock?: boolean;
  featured?: boolean | null;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating';
  limit?: number;
  offset?: number;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function searchCatalog(input: CatalogSearchInput = {}): Promise<CatalogSearchResponse> {
  const { data, error } = await supabase.rpc('search_catalog_v1', {
    p_query: input.query?.trim() || null,
    p_category_slug: input.categorySlug?.trim() || null,
    p_producer_id: input.producerId || null,
    p_province: input.province?.trim() || null,
    p_district: input.district?.trim() || null,
    p_village: input.village?.trim() || null,
    p_min_price_minor: input.minPriceMinor ?? null,
    p_max_price_minor: input.maxPriceMinor ?? null,
    p_in_stock: input.inStock ?? false,
    p_featured: input.featured ?? null,
    p_sort: input.sort ?? 'relevance',
    p_limit: input.limit ?? 20,
    p_offset: input.offset ?? 0,
  });
  return unwrap<CatalogSearchResponse>(data, error);
}

export async function catalogSuggestions(query: string, limit = 10): Promise<CatalogSuggestion[]> {
  const normalized = query.trim();
  if (!normalized) return [];
  const { data, error } = await supabase.rpc('catalog_search_suggestions_v1', {
    p_query: normalized,
    p_limit: limit,
  });
  return unwrap<CatalogSuggestion[]>(data, error);
}

export async function getProductDetail(reference: string) {
  const { data, error } = await supabase.rpc('get_public_product_detail_v1', {
    p_reference: reference,
  });
  return unwrap<any>(data, error);
}

export async function toggleProductFavorite(reference: string) {
  const { data, error } = await supabase.rpc('toggle_customer_favorite', {
    p_product_reference: reference,
  });
  return unwrap<any>(data, error);
}

export async function listProductReviews(productId: string, limit = 20, offset = 0) {
  const { data, error } = await supabase.rpc('get_product_reviews_v1', {
    p_product_id: productId,
    p_limit: limit,
    p_offset: offset,
  });
  return unwrap<any>(data, error);
}

export function publicCatalogUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('catalog-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}

export async function getPublicProducerProfile(reference: string) {
  const { data, error } = await supabase.rpc('get_public_producer_profile_v1', {
    p_reference: reference,
  });
  return unwrap<any>(data, error);
}

export async function toggleProducerFollow(producerId: string) {
  const { data, error } = await supabase.rpc('toggle_producer_follow_v1', {
    p_producer_id: producerId,
  });
  return unwrap<any>(data, error);
}

export async function listFollowedProducerIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_my_followed_producers_v1');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: any) => String(row.id));
}

export async function startProducerProductConversation(input: {
  producerId: string;
  productId: string;
  productName: string;
  message: string;
}) {
  const body = input.message.trim();
  if (!body || body.length > 5000) throw new Error('Mesaj 1 ile 5000 karakter arasında olmalıdır.');
  const subject = `Ürün hakkında: ${input.productName}`.slice(0, 200);
  const { data, error } = await supabase.rpc('start_producer_conversation_v1', {
    p_producer_id: input.producerId,
    p_product_id: input.productId,
    p_order_id: null,
    p_subject: subject,
    p_initial_message: body,
  });
  return unwrap<any>(data, error);
}

export type PublicCategory = {
  id: string;
  parentId?: string | null;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  imagePath?: string | null;
  sortOrder: number;
  productCount: number;
};

export async function listPublicCategories(): Promise<PublicCategory[]> {
  const { data, error } = await supabase.rpc('list_public_categories_v1');
  return unwrap<PublicCategory[]>(data, error);
}

export async function getPublicHomeCatalog() {
  const { data, error } = await supabase.rpc('get_public_home_catalog_v1');
  return unwrap<any>(data, error);
}

export async function listFavoriteReferences(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_customer_favorite_references');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: any) => String(row.product_reference));
}
