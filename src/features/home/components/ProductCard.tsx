import React,{useId}from'react';
import{ChevronRight,MapPin}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import{productHandlingLabel}from'../../catalog/productHandlingApi';
import{buildProductCardAccessibilityLabel}from'../../accessibility/productCardAccessibility';
import PremiumImage from'./PremiumImage';
import PriceDisplay from'./PriceDisplay';
import ProductBadge from'./ProductBadge';

function sourceLabel(item:CatalogItem){const place=[item.producer.village,item.producer.district,item.producer.province].find(value=>typeof value==='string'&&value.trim());return place?`${item.producer.name} · ${place}`:item.producer.name;}
function strongestSignal(item:CatalogItem){if(item.producer.originVerified)return{tone:'verified' as const,label:'Menşe doğrulandı'};if(item.handlingProfile.requiresColdChain)return{tone:'cold' as const,label:'Soğuk zincir'};if(item.stockMode==='preorder')return{tone:'preorder' as const,label:'Ön sipariş'};if(item.stockMode==='seasonal')return{tone:'seasonal' as const,label:'Mevsimlik'};const handling=productHandlingLabel(item.handlingProfile);return handling?{tone:'verified' as const,label:handling}:null;}

export default function ProductCard({item,onClick,eager=false}:{item:CatalogItem;onClick:()=>void;eager?:boolean}){
 const spokenId=useId();
 const signal=strongestSignal(item);
 const official=item.producer.storeKind==='official';
 const compareMinor=typeof item.variant.compareAtPriceMinor==='number'&&Number.isSafeInteger(item.variant.compareAtPriceMinor)?item.variant.compareAtPriceMinor:null;
 const accessibleLabel=buildProductCardAccessibilityLabel({name:item.name,price:item.variant.priceMinor/100,currency:item.currency,compareAtPrice:compareMinor!==null?compareMinor/100:null,statuses:[official?'Resmi mağaza':null,signal?.label]});
 return<article className="go-product-card-v2" aria-labelledby={spokenId} data-product-id={item.id} data-product-reference={item.slug}>
  <span id={spokenId} className="sr-only">{accessibleLabel}</span>
  <button type="button" onClick={onClick} className="go-product-card-v2__button" aria-labelledby={spokenId}>
   <PremiumImage src={item.imagePath} alt={`${item.name} ürün görseli`} eager={eager} className="go-product-card-v2__media"/>
   <span className="go-product-card-v2__content" aria-hidden="true">
    <span className="go-product-card-v2__title">{item.name}</span>
    <span className="go-product-card-v2__source"><MapPin aria-hidden="true"/><span>{sourceLabel(item)}</span></span>
    <span className="go-product-card-v2__signals">{official?<ProductBadge tone="official" label="Resmi mağaza"/>:signal?<ProductBadge tone={signal.tone} label={signal.label}/>:null}{official&&signal?<ProductBadge tone={signal.tone} label={signal.label}/>:null}</span>
    <span className="go-product-card-v2__footer"><PriceDisplay priceMinor={item.variant.priceMinor} currency={item.currency}/><ChevronRight aria-hidden="true"/></span>
   </span>
  </button>
 </article>;
}
