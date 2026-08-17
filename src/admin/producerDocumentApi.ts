import { supabase } from '../lib/supabase';

export async function createProducerDocumentPreviewUrl(storagePath: string) {
  const path = String(storagePath || '').trim().replace(/^\/+/, '');
  if (!path) throw new Error('Belge yolu bulunamadı.');
  if (path.length > 1024) throw new Error('Belge yolu geçersiz.');
  if (path.split('/').some(segment => segment === '..' || segment === '.')) throw new Error('Belge yolu geçersiz.');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) throw new Error('Harici belge bağlantıları bu alanda açılamaz.');

  const { data, error } = await supabase.storage.from('producer-documents').createSignedUrl(path, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Belge için geçici görüntüleme bağlantısı oluşturulamadı.');
  return data.signedUrl;
}
