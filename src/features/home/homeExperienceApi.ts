import { supabase } from '../../lib/supabase';
import { publicCatalogUrl, type CatalogItem, type PublicCategory } from '../catalog/api';
import { normalizeProductHandlingProfile } from '../catalog/productHandlingApi';

export const SUPPORTED_HOME_LOCALES = ['tr','en','de','fr','ku','ar'] as const;
export type HomeLocale = typeof SUPPORTED_HOME_LOCALES[number];
export type HomeSectionSource = {kind:'featured'|'preorder'|'seasonal'|'newest'|'offers'|'curated'|'category';collectionKey?:string;categorySlug?:string};
export type HomeSectionModel = {key:string;type:'product_carousel';title:string;subtitle:string;displayLimit:number;source:HomeSectionSource;items:CatalogItem[];deferred:boolean};
export type HomeCampaign = {id:string;slug:string;title:string;description:string|null;bannerPath:string|null;startsAt:string;endsAt:string;targetScope:'all'|'products'|'categories';targetIds:string[]};
export type HomeExperience = {
  version:number;
  locale:HomeLocale;
  generatedAt:string;
  updatedAt:string;
  cacheKey:string;
  cachePolicy:{compositionMaxAgeSeconds:number;categoriesMaxAgeSeconds:number;productProjectionMaxAgeSeconds:number};
  brand:{name:string;slug:string;defaultLocale:string;defaultCurrency:string};
  interface:{heroTitle:string;heroSubtitle:string;heroButtonText:string;featuredTitle:string;seasonalTitle:string;categoriesTitle:string;footerText:string|null};
  search:{enabled:boolean;voiceEnabled:boolean};
  categories:PublicCategory[];
  categoryOrder:Array<{id:string;title:string;subtitle:string;targetCategory:string;icon:string|null;image:string|null}>;
  sections:HomeSectionModel[];
  campaign:HomeCampaign|null;
  eventSpotlight:any;
  salesReadiness:{status:string;message:string};
};

const STORE_KINDS=new Set(['independent','official']);
const STOREFRONT_TIERS=new Set(['standard','verified','signature']);
const SOURCE_KINDS=new Set(['featured','preorder','seasonal','newest','offers','curated','category']);
const TARGET_SCOPES=new Set(['all','products','categories']);
const LOCALES=new Set<string>(SUPPORTED_HOME_LOCALES);

