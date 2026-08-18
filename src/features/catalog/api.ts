import { supabase } from '../../lib/supabase';

export type CatalogSuggestion = {
  kind: 'product' | 'producer' | 'category';
  id: string;
  label: string;
  value: string;
};

export type ProducerFollowMetric = {
  producerId: string;
  followerCount: number;
  following: boolean;
  verified: boolean;
  originVerified: boolean;
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

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 240) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function optionalText(value: unknown, max = 1000) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return value;
}

function optionalSafeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value == null) return null;
  return safeInteger(value, label, min, max);
}

function normalizedCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Para birimi doğrulanamadı.');
  return currency;
}

function requireReference(value: unknown, label = 'Referans', max = 220) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function validateProductDetail(value: unknown) {
  if (!isRecord(value)) throw new Error('Ürün detayı sunucudan doğrulanamadı.');
  requiredText(value.id, 'Ürün kimliği', 160);
  requiredText(value.slug, 'Ürün bağlantısı', 220);
  requiredText(value.name, 'Ürün adı', 300);
  normalizedCurrency(value.currency);
  if (!Array.isArray(value.variants) || value.variants.length < 1 || value.variants.length > 100) throw new Error('Ürün seçenekleri sunucudan doğrulanamadı.');
  value.variants.forEach((variant: unknown, index: number) => {
    if (!isRecord(variant)) throw new Error(`${index + 1}. ürün seçeneği doğrulanamadı.`);
    requiredText(variant.id, 'Varyant kimliği', 160);
    requiredText(variant.name, 'Varyant adı', 240);
    safeInteger(variant.priceMinor, 'Varyant fiyatı');
    optionalSafeInteger(variant.compareAtPriceMinor, 'Karşılaştırma fiyatı');
    optionalSafeInteger(variant.availableQuantity, 'Satılabilir stok', 0, 999999999);
    optionalSafeInteger(variant.weightGrams, 'Sevkiyat ağırlığı', 0, 100000000);
    if (typeof variant.available !== 'boolean') throw new Error('Varyant satış durumu doğrulanamadı.');
    if (variant.default != null && typeof variant.default !== 'boolean') throw new Error('Varsayılan varyant durumu doğrulanamadı.');
  });
  if (value.producer != null) {
    if (!isRecord(value.producer)) throw new Error('Üretici bilgisi doğrulanamadı.');
    requiredText(value.producer.id, 'Üretici kimliği', 160);
    requiredText(value.producer.name, 'Üretici adı', 240);
    requiredText(value.producer.slug, 'Üretici bağlantısı', 220);
    if (value.producer.verified != null && typeof value.producer.verified !== 'boolean') throw new Error('Üretici doğrulama durumu doğrulanamadı.');
    if (value.producer.originVerified != null && typeof value.producer.originVerified !== 'boolean') throw new Error('Menşe doğrulama durumu doğrulanamadı.');
  }
  if (value.images != null && (!Array.isArray(value.images) || value.images.length > 24)) throw new Error('Ürün görselleri doğrulanamadı.');
  if (Array.isArray(value.images)) value.images.forEach((image: unknown) => {
    if (!isRecord(image)) throw new Error('Ürün görseli doğrulanamadı.');
    requiredText(image.path, 'Ürün görsel yolu', 1200);
    if (image.primary != null && typeof image.primary !== 'boolean') throw new Error('Ürün ana görsel durumu doğrulanamadı.');
  });
  if (value.trustBadges != null && !Array.isArray(value.trustBadges)) throw new Error('Ürün güven rozetleri doğrulanamadı.');
  if (value.traceability != null && !isRecord(value.traceability)) throw new Error('Ürün izlenebilirlik bilgisi doğrulanamadı.');
  if (isRecord(value.traceability)) {
    if (!Array.isArray(value.traceability.batches)) throw new Error('Ürün lot bilgileri doğrulanamadı.');
    if (value.traceability.batches.length > 100) throw new Error('Ürün lot listesi desteklenen sınırı aşıyor.');
    if (typeof value.traceability.hasReleasedBatches !== 'boolean') throw new Error('Ürün lot yayın durumu doğrulanamadı.');
  }
  return value;
}

