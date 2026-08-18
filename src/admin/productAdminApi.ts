import { supabase } from '../lib/supabase';

export type AdminProductStatus = 'draft' | 'review' | 'published' | 'rejected' | 'archived';

export type AdminProduct = {
  id: string;
  producer_id: string | null;
  producer_name: string;
  producer_verified: boolean;
  producer_origin_verified: boolean;
  category_id: string | null;
  category_name: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  origin: string | null;
  unit_label: string | null;
  base_price_minor: number;
  compare_at_price_minor: number | null;
  currency: string;
  status: AdminProductStatus;
  stock_mode: string;
  is_featured: boolean;
  is_active: boolean;
  export_status: string;
  country_of_origin_code: string | null;
  requires_cold_chain: boolean;
  is_perishable: boolean;
  shelf_life_days: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  variant_count: number;
  active_variant_count: number;
  missing_weight_variant_count: number;
  database_primary_image_count: number;
  primary_image_count: number;
  stored_image_count: number;
  stored_primary_image_count: number;
  image_asset_ready: boolean;
  available_quantity: number;
  review_count: number;
  rating_average: number;
  shipping_weight_ready: boolean;
  origin_code_ready: boolean;
  shelf_life_ready: boolean;
  export_ready: boolean;
  catalog_issue_count: number;
};

const PRODUCT_STATUSES = new Set<AdminProductStatus>(['draft','review','published','rejected','archived']);

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 300) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, max = 1000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Ürün metin alanı doğrulanamadı.');
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error('Ürün metin alanı doğrulanamadı.');
  return text;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value == null) return null;
  return safeInteger(value, label, min, max);
}

function requireBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function safeRating(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 5) throw new Error('Ürün puanı doğrulanamadı.');
  return value;
}

function safeCurrency(value: unknown) {
  const currency = requiredText(value, 'Para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Para birimi doğrulanamadı.');
  return currency;
}

function safeDate(value: unknown, label: string, optional = false) {
  if (value == null && optional) return null;
  const text = requiredText(value, label, 80);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function normalizeRow(value: unknown, index: number): AdminProduct {
  if (!isRecord(value)) throw new Error(`${index + 1}. yönetim ürün kaydı doğrulanamadı.`);
  const statusText = requiredText(value.status, 'Ürün durumu', 30) as AdminProductStatus;
  if (!PRODUCT_STATUSES.has(statusText)) throw new Error('Ürün durumu doğrulanamadı.');
  const countryCode = optionalText(value.country_of_origin_code, 2)?.toUpperCase() || null;
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) throw new Error('Menşe ülke kodu doğrulanamadı.');
  const producerId = optionalText(value.producer_id, 160);
  const producerName = optionalText(value.producer_name, 240) || 'Üretici kaydı yok';
  const imageAssetReady = requireBoolean(value.image_asset_ready, 'Görsel dosyası hazırlığı');
  const primaryImageCount = safeInteger(value.primary_image_count, 'Storage birincil görsel sayısı', 0, 1000);
  const storedPrimaryImageCount = safeInteger(value.stored_primary_image_count, 'Storage birincil görsel sayısı', 0, 1000);
  if (primaryImageCount !== storedPrimaryImageCount || imageAssetReady !== (storedPrimaryImageCount === 1)) throw new Error('Görsel hazırlık özeti kendi içinde tutarsız.');
  return {
    id: requiredText(value.id, 'Ürün kimliği', 160),
    producer_id: producerId,
    producer_name: producerName,
    producer_verified: requireBoolean(value.producer_verified, 'Üretici doğrulama durumu'),
    producer_origin_verified: requireBoolean(value.producer_origin_verified, 'Menşe doğrulama durumu'),
    category_id: optionalText(value.category_id, 160),
    category_name: optionalText(value.category_name, 240),
    slug: requiredText(value.slug, 'Ürün bağlantısı', 220),
    name: requiredText(value.name, 'Ürün adı', 300),
    short_description: optionalText(value.short_description, 1000),
    description: optionalText(value.description, 10000),
    origin: optionalText(value.origin, 500),
    unit_label: optionalText(value.unit_label, 120),
    base_price_minor: safeInteger(value.base_price_minor, 'Ürün taban fiyatı'),
    compare_at_price_minor: optionalInteger(value.compare_at_price_minor, 'Karşılaştırma fiyatı'),
    currency: safeCurrency(value.currency),
    status: statusText,
    stock_mode: requiredText(value.stock_mode, 'Stok modeli', 80),
    is_featured: requireBoolean(value.is_featured, 'Vitrin durumu'),
    is_active: requireBoolean(value.is_active, 'Ürün aktiflik durumu'),
    export_status: requiredText(value.export_status, 'İhracat durumu', 80),
    country_of_origin_code: countryCode,
    requires_cold_chain: requireBoolean(value.requires_cold_chain, 'Soğuk zincir durumu'),
    is_perishable: requireBoolean(value.is_perishable, 'Bozulabilir ürün durumu'),
    shelf_life_days: optionalInteger(value.shelf_life_days, 'Raf ömrü', 1, 36500),
    published_at: safeDate(value.published_at, 'Yayın tarihi', true),
    created_at: safeDate(value.created_at, 'Oluşturma tarihi') as string,
    updated_at: safeDate(value.updated_at, 'Güncelleme tarihi') as string,
    variant_count: safeInteger(value.variant_count, 'Varyant sayısı', 0, 10000),
    active_variant_count: safeInteger(value.active_variant_count, 'Aktif varyant sayısı', 0, 10000),
    missing_weight_variant_count: safeInteger(value.missing_weight_variant_count, 'Eksik ağırlık varyant sayısı', 0, 10000),
    database_primary_image_count: safeInteger(value.database_primary_image_count, 'Veritabanı birincil görsel kaydı', 0, 1000),
    primary_image_count: primaryImageCount,
    stored_image_count: safeInteger(value.stored_image_count, 'Storage görsel sayısı', 0, 10000),
    stored_primary_image_count: storedPrimaryImageCount,
    image_asset_ready: imageAssetReady,
    available_quantity: safeInteger(value.available_quantity, 'Satılabilir stok', 0, 1000000000),
    review_count: safeInteger(value.review_count, 'Değerlendirme sayısı', 0, 1000000000),
    rating_average: safeRating(value.rating_average),
    shipping_weight_ready: requireBoolean(value.shipping_weight_ready, 'Kargo ağırlığı hazırlığı'),
    origin_code_ready: requireBoolean(value.origin_code_ready, 'Menşe kodu hazırlığı'),
    shelf_life_ready: requireBoolean(value.shelf_life_ready, 'Raf ömrü hazırlığı'),
    export_ready: requireBoolean(value.export_ready, 'İhracat hazırlığı'),
    catalog_issue_count: safeInteger(value.catalog_issue_count, 'Katalog sorun sayısı', 0, 1000),
  };
}

