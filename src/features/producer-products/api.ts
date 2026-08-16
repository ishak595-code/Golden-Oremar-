import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T { if (error) throw error; return data as T; }

export async function listMyProducerProducts() {
  const { data, error } = await supabase.rpc('list_my_producer_products_v1');
  return unwrap<any[]>(data, error);
}
export async function listProductCategories() {
  const { data, error } = await supabase.rpc('list_public_categories_v1');
  return unwrap<any[]>(data, error);
}
export async function getMyProducerProfile() {
  const { data, error } = await supabase.rpc('get_my_producer_profile_v1');
  return unwrap<any>(data, error);
}
export async function saveProducerProduct(reference: string | null, payload: any) {
  const { data, error } = await supabase.rpc('management_upsert_product_v1', { p_reference: reference, p_payload: payload });
  return unwrap<any>(data, error);
}
export async function archiveProducerProduct(reference: string) {
  const { data, error } = await supabase.rpc('management_archive_product_v1', { p_reference: reference });
  return unwrap<boolean>(data, error);
}
export async function uploadProducerProductImages(producerId: string, files: File[]) {
  if (files.length > 10) throw new Error('Bir üründe en fazla 10 görsel yükleyebilirsiniz.');
  const allowed = ['image/jpeg','image/png','image/webp','image/avif'];
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      if (!allowed.includes(file.type)) throw new Error('Ürün görselleri JPEG, PNG, WebP veya AVIF olmalıdır.');
      if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('Her ürün görseli en fazla 10 MB olabilir.');
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'image/avif' ? 'avif' : 'webp';
      const path = `${producerId}/products/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('catalog-public').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
      if (error) throw error;
      uploaded.push(path);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await supabase.storage.from('catalog-public').remove(uploaded).catch(()=>{});
    throw error;
  }
}
export async function removeProducerProductImages(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from('catalog-public').remove(paths);
  if (error) throw error;
}
export function publicCatalogUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('catalog-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