function validateProducerProfile(value: unknown) {
  if (!isRecord(value)) throw new Error('Üretici profili sunucudan doğrulanamadı.');
  requiredText(value.id, 'Üretici kimliği', 160);
  requiredText(value.slug, 'Üretici bağlantısı', 220);
  requiredText(value.display_name, 'Üretici adı', 240);
  if (value.following != null && typeof value.following !== 'boolean') throw new Error('Takip durumu doğrulanamadı.');
  optionalSafeInteger(value.product_count, 'Ürün sayısı', 0, 1000000);
  optionalSafeInteger(value.follower_count, 'Takipçi sayısı', 0, 1000000000);
  optionalSafeInteger(value.rating_count, 'Değerlendirme sayısı', 0, 1000000000);
  if (value.rating_average != null && (typeof value.rating_average !== 'number' || !Number.isFinite(value.rating_average) || value.rating_average < 0 || value.rating_average > 5)) throw new Error('Üretici puanı doğrulanamadı.');
  if (value.badges != null && !Array.isArray(value.badges)) throw new Error('Üretici güven rozetleri doğrulanamadı.');
  if (!Array.isArray(value.products) || value.products.length > 200) throw new Error('Üretici ürünleri sunucudan doğrulanamadı.');
  value.products.forEach((product: unknown, index: number) => {
    if (!isRecord(product)) throw new Error(`${index + 1}. üretici ürünü doğrulanamadı.`);
    requiredText(product.id, 'Ürün kimliği', 160);
    requiredText(product.slug, 'Ürün bağlantısı', 220);
    requiredText(product.name, 'Ürün adı', 300);
    requiredText(product.variant_id, 'Varyant kimliği', 160);
    requiredText(product.variant_name, 'Varyant adı', 240);
    normalizedCurrency(product.currency);
    safeInteger(product.price_minor, 'Ürün fiyatı');
    optionalSafeInteger(product.compare_at_price_minor, 'Karşılaştırma fiyatı');
    optionalSafeInteger(product.available_quantity, 'Satılabilir stok', 0, 999999999);
    optionalSafeInteger(product.weight_grams, 'Sevkiyat ağırlığı', 0, 100000000);
    optionalSafeInteger(product.review_count, 'Değerlendirme sayısı', 0, 1000000000);
    if (product.average_rating != null && (typeof product.average_rating !== 'number' || !Number.isFinite(product.average_rating) || product.average_rating < 0 || product.average_rating > 5)) throw new Error('Ürün puanı doğrulanamadı.');
    if (typeof product.available !== 'boolean') throw new Error('Ürün satış durumu doğrulanamadı.');
  });
  return value;
}

export async function searchCatalog(input: CatalogSearchInput = {}): Promise<CatalogSearchResponse> {
  const query = input.query?.trim().slice(0, 160) || null;
  const categorySlug = input.categorySlug?.trim().slice(0, 220) || null;
  const producerId = input.producerId?.trim().slice(0, 160) || null;
  const limit = Number.isSafeInteger(input.limit) ? Math.min(100, Math.max(1, input.limit as number)) : 20;
  const offset = Number.isSafeInteger(input.offset) ? Math.min(100000, Math.max(0, input.offset as number)) : 0;
  const { data, error } = await supabase.rpc('search_catalog_v1', {
    p_query: query,
    p_category_slug: categorySlug,
    p_producer_id: producerId,
    p_province: input.province?.trim().slice(0, 120) || null,
    p_district: input.district?.trim().slice(0, 120) || null,
    p_village: input.village?.trim().slice(0, 160) || null,
    p_min_price_minor: input.minPriceMinor ?? null,
    p_max_price_minor: input.maxPriceMinor ?? null,
    p_in_stock: input.inStock ?? false,
    p_featured: input.featured ?? null,
    p_sort: input.sort ?? 'relevance',
    p_limit: limit,
    p_offset: offset,
  });
  const result = unwrap<any>(data, error);
  if (!isRecord(result) || !Array.isArray(result.items)) throw new Error('Katalog arama sonucu doğrulanamadı.');
  return result as CatalogSearchResponse;
}

export async function catalogSuggestions(query: string, limit = 10): Promise<CatalogSuggestion[]> {
  const normalized = query.trim().slice(0, 160);
  if (!normalized) return [];
  const safeLimit = Number.isSafeInteger(limit) ? Math.min(20, Math.max(1, limit)) : 10;
  const { data, error } = await supabase.rpc('catalog_search_suggestions_v1', {
    p_query: normalized,
    p_limit: safeLimit,
  });
  const rows = unwrap<any>(data, error);
  if (!Array.isArray(rows)) throw new Error('Arama önerileri doğrulanamadı.');
  return rows.slice(0, safeLimit).flatMap((row: any) => {
    if (!isRecord(row) || !['product', 'producer', 'category'].includes(row.kind)) return [];
    const id = optionalText(row.id, 160); const label = optionalText(row.label, 240); const value = optionalText(row.value, 240);
    return id && label && value ? [{ kind: row.kind, id, label, value } as CatalogSuggestion] : [];
  });
}

export async function getProductDetail(reference: string) {
  const { data, error } = await supabase.rpc('get_public_product_detail_v1', {
    p_reference: requireReference(reference, 'Ürün referansı'),
  });
  return validateProductDetail(unwrap<unknown>(data, error));
}

export async function toggleProductFavorite(reference: string) {
  const { data, error } = await supabase.rpc('toggle_customer_favorite', {
    p_product_reference: requireReference(reference, 'Ürün referansı'),
  });
  const result = unwrap<any>(data, error);
  if (!isRecord(result) || typeof result.isFavorite !== 'boolean') throw new Error('Favori sonucu doğrulanamadı.');
  return result;
}

