import { supabase } from '../lib/supabase';

export type CatalogMediaHealthStatus='missing_object'|'orphan_object'|'invalid_path'|'invalid_mime'|'invalid_size'|'unverified_binary';
export type CatalogMediaHealthItem={status:CatalogMediaHealthStatus;productId:string|null;productName:string|null;imageId:string|null;path:string};
export type CatalogMediaHealth={
  scannedAt:string;
  lastScheduledScanAt:string|null;
  lastQuarantinedCount:number;
  summary:{total:number;healthy:number;missing:number;orphan:number;invalid:number};
  items:CatalogMediaHealthItem[];
};

const STATUSES=new Set<CatalogMediaHealthStatus>(['missing_object','orphan_object','invalid_path','invalid_mime','invalid_size','unverified_binary']);
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function count(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}
function optionalText(value:unknown,max:number){if(value==null)return null;if(typeof value!=='string')throw new Error('Medya sağlık metni doğrulanamadı.');const text=value.trim();if(!text||text.length>max)return null;return text;}
function requiredText(value:unknown,label:string,max:number){const text=optionalText(value,max);if(!text)throw new Error(`${label} doğrulanamadı.`);return text;}
function dateValue(value:unknown,label:string,optional=false){if(value==null&&optional)return null;const text=requiredText(value,label,80);if(Number.isNaN(Date.parse(text)))throw new Error(`${label} doğrulanamadı.`);return text;}

function normalize(value:unknown):CatalogMediaHealth{
  if(!record(value)||!record(value.summary)||!Array.isArray(value.items)||value.items.length>5000)throw new Error('Katalog medya sağlık özeti doğrulanamadı.');
  const summary={
    total:count(value.summary.total,'Toplam medya'),
    healthy:count(value.summary.healthy,'Sağlıklı medya'),
    missing:count(value.summary.missing,'Eksik medya'),
    orphan:count(value.summary.orphan,'Yetim medya'),
    invalid:count(value.summary.invalid,'Geçersiz medya'),
  };
  if(summary.healthy+summary.missing+summary.orphan+summary.invalid!==summary.total)throw new Error('Katalog medya sağlık sayıları tutarsız.');
  const items=value.items.map((item,index)=>{
    if(!record(item))throw new Error(`${index+1}. medya sağlık kaydı doğrulanamadı.`);
    const status=requiredText(item.status,'Medya durumu',40) as CatalogMediaHealthStatus;
    if(!STATUSES.has(status))throw new Error('Medya durumu doğrulanamadı.');
    return{status,productId:optionalText(item.productId,36),productName:optionalText(item.productName,300),imageId:optionalText(item.imageId,36),path:requiredText(item.path,'Medya yolu',1200)};
  });
  if(items.length!==summary.missing+summary.orphan+summary.invalid)throw new Error('Katalog medya sorun listesi özetle tutarsız.');
  return{
    scannedAt:dateValue(value.scannedAt,'Tarama tarihi') as string,
    lastScheduledScanAt:dateValue(value.lastScheduledScanAt,'Son planlı tarama',true),
    lastQuarantinedCount:count(value.lastQuarantinedCount,'Karantina sayısı'),
    summary,
    items,
  };
}

export async function getSuperAdminCatalogMediaHealth(){
  const{data,error}=await supabase.rpc('super_admin_catalog_media_health_v2');
  if(error)throw error;
  return normalize(data);
}

export function catalogMediaHealthErrorMessage(error:unknown){
  const message=String((error as {message?:unknown})?.message||'').trim();
  if(message.includes('permission_required:product.health_manage'))return'Katalog medya sağlık görünümü yalnız Super Admin hesabına açıktır.';
  return message&&message.length<=260?message:'Katalog medya sağlık özeti yüklenemedi.';
}
