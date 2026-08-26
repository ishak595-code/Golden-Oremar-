import { supabase } from '../lib/supabase';

export type PublishReadinessState='all'|'published'|'ready'|'missing_media'|'data_missing'|'media_blocked'|'owner_required';
export type PublishReadinessReason={code:string;label:string};
export type PublishReadinessItem={productId:string;name:string;slug:string;producerName:string|null;status:string;active:boolean;published:boolean;readyToPublish:boolean;missingRealMedia:boolean;mandatoryDataMissing:boolean;mediaReady:boolean;brandFallbackAllowed:boolean;mediaBlocked:boolean;ownerApprovalRequired:boolean;reasons:PublishReadinessReason[];updatedAt:string};
export type PublishReadinessSnapshot={scannedAt:string;summary:{total:number;published:number;readyToPublish:number;missingRealMedia:number;mandatoryDataMissing:number;mediaReady:number;brandFallbackAllowed:number;mediaBlocked:number;ownerApprovalRequired:number};filteredTotal:number;limit:number;offset:number;items:PublishReadinessItem[]};

const STATES=new Set<PublishReadinessState>(['all','published','ready','missing_media','data_missing','media_blocked','owner_required']);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function integer(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}
function text(value:unknown,label:string,max:number,optional=false){if(value==null&&optional)return null;if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const normalized=value.trim();if((!normalized&&!optional)||normalized.length>max||/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized||null;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function date(value:unknown,label:string){const normalized=text(value,label,80) as string;if(Number.isNaN(Date.parse(normalized)))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function reasons(value:unknown){if(!Array.isArray(value)||value.length>20)throw new Error('Yayın engeli nedenleri doğrulanamadı.');return value.map((item,index)=>{if(!record(item))throw new Error(`${index+1}. yayın engeli doğrulanamadı.`);return{code:text(item.code,'Yayın engeli kodu',100) as string,label:text(item.label,'Yayın engeli açıklaması',260) as string};});}
function normalize(value:unknown):PublishReadinessSnapshot{
 if(!record(value)||!record(value.summary)||!Array.isArray(value.items)||value.items.length>200)throw new Error('Ürün yayın hazırlığı özeti doğrulanamadı.');
 const summary={total:integer(value.summary.total,'Toplam ürün'),published:integer(value.summary.published,'Yayındaki ürün'),readyToPublish:integer(value.summary.readyToPublish,'Yayına hazır ürün'),missingRealMedia:integer(value.summary.missingRealMedia,'Gerçek görseli eksik ürün'),mandatoryDataMissing:integer(value.summary.mandatoryDataMissing,'Zorunlu verisi eksik ürün'),mediaReady:integer(value.summary.mediaReady,'Medya gate geçen ürün'),brandFallbackAllowed:integer(value.summary.brandFallbackAllowed,'Marka fallback izinli ürün'),mediaBlocked:integer(value.summary.mediaBlocked,'Medya engelli ürün'),ownerApprovalRequired:integer(value.summary.ownerApprovalRequired,'Owner onayı gereken ürün')};
 for(const count of Object.values(summary))if(count>summary.total)throw new Error('Ürün yayın hazırlığı sayıları tutarsız.');
 const items=value.items.map((item,index)=>{if(!record(item))throw new Error(`${index+1}. ürün yayın hazırlığı doğrulanamadı.`);return{productId:text(item.productId,'Ürün kimliği',80) as string,name:text(item.name,'Ürün adı',300) as string,slug:text(item.slug,'Ürün slug',220) as string,producerName:text(item.producerName,'Üretici adı',240,true),status:text(item.status,'Ürün durumu',60) as string,active:bool(item.active,'Aktiflik'),published:bool(item.published,'Yayın durumu'),readyToPublish:bool(item.readyToPublish,'Yayın hazırlığı'),missingRealMedia:bool(item.missingRealMedia,'Gerçek medya durumu'),mandatoryDataMissing:bool(item.mandatoryDataMissing,'Zorunlu veri durumu'),mediaReady:bool(item.mediaReady,'Canonical medya hazırlığı'),brandFallbackAllowed:bool(item.brandFallbackAllowed,'Marka fallback izni'),mediaBlocked:bool(item.mediaBlocked,'Medya engeli'),ownerApprovalRequired:bool(item.ownerApprovalRequired,'Owner onayı'),reasons:reasons(item.reasons),updatedAt:date(item.updatedAt,'Güncelleme tarihi')};});
 return{scannedAt:date(value.scannedAt,'Tarama tarihi'),summary,filteredTotal:integer(value.filteredTotal,'Filtrelenmiş toplam'),limit:integer(value.limit,'Limit'),offset:integer(value.offset,'Offset'),items};
}

export async function getSuperAdminProductPublishReadiness(input:{query?:string;state?:PublishReadinessState;limit?:number;offset?:number}={}){
 const state=STATES.has(input.state||'all')?(input.state||'all'):'all';
 const limit=Number.isSafeInteger(input.limit)&&Number(input.limit)>=1&&Number(input.limit)<=200?Number(input.limit):100;
 const offset=Number.isSafeInteger(input.offset)&&Number(input.offset)>=0?Number(input.offset):0;
 const{data,error}=await supabase.rpc('super_admin_product_publish_readiness_v1',{p_query:String(input.query||'').trim().slice(0,120)||null,p_state:state,p_limit:limit,p_offset:offset});
 if(error)throw error;
 return normalize(data);
}

export async function getSuperAdminProductPublishReadinessItem(productId:string){
 const normalized=String(productId||'').trim().toLowerCase();
 if(!UUID_RE.test(normalized))throw new Error('Ürün kimliği doğrulanamadı.');
 const snapshot=await getSuperAdminProductPublishReadiness({query:normalized,limit:1,offset:0});
 const item=snapshot.items[0];
 if(snapshot.filteredTotal!==1||!item||item.productId.toLowerCase()!==normalized)throw new Error('Ürün yayın hazırlığı kaydı bulunamadı.');
 return item;
}

export function publishReadinessErrorMessage(error:unknown){const message=String((error as {message?:unknown})?.message||'').trim();if(message.includes('permission_required:product.health_manage'))return'Ürün yayın hazırlığı yalnız yetkili Super Admin hesabına açıktır.';return message&&message.length<=300?message:'Ürün yayın hazırlığı yüklenemedi.';}