export async function listProductReviews(productId: string, limit = 20, offset = 0) {
  const safeLimit = Number.isSafeInteger(limit) ? Math.min(100, Math.max(1, limit)) : 20;
  const safeOffset = Number.isSafeInteger(offset) ? Math.min(100000, Math.max(0, offset)) : 0;
  const { data, error } = await supabase.rpc('get_product_reviews_v1', {
    p_product_id: requireReference(productId, 'Ürün kimliği', 160),
    p_limit: safeLimit,
    p_offset: safeOffset,
  });
  const result = unwrap<any>(data, error);
  if (!isRecord(result) || !Array.isArray(result.items)) throw new Error('Ürün yorumları doğrulanamadı.');
  if (result.items.length > safeLimit) throw new Error('Ürün yorumları beklenen sınırı aşıyor.');
  return result;
}

export function publicCatalogUrl(path?: string | null) {
  const raw = typeof path === 'string' ? path.trim() : '';
  if (!raw || /[\u0000-\u001F\u007F]/.test(raw)) return '';
  if (/^https:\/\//i.test(raw)) {
    try { return new URL(raw).toString(); } catch { return ''; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
  const normalized = raw.replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some(part => part === '..' || part === '.')) return '';
  return supabase.storage.from('catalog-public').getPublicUrl(normalized).data.publicUrl;
}

export async function getPublicProducerProfile(reference: string) {
  const { data, error } = await supabase.rpc('get_public_producer_profile_v2', {
    p_reference: requireReference(reference, 'Üretici referansı'),
  });
  return validateProducerProfile(unwrap<unknown>(data, error));
}

export async function getProducerFollowMetrics(producerIds: string[]): Promise<ProducerFollowMetric[]> {
  const unique = [...new Set(producerIds.map(value => optionalText(value, 160)).filter((value): value is string => Boolean(value)))].slice(0, 100);
  if (!unique.length) return [];
  const { data, error } = await supabase.rpc('get_public_producer_follow_metrics_v1', {
    p_producer_ids: unique,
  });
  const rows = unwrap<any>(data, error);
  if (!Array.isArray(rows)) throw new Error('Üretici takip metrikleri doğrulanamadı.');
  return rows.flatMap((row: any) => {
    if (!isRecord(row)) return [];
    const producerId = optionalText(row.producerId, 160);
    const followerCount = typeof row.followerCount === 'number' && Number.isSafeInteger(row.followerCount) && row.followerCount >= 0 ? row.followerCount : null;
    if (!producerId || followerCount === null || typeof row.following !== 'boolean' || typeof row.verified !== 'boolean' || typeof row.originVerified !== 'boolean') return [];
    return [{ producerId, followerCount, following: row.following, verified: row.verified, originVerified: row.originVerified }];
  });
}

export async function toggleProducerFollow(producerId: string) {
  const { data, error } = await supabase.rpc('toggle_producer_follow_v1', {
    p_producer_id: requireReference(producerId, 'Üretici kimliği', 160),
  });
  const result = unwrap<any>(data, error);
  if (!isRecord(result) || typeof result.following !== 'boolean') throw new Error('Takip sonucu doğrulanamadı.');
  return result;
}

export async function listFollowedProducerIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_my_followed_producers_v1');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Takip edilen üreticiler doğrulanamadı.');
  return data.flatMap((row: any) => {
    const id = isRecord(row) ? optionalText(row.id, 160) : null;
    return id ? [id] : [];
  });
}

export async function startProducerProductConversation(input: {
  producerId: string;
  productId: string;
  productName: string;
  message: string;
}) {
  const body = input.message.trim();
  if (!body || body.length > 5000) throw new Error('Mesaj 1 ile 5000 karakter arasında olmalıdır.');
  const producerId = requireReference(input.producerId, 'Üretici kimliği', 160);
  const productId = requireReference(input.productId, 'Ürün kimliği', 160);
  const productName = requiredText(input.productName, 'Ürün adı', 240);
  const subject = `Ürün hakkında: ${productName}`.slice(0, 200);
  const { data, error } = await supabase.rpc('start_producer_conversation_v1', {
    p_producer_id: producerId,
    p_product_id: productId,
    p_order_id: null,
    p_subject: subject,
    p_initial_message: body,
  });
  const result = unwrap<any>(data, error);
  if (!isRecord(result)) throw new Error('Konuşma sonucu doğrulanamadı.');
  return result;
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
  const rows = unwrap<any>(data, error);
  if (!Array.isArray(rows)) throw new Error('Kategori listesi doğrulanamadı.');
  return rows as PublicCategory[];
}

export async function getPublicHomeCatalog() {
  const { data, error } = await supabase.rpc('get_public_home_catalog_v1');
  const result = unwrap<any>(data, error);
  if (!isRecord(result)) throw new Error('Ana katalog sunucudan doğrulanamadı.');
  return result;
}

export async function listFavoriteReferences(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_customer_favorite_references');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Favori ürün referansları doğrulanamadı.');
  return data.flatMap((row: any) => {
    const reference = isRecord(row) ? optionalText(row.product_reference, 220) : null;
    return reference ? [reference] : [];
  });
}
