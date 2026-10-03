import React,{useCallback,useEffect,useRef,useState}from'react';
import{ChevronLeft,ChevronRight,ZoomIn}from'lucide-react';
import ProductArtwork,{shippedProductPhoto}from'./ProductArtwork';
import ProductVideo from'../media/ProductVideo';

/**
 * The product page slider.
 *
 * Swipe on a phone (CSS scroll snap, so it follows the finger natively),
 * arrows on larger screens, arrow keys when focused, and a thin segment
 * bar directly under the image (one segment per slide, tappable). Real photos
 * come first and open full screen on tap. When a product has no photo yet,
 * its shipped representative photo (or drawn artwork) takes the first slide.
 * The second slide is the product's origin photo (the mountains, the drying,
 * the bez kese being filled) when one has been shipped; there are no empty
 * or placeholder slides.
 *
 * The image is as large as the layout allows (edge to edge on a phone) and
 * the shipped photos are served from a srcset (480 / 1200 px), so a phone's
 * high-density screen gets the sharp file; nothing is enlarged past its source.
 */

export type GallerySlide=
 |{kind:'photo';key:string;src:string;alt:string;path:string}
 |{kind:'artwork';key:string}
 |{kind:'scene';key:string;src:string;alt:string}
 |{kind:'video';key:string;url:string};

type Props={
 slides:GallerySlide[];
 productName:string;
 categorySlug?:string|null;
 categoryName?:string|null;
 productType?:string|null;
 safetyClass?:string|null;
 onOpenPhoto:(path:string)=>void;
 onSlideChange?:(slide:GallerySlide)=>void;
 /** For the shipped representative photo, when the product has no photo of its own. */
 productSlug?:string|null;
};

/** 480 and 1200 px versions of a shipped photo (scripts/product-photos/import.mjs writes both). */
function shippedSrcSet(src:string){return/^\/product-photos\/.+\.webp$/.test(src)&&!src.endsWith('-480.webp')?`${src.replace(/\.webp$/,'-480.webp')} 480w, ${src} 1200w`:undefined;}
const SIZES='(min-width: 1024px) 640px, 100vw';