export async function adminListProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase.rpc('admin_list_products_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Yönetim ürün listesi sunucudan doğrulanamadı.');
  return rows.map(normalizeRow);
}

export async function adminReviewProduct(productId: string, approve: boolean, reason?: string) {
  const id = requiredText(productId, 'Ürün kimliği', 160);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Ürün kimliği doğrulanamadı.');
  if (typeof approve !== 'boolean') throw new Error('Ürün inceleme kararı doğrulanamadı.');
  const cleanReason = reason?.trim() || null;
  if (!approve && (!cleanReason || cleanReason.length < 8 || cleanReason.length > 2000)) {
    throw new Error('Ürün reddi için 8 ile 2000 karakter arasında gerekçe yazılmalıdır.');
  }
  if (approve && cleanReason && cleanReason.length > 2000) throw new Error('İnceleme notu 2000 karakteri aşamaz.');
  const { data, error } = await supabase.rpc('admin_review_product_v1', {
    p_product_id: id,
    p_approve: approve,
    p_reason: cleanReason,
  });
  return unwrap<any>(data, error);
}

export function productAdminErrorMessage(error: unknown, fallback = 'Ürün yönetim işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['product_not_reviewable', 'Bu ürün şu anda yönetici incelemesine açık değil.'],
    ['verified_active_producer_required', 'Ürün, aktif ve kimliği doğrulanmış bir üreticiye bağlı olmadan yayınlanamaz.'],
    ['rejected_product_must_be_resubmitted', 'Reddedilmiş ürün doğrudan onaylanamaz. Satıcı ürünü düzelterek yeniden incelemeye göndermelidir.'],
    ['product_content_incomplete', 'Ürün adı, açıklaması, hikayesi veya menşe bilgisi yayın için yetersiz.'],
    ['active_priced_variant_required', 'Ürünün en az bir aktif ve fiyatlandırılmış varyantı olmalıdır.'],
    ['stored_primary_product_image_required', 'Ürün yayınlanmadan önce birincil görselin gerçek dosyası catalog-public Storage alanında bulunmalıdır. Yalnız veritabanındaki görsel yolu yeterli değildir.'],
    ['primary_product_image_required', 'Ürün yayınlanmadan önce birincil ürün görseli gereklidir.'],
    ['product_rejection_reason_required', 'Ürün reddi için en az 8 karakterlik gerekçe gerekir.'],
    ['product_rejection_reason_too_long', 'Ürün ret gerekçesi 2000 karakteri aşamaz.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function formatProductMoney(minor: number | null | undefined, currency: string | null | undefined) {
  if (!Number.isSafeInteger(minor) || Number(minor) < 0) return 'Tutar doğrulanamadı';
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) return 'Para birimi doğrulanamadı';
  try {
    return (Number(minor) / 100).toLocaleString('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 });
  } catch {
    return 'Tutar doğrulanamadı';
  }
}
