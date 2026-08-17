import { supabase } from '../lib/supabase';

export type AdminCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  published_product_count: number;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function safeNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeSortOrder(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(Math.round(parsed))) {
    throw new Error('Kategori sıralaması geçerli bir tam sayı olmalıdır.');
  }
  const normalized = Math.round(parsed);
  if (normalized < -100000 || normalized > 100000) {
    throw new Error('Kategori sıralaması -100000 ile 100000 arasında olmalıdır.');
  }
  return normalized;
}

function normalizePersistentImage(value?: string | null) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.length > 2048) throw new Error('Kategori görsel yolu çok uzun.');
  if (/^(data|blob|javascript):/i.test(image)) {
    throw new Error('Geçici veya güvensiz kategori görsel adresi kullanılamaz.');
  }
  if (/^https?:\/\//i.test(image)) {
    let url: URL;
    try { url = new URL(image); } catch { throw new Error('Kategori görsel URL adresi geçersiz.'); }
    if (url.protocol !== 'https:') throw new Error('Harici kategori görseli yalnız HTTPS üzerinden kullanılabilir.');
    return url.toString();
  }
  const normalized = image.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\\')) {
    throw new Error('Kategori görsel dosya yolu geçersiz.');
  }
  return normalized;
}

export async function adminListCategories(): Promise<AdminCategory[]> {
  const { data, error } = await supabase.rpc('admin_list_categories_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    slug: String(row.slug || ''),
    name: String(row.name || 'İsimsiz kategori'),
    description: row.description ? String(row.description) : null,
    icon: row.icon ? String(row.icon) : null,
    image_path: row.image_path ? String(row.image_path) : null,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Math.trunc(Number(row.sort_order)) : 0,
    is_active: row.is_active === true,
    product_count: safeNonNegativeInteger(row.product_count),
    published_product_count: safeNonNegativeInteger(row.published_product_count),
  }));
}

export async function adminSaveCategory(input: {
  reference?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  const name = input.name.trim();
  const description = String(input.description || '').trim();
  const icon = String(input.icon || '').trim();
  const image = normalizePersistentImage(input.image);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  if (name.length < 2 || name.length > 120) throw new Error('Kategori adı 2 ile 120 karakter arasında olmalıdır.');
  if (description.length > 3000) throw new Error('Kategori açıklaması 3000 karakteri aşamaz.');
  if (icon.length > 80) throw new Error('Kategori ikon alanı 80 karakteri aşamaz.');
  const { data, error } = await supabase.rpc('management_upsert_category_v1', {
    p_reference: input.reference || null,
    p_payload: {
      name,
      description,
      icon,
      image,
      sortOrder,
      is_active: input.isActive,
    },
  });
  return unwrap<any>(data, error);
}

export async function adminArchiveCategory(reference: string) {
  const normalized = String(reference || '').trim();
  if (!normalized || normalized.length > 200) throw new Error('Kategori referansı geçersiz.');
  const { data, error } = await supabase.rpc('management_archive_category_v1', { p_reference: normalized });
  return unwrap<boolean>(data, error);
}

export function categoryAdminErrorMessage(error: unknown, fallback = 'Kategori işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['category_not_found', 'Kategori artık bulunamadı. Listeyi yenileyin.'],
    ['category_has_published_products', 'Yayında ürünü olan kategori pasifleştirilemez. Önce ürünleri başka kategoriye taşıyın veya yayından kaldırın.'],
    ['category_name_required', 'Kategori adı zorunludur.'],
    ['invalid_category_name', 'Kategori adı 2 ile 120 karakter arasında olmalıdır.'],
    ['invalid_category_field_length', 'Kategori alanlarından biri izin verilen uzunluğu aşıyor.'],
    ['persistent_category_image_required', 'Geçici blob veya data URL kategori görseli olarak kaydedilemez. Kalıcı dosya yolu kullanın.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}
