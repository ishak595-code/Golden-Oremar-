import { supabase } from '../lib/supabase';

export type AdminContentType = 'blog' | 'recipe' | 'health_guide' | 'product_health';
export type AdminContentStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
export type AdminContentLocale = 'tr' | 'en' | 'de' | 'fr' | 'ku' | 'ar';

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
  status: AdminContentStatus;
  locale: AdminContentLocale;
  metadata: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminBrandPublicConfig = Record<string, unknown> & {
  appSettings?: { logoUrl?: string; theme?: 'light' | 'dark' };
  contactInfo?: {
    address?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    mapUrl?: string;
    social?: Record<string, string>;
  };
  heroCategories?: Array<{ id: string; title: string; subtitle: string; image: string; icon: string; targetCategory: string }>;
  homeSections?: Array<{ id: string; title: string; active: boolean }>;
  launchReadiness?: { status: string; reason?: string };
};

export type AdminBrandConfig = {
  slug: string;
  brandName: string;
  maintenanceMode: boolean;
  supportEmail: string | null;
  supportPhone: string | null;
  publicConfig: AdminBrandPublicConfig;
  updatedAt: string;
};

const CONTENT_TYPES = ['blog', 'recipe', 'health_guide', 'product_health'] as const;
const CONTENT_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;
const CONTENT_LOCALES = ['tr', 'en', 'de', 'fr', 'ku', 'ar'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, label: string, max = 500) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalPlainString(value: unknown, label: string, max = 2048) {
  if (value == null) return undefined;
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001F\u007F]/.test(value)) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function contentText(value: unknown) {
  if (typeof value !== 'string' || value.length > 200000) throw new Error('İçerik metni doğrulanamadı.');
  return value;
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

function dateTime(value: unknown, label: string, required = true) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function contentType(value: unknown): AdminContentType {
  const text = requiredText(value, 'İçerik türü', 40);
  if (!CONTENT_TYPES.includes(text as AdminContentType)) throw new Error('İçerik türü doğrulanamadı.');
  return text as AdminContentType;
}

function contentStatus(value: unknown): AdminContentStatus {
  const text = requiredText(value, 'İçerik durumu', 40);
  if (!CONTENT_STATUSES.includes(text as AdminContentStatus)) throw new Error('İçerik durumu doğrulanamadı.');
  return text as AdminContentStatus;
}

function contentLocale(value: unknown): AdminContentLocale {
  const text = requiredText(value, 'İçerik dili', 8);
  if (!CONTENT_LOCALES.includes(text as AdminContentLocale)) throw new Error('İçerik dili doğrulanamadı.');
  return text as AdminContentLocale;
}

function normalizeContent(value: unknown, index: number): AdminContentEntry {
  if (!isRecord(value)) throw new Error(`${index + 1}. içerik kaydı doğrulanamadı.`);
  const metadata = value.metadata;
  if (!isRecord(metadata)) throw new Error(`${index + 1}. içerik metadata alanı doğrulanamadı.`);
  const status = contentStatus(value.status);
  const publishedAt = dateTime(value.published_at, 'İçerik yayın tarihi', false);
  if (status === 'published' && !publishedAt) throw new Error(`${index + 1}. yayınlanmış içerikte yayın tarihi eksik.`);
  return {
    id: uuid(value.id, 'İçerik kimliği'),
    legacy_id: optionalText(value.legacy_id, 'Legacy içerik kimliği', 160),
    content_type: contentType(value.content_type),
    slug: requiredText(value.slug, 'İçerik bağlantısı', 220),
    title: requiredText(value.title, 'İçerik başlığı', 240),
    summary: optionalText(value.summary, 'İçerik özeti', 2000),
    content: contentText(value.content),
    image: optionalText(value.image, 'İçerik görsel yolu', 2048),
    related_product_id: optionalUuid(value.related_product_id, 'İlişkili ürün kimliği'),
    related_product_name: optionalText(value.related_product_name, 'İlişkili ürün adı', 300),
    status,
    locale: contentLocale(value.locale),
    metadata,
    published_at: publishedAt,
    created_at: dateTime(value.created_at, 'İçerik oluşturulma tarihi', true) as string,
    updated_at: dateTime(value.updated_at, 'İçerik güncellenme tarihi', true) as string,
  };
}

function normalizeAppSettings(value: unknown) {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error('Uygulama görünüm ayarları doğrulanamadı.');
  const theme = value.theme == null ? undefined : requiredText(value.theme, 'Varsayılan tema', 10);
  if (theme && theme !== 'light' && theme !== 'dark') throw new Error('Varsayılan tema doğrulanamadı.');
  return {
    logoUrl: optionalPlainString(value.logoUrl, 'Logo yolu'),
    theme: theme as 'light' | 'dark' | undefined,
  };
}

function normalizeContactInfo(value: unknown) {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error('İletişim ayarları doğrulanamadı.');
  let social: Record<string, string> | undefined;
  if (value.social != null) {
    if (!isRecord(value.social)) throw new Error('Sosyal medya ayarları doğrulanamadı.');
    social = {};
    for (const [key, raw] of Object.entries(value.social)) {
      const safeKey = requiredText(key, 'Sosyal medya anahtarı', 40);
      social[safeKey] = optionalPlainString(raw, `${safeKey} bağlantısı`) || '';
    }
  }
  return {
    address: optionalPlainString(value.address, 'İletişim adresi', 500),
    phone: optionalPlainString(value.phone, 'İletişim telefonu', 40),
    whatsapp: optionalPlainString(value.whatsapp, 'WhatsApp bilgisi', 40),
    email: optionalPlainString(value.email, 'İletişim e-postası', 320),
    mapUrl: optionalPlainString(value.mapUrl, 'Harita bağlantısı'),
    social,
  };
}

function normalizeHeroCategories(value: unknown) {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) throw new Error('Hero kategori listesi doğrulanamadı.');
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${index + 1}. hero kategori kartı doğrulanamadı.`);
    return {
      id: requiredText(item.id, 'Hero kategori kimliği', 80),
      title: requiredText(item.title, 'Hero kategori başlığı', 120),
      subtitle: optionalPlainString(item.subtitle, 'Hero kategori alt başlığı', 180) || '',
      image: optionalPlainString(item.image, 'Hero kategori görseli') || '',
      icon: optionalPlainString(item.icon, 'Hero kategori ikonu', 80) || '',
      targetCategory: requiredText(item.targetCategory, 'Hero kategori hedefi', 120),
    };
  });
}

function normalizeHomeSections(value: unknown) {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('Ana sayfa bölüm listesi doğrulanamadı.');
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${index + 1}. ana sayfa bölümü doğrulanamadı.`);
    return {
      id: requiredText(item.id, 'Ana sayfa bölüm kimliği', 80),
      title: requiredText(item.title, 'Ana sayfa bölüm başlığı', 160),
      active: booleanValue(item.active, 'Ana sayfa bölüm durumu'),
    };
  });
}