export default function ProductGallery({slides:inputSlides,productName,categorySlug,categoryName,productType,safetyClass,onOpenPhoto,onSlideChange,productSlug}:Props){
 const trackRef=useRef<HTMLDivElement>(null);
 const[index,setIndex]=useState(0);
 const[failed,setFailed]=useState<Record<string,true>>({});
 // An origin photo that fails to load is dropped, never left as an empty slide.
 const slides=inputSlides.filter(slide=>slide.kind!=='scene'||!failed[slide.key]);
 const count=slides.length;

 useEffect(()=>{const track=trackRef.current;if(track)track.scrollTo({left:0});setIndex(0);},[slides.map(slide=>slide.key).join('|')]);
 useEffect(()=>{const slide=slides[index];if(slide)onSlideChange?.(slide);},[index]);// eslint-disable-line react-hooks/exhaustive-deps

 const onScroll=useCallback(()=>{
  const track=trackRef.current;if(!track||!track.clientWidth)return;
  const next=Math.round(track.scrollLeft/track.clientWidth);
  setIndex(current=>next!==current&&next>=0&&next<count?next:current);
 },[count]);

 function goTo(next:number){
  const track=trackRef.current;if(!track)return;
  const target=(next+count)%count;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  track.scrollTo({left:target*track.clientWidth,behavior:reduce?'auto':'smooth'});
  setIndex(target);
 }

 function onKeyDown(event:React.KeyboardEvent){
  if(event.key==='ArrowRight'){event.preventDefault();goTo(index+1);}
  else if(event.key==='ArrowLeft'){event.preventDefault();goTo(index-1);}
 }

 const photoSlides=slides.map((slide,position)=>({slide,position})).filter(entry=>entry.slide.kind==='photo'&&!failed[entry.slide.key]);
 // Thumbnails show at a glance that there are more photos (Baymard: hidden
 // extra images are often missed on mobile). Only for two or more photos.
 const thumbs=photoSlides.length>1?<div className="go-gallery__thumbs" role="group" aria-label="Ürün fotoğrafları">{photoSlides.map(({slide,position})=>slide.kind==='photo'?<button type="button" key={`thumb:${slide.key}`} onClick={()=>goTo(position)} aria-label={`${position+1}. görsele git`} aria-current={position===index?'true':undefined} className={`go-gallery__thumb${position===index?' is-active':''}`}><img src={slide.src} alt="" loading="lazy" decoding="async"/></button>:null)}</div>:null;
 return<><section className="go-gallery" aria-roledescription="görsel kaydırıcı" aria-label={`${productName} görselleri`} onKeyDown={onKeyDown}>
  <div ref={trackRef} className="go-gallery__track" onScroll={onScroll} tabIndex={0} aria-label={count>1?'Kaydırarak veya ok tuşlarıyla gezinin':undefined}>
   {slides.map((slide,position)=><div key={slide.key} className={`go-gallery__slide go-gallery__slide--${slide.kind}`} role="group" aria-roledescription="slayt" aria-label={`Fotoğraf ${position+1} / ${count}`} aria-hidden={position!==index?true:undefined} inert={position!==index?true:undefined}>
    {slide.kind==='photo'&&!failed[slide.key]?<button type="button" className="go-gallery__photo" onClick={()=>onOpenPhoto(slide.path)} aria-label={`${productName} görselini tam ekran aç`} tabIndex={position===index?0:-1}>
     <img src={slide.src} alt={slide.alt} loading={position===0?'eager':'lazy'} fetchPriority={position===0?'high':'auto'} decoding="async" onError={()=>setFailed(current=>({...current,[slide.key]:true}))}/>
     <span className="go-gallery__zoom" aria-hidden="true"><ZoomIn/></span>
    </button>:null}
    {slide.kind==='artwork'||(slide.kind==='photo'&&failed[slide.key])?<ProductArtwork name={productName} categorySlug={categorySlug} categoryName={categoryName} productType={productType} safetyClass={safetyClass} variant="hero" sizes={SIZES} slug={productSlug} label={shippedProductPhoto(productSlug)?productName:`${productName} için çizim görsel; ürün fotoğrafı yakında eklenecek`}/>:null}
    {slide.kind==='video'?<div className="go-gallery__video"><ProductVideo url={slide.url} title={productName} allowExternalLink/></div>:null}
    {slide.kind==='scene'&&!failed[slide.key]?<div className="go-gallery__scene"><img src={slide.src} srcSet={shippedSrcSet(slide.src)} sizes={SIZES} alt={slide.alt} loading="lazy" decoding="async" onError={()=>setFailed(current=>({...current,[slide.key]:true}))}/></div>:null}
   </div>)}
  </div>
  {count>1?<>
   <button type="button" className="go-gallery__arrow go-gallery__arrow--prev" onClick={()=>goTo(index-1)} aria-label="Önceki slayt"><ChevronLeft aria-hidden="true"/></button>
   <button type="button" className="go-gallery__arrow go-gallery__arrow--next" onClick={()=>goTo(index+1)} aria-label="Sonraki slayt"><ChevronRight aria-hidden="true"/></button>
   <div className="go-gallery__progress" role="group" aria-label="Fotoğraflar">{slides.map((slide,position)=><button type="button" key={slide.key} onClick={()=>goTo(position)} aria-label={`Fotoğraf ${position+1} / ${count}`} aria-current={position===index?'true':undefined} className={`go-gallery__segment${position===index?' is-active':''}`}><span aria-hidden="true"/></button>)}</div>
   <span className="sr-only" aria-live="polite">{`Fotoğraf ${index+1} / ${count}`}</span>
  </>:null}
 </section>{thumbs}</>;
}
