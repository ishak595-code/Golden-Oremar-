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

type AdminCategoryMutationResult = {
  id: string;
  databaseId: string;
  name: string;
  is_active: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalUuid(value: unknown, label: string) {
  if (value == null || value === '') return null;
  return uuid(value, label);
}

function nonNegativeInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return value;
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function normalizeSortOrder(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100000) {
    throw new Error('Kategori sıralaması 0 ile 100000 arasında tam sayı olmalıdır.');
  }
  return value;
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

function normalizeCategory(value: unknown, index: number): AdminCategory {
  if (!isRecord(value)) throw new Error(`${index + 1}. kategori kaydı doğrulanamadı.`);
  return {
    id: uuid(value.id, `${index + 1}. kategori kimliği`),
    parent_id: optionalUuid(value.parent_id, `${index + 1}. üst kategori kimliği`),
    slug: requiredText(value.slug, `${index + 1}. kategori kısa adı`, 160),
    name: requiredText(value.name, `${index + 1}. kategori adı`, 120),
    description: optionalText(value.description, `${index + 1}. kategori açıklaması`, 3000),
    icon: optionalText(value.icon, `${index + 1}. kategori ikonu`, 80),
    image_path: optionalText(value.image_path, `${index + 1}. kategori görseli`, 2048),
    sort_order: nonNegativeInteger(value.sort_order, `${index + 1}. kategori sıralaması`, 100000),
    is_active: booleanValue(value.is_active, `${index + 1}. kategori aktiflik durumu`),
    product_count: nonNegativeInteger(value.product_count, `${index + 1}. kategori ürün sayısı`, 1000000000),
    published_product_count: nonNegativeInteger(value.published_product_count, `${index + 1}. yayındaki ürün sayısı`, 1000000000),
  };
}

function normalizeMutationResult(value: unknown): AdminCategoryMutationResult {
  if (!isRecord(value)) throw new Error('Kategori kayıt sonucu doğrulanamadı.');
  return {
    id: requiredText(value.id, 'Kategori kısa adı', 160),
    databaseId: uuid(value.databaseId, 'Kategori veritabanı kimliği'),
    name: requiredText(value.name, 'Kategori adı', 120),
    is_active: booleanValue(value.is_active, 'Kategori aktiflik durumu'),
  };
}

export async function adminListCategories(): Promise<AdminCategory[]> {
  const { data, error } = await supabase.rpc('admin_list_categories_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Kategori listesi sunucudan doğrulanamadı.');
  return rows.map(normalizeCategory);
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
  if (typeof input.isActive !== 'boolean') throw new Error('Kategori aktiflik durumu geçersiz.');
  const reference = input.reference == null ? null : requiredText(input.reference, 'Kategori referansı', 200);
  const { data, error } = await supabase.rpc('management_upsert_category_v1', {
    p_reference: reference,
    p_payload: {
      name,
      description,
      icon,
      image,
      sortOrder,
      is_active: input.isActive,
    },
  });
  return normalizeMutationResult(unwrap<unknown>(data, error));
}

export async function adminArchiveCategory(reference: string) {
  const normalized = requiredText(reference, 'Kategori referansı', 200);
  const { data, error } = await supabase.rpc('management_archive_category_v1', { p_reference: normalized });
  const result = unwrap<unknown>(data, error);
  if (result !== true) throw new Error('Kategori pasifleştirme sonucu doğrulanamadı.');
  return true;
}

export function categoryAdminErrorMessage(error: unknown, fallback = 'Kategori işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['category_not_found', 'Kategori artık bulunamadı. Listeyi yenileyin.'],
    ['category_has_published_products', 'Yayında ürünü olan kategori pasifleştirilemez. Önce ürünleri başka kategoriye taşıyın veya yayından kaldırın.'],
    ['invalid_category_payload', 'Kategori veri yapısı geçersiz.'],
    ['category_name_required', 'Kategori adı zorunludur.'],
    ['invalid_category_name', 'Kategori adı 2 ile 120 karakter arasında olmalıdır.'],
    ['invalid_category_field_length', 'Kategori alanlarından biri izin verilen uzunluğu aşıyor.'],
    ['persistent_category_image_required', 'Geçici blob veya data URL kategori görseli olarak kaydedilemez. Kalıcı dosya yolu kullanın.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}
