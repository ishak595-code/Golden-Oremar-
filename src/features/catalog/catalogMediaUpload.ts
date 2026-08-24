import { supabase } from '../../lib/supabase';

const CATALOG_BUCKET='catalog-public';
const PRODUCT_IMAGE_PATH_RE=/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/products|admin\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/official-products)\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|avif)$/i;
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp','image/avif']);
const MAX_IMAGE_BYTES=10*1024*1024;

function verifiedPath(value:string){
  const path=String(value||'').trim();
  if(!PRODUCT_IMAGE_PATH_RE.test(path))throw new Error('Ürün görsel yolu doğrulanamadı.');
  return path;
}

export async function uploadVerifiedCatalogProductImage(pathValue:string,file:File){
  const path=verifiedPath(pathValue);
  if(!(file instanceof File)||!IMAGE_TYPES.has(file.type))throw new Error('Ürün görselleri JPEG, PNG, WebP veya AVIF olmalıdır.');
  if(file.size<=0||file.size>MAX_IMAGE_BYTES)throw new Error('Her ürün görseli en fazla 10 MB olabilir.');

  const bucket=supabase.storage.from(CATALOG_BUCKET);
  const{data,error}=await bucket.upload(path,file,{contentType:file.type,upsert:false,cacheControl:'31536000'});
  if(error)throw error;

  try{
    const{data:verification,error:verificationError}=await supabase.functions.invoke('catalog-media-verify',{body:{path}});
    if(verificationError||verification?.ok!==true)throw verificationError||new Error(String(verification?.error||'catalog_media_verification_failed'));
    if(String(verification.path||'')!==path)throw new Error('catalog_media_verification_path_mismatch');
    return data;
  }catch(error){
    await bucket.remove([path]).catch(()=>undefined);
    throw error;
  }
}
