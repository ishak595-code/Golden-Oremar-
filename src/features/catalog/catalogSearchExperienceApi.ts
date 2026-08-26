import { supabase } from '../../lib/supabase';

export type CatalogCategoryFacet={slug:string;name:string;count:number};
export type CatalogProducerFacet={id:string;name:string;count:number};
export type CatalogLocationFacet={value:string;count:number};
export type CatalogSearchFacets={
 total:number;
 categories:CatalogCategoryFacet[];
 producers:CatalogProducerFacet[];
 provinces:CatalogLocationFacet[];
 districts:CatalogLocationFacet[];
 villages:CatalogLocationFacet[];
 price:{minMinor:number|null;maxMinor:number|null};
 inStockCount:number;
};
export type CatalogFacetInput={
 query?:string|null;
 categorySlug?:string|null;
 producerId?:string|null;
 province?:string|null;
 district?:string|null;
 village?:string|null;
 minPriceMinor?:number|null;
 maxPriceMinor?:number|null;
 inStock?:boolean;
 featured?:boolean|null;
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,label:string,max:number){if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const result=value.trim();if(!result||result.length>max||/[\u0000-\u001F\u007F]/.test(result))throw new Error(`${label} doğrulanamadı.`);return result;}
function optionalInput(value:unknown,max:number){if(value==null||String(value).trim()==='')return null;const result=String(value).trim();if(result.length>max||/[\u0000-\u001F\u007F]/.test(result))throw new Error('Arama filtresi doğrulanamadı.');return result;}
function integer(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}
function nullableInteger(value:unknown,label:string){if(value==null)return null;return integer(value,label);}
function countArray(value:unknown,label:string,max=500){if(!Array.isArray(value)||value.length>max)throw new Error(`${label} doğrulanamadı.`);return value;}
function optionalMinor(value:unknown,label:string){if(value==null)return null;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}
function uuidInput(value:unknown){const result=optionalInput(value,36);if(result&&!UUID_RE.test(result))throw new Error('Üretici filtresi doğrulanamadı.');return result;}

function normalizeCategory(value:unknown,index:number):CatalogCategoryFacet{if(!record(value))throw new Error(`${index+1}. kategori filtresi doğrulanamadı.`);return{slug:text(value.slug,'Kategori bağlantısı',220),name:text(value.name,'Kategori adı',180),count:integer(value.count,'Kategori sonucu')};}
function normalizeProducer(value:unknown,index:number):CatalogProducerFacet{if(!record(value))throw new Error(`${index+1}. üretici filtresi doğrulanamadı.`);const id=text(value.id,'Üretici kimliği',36);if(!UUID_RE.test(id))throw new Error('Üretici kimliği doğrulanamadı.');return{id,name:text(value.name,'Üretici adı',240),count:integer(value.count,'Üretici sonucu')};}
function normalizeLocation(value:unknown,index:number,label:string):CatalogLocationFacet{if(!record(value))throw new Error(`${index+1}. ${label} filtresi doğrulanamadı.`);return{value:text(value.value,label,180),count:integer(value.count,`${label} sonucu`)};}

export async function catalogSearchFacets(input:CatalogFacetInput={}):Promise<CatalogSearchFacets>{
 const query=optionalInput(input.query,100);
 const categorySlug=optionalInput(input.categorySlug,220);
 const producerId=uuidInput(input.producerId);
 const province=optionalInput(input.province,160);
 const district=optionalInput(input.district,160);
 const village=optionalInput(input.village,180);
 const minPriceMinor=optionalMinor(input.minPriceMinor,'Minimum fiyat');
 const maxPriceMinor=optionalMinor(input.maxPriceMinor,'Maksimum fiyat');
 if(minPriceMinor!=null&&maxPriceMinor!=null&&maxPriceMinor<minPriceMinor)throw new Error('Fiyat aralığı doğrulanamadı.');
 const featured=input.featured==null?null:Boolean(input.featured);
 const{data,error}=await supabase.rpc('catalog_search_facets_v1',{
  p_query:query,p_category_slug:categorySlug,p_producer_id:producerId,p_province:province,p_district:district,p_village:village,
  p_min_price_minor:minPriceMinor,p_max_price_minor:maxPriceMinor,p_in_stock:Boolean(input.inStock),p_featured:featured,
 });
 if(error)throw error;
 if(!record(data)||!record(data.price))throw new Error('Katalog filtre özeti doğrulanamadı.');
 const categories=countArray(data.categories,'Kategori filtreleri').map(normalizeCategory);
 const producers=countArray(data.producers,'Üretici filtreleri').map(normalizeProducer);
 const provinces=countArray(data.provinces,'İl filtreleri').map((item,index)=>normalizeLocation(item,index,'İl'));
 const districts=countArray(data.districts,'İlçe filtreleri').map((item,index)=>normalizeLocation(item,index,'İlçe'));
 const villages=countArray(data.villages,'Köy filtreleri').map((item,index)=>normalizeLocation(item,index,'Köy'));
 const total=integer(data.total,'Toplam katalog sonucu');
 const inStockCount=integer(data.inStockCount,'Stoktaki sonuç');
 const minMinor=nullableInteger(data.price.minMinor,'Minimum katalog fiyatı');
 const maxMinor=nullableInteger(data.price.maxMinor,'Maksimum katalog fiyatı');
 if(minMinor!=null&&maxMinor!=null&&maxMinor<minMinor)throw new Error('Katalog fiyat özeti tutarsız.');
 for(const item of [...categories,...producers,...provinces,...districts,...villages])if(item.count>total)throw new Error('Katalog filtre sayacı toplam sonuçtan büyük.');
 if(inStockCount>total)throw new Error('Stok filtresi toplam sonucu aşıyor.');
 return{total,categories,producers,provinces,districts,villages,price:{minMinor,maxMinor},inStockCount};
}
