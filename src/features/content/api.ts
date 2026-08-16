import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export type ContentType = 'recipe' | 'health_guide' | 'product_health';

export async function listPublicContent(type: ContentType, locale = 'tr', limit = 50, offset = 0) {
  const { data, error } = await supabase.rpc('list_public_content_v1', {
    p_content_type: type,
    p_locale: locale,
    p_limit: limit,
    p_offset: offset,
  });
  return unwrap<any>(data, error);
}

export async function getPublicContentEntry(reference: string, locale = 'tr') {
  const { data, error } = await supabase.rpc('get_public_content_entry_v1', {
    p_reference: reference,
    p_locale: locale,
  });
  return unwrap<any>(data, error);
}

export async function listContentFavoriteReferences() {
  const { data, error } = await supabase.rpc('list_my_content_favorite_references_v1');
  return unwrap<any[]>(data, error);
}

export async function toggleContentFavorite(reference: string) {
  const { data, error } = await supabase.rpc('toggle_my_content_favorite_v1', {
    p_content_reference: reference,
  });
  return unwrap<any>(data, error);
}

export function contentPublicUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('content-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