function normalizeLaunchReadiness(value: unknown) {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error('Canlı satış hazırlık durumu doğrulanamadı.');
  return {
    status: requiredText(value.status, 'Canlı satış hazırlık durumu', 120),
    reason: optionalPlainString(value.reason, 'Canlı satış hazırlık açıklaması', 1000),
  };
}

function normalizePublicConfig(value: unknown): AdminBrandPublicConfig {
  if (!isRecord(value)) throw new Error('Marka publicConfig alanı doğrulanamadı.');
  return {
    ...value,
    appSettings: normalizeAppSettings(value.appSettings),
    contactInfo: normalizeContactInfo(value.contactInfo),
    heroCategories: normalizeHeroCategories(value.heroCategories),
    homeSections: normalizeHomeSections(value.homeSections),
    launchReadiness: normalizeLaunchReadiness(value.launchReadiness),
  };
}

function normalizeBrandConfiguration(value: unknown): AdminBrandConfig {
  if (!isRecord(value)) throw new Error('Marka ayarı yanıtı doğrulanamadı.');
  const slug = requiredText(value.slug, 'Marka kısa adı', 80);
  if (slug !== 'golden-oremar') throw new Error('Beklenmeyen marka ayarı döndü.');
  const supportEmail = optionalText(value.supportEmail, 'Destek e-postası', 320);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new Error('Destek e-postası doğrulanamadı.');
  return {
    slug,
    brandName: requiredText(value.brandName, 'Marka adı', 80),
    maintenanceMode: booleanValue(value.maintenanceMode, 'Bakım modu'),
    supportEmail,
    supportPhone: optionalText(value.supportPhone, 'Destek telefonu', 40),
    publicConfig: normalizePublicConfig(value.publicConfig),
    updatedAt: dateTime(value.updatedAt, 'Marka ayarı güncelleme tarihi', true) as string,
  };
}

