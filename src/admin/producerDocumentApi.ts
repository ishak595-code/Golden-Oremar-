import { supabase } from '../lib/supabase';

export async function createProducerDocumentPreviewUrl(storagePath: string) {
  const path = String(storagePath || '').trim().replace(/^\/+/, '');
  if (!path || path.length > 2048 || /[\u0000-\u001F\u007F]/.test(path) || path.includes('\\')) {
    throw new Error('Belge yolu geçersiz.');
  }
  if (path.split('/').some(segment => !segment || segment === '..' || segment === '.')) throw new Error('Belge yolu geçersiz.');
  if (/^(?:data|blob|javascript|https?):/i.test(path)) throw new Error('Harici veya geçici belge bağlantıları bu alanda açılamaz.');

  const { data, error } = await supabase.storage.from('producer-documents').createSignedUrl(path, 300);
  if (error) throw error;
  const signedUrl = typeof data?.signedUrl === 'string' ? data.signedUrl.trim() : '';
  if (!signedUrl) throw new Error('Belge için geçici görüntüleme bağlantısı oluşturulamadı.');
  let parsed: URL;
  try { parsed = new URL(signedUrl); } catch { throw new Error('Belge görüntüleme bağlantısı doğrulanamadı.'); }
  if (parsed.protocol !== 'https:') throw new Error('Belge görüntüleme bağlantısı güvenli değil.');
  return parsed.toString();
}
