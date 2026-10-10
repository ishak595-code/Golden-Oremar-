import{ArrowRight,Gift,MapPin}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import{buildProducerUrl,buildProductUrl}from'../../navigation/appUrl';
import{productMaker}from'../../catalog/productMakers';
import HomeImage from'./HomeImage';

/* Editorial home blocks (v5). Every product is still one link with one
   accessible name (see HOME_PRESTIGE_CONTRACT.md); these only vary how a
   showcase is laid out: a feature story, a horizontal rail, a producer strip
   and a gift panel around the classic rows. */

export function homePrice(minor:number,currency:string){const digits=minor%100===0?0:2;const amount=(minor/100).toLocaleString('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits});return currency.toUpperCase()==='TRY'?`${amount} TL`:`${amount} ${currency}`;}
function place(item:CatalogItem){return[item.producer?.village,item.producer?.district||item.producer?.province].filter(Boolean).join(', ');}
function open(event:React.MouseEvent,action:()=>void){if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();action();}

/** The brand line: the page's visible H1. */
const INTRO_LINE='Köyünden, üreticisinden, mevsiminde.';
/* The super admin's own line when one is written; the old default hero
   sentence ("…öne çıkan fırsat") is not a brand line, so it is not used. */
function introLine(line:string){const text=line.trim();return!text||/öne çıkan fırsat|öne çıkanlar\.?$/i.test(text)?INTRO_LINE:text;}
export function HomeBrandIntro({brand,line}:{brand:string;line:string}){line=introLine(line);
 return<header className="go-home-intro"><h1><span className="go-home-intro__brand">{brand}</span>{' '}<span className="go-home-intro__line">{line}</span></h1></header>;
}

/** The first product of a showcase told as a short story, large. */
export function HomeFeatureCard({item,label,onOpen}:{item:CatalogItem;label?:string|null;onOpen:()=>void}){
 const maker=productMaker(item.slug,item.makerName)||item.producer?.name||'';const where=place(item);const price=homePrice(item.variant.priceMinor,item.currency);
 return<li className="go-feature-v5" data-product-id={item.id}>
  <a href={buildProductUrl(item.slug)} onClick={event=>open(event,onOpen)} className="go-feature-v5__link" aria-label={`${item.name}, ${price}${maker?`, ${maker}`:''}`} data-product-link="true">
   <span className="go-feature-v5__media" aria-hidden="true"><HomeImage item={item} sizes="(min-width: 1024px) 480px, (min-width: 768px) 45vw, 92vw"/></span>
   <span className="go-feature-v5__copy" aria-hidden="true">
    {label?<span className="go-feature-v5__label">{label}</span>:null}
    <strong>{item.name}</strong>
    {item.shortDescription?<span className="go-feature-v5__story">{item.shortDescription}</span>:null}
    <span className="go-feature-v5__meta">{maker?<span>{maker}</span>:null}{where?<span><MapPin/>{where}</span>:null}</span>
    <span className="go-feature-v5__foot"><span className="go-feature-v5__price">{price}</span><span className="go-feature-v5__cta">İncele<ArrowRight/></span></span>
   </span>
  </a>
 </li>;
}

/** A horizontal, snapping rail of tall tiles. */
export function HomeRail({items,label,onOpen}:{items:CatalogItem[];label?:(item:CatalogItem)=>string|null;onOpen:(item:CatalogItem)=>void}){
 return<ul className="go-rail-v5 hide-scrollbar">
  {items.map(item=>{const price=homePrice(item.variant.priceMinor,item.currency);const tag=label?.(item)||null;const where=place(item);return<li key={item.id} className="go-rail-v5__item" data-product-id={item.id}>
   <a href={buildProductUrl(item.slug)} onClick={event=>open(event,()=>onOpen(item))} className="go-rail-v5__link" aria-label={`${item.name}, ${price}`} data-product-link="true">
    <span className="go-rail-v5__media" aria-hidden="true"><HomeImage item={item} sizes="(min-width: 1024px) 240px, 44vw"/>{tag?<span className="go-rail-v5__tag">{tag}</span>:null}</span>
    <span className="go-rail-v5__copy" aria-hidden="true"><strong>{item.name}</strong>{where?<span>{where}</span>:null}<b>{price}</b></span>
   </a>
  </li>;})}
 </ul>;
}

/** The people behind the products, from the products already on the page. */
export function HomeProducerStrip({items,onOpen}:{items:CatalogItem[];onOpen:(id:string)=>void}){
 /* One chip per maker (the official store lists many village makers under one
    store account), linking to the store that sells their products. */
 const seen=new Set<string>();
 const producers=items.flatMap(item=>{const name=productMaker(item.slug,item.makerName)||item.producer?.name||'';if(!name||!item.producer?.id||seen.has(name))return[];seen.add(name);return[{key:name,id:item.producer.id,name,where:place(item)||item.origin||'',product:item}];}).slice(0,10);
 if(producers.length<2)return null;
 const href=(id:string)=>{try{return buildProducerUrl(id);}catch{return'#';}};
 return<section className="go-home-section go-producers-v5" aria-labelledby="home-producers-heading">
  <div className="go-section-header"><div className="go-section-header__copy"><span className="go-section-header__eyebrow">Emeğin sahipleri</span><h2 id="home-producers-heading">Her ürünün arkasında bir isim</h2></div></div>
  <ul className="go-producers-v5__list hide-scrollbar">
   {producers.map(producer=><li key={producer.key}><a href={href(producer.id)} onClick={event=>open(event,()=>onOpen(producer.id))} className="go-producers-v5__chip" aria-label={`${producer.name}${producer.where?`, ${producer.where}`:''}`}>
    <span className="go-producers-v5__avatar" aria-hidden="true"><HomeImage item={producer.product} sizes="56px"/></span>
    <span className="go-producers-v5__copy" aria-hidden="true"><strong>{producer.name}</strong>{producer.where?<span>{producer.where}</span>:null}</span>
   </a></li>)}
  </ul>
 </section>;
}

/** Wraps the gift showcase in a quiet gold-edged panel. */
export function HomeGiftPanel({children}:{children:React.ReactNode}){
 return<div className="go-gift-v5"><span className="go-gift-v5__mark" aria-hidden="true"><Gift/></span><p className="go-gift-v5__note">Her ürün sayfasında <b>Hediye Et</b> ile alıcının adresine, notunuzla gönderilir.</p>{children}</div>;
}
