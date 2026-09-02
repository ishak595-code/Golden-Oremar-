import{useEffect,useId,useState}from'react';
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

function ProductRowImage({src,alt,eager}:{src:string|null|undefined;alt:string;eager:boolean}){
 const[failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 const usable=typeof src==='string'&&src.trim().length>0&&!failed;
 if(!usable)return<span className="go-product-row-v4__placeholder rounded-xl w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0" aria-hidden="true"/>;
 return<img src={src} alt={alt} loading={eager?'eager':'lazy'} fetchPriority={eager?'high':'auto'} decoding="async" onError={()=>setFailed(true)} className="go-product-row-v4__image object-cover rounded-xl w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0"/>;
}

export default function ProductCard({item,onClick,eager=false}:{item:CatalogItem;onClick:()=>void;eager?:boolean}){
 const spokenId=useId();
 const region=regionLabel(item);
 const verification=verificationLabel(item);
 const meta=[region,verification].filter(Boolean).join(' · ');
 const compareMinor=typeof item.variant.compareAtPriceMinor==='number'&&Number.isSafeInteger(item.variant.compareAtPriceMinor)?item.variant.compareAtPriceMinor:null;
 const accessibleLabel=buildProductCardAccessibilityLabel({name:item.name,price:item.variant.priceMinor/100,currency:item.currency,compareAtPrice:compareMinor!==null?compareMinor/100:null,statuses:[item.producer.name,region,verification]});
 return<article role="listitem" className="go-product-row-v4__item w-full" data-product-id={item.id} data-product-reference={item.slug} data-row-layout="horizontal-list" data-native-feature-marker="go-product-card-v2">
  <span id={spokenId} className="sr-only">{accessibleLabel}</span>
  <a href={buildProductUrl(item.slug)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onClick();}} className="go-product-row-v4 w-full flex flex-row items-center justify-between hover:bg-[#112217] transition-all cursor-pointer" aria-labelledby={spokenId} data-product-link="true">
   <ProductRowImage src={item.imagePath} alt={`${item.name} ürün fotoğrafı`} eager={eager}/>
   <span className="go-product-row-v4__middle min-w-0 flex-1">
    <span className="go-product-row-v4__title">{item.name}</span>
    <span className="go-product-row-v4__meta text-sm text-gray-400">{meta}</span>
   </span>
   <span className="go-product-row-v4__tail flex flex-shrink-0 items-center">
    <span className="go-product-row-v4__price">{formatMinor(item.variant.priceMinor,item.currency)}</span>
    <ChevronRight className="go-product-row-v4__chevron" aria-hidden="true"/>
   </span>
  </a>
 </article>;
}
