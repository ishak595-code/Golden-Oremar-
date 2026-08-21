import { supabase } from '../lib/supabase';

export type StorefrontTier='standard'|'verified'|'signature';
export type StorefrontTheme='heritage'|'emerald'|'midnight'|'ivory';
export type AdminStorefront={
 id:string;name:string;slug:string;storeKind:'official'|'independent';status:string;verified:boolean;tier:StorefrontTier;theme:StorefrontTheme;
 headline:string;subheadline:string;realFollowerCount:number;launchAudienceCount:number;launchAudienceLabel:string;
 logoPath:string|null;coverPath:string|null;logoReady:boolean;coverReady:boolean;location:string;
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIERS=new Set<StorefrontTier>(['standard','verified','signature']);
const THEMES=new Set<StorefrontTheme>(['heritage','emerald','midnight','ivory']);
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
function unwrap<T>(data:T|null,error:unknown):T{if(error)throw error;return data as T;}
function record(value:unknown):value is Record<string,any>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,label:string,max:number,required=true){const normalized=typeof value==='string'?value.trim():'';if((required&&!normalized)||normalized.length>max||/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function uuid(value:unknown,label:string){const id=text(value,label,36);if(!UUID_RE.test(id))throw new Error(`${label} doğrulanamadı.`);return id;}
function nonNegative(value:unknown,label:string,max=1_000_000_000){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function boolean(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function path(value:unknown){if(value==null||value==='')return null;const result=text(value,'Görsel yolu',1200);if(/^[a-z][a-z0-9+.-]*:/i.test(result)||result.startsWith('/')||result.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Görsel yolu doğrulanamadı.');return result;}
function normalize(value:unknown,index:number):AdminStorefront{
 if(!record(value))throw new Error(`${index+1}. mağaza kaydı doğrulanamadı.`);
 const storeKind=text(value.storeKind,'Mağaza türü',30) as AdminStorefront['storeKind'];if(!['official','independent'].includes(storeKind))throw new Error('Mağaza türü doğrulanamadı.');
 const tier=text(value.tier,'Vitrin seviyesi',30) as StorefrontTier;if(!TIERS.has(tier))throw new Error('Vitrin seviyesi doğrulanamadı.');
 const theme=text(value.theme,'Vitrin teması',30) as StorefrontTheme;if(!THEMES.has(theme))throw new Error('Vitrin teması doğrulanamadı.');
 return{id:uuid(value.id,'Mağaza kimliği'),name:text(value.name,'Mağaza adı',240),slug:text(value.slug,'Mağaza bağlantısı',220),storeKind,status:text(value.status,'Mağaza durumu',40),verified:boolean(value.verified,'Mağaza doğrulaması'),tier,theme,headline:text(value.headline,'Vitrin başlığı',140,false),subheadline:text(value.subheadline,'Vitrin alt başlığı',320,false),realFollowerCount:nonNegative(value.realFollowerCount,'Gerçek takipçi sayısı'),launchAudienceCount:nonNegative(value.launchAudienceCount,'Lansman topluluğu'),launchAudienceLabel:text(value.launchAudienceLabel,'Lansman topluluğu etiketi',60),logoPath:path(value.logoPath),coverPath:path(value.coverPath),logoReady:boolean(value.logoReady,'Logo hazırlığı'),coverReady:boolean(value.coverReady,'Kapak hazırlığı'),location:text(value.location,'Mağaza konumu',500,false)};
}

export async function listAdminStorefronts(){const{data,error}=await supabase.rpc('super_admin_list_storefronts_v1');const raw=unwrap<unknown>(data,error);if(!Array.isArray(raw)||raw.length>5000)throw new Error('Mağaza vitrini listesi doğrulanamadı.');return raw.map(normalize);}

export async function updateStorefrontPresentation(input:{id:string;launchAudienceCount:number;launchAudienceLabel:string;tier:StorefrontTier;theme:StorefrontTheme;headline:string;subheadline:string}){
 const id=uuid(input.id,'Mağaza kimliği');const count=nonNegative(input.launchAudienceCount,'Lansman topluluğu');const label=text(input.launchAudienceLabel,'Lansman topluluğu etiketi',60);if(!TIERS.has(input.tier))throw new Error('Vitrin seviyesi doğrulanamadı.');if(!THEMES.has(input.theme))throw new Error('Vitrin teması doğrulanamadı.');const headline=text(input.headline,'Vitrin başlığı',140,false);const subheadline=text(input.subheadline,'Vitrin alt başlığı',320,false);
 const{data,error}=await supabase.rpc('super_admin_update_storefront_presentation_v1',{p_producer_id:id,p_launch_audience_count:count,p_launch_audience_label:label,p_storefront_tier:input.tier,p_storefront_theme:input.theme,p_headline:headline||null,p_subheadline:subheadline||null});return unwrap<unknown>(data,error);
}

function extensionFor(type:string){if(type==='image/png')return'png';if(type==='image/webp')return'webp';return'jpg';}
export async function uploadStorefrontAsset(producerId:string,kind:'logo'|'cover',file:File,current:{logoPath:string|null;coverPath:string|null}){
 const id=uuid(producerId,'Mağaza kimliği');if(!(file instanceof File)||!IMAGE_TYPES.has(file.type))throw new Error('Yalnızca JPEG, PNG veya WebP mağaza görseli yüklenebilir.');const max=kind==='logo'?5*1024*1024:10*1024*1024;if(file.size<=0||file.size>max)throw new Error(kind==='logo'?'Profil görseli en fazla 5 MB olabilir.':'Kapak görseli en fazla 10 MB olabilir.');
 const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError;const userId=userData.user?.id;if(!userId||!UUID_RE.test(userId))throw new Error('Super Admin oturumu doğrulanamadı.');
 const random=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;const storagePath=`admin/${userId}/storefronts/${id}/${kind}-${random}.${extensionFor(file.type)}`;
 const{error:uploadError}=await supabase.storage.from('catalog-public').upload(storagePath,file,{cacheControl:'31536000',upsert:false,contentType:file.type});if(uploadError)throw uploadError;
 const nextLogo=kind==='logo'?storagePath:current.logoPath;const nextCover=kind==='cover'?storagePath:current.coverPath;
 try{const{data,error}=await supabase.rpc('super_admin_update_storefront_media_v1',{p_producer_id:id,p_logo_path:nextLogo,p_cover_path:nextCover});return{result:unwrap<unknown>(data,error),path:storagePath};}catch(error){await supabase.storage.from('catalog-public').remove([storagePath]).catch(()=>undefined);throw error;}
}

export function storefrontAssetUrl(storagePath:string|null|undefined){if(!storagePath)return'';try{return supabase.storage.from('catalog-public').getPublicUrl(storagePath).data.publicUrl;}catch{return'';}}

export function storefrontAdminError(error:unknown,fallback='Mağaza vitrini işlemi tamamlanamadı.'){const message=String((error as any)?.message||'').trim();if(!message)return fallback;const map:Array<[string,string]>=[['super_admin_required','Bu işlem yalnız Super Admin tarafından yapılabilir.'],['producer_not_found','Mağaza kaydı bulunamadı.'],['storefront_logo_storage_object_required','Profil görseli Storage alanında doğrulanamadı.'],['storefront_cover_storage_object_required','Kapak görseli Storage alanında doğrulanamadı.'],['invalid_launch_audience_count','Lansman topluluğu 0 ile 1 milyar arasında olmalıdır.'],['invalid_launch_audience_label','Lansman topluluğu etiketi geçersiz.'],['invalid_storefront_tier','Vitrin seviyesi geçersiz.'],['invalid_storefront_theme','Vitrin teması geçersiz.']];for(const[key,value]of map)if(message.includes(key))return value;return message.length<=280?message:fallback;}
