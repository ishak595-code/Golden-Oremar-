import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function normalizeLocale(locale: string) {
  const value = String(locale || 'tr').trim().toLowerCase();
  return /^[a-z]{2}(?:-[a-z]{2})?$/.test(value) ? value : 'tr';
}

function requireReference(reference: string) {
  const value = String(reference || '').trim();
  if (!value || value.length > 200) throw new Error('Geçerli bir içerik referansı gerekiyor.');
  return value;
}

function boundedInteger(value: number, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export type ContentType = 'recipe' | 'health_guide' | 'product_health';

export async function listPublicContent(type: ContentType, locale = 'tr', limit = 50, offset = 0) {
  if (!['recipe', 'health_guide', 'product_health'].includes(type)) throw new Error('Geçersiz içerik türü.');
  const { data, error } = await supabase.rpc('list_public_content_v1', {
    p_content_type: type,
    p_locale: normalizeLocale(locale),
    p_limit: boundedInteger(limit, 50, 1, 100),
    p_offset: boundedInteger(offset, 0, 0, 100000),
  });
  return unwrap<any>(data, error);
}

export async function getPublicContentEntry(reference: string, locale = 'tr') {
  const { data, error } = await supabase.rpc('get_public_content_entry_v2', {
    p_reference: requireReference(reference),
    p_locale: normalizeLocale(locale),
  });
  return unwrap<any>(data, error);
}

export async function listContentFavoriteReferences() {
  const { data, error } = await supabase.rpc('list_my_content_favorite_references_v1');
  return unwrap<any[]>(data, error);
}

export async function toggleContentFavorite(reference: string) {
  const { data, error } = await supabase.rpc('toggle_my_content_favorite_v1', {
    p_content_reference: requireReference(reference),
  });
  return unwrap<any>(data, error);
}

export function contentPublicUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('content-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
