import{ supabase }from'../../lib/supabase';

export type ProductRecommendationReason='same_category_better_value'|'same_category'|'popular_related'|'same_collection_better_value'|'same_collection'|'similar_attributes'|'related_category'|'popular'|'discovery';
export type ProductRecommendationSignals={sameCategory:boolean;relatedCategory:boolean;sameCollection:boolean;tagOverlapCount:number;cheaper:boolean;priceDifferenceMinor:number;sales30d:number;salesAll:number;favoriteCount:number;reviewCount:number;averageRating:number};
export type ProductRecommendation={id:string;legacyId:string|null;slug:string;name:string;shortDescription:string|null;origin:string|null;unitLabel:string|null;category:{id:string;slug:string;name:string};producer:{id:string;name:string;storeKind:'official'|'independent';storefrontTier:'standard'|'verified'|'signature'};variant:{id:string;name:string;sku:string|null;priceMinor:number;compareAtPriceMinor:number|null};currency:string;stockMode:string;availableQuantity:number|null;featured:boolean;imagePath:string|null;averageRating:number;reviewCount:number;reason:ProductRecommendationReason;score:number;signals:ProductRecommendationSignals};
export type ProductRecommendationResponse={productId:string;generatedAt:string;items:ProductRecommendation[]};

const REASONS=new Set<ProductRecommendationReason>(['same_category_better_value','same_category','popular_related','same_collection_better_value','same_collection','similar_attributes','related_category','popular','discovery']);
const STORE_KINDS=new Set(['official','independent']);
const TIERS=new Set(['standard','verified','signature']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,label:string,max:number,nullable=false){if(value==null&&nullable)return null;if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const normalized=value.trim();if((!normalized&&!nullable)||normalized.length>max||/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized||null;}
function integer(value:unknown,label:string,max=Number.MAX_SAFE_INTEGER,nullable=false){if(value==null&&nullable)return null;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function decimal(value:unknown,label:string,min=0,max=Number.MAX_SAFE_INTEGER){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function uuid(value:unknown,label:string){const normalized=text(value,label,80)as string;if(!UUID.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function currency(value:unknown){const normalized=(text(value,'Para birimi',3)as string).toUpperCase();if(!/^[A-Z]{3}$/.test(normalized))throw new Error('Para birimi doğrulanamadı.');return normalized;}
function date(value:unknown,label:string){const normalized=text(value,label,80)as string;if(Number.isNaN(Date.parse(normalized)))throw new Error(`${label} doğrulanamadı.`);return normalized;}

function normalizeRecommendation(value:unknown,index:number):ProductRecommendation{
 if(!record(value)||!record(value.category)||!record(value.producer)||!record(value.variant)||!record(value.signals))throw new Error(`${index+1}. ürün önerisi doğrulanamadı.`);
 const reason=text(value.reason,'Öneri nedeni',80)as ProductRecommendationReason;if(!REASONS.has(reason))throw new Error('Öneri nedeni doğrulanamadı.');
 const storeKind=text(value.producer.storeKind,'Mağaza türü',30)as ProductRecommendation['producer']['storeKind'];if(!STORE_KINDS.has(storeKind))throw new Error('Öneri mağaza türü doğrulanamadı.');
 const storefrontTier=text(value.producer.storefrontTier,'Vitrin seviyesi',30)as ProductRecommendation['producer']['storefrontTier'];if(!TIERS.has(storefrontTier))throw new Error('Öneri vitrin seviyesi doğrulanamadı.');
 const signals:ProductRecommendationSignals={sameCategory:bool(value.signals.sameCategory,'Kategori eşleşmesi'),relatedCategory:bool(value.signals.relatedCategory,'İlgili kategori'),sameCollection:bool(value.signals.sameCollection,'Seçki eşleşmesi'),tagOverlapCount:integer(value.signals.tagOverlapCount,'Etiket eşleşmesi',100)as number,cheaper:bool(value.signals.cheaper,'Fiyat avantajı'),priceDifferenceMinor:integer(value.signals.priceDifferenceMinor,'Fiyat farkı')as number,sales30d:integer(value.signals.sales30d,'30 günlük satış',1000000000)as number,salesAll:integer(value.signals.salesAll,'Toplam satış',1000000000)as number,favoriteCount:integer(value.signals.favoriteCount,'Favori sayısı',1000000000)as number,reviewCount:integer(value.signals.reviewCount,'Yorum sayısı',1000000000)as number,averageRating:decimal(value.signals.averageRating,'Ortalama puan',0,5)};
 if((reason==='popular'||reason==='popular_related')&&signals.sales30d<1)throw new Error('Popüler ürün önerisi gerçek satış sinyali taşımıyor.');
 if(reason==='same_category_better_value'&&(!signals.sameCategory||!signals.cheaper))throw new Error('Kategori/fiyat öneri nedeni sinyallerle uyuşmuyor.');
 return{id:uuid(value.id,'Öneri ürün kimliği'),legacyId:text(value.legacyId,'Eski ürün kimliği',160,true),slug:text(value.slug,'Öneri ürün bağlantısı',220)as string,name:text(value.name,'Öneri ürün adı',300)as string,shortDescription:text(value.shortDescription,'Öneri kısa açıklaması',1000,true),origin:text(value.origin,'Öneri menşei',240,true),unitLabel:text(value.unitLabel,'Öneri birimi',120,true),category:{id:uuid(value.category.id,'Öneri kategori kimliği'),slug:text(value.category.slug,'Öneri kategori bağlantısı',220)as string,name:text(value.category.name,'Öneri kategori adı',180)as string},producer:{id:uuid(value.producer.id,'Öneri üretici kimliği'),name:text(value.producer.name,'Öneri üretici adı',240)as string,storeKind,storefrontTier},variant:{id:uuid(value.variant.id,'Öneri varyant kimliği'),name:text(value.variant.name,'Öneri varyant adı',240)as string,sku:text(value.variant.sku,'Öneri SKU',160,true),priceMinor:integer(value.variant.priceMinor,'Öneri fiyatı')as number,compareAtPriceMinor:integer(value.variant.compareAtPriceMinor,'Öneri karşılaştırma fiyatı',Number.MAX_SAFE_INTEGER,true)},currency:currency(value.currency),stockMode:text(value.stockMode,'Öneri stok modu',80)as string,availableQuantity:integer(value.availableQuantity,'Öneri stok miktarı',999999999,true),featured:bool(value.featured,'Öneri öne çıkarma durumu'),imagePath:text(value.imagePath,'Öneri görsel yolu',1200,true),averageRating:decimal(value.averageRating,'Öneri ortalama puanı',0,5),reviewCount:integer(value.reviewCount,'Öneri yorum sayısı',1000000000)as number,reason,score:decimal(value.score,'Öneri skoru',-100000,100000),signals};
}

function normalizeResponse(value:unknown):ProductRecommendationResponse{
 if(!record(value)||!Array.isArray(value.items)||value.items.length>24)throw new Error('Ürün önerileri doğrulanamadı.');
 const productId=uuid(value.productId,'Öneri kaynak ürün kimliği');const generatedAt=date(value.generatedAt,'Öneri üretim zamanı');
 const items=value.items.map(normalizeRecommendation);if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error('Ürün önerileri yineleniyor.');if(items.some(item=>item.id===productId))throw new Error('Kaynak ürün kendi öneri listesine giremez.');
 return{productId,generatedAt,items};
}

export async function getProductRecommendations(reference:string,limit=12):Promise<ProductRecommendationResponse>{
 const normalized=String(reference||'').trim().slice(0,200);if(!normalized)throw new Error('Ürün referansı gerekli.');const bounded=Number.isSafeInteger(limit)?Math.min(24,Math.max(1,limit)):12;
 const{data,error}=await supabase.rpc('public_product_recommendations_v1',{p_reference:normalized,p_limit:bounded});if(error)throw error;return normalizeResponse(data);
}
