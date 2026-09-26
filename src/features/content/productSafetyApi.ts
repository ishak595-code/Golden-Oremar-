import { supabase } from '../../lib/supabase';
import { publicMediaUrl } from '../../lib/mediaUrl';

function normalizeLocale(locale:string){const value=String(locale||'tr').trim().toLowerCase();return/^[a-z]{2}(?:-[a-z]{2})?$/.test(value)?value:'tr';}
function record(value:unknown):value is Record<string,any>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function safePath(value:unknown){const path=typeof value==='string'?value.trim():'';if(!path)return'';if(path.length>1200||/^[a-z][a-z0-9+.-]*:/i.test(path)||path.startsWith('/')||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Ürün video yolu doğrulanamadı.');return path;}
export async function getProductSafety(reference:string,locale='tr'){
 const normalizedReference=String(reference||'').trim();if(!normalizedReference||normalizedReference.length>200)throw new Error('Geçerli bir ürün referansı gerekiyor.');
 const{data,error}=await supabase.rpc('get_public_product_safety_v3',{p_reference:normalizedReference,p_locale:normalizeLocale(locale)});if(error)throw error;if(data==null)return{};if(!record(data))throw new Error('Ürün sağlık bilgileri doğrulanamadı.');
 const safety=record(data.safety)?{...data.safety}:{};const productInfo=record(data.productInfo)?data.productInfo:{};const recipe=record(data.recipe)?data.recipe:{};const videoPath=safePath(safety.videoPath);const serverVideoUrl=typeof safety.videoUrl==='string'&&/^https:\/\//.test(safety.videoUrl)?safety.videoUrl:'';const videoUrl=videoPath?(serverVideoUrl||publicMediaUrl('catalog-public',videoPath)):'';
 return{...data,productInfo,recipe,safety:{...safety,productInfo,recipe,videoPath,videoUrl}};
}