function normalizeReference(value: string | null | undefined) {
  if (value == null || value.trim() === '') return null;
  return requiredText(value, 'İçerik referansı', 160);
}

export async function adminListContent(): Promise<AdminContentEntry[]> {
  const { data, error } = await supabase.rpc('admin_list_content_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error('İçerik listesi doğrulanamadı.');
  return rows.map(normalizeContent);
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
  if (!CONTENT_TYPES.includes(input.type)) throw new Error('İçerik türü doğrulanamadı.');
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length < 2 || title.length > 240) throw new Error('İçerik başlığı 2 ile 240 karakter arasında olmalıdır.');
  if ((input.summary || '').length > 2000) throw new Error('İçerik özeti 2000 karakteri aşamaz.');
  if (content.length > 200000) throw new Error('İçerik metni 200000 karakteri aşamaz.');
  const image = input.image?.trim() || '';
  if (image.length > 2048) throw new Error('İçerik görsel yolu çok uzun.');
  if (/^(blob:|data:)/i.test(image)) throw new Error('Geçici blob veya data URL kalıcı içerik görseli olarak kaydedilemez.');
  const relatedProductId = input.relatedProductId ? uuid(input.relatedProductId, 'İlişkili ürün kimliği') : null;
  if (input.type === 'product_health' && !relatedProductId) throw new Error('Ürün sağlık bilgisi için ilişkili ürün seçilmelidir.');
  const { data, error } = await supabase.rpc('management_upsert_content_v1', {
    p_reference: normalizeReference(input.reference),
    p_content_type: input.type,
    p_payload: {
      title,
      summary: input.summary?.trim() || '',
      content,
      image,
      productId: relatedProductId,
      category: input.category?.trim() || '',
      date: input.date?.trim() || '',
    },
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result)) throw new Error('İçerik kayıt yanıtı doğrulanamadı.');
  requiredText(result.id, 'İçerik referansı', 160);
  uuid(result.databaseId, 'İçerik veritabanı kimliği');
  if (contentType(result.contentType) !== input.type || contentStatus(result.status) !== 'published') {
    throw new Error('İçerik kayıt yanıtı istekle eşleşmiyor.');
  }
  return result;
}

export async function adminArchiveContent(reference: string) {
  const normalized = requiredText(reference, 'İçerik referansı', 160);
  const { data, error } = await supabase.rpc('management_archive_content_v1', { p_reference: normalized });
  const result = unwrap<unknown>(data, error);
  if (result !== true) throw new Error('İçerik arşivleme yanıtı doğrulanamadı.');
  return true;
}

export async function adminGetBrandConfiguration(): Promise<AdminBrandConfig> {
  const { data, error } = await supabase.rpc('admin_get_brand_configuration_v1');
  return normalizeBrandConfiguration(unwrap<unknown>(data, error));
}

export async function adminUpdateBrandSection(section: 'general' | 'contactInfo' | 'heroCategories' | 'homeSections' | 'staticContent', payload: Record<string, unknown>) {
  if (!isRecord(payload)) throw new Error('Marka ayarı veri yapısı doğrulanamadı.');
  const { data, error } = await supabase.rpc('admin_update_brand_configuration_v1', {
    p_section: section,
    p_payload: payload,
  });
  return normalizeBrandConfiguration(unwrap<unknown>(data, error));
}

export function contentAdminErrorMessage(error: unknown, fallback = 'İçerik işlemi tamamlanamadı.') {
  const message = error instanceof Error ? error.message.trim() : '';
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
