import{useEffect,useMemo,useState}from'react';
import{ChevronRight}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import{buildProductCardAccessibilityLabel}from'../../accessibility/productCardAccessibility';
import{buildProductUrl}from'../../navigation/appUrl';
import'./ProductCard.css';

function formatMinor(value:number,currency:string){
 const normalized=currency.trim().toUpperCase();
 const amount=(value/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
 if(normalized==='TRY')return`${amount} TL`;
 try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:normalized,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);}catch{return`${amount} ${normalized}`;}
}

/**
 * Short place name for the row: district and province ("Yüksekova, Hakkâri").
 * The full origin ("Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri") cannot fit a
 * phone row beside a badge and was always cut. The full origin still goes to
 * screen readers through the accessible label.
 */
function compactRegion(region:string){
 const parts=region.split(',').map(part=>part.trim()).filter(Boolean);
 return parts.length>=3?`${parts[parts.length-2]}, ${parts[parts.length-1]}`:region;
}

/** Province alone ("Hakkâri"), for rows too narrow for district and province. */
function shortRegion(region:string){
 const parts=region.split(',').map(part=>part.trim()).filter(Boolean);
 return parts.length>=2?parts[parts.length-1]:region;
}

function regionLabel(item:CatalogItem){
 const direct=typeof item.origin==='string'&&item.origin.trim()?item.origin.trim():null;
 if(direct)return direct;
 return[item.producer.village,item.producer.district,item.producer.province].find(value=>typeof value==='string'&&value.trim())||item.producer.name;
}

function verificationLabel(item:CatalogItem){
 if(item.producer.originVerified)return'Menşei doğrulandı';
 if(item.producer.verified)return'Üretici doğrulandı';
 return null;
}

function optimizedCatalogImageUrl(src:string){
 try{
  const url=new URL(src);
  const marker='/storage/v1/object/public/';
  if(!url.pathname.includes(marker))return src;
  url.pathname=url.pathname.replace(marker,'/storage/v1/render/image/public/');
  url.searchParams.set('width','320');
  url.searchParams.set('quality','72');
  url.searchParams.set('resize','cover');
  return url.toString();
 }catch{return src;}
}

function ProductRowImage({src,eager}:{src:string|null|undefined;eager:boolean}){
 // Two-stage load. The transformed URL is tried first because it is a small
 // fraction of the original's bytes - the row thumbnail renders at 64-80px, so
 // shipping a full-size photo there is pure egress waste once real product
 // photography is uploaded.
 //
 // Image Transformation is a paid-plan Supabase feature. On a plan without it
 // the /render/image endpoint rejects the request, so on that first error the
 // component falls back to the original object URL rather than to an empty
 // placeholder. The placeholder is reserved for the case where the original
 // itself fails. This keeps images visible on every plan instead of silently
 // blanking the whole home screen when the transform is unavailable.
 const trimmed=typeof src==='string'?src.trim():'';
 const optimized=useMemo(()=>trimmed?optimizedCatalogImageUrl(trimmed):'',[trimmed]);
 const[stage,setStage]=useState<'optimized'|'original'|'failed'>('optimized');
 useEffect(()=>setStage('optimized'),[trimmed]);
 const current=stage==='optimized'?optimized:stage==='original'?trimmed:'';
 if(!current)return<span className="go-product-row-v4__placeholder rounded-xl w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0" aria-hidden="true"/>;
 return<img src={current} alt="" aria-hidden="true" loading={eager?'eager':'lazy'} fetchPriority={eager?'high':'auto'} decoding="async" onError={()=>setStage(prev=>prev==='optimized'&&optimized!==trimmed?'original':'failed')} className="go-product-row-v4__image object-cover rounded-xl w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0"/>;
}

export default function ProductCard({item,onClick,eager=false,merchandisingLabel=null}:{item:CatalogItem;onClick:()=>void;eager?:boolean;merchandisingLabel?:string|null}){
 const region=regionLabel(item);
 const verification=verificationLabel(item);
 const compareMinor=typeof item.variant.compareAtPriceMinor==='number'&&Number.isSafeInteger(item.variant.compareAtPriceMinor)?item.variant.compareAtPriceMinor:null;
 const accessibleLabel=buildProductCardAccessibilityLabel({name:item.name,price:item.variant.priceMinor/100,currency:item.currency,compareAtPrice:compareMinor!==null?compareMinor/100:null,statuses:[merchandisingLabel,item.producer.name,region,verification]});
 return<li className="go-product-row-v4__item w-full" data-product-id={item.id} data-product-reference={item.slug} data-row-layout="horizontal-list" data-home-row-contract="single-link-v4" data-native-feature-marker="go-product-card-v2">
  <a href={buildProductUrl(item.slug)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onClick();}} className="go-product-row-v4 w-full flex flex-row items-center justify-between hover:bg-[#112217] transition-all cursor-pointer" aria-label={accessibleLabel} data-product-link="true">
   <ProductRowImage src={item.imagePath} eager={eager}/>
   <span className="go-product-row-v4__middle min-w-0 flex-1" aria-hidden="true">
    <span className="go-product-row-v4__title">{item.name}</span>
    <span className="go-product-row-v4__meta text-sm text-gray-400">
     {merchandisingLabel?<span className="go-product-row-v4__badge">{merchandisingLabel}</span>:null}
     <span className="go-product-row-v4__region"><span className="go-product-row-v4__region-full">{compactRegion(region)}</span><span className="go-product-row-v4__region-short">{shortRegion(region)}</span></span>
     {verification?<span className="go-product-row-v4__verification">{verification}</span>:null}
    </span>
   </span>
   <span className="go-product-row-v4__tail flex flex-shrink-0 items-center" aria-hidden="true">
    <span className="go-product-row-v4__price">{formatMinor(item.variant.priceMinor,item.currency)}</span>
    <ChevronRight className="go-product-row-v4__chevron" aria-hidden="true"/>
   </span>
  </a>
 </li>;
}
