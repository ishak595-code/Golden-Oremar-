import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const SUPPORTED_LOCALES = new Set(['tr', 'en', 'de', 'fr', 'ku', 'ar']);

function normalizeLocale(locale: unknown) {
  const value = typeof locale === 'string' ? locale.trim().toLowerCase().split('-')[0] : '';
  return SUPPORTED_LOCALES.has(value) ? value : 'tr';
}

function requiredText(value: unknown, label: string, max = 240) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function optionalText(value: unknown, max = 1000) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error('İçerik metni doğrulanamadı.');
  return normalized;
}

function documentText(value: unknown) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('İçerik gövdesi doğrulanamadı.');
  const normalized = value.trim();
  if (normalized.length > 200000) throw new Error('İçerik gövdesi desteklenen sınırı aşıyor.');
  return normalized;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalDate(value: unknown, label: string) {
  const raw = optionalText(value, 80);
  if (!raw) return null;
  if (Number.isNaN(Date.parse(raw))) throw new Error(`${label} doğrulanamadı.`);
  return raw;
}

function requireReference(reference: unknown) {
  return requiredText(reference, 'İçerik referansı', 200);
}

function boundedInteger(value: number, fallback: number, min: number, max: number) {
  return Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export type ContentType = 'recipe' | 'health_guide' | 'product_health';

function normalizeContentType(value: unknown): ContentType {
  if (value === 'recipe' || value === 'health_guide' || value === 'product_health') return value;
  throw new Error('İçerik türü doğrulanamadı.');
}

function normalizeListItem(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. içerik kaydı doğrulanamadı.`);
  return {
    id: requiredText(value.id, 'İçerik kimliği', 160),
    slug: requiredText(value.slug, 'İçerik bağlantısı', 220),
    type: normalizeContentType(value.type),
    title: requiredText(value.title, 'İçerik başlığı', 300),
    summary: optionalText(value.summary, 1600),
    category: optionalText(value.category, 160),
    heroImagePath: optionalText(value.heroImagePath, 1200),
    publishedAt: optionalDate(value.publishedAt, 'İçerik yayın tarihi'),
    locale: normalizeLocale(value.locale),
  };
}

function normalizeRelatedProduct(value: unknown) {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('İlgili ürün doğrulanamadı.');
  return {
    id: requiredText(value.id, 'İlgili ürün kimliği', 160),
    slug: requiredText(value.slug, 'İlgili ürün bağlantısı', 220),
    name: requiredText(value.name, 'İlgili ürün adı', 300),
  };
}

export async function listPublicContent(type: ContentType, locale = 'tr', limit = 50, offset = 0) {
  const requestedType = normalizeContentType(type);
  const requestedLocale = normalizeLocale(locale);
  const safeLimit = boundedInteger(limit, 50, 1, 100);
  const safeOffset = boundedInteger(offset, 0, 0, 100000);
  const { data, error } = await supabase.rpc('list_public_content_v1', {
    p_content_type: requestedType,
    p_locale: requestedLocale,
    p_limit: safeLimit,
    p_offset: safeOffset,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || !Array.isArray(result.items)) throw new Error('İçerik listesi doğrulanamadı.');
  const total = safeInteger(result.total, 'İçerik toplamı', 0, 1000000000);
  const responseLimit = safeInteger(result.limit, 'İçerik sayfa sınırı', 1, 100);
  const responseOffset = safeInteger(result.offset, 'İçerik sayfa başlangıcı', 0, 100000);
  if (responseLimit !== safeLimit || responseOffset !== safeOffset) throw new Error('İçerik sayfalama cevabı istekle eşleşmiyor.');
  const items = result.items.map((item, index) => normalizeListItem(item, index));
  if (items.length > responseLimit || (items.length > 0 && responseOffset + items.length > total)) throw new Error('İçerik sayfalama toplamı tutarsız.');
  return { items, total, limit: responseLimit, offset: responseOffset };
}

export async function getPublicContentEntry(reference: string, locale = 'tr') {
  const requestedLocale = normalizeLocale(locale);
  const { data, error } = await supabase.rpc('get_public_content_entry_v3', {
    p_reference: requireReference(reference),
    p_locale: requestedLocale,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result)) throw new Error('İçerik detayı doğrulanamadı.');
  const entry = {
    id: requiredText(result.id, 'İçerik kimliği', 160),
    slug: requiredText(result.slug, 'İçerik bağlantısı', 220),
    type: normalizeContentType(result.type),
    title: requiredText(result.title, 'İçerik başlığı', 300),
    summary: optionalText(result.summary, 1600),
    category: optionalText(result.category, 160),
    heroImagePath: optionalText(result.heroImagePath, 1200),
    markdown: documentText(result.markdown),
    sanitizedHtml: documentText(result.sanitizedHtml),
    safety: result.safety == null ? null : isRecord(result.safety) ? result.safety : (() => { throw new Error('İçerik güvenlik bilgisi doğrulanamadı.'); })(),
    relatedProduct: normalizeRelatedProduct(result.relatedProduct),
  };
  if (!entry.markdown && !entry.sanitizedHtml) throw new Error('Yayın içeriğinin gövdesi doğrulanamadı.');
  return entry;
}

export async function listContentFavoriteReferences() {
  const { data, error } = await supabase.rpc('list_my_content_favorite_references_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error('İçerik favorileri doğrulanamadı.');
  return rows.map((row: unknown, index: number) => {
    if (!isRecord(row)) throw new Error(`${index + 1}. içerik favorisi doğrulanamadı.`);
    return {
      id: requiredText(row.id, 'Favori içerik kimliği', 160),
      slug: requiredText(row.slug, 'Favori içerik bağlantısı', 220),
    };
  });
}

export async function toggleContentFavorite(reference: string) {
  const { data, error } = await supabase.rpc('toggle_my_content_favorite_v1', {
    p_content_reference: requireReference(reference),
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || typeof result.isFavorite !== 'boolean') throw new Error('İçerik favori sonucu doğrulanamadı.');
  return {
    isFavorite: result.isFavorite,
    id: optionalText(result.id, 160),
    slug: optionalText(result.slug, 220),
  };
}

export function contentPublicUrl(path?: string | null) {
  const raw = typeof path === 'string' ? path.trim() : '';
  if (!raw || /[\u0000-\u001F\u007F]/.test(raw)) return '';
  if (/^https:\/\//i.test(raw)) {
    try { return new URL(raw).toString(); } catch { return ''; }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
  const normalized = raw.replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some(part => part === '..' || part === '.' || !part)) return '';
  return supabase.storage.from('content-public').getPublicUrl(normalized).data.publicUrl;
}
