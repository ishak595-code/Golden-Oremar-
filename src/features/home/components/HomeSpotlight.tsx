import{useState}from'react';
import{ArrowRight}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import ProductArtwork,{isBrandFallbackImage}from'../../catalog/ProductArtwork';
import{productMaker}from'../../catalog/productMakers';
import{buildProductUrl}from'../../navigation/appUrl';
import{currentSeason,custom}from'../../customer-experience/customerCopy';

function priceText(minor:number,currency:string){const digits=minor%100===0?0:2;const amount=(minor/100).toLocaleString('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits});return currency.toUpperCase()==='TRY'?`${amount} TL`:`${amount} ${currency}`;}

type Props={item:CatalogItem;title:string;subtitle:string;buttonText:string;onOpen:()=>void};
export default function HomeSpotlight({item,title,subtitle,buttonText,onOpen}:Props){
 const season=currentSeason();
 const photo=typeof item.imagePath==='string'&&item.imagePath.trim()&&!isBrandFallbackImage(item.imagePath)?item.imagePath.trim():'';
 const[photoFailed,setPhotoFailed]=useState(false);
 const maker=productMaker(item.slug,item.makerName);
 const note=custom(subtitle)||item.shortDescription||'';
 const price=priceText(item.variant.priceMinor,item.currency);
 const heading=title.trim()||'Bugünün Önerisi';
 return<section className="go-home-section go-spotlight" aria-labelledby="home-spotlight-title" data-home-spotlight={item.slug}>
  <a href={buildProductUrl(item.slug)} className="go-spotlight__card" onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onOpen();}} aria-label={`${heading}: ${item.name}, ${price}${maker?`, üreten ${maker}`:''}`}>
   <span className="go-spotlight__media" aria-hidden="true">
    {photo&&!photoFailed?<img src={photo} alt="" loading="eager" fetchPriority="high" decoding="async" onError={()=>setPhotoFailed(true)}/>:<ProductArtwork name={item.name} slug={item.slug} categorySlug={item.category?.slug} categoryName={item.category?.name} productType={item.handlingProfile?.productType} safetyClass={item.handlingProfile?.safetyClass} variant="hero" sizes="(min-width: 768px) 720px, 100vw"/>}
    <span className="go-spotlight__badge">{season.name} seçkisi</span>
   </span>
   <span className="go-spotlight__copy" aria-hidden="true">
    <span className="go-spotlight__eyebrow">{heading}</span>
    <strong id="home-spotlight-title" className="go-spotlight__name">{item.name}</strong>
    {note?<span className="go-spotlight__note">{note}</span>:null}
    <span className="go-spotlight__foot">
     <span className="go-spotlight__price">{price}{maker?<small>{maker}</small>:null}</span>
     <span className="go-spotlight__cta">{buttonText.trim()||'Öneriyi Keşfet'}<ArrowRight/></span>
    </span>
   </span>
  </a>
 </section>;
}
