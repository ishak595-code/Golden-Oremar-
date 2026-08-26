import { supabase } from '../lib/supabase';

export type SuperAdminStoreState='all'|'open'|'setup'|'blocked'|'closed'|'archived';
export type SuperAdminStoreLifecycleState=Exclude<SuperAdminStoreState,'all'>;
export type SuperAdminStoreAction='open'|'block'|'close'|'archive'|'restore';
export type SuperAdminStoreKind='official'|'independent';

export type SuperAdminStoreSummary={
 totalStores:number;
 openStores:number;
 setupPending:number;
 blockedStores:number;
 closedStores:number;
 archivedStores:number;
 officialStores:number;
 independentStores:number;
 totalProducts:number;
 publishedProducts:number;
 totalOrders:number;
};

export type SuperAdminStoreListItem={
 id:string;
 storeNumber:string;
 slug:string;
 name:string;
 storeKind:SuperAdminStoreKind;
 producerStatus:string;
 storefrontStatus:string;
 state:SuperAdminStoreLifecycleState;
 verified:boolean;
 originVerified:boolean;
 contactEmail:string|null;
 contactPhone:string|null;
 location:string;
 productCount:number;
 publishedProductCount:number;
 orderCount:number;
 updatedAt:string;
 createdAt:string;
 archivedAt:string|null;
};

export type SuperAdminStoreDirectory={
 summary:SuperAdminStoreSummary;
 total:number;
 limit:number;
 offset:number;
 items:SuperAdminStoreListItem[];
};

