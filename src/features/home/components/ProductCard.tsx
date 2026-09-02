import{useId}from'react';
import{ChevronRight}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import{productHandlingLabel}from'../../catalog/productHandlingApi';
import{buildProductCardAccessibilityLabel}from'../../accessibility/productCardAccessibility';
import{buildProductUrl}from'../../navigation/appUrl';
import PremiumImage from'./PremiumImage';
import PriceDisplay from'./PriceDisplay';
import'./ProductCard.css';

function strongestSignal(item:CatalogItem){if(item.producer.originVerified)return'Menşe doğrulandı';if(item.handlingProfile.requiresColdChain)return'Soğuk zincir';if(item.stockMode==='preorder')return'Ön sipariş';if(item.stockMode==='seasonal')return'Mevsimlik';return productHandlingLabel(item.handlingProfile)||null;}
function ratingText(item:CatalogItem){if(item.reviewCount<1)return null;return`${item.averageRating.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1})} (${item.reviewCount.toLocaleString('tr-TR')})`;}

export default function ProductCard({item,onClick,eager=false}:{item:CatalogItem;onClick:()=>void;eager?:boolean}){
 const spokenId=useId();
 const signal=strongestSignal(item);
 const official=item.producer.storeKind==='official';
 const rating=ratingText(item);
 const compareMinor=typeof item.variant.compareAtPriceMinor==='number'&&Number.isSafeInteger(item.variant.compareAtPriceMinor)?item.variant.compareAtPriceMinor:null;
 const accessibleLabel=buildProductCardAccessibilityLabel({name:item.name,price:item.variant.priceMinor/100,currency:item.currency,compareAtPrice:compareMinor!==null?compareMinor/100:null,statuses:[rating?`${rating} puan ve değerlendirme`:null,official?'Resmi mağaza':null,signal]});
 const productImagePath=item.imagePath&&!item.imagePath.startsWith('brand/official-store/')?item.imagePath:null;
 return<article className="go-product-card-v2" data-product-id={item.id} data-product-reference={item.slug}>
  <span id={spokenId} className="sr-only">{accessibleLabel}</span>
  <a href={buildProductUrl(item.slug)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onClick();}} className="go-product-card-v2__button" aria-labelledby={spokenId} data-product-link="true">
   <PremiumImage src={productImagePath} alt={`${item.name} ürün fotoğrafı`} eager={eager} className="go-product-card-v2__media"/>
   <span className="go-product-card-v2__body" aria-hidden="true">
    <span className="go-product-card-v2__title">{item.name}</span>
    <PriceDisplay priceMinor={item.variant.priceMinor} currency={item.currency} className="go-product-card-v2__price"/>
   </span>
   <ChevronRight className="go-product-card-v2__chevron" aria-hidden="true"/>
  </a>
 </article>;
}
