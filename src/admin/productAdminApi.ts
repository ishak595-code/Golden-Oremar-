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
  available_quantity: number;
  review_count: number;
  rating_average: number;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function adminListProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase.rpc('admin_list_products_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    producer_id: row.producer_id ? String(row.producer_id) : null,
    producer_name: String(row.producer_name || 'Bilinmeyen üretici'),
    producer_verified: row.producer_verified === true,
    producer_origin_verified: row.producer_origin_verified === true,
    category_id: row.category_id ? String(row.category_id) : null,
    category_name: row.category_name ? String(row.category_name) : null,
    slug: String(row.slug || ''),
    name: String(row.name || 'İsimsiz ürün'),
    base_price_minor: Number(row.base_price_minor || 0),
    compare_at_price_minor: row.compare_at_price_minor == null ? null : Number(row.compare_at_price_minor),
    currency: String(row.currency || 'TRY'),
    status: (['draft', 'review', 'published', 'rejected', 'archived'].includes(String(row.status)) ? row.status : 'draft') as AdminProductStatus,
    is_featured: row.is_featured === true,
    is_active: row.is_active === true,
    requires_cold_chain: row.requires_cold_chain === true,
    is_perishable: row.is_perishable === true,
    variant_count: Number(row.variant_count || 0),
    available_quantity: Number(row.available_quantity || 0),
    review_count: Number(row.review_count || 0),
    rating_average: Number(row.rating_average || 0),
  }));
}

export async function adminReviewProduct(productId: string, approve: boolean, reason?: string) {
  const cleanReason = reason?.trim() || null;
  if (!approve && (!cleanReason || cleanReason.length < 8 || cleanReason.length > 2000)) {
    throw new Error('Ürün reddi için 8 ile 2000 karakter arasında gerekçe yazılmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_review_product_v1', {
    p_product_id: productId,
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
    ['primary_product_image_required', 'Ürün yayınlanmadan önce birincil ürün görseli gereklidir.'],
    ['product_rejection_reason_required', 'Ürün reddi için en az 8 karakterlik gerekçe gerekir.'],
    ['product_rejection_reason_too_long', 'Ürün ret gerekçesi 2000 karakteri aşamaz.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function formatProductMoney(minor: number | null | undefined, currency = 'TRY') {
  return (Number(minor || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
}