export type SuperAdminStoreDetail={
 id:string;
 storeNumber:string;
 slug:string;
 name:string;
 description:string;
 story:string;
 storeKind:SuperAdminStoreKind;
 producerStatus:string;
 storefrontStatus:string;
 publishedAt:string|null;
 verified:boolean;
 originVerified:boolean;
 trustBadgeActive:boolean;
 logoPath:string|null;
 coverPath:string|null;
 contact:{email:string|null;phone:string|null;website:string|null};
 address:{line1:string|null;line2:string|null;postalCode:string|null;city:string|null;region:string|null;countryCode:string|null;visibility:string};
 business:{type:string|null;name:string|null;reference:string|null;verifiedAt:string|null};
 readiness:{ready:boolean;missing:string[];steps:unknown[]};
 application:Record<string,unknown>|null;
 metrics:{products:number;publishedProducts:number;orders:number;customers:number;followers:number};
 createdAt:string;
 updatedAt:string;
 archivedAt:string|null;
 officialProtected:boolean;
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORE_NUMBER_RE=/^GO-STORE-[0-9]{8}$/;
const STATES=new Set<SuperAdminStoreState>(['all','open','setup','blocked','closed','archived']);
const LIFECYCLE_STATES=new Set<SuperAdminStoreLifecycleState>(['open','setup','blocked','closed','archived']);
const ACTIONS=new Set<SuperAdminStoreAction>(['open','block','close','archive','restore']);
const STORE_KINDS=new Set<SuperAdminStoreKind>(['official','independent']);

function object(value:unknown,label:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} doğrulanamadı.`);return value as Record<string,unknown>;}
function text(value:unknown,label:string,max=1000){if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const result=value.trim();if(!result||result.length>max||/[\u0000-\u001F\u007F]/.test(result))throw new Error(`${label} doğrulanamadı.`);return result;}
function textAllowEmpty(value:unknown,label:string,max=10000){if(typeof value!=='string'||value.length>max||/[\u0000-\u001F\u007F]/.test(value))throw new Error(`${label} doğrulanamadı.`);return value;}
function optionalText(value:unknown,label:string,max=2048){if(value==null||value==='')return null;if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const result=value.trim();if(!result)return null;if(result.length>max||/[\u0000-\u001F\u007F]/.test(result))throw new Error(`${label} doğrulanamadı.`);return result;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function integer(value:unknown,label:string,max=Number.MAX_SAFE_INTEGER){const number=typeof value==='string'&&/^[0-9]+$/.test(value)?Number(value):value;if(typeof number!=='number'||!Number.isSafeInteger(number)||number<0||number>max)throw new Error(`${label} doğrulanamadı.`);return number;}
function dateTime(value:unknown,label:string,required=true){if(value==null||value===''){if(required)throw new Error(`${label} doğrulanamadı.`);return null;}const result=text(value,label,80);if(Number.isNaN(new Date(result).getTime()))throw new Error(`${label} doğrulanamadı.`);return result;}
function uuid(value:unknown,label:string){const result=text(value,label,36);if(!UUID_RE.test(result))throw new Error(`${label} doğrulanamadı.`);return result;}
function storeNumber(value:unknown){const result=text(value,'Mağaza numarası',17).toUpperCase();if(!STORE_NUMBER_RE.test(result))throw new Error('Mağaza numarası doğrulanamadı.');return result;}
function kind(value:unknown){const result=text(value,'Mağaza türü',40) as SuperAdminStoreKind;if(!STORE_KINDS.has(result))throw new Error('Mağaza türü doğrulanamadı.');return result;}
function lifecycleState(value:unknown){const result=text(value,'Mağaza yaşam döngüsü',40) as SuperAdminStoreLifecycleState;if(!LIFECYCLE_STATES.has(result))throw new Error('Mağaza yaşam döngüsü doğrulanamadı.');return result;}
function stringArray(value:unknown,label:string,max=100){if(!Array.isArray(value)||value.length>max)throw new Error(`${label} doğrulanamadı.`);return value.map((item,index)=>text(item,`${label} ${index+1}`,240));}
function nullableObject(value:unknown,label:string){return value==null?null:object(value,label);}

function normalizeSummary(value:unknown):SuperAdminStoreSummary{const row=object(value,'Mağaza özeti');return{
 totalStores:integer(row.totalStores,'Toplam mağaza'),openStores:integer(row.openStores,'Açık mağaza'),setupPending:integer(row.setupPending,'Kurulum bekleyen mağaza'),blockedStores:integer(row.blockedStores,'Engelli mağaza'),closedStores:integer(row.closedStores,'Kapalı mağaza'),archivedStores:integer(row.archivedStores,'Arşivlenmiş mağaza'),officialStores:integer(row.officialStores,'Resmi mağaza'),independentStores:integer(row.independentStores,'Bağımsız mağaza'),totalProducts:integer(row.totalProducts,'Toplam ürün'),publishedProducts:integer(row.publishedProducts,'Yayındaki ürün'),totalOrders:integer(row.totalOrders,'Toplam sipariş')};}

function normalizeListItem(value:unknown,index:number):SuperAdminStoreListItem{const row=object(value,`${index+1}. mağaza`);return{
 id:uuid(row.id,`${index+1}. mağaza kimliği`),storeNumber:storeNumber(row.storeNumber),slug:text(row.slug,'Mağaza kısa adı',180),name:text(row.name,'Mağaza adı',240),storeKind:kind(row.storeKind),producerStatus:text(row.producerStatus,'Satıcı durumu',40),storefrontStatus:text(row.storefrontStatus,'Vitrin durumu',40),state:lifecycleState(row.state),verified:bool(row.verified,'Kimlik doğrulaması'),originVerified:bool(row.originVerified,'Menşe doğrulaması'),contactEmail:optionalText(row.contactEmail,'İletişim e-postası',320),contactPhone:optionalText(row.contactPhone,'İletişim telefonu',80),location:typeof row.location==='string'?row.location.trim().slice(0,500):'',productCount:integer(row.productCount,'Ürün sayısı'),publishedProductCount:integer(row.publishedProductCount,'Yayındaki ürün sayısı'),orderCount:integer(row.orderCount,'Sipariş sayısı'),updatedAt:dateTime(row.updatedAt,'Güncelleme tarihi') as string,createdAt:dateTime(row.createdAt,'Oluşturma tarihi') as string,archivedAt:dateTime(row.archivedAt,'Arşiv tarihi',false)};}

function normalizeContact(value:unknown){const row=object(value,'Mağaza iletişimi');return{email:optionalText(row.email,'Mağaza e-postası',320),phone:optionalText(row.phone,'Mağaza telefonu',80),website:optionalText(row.website,'Mağaza web sitesi',2048)};}
function normalizeAddress(value:unknown){const row=object(value,'Mağaza adresi');return{line1:optionalText(row.line1,'Adres satırı 1',500),line2:optionalText(row.line2,'Adres satırı 2',500),postalCode:optionalText(row.postalCode,'Posta kodu',40),city:optionalText(row.city,'Şehir',160),region:optionalText(row.region,'Bölge',160),countryCode:optionalText(row.countryCode,'Ülke kodu',2),visibility:typeof row.visibility==='string'?row.visibility.trim().slice(0,40):'hidden'};}
function normalizeBusiness(value:unknown){const row=object(value,'İşletme kimliği');return{type:optionalText(row.type,'İşletme türü',80),name:optionalText(row.name,'İşletme adı',240),reference:optionalText(row.reference,'İşletme referansı',240),verifiedAt:dateTime(row.verifiedAt,'İşletme doğrulama tarihi',false)};}
function normalizeReadiness(value:unknown){const row=object(value,'Mağaza hazır olma durumu');return{ready:bool(row.ready,'Mağaza hazır olma durumu'),missing:stringArray(row.missing??[],'Eksik mağaza adımı',100),steps:Array.isArray(row.steps)?row.steps.slice(0,100):[]};}
function normalizeMetrics(value:unknown){const row=object(value,'Mağaza metrikleri');return{products:integer(row.products,'Ürün sayısı'),publishedProducts:integer(row.publishedProducts,'Yayındaki ürün sayısı'),orders:integer(row.orders,'Sipariş sayısı'),customers:integer(row.customers,'Müşteri sayısı'),followers:integer(row.followers,'Takipçi sayısı')};}

function normalizeDetail(value:unknown):SuperAdminStoreDetail{const row=object(value,'Mağaza detayı');const application=nullableObject(row.application,'Satıcı başvurusu');return{
 id:uuid(row.id,'Mağaza kimliği'),storeNumber:storeNumber(row.storeNumber),slug:text(row.slug,'Mağaza kısa adı',180),name:text(row.name,'Mağaza adı',240),description:textAllowEmpty(row.description??'','Mağaza açıklaması'),story:textAllowEmpty(row.story??'','Mağaza hikayesi'),storeKind:kind(row.storeKind),producerStatus:text(row.producerStatus,'Satıcı durumu',40),storefrontStatus:text(row.storefrontStatus,'Vitrin durumu',40),publishedAt:dateTime(row.publishedAt,'Yayın tarihi',false),verified:bool(row.verified,'Kimlik doğrulaması'),originVerified:bool(row.originVerified,'Menşe doğrulaması'),trustBadgeActive:bool(row.trustBadgeActive,'Güven rozeti'),logoPath:optionalText(row.logoPath,'Logo yolu',2048),coverPath:optionalText(row.coverPath,'Kapak yolu',2048),contact:normalizeContact(row.contact),address:normalizeAddress(row.address),business:normalizeBusiness(row.business),readiness:normalizeReadiness(row.readiness),application,metrics:normalizeMetrics(row.metrics),createdAt:dateTime(row.createdAt,'Oluşturma tarihi') as string,updatedAt:dateTime(row.updatedAt,'Güncelleme tarihi') as string,archivedAt:dateTime(row.archivedAt,'Arşiv tarihi',false),officialProtected:bool(row.officialProtected,'Resmi mağaza koruması')};}

export async function superAdminListStores(query='',state:SuperAdminStoreState='all',limit=50,offset=0):Promise<SuperAdminStoreDirectory>{
 const cleanQuery=query.trim();if(cleanQuery.length>160)throw new Error('Mağaza araması en fazla 160 karakter olabilir.');if(!STATES.has(state))throw new Error('Mağaza durum filtresi geçersiz.');if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0)throw new Error('Mağaza sayfalaması geçersiz.');
 const{data,error}=await supabase.rpc('super_admin_store_directory_v1',{p_query:cleanQuery||null,p_state:state,p_limit:limit,p_offset:offset});if(error)throw error;const root=object(data,'Mağaza dizini');const itemsRaw=root.items;if(!Array.isArray(itemsRaw)||itemsRaw.length>limit)throw new Error('Mağaza dizini sunucudan doğrulanamadı.');const result={summary:normalizeSummary(root.summary),total:integer(root.total,'Filtrelenmiş mağaza sayısı'),limit:integer(root.limit,'Sayfa boyutu',100),offset:integer(root.offset,'Sayfa başlangıcı'),items:itemsRaw.map(normalizeListItem)};if(result.offset!==offset||result.limit!==limit||result.items.length>result.total)throw new Error('Mağaza dizini sayfalaması tutarsız.');return result;
}

export async function superAdminGetStoreDetail(reference:string):Promise<SuperAdminStoreDetail>{const ref=text(reference,'Mağaza referansı',220);const{data,error}=await supabase.rpc('super_admin_store_detail_v1',{p_store_reference:ref});if(error)throw error;return normalizeDetail(data);}

export async function superAdminSetStoreState(reference:string,action:SuperAdminStoreAction,reason?:string|null){const ref=text(reference,'Mağaza referansı',220);if(!ACTIONS.has(action))throw new Error('Mağaza yaşam döngüsü işlemi geçersiz.');const cleanReason=reason?.trim()||null;if(['block','close','archive'].includes(action)&&(!cleanReason||cleanReason.length<10||cleanReason.length>1000))throw new Error('Bu işlem için 10 ile 1000 karakter arasında yönetim gerekçesi yazılmalıdır.');const{data,error}=await supabase.rpc('super_admin_set_store_state_v1',{p_store_reference:ref,p_action:action,p_reason:cleanReason});if(error)throw error;const row=object(data,'Mağaza durum sonucu');if(row.ok!==true||uuid(row.id,'Mağaza kimliği')===''||storeNumber(row.storeNumber)==='')throw new Error('Mağaza durum güncelleme sonucu doğrulanamadı.');return row;}

export function storeDirectoryErrorMessage(error:unknown,fallback='Mağaza yönetim işlemi tamamlanamadı.'){const message=String((error as {message?:unknown})?.message||'').trim();if(!message)return fallback;const map:Array<[string,string]>=[
 ['permission_required:storefront.lifecycle_manage','Bu mağaza yaşam döngüsü işlemi yalnız MFA doğrulamalı Super Admin tarafından yapılabilir.'],['store_not_found','Mağaza artık bulunamadı.'],['invalid_store_reference','Mağaza kimliği veya numarası geçersiz.'],['store_search_query_too_long','Mağaza araması en fazla 160 karakter olabilir.'],['invalid_store_state_filter','Mağaza durum filtresi geçersiz.'],['invalid_pagination','Mağaza sayfalaması geçersiz.'],['invalid_store_lifecycle_action','Mağaza yaşam döngüsü işlemi geçersiz.'],['store_lifecycle_reason_required','Engelleme, kapatma veya arşivleme için en az 10 karakterlik yönetim gerekçesi gerekir.'],['official_store_state_protected','Golden Oremar resmi mağazası yaşam döngüsü işlemlerine karşı korumalıdır.'],['store_restore_required','Arşivlenmiş mağaza önce arşivden çıkarılmalıdır.'],['storefront_publish_required','Mağaza açılmadan önce vitrin yayınlanmalıdır.'],['storefront_readiness_required','Mağaza açılmadan önce mağaza kurulumundaki eksikler tamamlanmalıdır.'],['store_verification_required','Mağaza açılmadan önce kimlik ve menşe doğrulaması tamamlanmalıdır.'],['active_producer_trust_badge_required','Mağaza açılmadan önce aktif üretici güven rozeti gerekir.'],['store_archived','Arşivlenmiş mağazada bu işlem yapılamaz.'],['store_already_archived','Mağaza zaten arşivlenmiş.'],['store_not_archived','Mağaza arşivde değil.'],['storefront_media_legacy_retired','Eski mağaza medya yolu kapatıldı. Doğrulanmış mağaza medya akışını kullanın.']
 ];for(const[key,textValue]of map)if(message.includes(key))return textValue;return message.length<=300?message:fallback;}
