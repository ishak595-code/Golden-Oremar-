import{useState}from'react';
import type{CatalogItem}from'../../catalog/api';
import ProductArtwork,{isBrandFallbackImage,shippedProductPhoto}from'../../catalog/ProductArtwork';

/**
 * Home photography: AVIF with a WebP fallback in sizes from 160 to 960 px
 * (AVIF 160-960, WebP 160/320 next to the 480/1200 originals;
 * scripts/product-photos/variants.mjs), so a phone row downloads ~6 KB and
 * the hero only what the screen needs. A real store photo (Supabase) wins
 * over the shipped one; with neither, the drawn artwork.
 */
const WIDTHS=[160,320,640,960];

function shippedBase(slug:string){const large=shippedProductPhoto(slug,'large');return large?large.replace(/\.webp$/,''):null;}

function realPhoto(item:Pick<CatalogItem,'imagePath'>){const src=typeof item.imagePath==='string'?item.imagePath.trim():'';return src&&!isBrandFallbackImage(src)?src:'';}

type Props={item:CatalogItem;sizes:string;eager?:boolean;className?:string;artwork?:'tile'|'card'|'hero'};
export default function HomeImage({item,sizes,eager=false,className='',artwork='card'}:Props){
 const[failed,setFailed]=useState(false);
 const own=realPhoto(item);const base=shippedBase(item.slug);
 const common={alt:'',decoding:'async' as const,loading:eager?'eager' as const:'lazy' as const,fetchPriority:eager?'high' as const:'auto' as const,draggable:false,onError:()=>setFailed(true),className:`go-home-img ${className}`.trim()};
 if(!failed&&own)return<img src={own} {...common}/>;
 if(!failed&&base)return<picture className="go-home-picture">
  <source type="image/avif" srcSet={WIDTHS.map(w=>`${base}-${w}.avif ${w}w`).join(', ')} sizes={sizes}/>
  <img src={`${base}-320.webp`} srcSet={`${base}-160.webp 160w, ${base}-320.webp 320w, ${base}-480.webp 480w, ${base}.webp 1200w`} sizes={sizes} {...common}/>
 </picture>;
 return<ProductArtwork name={item.name} slug={null} categorySlug={item.category?.slug} categoryName={item.category?.name} productType={item.handlingProfile?.productType} safetyClass={item.handlingProfile?.safetyClass} variant={artwork} className={className}/>;
}
