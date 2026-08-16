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
    sort_order: Number(row.sort_order || 0),
    is_active: row.is_active === true,
    product_count: Number(row.product_count || 0),
    published_product_count: Number(row.published_product_count || 0),
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
  if (name.length < 2 || name.length > 120) throw new Error('Kategori adı 2 ile 120 karakter arasında olmalıdır.');
  if ((input.description || '').length > 3000) throw new Error('Kategori açıklaması 3000 karakteri aşamaz.');
  if ((input.icon || '').length > 80) throw new Error('Kategori ikon alanı 80 karakteri aşamaz.');
  if ((input.image || '').length > 2048) throw new Error('Kategori görsel yolu çok uzun.');
  const { data, error } = await supabase.rpc('management_upsert_category_v1', {
    p_reference: input.reference || null,
    p_payload: {
      name,
      description: input.description?.trim() || '',
      icon: input.icon?.trim() || '',
      image: input.image?.trim() || '',
      sortOrder: Math.round(input.sortOrder || 0),
      is_active: input.isActive,
    },
  });
  return unwrap<any>(data, error);
}

export async function adminArchiveCategory(reference: string) {
  const { data, error } = await supabase.rpc('management_archive_category_v1', { p_reference: reference });
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
