import { supabase } from '../lib/supabase';

export async function createProducerDocumentPreviewUrl(storagePath: string) {
  const path = storagePath.trim().replace(/^\/+/, '');
  if (!path) throw new Error('Belge yolu bulunamadı.');
  const { data, error } = await supabase.storage.from('producer-documents').createSignedUrl(path, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Belge için geçici görüntüleme bağlantısı oluşturulamadı.');
  return data.signedUrl;
}
