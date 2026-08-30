import React,{useId}from'react';
import{ChevronRight,MapPin}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import{productHandlingLabel}from'../../catalog/productHandlingApi';
import{buildProductCardAccessibilityLabel}from'../../accessibility/productCardAccessibility';
import{buildProductUrl}from'../../navigation/appUrl';
import PremiumImage from'./PremiumImage';
import PriceDisplay from'./PriceDisplay';
import ProductBadge from'./ProductBadge';
import'./homeProductRowLock.css';

function sourceLabel(item:CatalogItem){const place=[item.producer.village,item.producer.district,item.producer.province].find(value=>typeof value==='string'&&value.trim());return place?`${item.producer.name} · ${place}`:item.producer.name;}
function strongestSignal(item:CatalogItem){if(item.producer.originVerified)return{tone:'verified' as const,label:'Menşe doğrulandı'};if(item.handlingProfile.requiresColdChain)return{tone:'cold' as const,label:'Soğuk zincir'};if(item.stockMode==='preorder')return{tone:'preorder' as const,label:'Ön sipariş'};if(item.stockMode==='seasonal')return{tone:'seasonal' as const,label:'Mevsimlik'};const handling=productHandlingLabel(item.handlingProfile);return handling?{tone:'verified' as const,label:handling}:null;}

const contentGridStyle:React.CSSProperties={display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',columnGap:8,rowGap:6,alignItems:'center'};
const fullRowStyle:React.CSSProperties={gridColumn:'1 / -1'};
const signalsStyle:React.CSSProperties={gridColumn:'1',gridRow:'3',minWidth:0};
const footerStyle:React.CSSProperties={gridColumn:'2',gridRow:'3',marginTop:0,justifySelf:'end',alignSelf:'center'};

export default function ProductCard({item,onClick,eager=false}:{item:CatalogItem;onClick:()=>void;eager?:boolean}){
 const spokenId=useId();
 const signal=strongestSignal(item);
 const official=item.producer.storeKind==='official';
 const visualSignal=signal??(official?{tone:'official' as const,label:'Resmi mağaza'}:null);
 const compareMinor=typeof item.variant.compareAtPriceMinor==='number'&&Number.isSafeInteger(item.variant.compareAtPriceMinor)?item.variant.compareAtPriceMinor:null;
 const accessibleLabel=buildProductCardAccessibilityLabel({name:item.name,price:item.variant.priceMinor/100,currency:item.currency,compareAtPrice:compareMinor!==null?compareMinor/100:null,statuses:[official?'Resmi mağaza':null,signal?.label]});
 const productImagePath=item.imagePath&&!item.imagePath.startsWith('brand/official-store/')?item.imagePath:null;
 return<article className="go-product-card-v2" data-product-id={item.id} data-product-reference={item.slug}>
  <span id={spokenId} className="sr-only">{accessibleLabel}</span>
  <a href={buildProductUrl(item.slug)} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onClick();}} className="go-product-card-v2__button" aria-labelledby={spokenId} data-product-link="true" style={{cursor:'pointer',touchAction:'manipulation'}}>
   <PremiumImage src={productImagePath} alt={`${item.name} ürün fotoğrafı`} eager={eager} className="go-product-card-v2__media"/>
   <span className="go-product-card-v2__content" aria-hidden="true" style={contentGridStyle}>
    <span className="go-product-card-v2__title" style={fullRowStyle}>{item.name}</span>
    <span className="go-product-card-v2__source" style={fullRowStyle}><MapPin aria-hidden="true"/><span>{sourceLabel(item)}</span></span>
    <span className="go-product-card-v2__signals" style={signalsStyle}><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-brand-muted">{item.unitLabel||item.category.name}</span>{visualSignal?<ProductBadge tone={visualSignal.tone} label={visualSignal.label}/>:null}</span>
    <span className="go-product-card-v2__footer" style={footerStyle}><PriceDisplay priceMinor={item.variant.priceMinor} currency={item.currency}/><ChevronRight aria-hidden="true"/></span>
   </span>
  </a>
 </article>;
}
