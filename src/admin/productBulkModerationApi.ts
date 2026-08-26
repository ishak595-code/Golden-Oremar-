import {supabase} from'../lib/supabase';

export type BulkModerationItem={productId:string;name:string;ok:boolean;approved:boolean;errorCode:string|null;error:string|null};
export type BulkModerationResult={requestedCount:number;successCount:number;failureCount:number;approved:boolean;results:BulkModerationItem[]};

function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function integer(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>500)throw new Error(`${label} doğrulanamadı.`);return value;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function text(value:unknown,label:string,max:number,optional=false){if(value==null&&optional)return null;if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const normalized=value.trim();if((!normalized&&!optional)||normalized.length>max||/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized||null;}
function normalize(value:unknown):BulkModerationResult{
 if(!record(value)||!Array.isArray(value.results)||value.results.length>500)throw new Error('Toplu ürün moderasyon sonucu doğrulanamadı.');
 const requestedCount=integer(value.requestedCount,'İstenen ürün sayısı'),successCount=integer(value.successCount,'Başarılı ürün sayısı'),failureCount=integer(value.failureCount,'Başarısız ürün sayısı'),approved=bool(value.approved,'Toplu işlem türü');
 if(successCount+failureCount!==requestedCount||value.results.length!==requestedCount)throw new Error('Toplu ürün moderasyon sayıları tutarsız.');
 const results=value.results.map((item,index)=>{if(!record(item))throw new Error(`${index+1}. toplu ürün sonucu doğrulanamadı.`);return{productId:text(item.productId,'Ürün kimliği',80) as string,name:text(item.name,'Ürün adı',300) as string,ok:bool(item.ok,'İşlem sonucu'),approved:bool(item.approved,'Onay sonucu'),errorCode:text(item.errorCode,'Hata kodu',30,true),error:text(item.error,'Hata açıklaması',500,true)};});
 return{requestedCount,successCount,failureCount,approved,results};
}

export async function superAdminBulkReviewProducts(input:{approve:boolean;reason?:string;productIds?:string[]}){
 const reason=String(input.reason||'').trim();
 if(!input.approve&&(reason.length<8||reason.length>2000))throw new Error('Toplu ret için 8 ile 2000 karakter arasında açık bir gerekçe yazın.');
 if(input.approve&&reason.length>2000)throw new Error('İnceleme notu en fazla 2000 karakter olabilir.');
 const ids=input.productIds?.filter(Boolean)||null;
 if(ids&&ids.length>500)throw new Error('Tek işlemde en fazla 500 ürün işlenebilir.');
 const{data,error}=await supabase.rpc('super_admin_bulk_review_products_v1',{p_product_ids:ids,p_approve:input.approve,p_reason:reason||null});
 if(error)throw error;
 return normalize(data);
}

export function bulkModerationErrorMessage(error:unknown){
 const message=String((error as{message?:unknown})?.message||'').trim();
 const map:Array<[string,string]>=[
  ['permission_required:product.publish','Toplu ürün onayı ve reddi yalnız AAL2 Super Admin oturumuna açıktır.'],
  ['permission_required:product.approve','Toplu ürün onayı için owner onay yetkisi gerekiyor.'],
  ['permission_required:product.reject','Toplu ürün reddi için ret yetkisi gerekiyor.'],
  ['product_rejection_reason_required','Toplu ret için en az 8 karakterlik gerekçe yazın.'],
  ['bulk_product_limit_exceeded','Tek toplu işlem en fazla 500 onay bekleyen ürünü işler.'],
 ];
 for(const[key,label]of map)if(message.includes(key))return label;
 return message&&message.length<=300?message:'Toplu ürün moderasyonu tamamlanamadı.';
}
