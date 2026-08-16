import { supabase } from '../lib/supabase';

export type AdminContentType = 'blog' | 'recipe' | 'health_guide' | 'product_health';

export type AdminContentEntry = {
  id: string;
  legacy_id: string | null;
  content_type: AdminContentType;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  image: string | null;
  related_product_id: string | null;
  related_product_name: string | null;
  status: string;
  locale: string;
  metadata: Record<string, any>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminBrandConfig = {
  slug: string;
  brandName: string;
  maintenanceMode: boolean;
  supportEmail: string | null;
  supportPhone: string | null;
  publicConfig: Record<string, any>;
  updatedAt: string;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function adminListContent(): Promise<AdminContentEntry[]> {
  const { data, error } = await supabase.rpc('admin_list_content_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    legacy_id: row.legacy_id ? String(row.legacy_id) : null,
    content_type: String(row.content_type || 'blog') as AdminContentType,
    slug: String(row.slug || ''),
    title: String(row.title || 'İsimsiz içerik'),
    summary: row.summary ? String(row.summary) : null,
    content: String(row.content || ''),
    image: row.image ? String(row.image) : null,
    related_product_id: row.related_product_id ? String(row.related_product_id) : null,
    related_product_name: row.related_product_name ? String(row.related_product_name) : null,
    status: String(row.status || 'draft'),
    locale: String(row.locale || 'tr'),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  }));
}

export async function adminSaveContent(input: {
  reference?: string | null;
  type: AdminContentType;
  title: string;
  summary?: string | null;
  content: string;
  image?: string | null;
  relatedProductId?: string | null;
  category?: string | null;
  date?: string | null;
}) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length < 2 || title.length > 240) throw new Error('İçerik başlığı 2 ile 240 karakter arasında olmalıdır.');
  if ((input.summary || '').length > 2000) throw new Error('İçerik özeti 2000 karakteri aşamaz.');
  if (content.length > 200000) throw new Error('İçerik metni 200000 karakteri aşamaz.');
  if ((input.image || '').length > 2048) throw new Error('İçerik görsel yolu çok uzun.');
  if (input.type === 'product_health' && !input.relatedProductId) throw new Error('Ürün sağlık bilgisi için ilişkili ürün seçilmelidir.');
  const { data, error } = await supabase.rpc('management_upsert_content_v1', {
    p_reference: input.reference || null,
    p_content_type: input.type,
    p_payload: {
      title,
      summary: input.summary?.trim() || '',
      content,
      image: input.image?.trim() || '',
      productId: input.relatedProductId || null,
      category: input.category?.trim() || '',
      date: input.date?.trim() || '',
    },
  });
  return unwrap<any>(data, error);
}

export async function adminArchiveContent(reference: string) {
  const { data, error } = await supabase.rpc('management_archive_content_v1', { p_reference: reference });
  return unwrap<boolean>(data, error);
}

export async function adminGetBrandConfiguration(): Promise<AdminBrandConfig> {
  const { data, error } = await supabase.rpc('admin_get_brand_configuration_v1');
  const raw = unwrap<any>(data, error) || {};
  return {
    slug: String(raw.slug || 'golden-oremar'),
    brandName: String(raw.brandName || 'Golden Oremar'),
    maintenanceMode: raw.maintenanceMode === true,
    supportEmail: raw.supportEmail ? String(raw.supportEmail) : null,
    supportPhone: raw.supportPhone ? String(raw.supportPhone) : null,
    publicConfig: raw.publicConfig && typeof raw.publicConfig === 'object' ? raw.publicConfig : {},
    updatedAt: String(raw.updatedAt || ''),
  };
}

export async function adminUpdateBrandSection(section: 'general' | 'contactInfo' | 'heroCategories' | 'homeSections' | 'staticContent', payload: Record<string, any>) {
  const { data, error } = await supabase.rpc('admin_update_brand_configuration_v1', {
    p_section: section,
    p_payload: payload,
  });
  return unwrap<any>(data, error);
}

export function contentAdminErrorMessage(error: unknown, fallback = 'İçerik işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['content_not_found', 'İçerik artık bulunamadı. Listeyi yenileyin.'],
    ['invalid_content_payload', 'İçerik türü veya veri yapısı geçersiz.'],
    ['content_title_required', 'İçerik başlığı zorunludur.'],
    ['invalid_content_title', 'İçerik başlığı 2 ile 240 karakter arasında olmalıdır.'],
    ['invalid_content_field_length', 'İçerik alanlarından biri izin verilen uzunluğu aşıyor.'],
    ['persistent_content_image_required', 'Geçici blob veya data URL içerik görseli olarak kaydedilemez.'],
    ['unsupported_health_claim', 'Bu metinde doğrulanmamış veya aşırı sağlık iddiası bulunuyor. Tıbbi iddia yerine tarafsız ve kanıtlanabilir ifade kullanın.'],
    ['related_product_required', 'Ürün sağlık bilgisi için ilişkili ürün seçilmelidir.'],
    ['invalid_configuration_payload', 'Marka ayarı veri yapısı geçersiz.'],
    ['brand_configuration_not_found', 'Golden Oremar marka ayarı bulunamadı.'],
    ['unsupported_configuration_section', 'Bu ayar bölümü yönetim sözleşmesinde desteklenmiyor.'],
    ['persistent_category_image_required', 'Geçici görsel adresi kalıcı ayar olarak kaydedilemez.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 280 ? message : fallback;
}
