import{useId}from'react';
import{ChevronRight,MapPin,Star}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import{productHandlingLabel}from'../../catalog/productHandlingApi';
import{buildProductCardAccessibilityLabel}from'../../accessibility/productCardAccessibility';
import{buildProductUrl}from'../../navigation/appUrl';
import PremiumImage from'./PremiumImage';
import PriceDisplay from'./PriceDisplay';
import ProductBadge from'./ProductBadge';
import'./ProductCard.css';

function placeLabel(item:CatalogItem){return[item.producer.village,item.producer.district,item.producer.province].find(value=>typeof value==='string'&&value.trim())||null;}
function sourceLabel(item:CatalogItem){const place=placeLabel(item);return place?`${item.producer.name} · ${place}`:item.producer.name;}
function strongestSignal(item:CatalogItem){if(item.producer.originVerified)return{tone:'verified' as const,label:'Menşe doğrulandı'};if(item.producer.verified)return{tone:'verified' as const,label:'Üretici doğrulandı'};if(item.producer.storeKind==='official')return{tone:'official' as const,label:'Resmi mağaza'};if(item.handlingProfile.requiresColdChain)return{tone:'cold' as const,label:'Soğuk zincir'};if(item.stockMode==='preorder')return{tone:'preorder' as const,label:'Ön sipariş'};if(item.stockMode==='seasonal')return{tone:'seasonal' as const,label:'Mevsimlik'};const handling=productHandlingLabel(item.handlingProfile);return handling?{tone:'verified' as const,label:handling}:null;}
function ratingText(item:CatalogItem){if(item.reviewCount<1)return null;return`${item.averageRating.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} (${item.reviewCount.toLocaleString('tr-TR')})`;}

export default function ProductCard({item,onClick,eager=false}:{item:CatalogItem;onClick:()=>void;eager?:boolean}){
 const spokenId=useId();
 const signal=strongestSignal(item);
 const rating=ratingText(item);
 const detail=item.unitLabel||item.category.name;
 const compareMinor=typeof item.variant.compareAtPriceMinor==='number'&&Number.isSafeInteger(item.variant.compareAtPriceMinor)?item.variant.compareAtPriceMinor:null;
 const accessibleLabel=buildProductCardAccessibilityLabel({name:item.name,price:item.variant.priceMinor/100,currency:item.currency,compareAtPrice:compareMinor!==null?compareMinor/100:null,statuses:[sourceLabel(item),detail,rating?`${rating} puan ve değerlendirme`:null,signal?.label]});
 const productImagePath=item.imagePath&&!item.imagePath.startsWith('brand/official-store/')?item.imagePath:null;
 return<article className="go-product-card-v2" data-product-id={item.id} data-product-reference={item.slug} data-row-layout="marketplace">
  <span id={spokenId} className="sr-only">{accessibleLabel}</span>
  <a href={buildProductUrl(item.slug)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onClick();}} className="go-product-card-v2__button" aria-labelledby={spokenId} data-product-link="true">
   <PremiumImage src={productImagePath} alt={`${item.name} ürün fotoğrafı`} eager={eager} className="go-product-card-v2__media"/>
   <span className="go-product-card-v2__identity" aria-hidden="true">
    <span className="go-product-card-v2__title">{item.name}</span>
    <span className="go-product-card-v2__meta">
     <span className="go-product-card-v2__source"><MapPin aria-hidden="true"/><span>{sourceLabel(item)}</span></span>
     <span className="go-product-card-v2__detail">{detail}</span>
     <span className="go-product-card-v2__cue">{signal?<ProductBadge tone={signal.tone} label={signal.label}/>:rating?<><Star aria-hidden="true"/><span>{rating}</span></>:null}</span>
    </span>
   </span>
   <PriceDisplay priceMinor={item.variant.priceMinor} currency={item.currency} className="go-product-card-v2__price"/>
   <ChevronRight className="go-product-card-v2__chevron" aria-hidden="true"/>
  </a>
 </article>;
}
