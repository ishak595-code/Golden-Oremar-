import{supabase}from'../../lib/supabase';

export type CatalogFacetCount={value:string;count:number};
export type CatalogCategoryFacet={slug:string;name:string;count:number};
export type CatalogProducerFacet={id:string;name:string;count:number};
export type CatalogSearchFacets={total:number;categories:CatalogCategoryFacet[];producers:CatalogProducerFacet[];provinces:CatalogFacetCount[];districts:CatalogFacetCount[];villages:CatalogFacetCount[];price:{minMinor:number|null;maxMinor:number|null};inStockCount:number;};
export type CatalogFacetInput={query?:string|null;categorySlug?:string|null;producerId?:string|null;province?:string|null;district?:string|null;village?:string|null;minPriceMinor?:number|null;maxPriceMinor?:number|null;inStock?:boolean;featured?:boolean|null;};

function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function integer(value:unknown,label:string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}
function nullableInteger(value:unknown,label:string){if(value==null)return null;return integer(value,label);}
function text(value:unknown,label:string,max:number){if(typeof value!=='string')throw new Error(`${label} doğrulanamadı.`);const normalized=value.trim();if(!normalized||normalized.length>max||/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`${label} doğrulanamadı.`);return normalized;}
function counts(value:unknown,label:string){if(!Array.isArray(value)||value.length>500)throw new Error(`${label} doğrulanamadı.`);return value.map((row,index)=>{if(!record(row))throw new Error(`${label} ${index+1} doğrulanamadı.`);return{value:text(row.value,`${label} değeri`,160),count:integer(row.count,`${label} sayısı`)};});}
function categories(value:unknown){if(!Array.isArray(value)||value.length>500)throw new Error('Kategori facetleri doğrulanamadı.');return value.map((row,index)=>{if(!record(row))throw new Error(`${index+1}. kategori faceti doğrulanamadı.`);return{slug:text(row.slug,'Kategori slug',220),name:text(row.name,'Kategori adı',220),count:integer(row.count,'Kategori sayısı')};});}
function producers(value:unknown){if(!Array.isArray(value)||value.length>500)throw new Error('Üretici facetleri doğrulanamadı.');return value.map((row,index)=>{if(!record(row))throw new Error(`${index+1}. üretici faceti doğrulanamadı.`);return{id:text(row.id,'Üretici kimliği',80),name:text(row.name,'Üretici adı',240),count:integer(row.count,'Üretici sayısı')};});}
function normalize(value:unknown):CatalogSearchFacets{if(!record(value)||!record(value.price))throw new Error('Katalog filtre özeti doğrulanamadı.');const total=integer(value.total,'Sonuç sayısı');const inStockCount=integer(value.inStockCount,'Stok sonucu');if(inStockCount>total)throw new Error('Stok facet sayısı tutarsız.');return{total,categories:categories(value.categories),producers:producers(value.producers),provinces:counts(value.provinces,'İl facetleri'),districts:counts(value.districts,'İlçe facetleri'),villages:counts(value.villages,'Köy facetleri'),price:{minMinor:nullableInteger(value.price.minMinor,'Minimum fiyat'),maxMinor:nullableInteger(value.price.maxMinor,'Maksimum fiyat')},inStockCount};}
function minor(value:number|null|undefined,label:string){if(value==null)return null;if(!Number.isSafeInteger(value)||value<0)throw new Error(`${label} doğrulanamadı.`);return value;}

export async function getCatalogSearchFacets(input:CatalogFacetInput){
 const{data,error}=await supabase.rpc('catalog_search_facets_v1',{
  p_query:String(input.query||'').trim().slice(0,100)||null,
  p_category_slug:String(input.categorySlug||'').trim()||null,
  p_producer_id:String(input.producerId||'').trim()||null,
  p_province:String(input.province||'').trim()||null,
  p_district:String(input.district||'').trim()||null,
  p_village:String(input.village||'').trim()||null,
  p_min_price_minor:minor(input.minPriceMinor,'Minimum fiyat'),
  p_max_price_minor:minor(input.maxPriceMinor,'Maksimum fiyat'),
  p_in_stock:input.inStock===true,
  p_featured:input.featured==null?null:input.featured===true,
 });
 if(error)throw error;
 return normalize(data);
}