function isRecord(value:unknown):value is Record<string,any>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function requiredText(value:unknown,label:string,max=500){const text=typeof value==='string'?value.trim():'';if(!text||text.length>max||/[\u0000-\u001F\u007F]/.test(text))throw new Error(`${label} doğrulanamadı.`);return text;}
function optionalText(value:unknown,max=1000){if(value==null||value==='')return null;if(typeof value!=='string')throw new Error('Metin alanı doğrulanamadı.');const text=value.trim();if(!text)return null;if(text.length>max||/[\u0000-\u001F\u007F]/.test(text))throw new Error('Metin alanı doğrulanamadı.');return text;}
function integer(value:unknown,label:string,min=0,max=Number.MAX_SAFE_INTEGER){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function finite(value:unknown,label:string,min:number,max:number){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function booleanValue(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function dateTime(value:unknown,label:string){const text=requiredText(value,label,80);if(Number.isNaN(Date.parse(text)))throw new Error(`${label} doğrulanamadı.`);return text;}
function currency(value:unknown){const text=requiredText(value,'Para birimi',3).toUpperCase();if(!/^[A-Z]{3}$/.test(text))throw new Error('Para birimi doğrulanamadı.');return text;}

export function normalizeHomeLocale(value:unknown):HomeLocale{
  const raw=typeof value==='string'?value.trim().toLowerCase().split('-')[0]:'';
  return (LOCALES.has(raw)?raw:'tr') as HomeLocale;
}

export function browserHomeLocale():HomeLocale{
  if(typeof document!=='undefined'&&document.documentElement.lang)return normalizeHomeLocale(document.documentElement.lang);
  if(typeof navigator!=='undefined'&&navigator.language)return normalizeHomeLocale(navigator.language);
  return 'tr';
}

function normalizeProducer(value:unknown){
  if(!isRecord(value))throw new Error('Üretici özeti doğrulanamadı.');
  const storeKind=requiredText(value.storeKind,'Mağaza türü',30),tier=requiredText(value.storefrontTier,'Vitrin seviyesi',30),tone=requiredText(value.badgeTone,'Rozet tonu',30);
  if(!STORE_KINDS.has(storeKind)||!STOREFRONT_TIERS.has(tier)||!['ruby','blue'].includes(tone))throw new Error('Üretici mağaza kimliği doğrulanamadı.');
  return{id:requiredText(value.id,'Üretici kimliği',160),name:requiredText(value.name,'Üretici adı',240),province:optionalText(value.province,120),district:optionalText(value.district,120),village:optionalText(value.village,160),verified:booleanValue(value.verified,'Üretici doğrulaması'),originVerified:booleanValue(value.originVerified,'Menşe doğrulaması'),storeKind:storeKind as 'official'|'independent',storefrontTier:tier as 'standard'|'verified'|'signature',badgeTone:tone as 'ruby'|'blue',storeBadgeLabel:requiredText(value.storeBadgeLabel,'Mağaza etiketi',180),followerCount:integer(value.followerCount,'Takipçi sayısı',0,1000000000)};
}

function normalizeItem(value:unknown,index:number):CatalogItem{
  if(!isRecord(value)||!isRecord(value.category)||!isRecord(value.variant))throw new Error(`${index+1}. ürün kartı doğrulanamadı.`);
  const imagePath=optionalText(value.imagePath,1200);
  return{
    id:requiredText(value.id,'Ürün kimliği',160),legacyId:optionalText(value.legacyId,160),slug:requiredText(value.slug,'Ürün bağlantısı',220),name:requiredText(value.name,'Ürün adı',300),shortDescription:optionalText(value.shortDescription,1000),origin:optionalText(value.origin,240),unitLabel:optionalText(value.unitLabel,160),
    category:{id:requiredText(value.category.id,'Kategori kimliği',160),slug:requiredText(value.category.slug,'Kategori bağlantısı',220),name:requiredText(value.category.name,'Kategori adı',160)},
    producer:normalizeProducer(value.producer),
    variant:{id:requiredText(value.variant.id,'Varyant kimliği',160),name:requiredText(value.variant.name,'Varyant adı',240),sku:optionalText(value.variant.sku,160),priceMinor:integer(value.variant.priceMinor,'Ürün fiyatı'),compareAtPriceMinor:value.variant.compareAtPriceMinor==null?null:integer(value.variant.compareAtPriceMinor,'Karşılaştırma fiyatı')},
    currency:currency(value.currency),stockMode:requiredText(value.stockMode,'Stok modu',80),availableQuantity:value.availableQuantity==null?null:integer(value.availableQuantity,'Satılabilir stok',0,999999999),featured:booleanValue(value.featured,'Öne çıkarma durumu'),imagePath:imagePath?publicCatalogUrl(imagePath):null,averageRating:finite(value.averageRating,'Ürün puanı',0,5),reviewCount:integer(value.reviewCount,'Değerlendirme sayısı',0,1000000000),handlingProfile:normalizeProductHandlingProfile(value.handlingProfile)
  };
}

function normalizeCategory(value:unknown,index:number):PublicCategory{
  if(!isRecord(value))throw new Error(`${index+1}. kategori doğrulanamadı.`);
  return{id:requiredText(value.id,'Kategori kimliği',160),parentId:optionalText(value.parentId,160),slug:requiredText(value.slug,'Kategori bağlantısı',220),name:requiredText(value.name,'Kategori adı',160),description:optionalText(value.description,1000),icon:optionalText(value.icon,120),imagePath:optionalText(value.imagePath,1200),sortOrder:integer(value.sortOrder,'Kategori sırası',0,1000000),productCount:integer(value.productCount,'Kategori ürün sayısı',1,1000000000)};
}

function normalizeSource(value:unknown):HomeSectionSource{
  if(!isRecord(value))throw new Error('Ana sayfa bölüm kaynağı doğrulanamadı.');
  const kind=requiredText(value.kind,'Bölüm kaynak türü',30);if(!SOURCE_KINDS.has(kind))throw new Error('Ana sayfa bölüm kaynak türü doğrulanamadı.');
  return{kind:kind as HomeSectionSource['kind'],collectionKey:optionalText(value.collectionKey,80)||undefined,categorySlug:optionalText(value.categorySlug,220)||undefined};
}

function normalizeSection(value:unknown,index:number):HomeSectionModel{
  if(!isRecord(value)||!Array.isArray(value.items))throw new Error(`${index+1}. ana sayfa bölümü doğrulanamadı.`);
  const type=requiredText(value.type,'Bölüm türü',40);if(type!=='product_carousel')throw new Error('Desteklenmeyen ana sayfa bölüm türü.');
  const limit=integer(value.displayLimit,'Bölüm ürün sınırı',1,12);const items=value.items.map((item,itemIndex)=>normalizeItem(item,itemIndex));if(items.length>limit)throw new Error('Ana sayfa bölümü ürün sınırını aşıyor.');
  return{key:requiredText(value.key,'Bölüm anahtarı',80),type:'product_carousel',title:requiredText(value.title,'Bölüm başlığı',160),subtitle:optionalText(value.subtitle,400)||'',displayLimit:limit,source:normalizeSource(value.source),items,deferred:booleanValue(value.deferred,'Bölüm erteleme durumu')};
}

function normalizeCampaign(value:unknown):HomeCampaign|null{
  if(value==null)return null;if(!isRecord(value)||!Array.isArray(value.targetIds))throw new Error('Kampanya özeti doğrulanamadı.');
  const scope=requiredText(value.targetScope,'Kampanya hedefi',30);if(!TARGET_SCOPES.has(scope))throw new Error('Kampanya hedefi doğrulanamadı.');
  return{id:requiredText(value.id,'Kampanya kimliği',160),slug:requiredText(value.slug,'Kampanya bağlantısı',180),title:requiredText(value.title,'Kampanya başlığı',200),description:optionalText(value.description,1000),bannerPath:optionalText(value.bannerPath,1200),startsAt:dateTime(value.startsAt,'Kampanya başlangıcı'),endsAt:dateTime(value.endsAt,'Kampanya bitişi'),targetScope:scope as HomeCampaign['targetScope'],targetIds:value.targetIds.map((id,index)=>requiredText(id,`${index+1}. kampanya hedefi`,220))};
}

function normalizeExperience(value:unknown):HomeExperience{
  if(!isRecord(value)||!isRecord(value.brand)||!isRecord(value.interface)||!isRecord(value.search)||!isRecord(value.cachePolicy)||!isRecord(value.salesReadiness)||!Array.isArray(value.categories)||!Array.isArray(value.categoryOrder)||!Array.isArray(value.sections))throw new Error('Ana sayfa deneyimi sunucudan doğrulanamadı.');
  const version=integer(value.version,'Ana sayfa sözleşme sürümü',2,20);const locale=normalizeHomeLocale(value.locale);const generatedAt=dateTime(value.generatedAt,'Ana sayfa oluşturma zamanı'),updatedAt=dateTime(value.updatedAt,'Ana sayfa güncelleme zamanı');
  const categories=value.categories.map((item,index)=>normalizeCategory(item,index));if(categories.length>100)throw new Error('Ana sayfa kategori sınırı aşıldı.');
  const sections=value.sections.map((item,index)=>normalizeSection(item,index));if(sections.length>20||sections.filter(section=>!section.deferred).length>1)throw new Error('Ana sayfa ilk yükleme sınırı doğrulanamadı.');
  const categoryOrder=value.categoryOrder.map((item:any,index:number)=>{if(!isRecord(item))throw new Error(`${index+1}. kategori sırası doğrulanamadı.`);return{id:requiredText(item.id,'Kategori sıra kimliği',100),title:requiredText(item.title,'Kategori sıra başlığı',160),subtitle:optionalText(item.subtitle,240)||'',targetCategory:requiredText(item.targetCategory,'Kategori hedefi',220),icon:optionalText(item.icon,80),image:optionalText(item.image,1200)};});
  return{version,locale,generatedAt,updatedAt,cacheKey:requiredText(value.cacheKey,'Ana sayfa cache anahtarı',240),cachePolicy:{compositionMaxAgeSeconds:integer(value.cachePolicy.compositionMaxAgeSeconds,'Composition cache süresi',1,3600),categoriesMaxAgeSeconds:integer(value.cachePolicy.categoriesMaxAgeSeconds,'Kategori cache süresi',1,86400),productProjectionMaxAgeSeconds:integer(value.cachePolicy.productProjectionMaxAgeSeconds,'Ürün cache süresi',1,3600)},brand:{name:requiredText(value.brand.name,'Marka adı',120),slug:requiredText(value.brand.slug,'Marka bağlantısı',120),defaultLocale:requiredText(value.brand.defaultLocale,'Varsayılan dil',16),defaultCurrency:currency(value.brand.defaultCurrency)},interface:{heroTitle:requiredText(value.interface.heroTitle,'Vitrin başlığı',180),heroSubtitle:requiredText(value.interface.heroSubtitle,'Vitrin açıklaması',500),heroButtonText:requiredText(value.interface.heroButtonText,'Vitrin aksiyonu',80),featuredTitle:requiredText(value.interface.featuredTitle,'Öne çıkan başlığı',160),seasonalTitle:requiredText(value.interface.seasonalTitle,'Mevsimlik başlığı',160),categoriesTitle:requiredText(value.interface.categoriesTitle,'Kategori başlığı',160),footerText:optionalText(value.interface.footerText,500)},search:{enabled:booleanValue(value.search.enabled,'Arama durumu'),voiceEnabled:booleanValue(value.search.voiceEnabled,'Sesli arama durumu')},categories,categoryOrder,sections,campaign:normalizeCampaign(value.campaign),eventSpotlight:value.eventSpotlight,salesReadiness:{status:requiredText(value.salesReadiness.status,'Satış hazırlık durumu',100),message:requiredText(value.salesReadiness.message,'Satış hazırlık mesajı',500)}};
}

export async function getPublicHomeExperience(locale:HomeLocale):Promise<HomeExperience>{
  const{data,error}=await supabase.rpc('get_public_home_experience_v1',{p_locale:locale});if(error)throw error;return normalizeExperience(data);
}

export async function getPublicHomeSection(key:string,locale:HomeLocale):Promise<HomeSectionModel|null>{
  const sectionKey=requiredText(key,'Ana sayfa bölüm anahtarı',80);const{data,error}=await supabase.rpc('get_public_home_section_v1',{p_key:sectionKey,p_locale:locale});if(error)throw error;if(data==null)return null;const normalized=normalizeSection({...data,deferred:false},0);if(normalized.key!==sectionKey)throw new Error('Ana sayfa bölüm cevabı istekle eşleşmiyor.');return normalized;
}
