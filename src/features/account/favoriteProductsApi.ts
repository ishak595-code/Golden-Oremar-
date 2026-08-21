import { supabase } from '../../lib/supabase';
import { normalizeProductHandlingProfile, type ProductHandlingProfile } from '../catalog/productHandlingApi';

export type FavoriteProductItem={
 productId:string;legacyId:string|null;slug:string;name:string;shortDescription:string;origin:string|null;currency:string;
 stockMode:'tracked'|'preorder'|'unlimited'|'seasonal';availableQuantity:number|null;handlingProfile:ProductHandlingProfile;
 producer:{id:string;name:string;verified:boolean;originVerified:boolean;locationLabel:string;storeKind:'official'|'independent';storefrontTier:'standard'|'verified'|'signature';badgeTone:'ruby'|'blue';storeBadgeLabel:string};
 variant:{id:string;name:string;priceMinor:number;compareAtPriceMinor:number|null}|null;imagePath:string|null;available:boolean;favoritedAt:string;
};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOCK_MODES=new Set<FavoriteProductItem['stockMode']>(['tracked','preorder','unlimited','seasonal']);
function record(v:unknown):v is Record<string,any>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v);}
function text(v:unknown,label:string,max=500,required=true){if(v==null||v===''){if(required)throw new Error(`${label} doğrulanamadı.`);return'';}if(typeof v!=='string')throw new Error(`${label} doğrulanamadı.`);const s=v.trim();if((required&&!s)||s.length>max||/[\u0000-\u001F\u007F]/.test(s))throw new Error(`${label} doğrulanamadı.`);return s;}
function optional(v:unknown,label:string,max=1000){const s=text(v,label,max,false);return s||null;}
function uuid(v:unknown,label:string){const s=text(v,label,36);if(!UUID_RE.test(s))throw new Error(`${label} doğrulanamadı.`);return s;}
function integer(v:unknown,label:string,max=Number.MAX_SAFE_INTEGER){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>max)throw new Error(`${label} doğrulanamadı.`);return v;}
function optionalInteger(v:unknown,label:string,max=Number.MAX_SAFE_INTEGER){if(v==null)return null;return integer(v,label,max);}
function bool(v:unknown,label:string){if(typeof v!=='boolean')throw new Error(`${label} doğrulanamadı.`);return v;}
function date(v:unknown,label:string){const s=text(v,label,80);if(Number.isNaN(Date.parse(s)))throw new Error(`${label} doğrulanamadı.`);return s;}
function currency(v:unknown){const s=text(v,'Para birimi',3).toUpperCase();if(!/^[A-Z]{3}$/.test(s))throw new Error('Para birimi doğrulanamadı.');return s;}
function normalize(v:unknown,index:number):FavoriteProductItem{
 if(!record(v)||!record(v.producer)||!record(v.variant))throw new Error(`${index+1}. favori ürün doğrulanamadı.`);
 const producer=v.producer,kind=text(producer.storeKind,'Mağaza türü',30) as FavoriteProductItem['producer']['storeKind'];if(!['official','independent'].includes(kind))throw new Error('Mağaza türü doğrulanamadı.');
 const tier=text(producer.storefrontTier,'Vitrin seviyesi',30) as FavoriteProductItem['producer']['storefrontTier'];if(!['standard','verified','signature'].includes(tier))throw new Error('Vitrin seviyesi doğrulanamadı.');
 const tone=text(producer.badgeTone,'Rozet tonu',20) as FavoriteProductItem['producer']['badgeTone'];if((kind==='official'&&tone!=='ruby')||(kind==='independent'&&tone!=='blue'))throw new Error('Mağaza rozeti kimliği tutarsız.');
 const stockMode=text(v.stockMode,'Stok modu',40) as FavoriteProductItem['stockMode'];if(!STOCK_MODES.has(stockMode))throw new Error('Stok modu doğrulanamadı.');
 let variant:FavoriteProductItem['variant']=null;if(v.variant.id!=null){variant={id:uuid(v.variant.id,'Varyant kimliği'),name:text(v.variant.name,'Varyant adı',240),priceMinor:integer(v.variant.priceMinor,'Fiyat'),compareAtPriceMinor:optionalInteger(v.variant.compareAtPriceMinor,'Karşılaştırma fiyatı')};}
 const availableQuantity=optionalInteger(v.availableQuantity,'Satılabilir stok',999999999);
 if(['tracked','seasonal'].includes(stockMode)&&availableQuantity===null)throw new Error('Takipli ürün stoğu doğrulanamadı.');
 const available=bool(v.available,'Satış durumu');if(available&&variant===null)throw new Error('Satışta görünen favoride aktif varyant yok.');if(available&&['tracked','seasonal'].includes(stockMode)&&availableQuantity===0)throw new Error('Stoksuz favori satışta gösterilemez.');
 return{productId:uuid(v.productId,'Ürün kimliği'),legacyId:optional(v.legacyId,'Legacy ürün kimliği',200),slug:text(v.slug,'Ürün bağlantısı',240),name:text(v.name,'Ürün adı',300),shortDescription:text(v.shortDescription,'Kısa açıklama',1000,false),origin:optional(v.origin,'Menşe',300),currency:currency(v.currency),stockMode,availableQuantity,handlingProfile:normalizeProductHandlingProfile(v.handlingProfile),producer:{id:uuid(producer.id,'Üretici kimliği'),name:text(producer.name,'Üretici adı',240),verified:bool(producer.verified,'Üretici doğrulama durumu'),originVerified:bool(producer.originVerified,'Menşe doğrulama durumu'),locationLabel:text(producer.locationLabel,'Üretici konumu',500,false),storeKind:kind,storefrontTier:tier,badgeTone:tone,storeBadgeLabel:text(producer.storeBadgeLabel,'Mağaza rozeti',180)},variant,imagePath:optional(v.imagePath,'Ürün görseli',2048),available,favoritedAt:date(v.favoritedAt,'Favori tarihi')};
}
export async function listFavoriteProducts(){const{data,error}=await supabase.rpc('list_my_favorites_v1');if(error)throw error;if(!Array.isArray(data)||data.length>10000)throw new Error('Favori listesi doğrulanamadı.');return data.map(normalize);}
export async function removeFavoriteProduct(reference:string){const normalized=text(reference,'Ürün referansı',240);const{data,error}=await supabase.rpc('toggle_customer_favorite',{p_product_reference:normalized});if(error)throw error;if(!record(data)||typeof data.isFavorite!=='boolean'||data.isFavorite!==false)throw new Error('Favori kaldırma sonucu doğrulanamadı.');return true;}
