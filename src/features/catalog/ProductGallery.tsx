import React,{useCallback,useEffect,useRef,useState}from'react';
import{ChevronLeft,ChevronRight,MapPin,Mountain,Quote,ZoomIn}from'lucide-react';
import ProductArtwork,{shippedProductPhoto}from'./ProductArtwork';

/**
 * The product page slider.
 *
 * Swipe on a phone (CSS scroll snap, so it follows the finger natively),
 * arrows and dots on larger screens, arrow keys when focused. Real photos
 * come first and open full screen on tap. When a product has no photo yet,
 * its drawn artwork takes the first slide. Two more slides tell where it
 * comes from and the first line of its story, so the slider always has
 * something real to say.
 */

export type GallerySlide=
 |{kind:'photo';key:string;src:string;alt:string;path:string}
 |{kind:'artwork';key:string}
 |{kind:'origin';key:string;origin:string;producer:string}
 |{kind:'story';key:string;kicker:string;line:string};

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

export default function ProductGallery({slides,productName,categorySlug,categoryName,productType,safetyClass,onOpenPhoto,onSlideChange,productSlug}:Props){
 const trackRef=useRef<HTMLDivElement>(null);
 const[index,setIndex]=useState(0);
 const[failed,setFailed]=useState<Record<string,true>>({});
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

 return<section className="go-gallery" aria-roledescription="görsel kaydırıcı" aria-label={`${productName} görselleri`} onKeyDown={onKeyDown}>
  <div ref={trackRef} className="go-gallery__track" onScroll={onScroll} tabIndex={0} aria-label={count>1?'Kaydırarak veya ok tuşlarıyla gezinin':undefined}>
   {slides.map((slide,position)=><div key={slide.key} className={`go-gallery__slide go-gallery__slide--${slide.kind}`} role="group" aria-roledescription="slayt" aria-label={`${position+1} / ${count}`} aria-hidden={position!==index?true:undefined}>
    {slide.kind==='photo'&&!failed[slide.key]?<button type="button" className="go-gallery__photo" onClick={()=>onOpenPhoto(slide.path)} aria-label={`${productName} görselini tam ekran aç`} tabIndex={position===index?0:-1}>
     <img src={slide.src} alt={slide.alt} loading={position===0?'eager':'lazy'} fetchPriority={position===0?'high':'auto'} decoding="async" onError={()=>setFailed(current=>({...current,[slide.key]:true}))}/>
     <span className="go-gallery__zoom" aria-hidden="true"><ZoomIn/></span>
    </button>:null}
    {slide.kind==='artwork'||(slide.kind==='photo'&&failed[slide.key])?<ProductArtwork name={productName} categorySlug={categorySlug} categoryName={categoryName} productType={productType} safetyClass={safetyClass} variant="hero" slug={productSlug} label={shippedProductPhoto(productSlug)?`${productName}, temsili görsel`:`${productName} için çizim görsel; ürün fotoğrafı yakında eklenecek`}/>:null}
    {slide.kind==='origin'?<div className="go-gallery__story-card go-gallery__story-card--origin">
     <Mountain aria-hidden="true" className="go-gallery__story-mark"/>
     <span className="go-gallery__eyebrow"><MapPin aria-hidden="true"/>Kökeni</span>
     <strong>{slide.origin}</strong>
     {slide.producer?<span className="go-gallery__story-sub">{slide.producer} tarafından, kayıtlı menşeiyle</span>:null}
    </div>:null}
    {slide.kind==='story'?<div className="go-gallery__story-card go-gallery__story-card--story">
     <Quote aria-hidden="true" className="go-gallery__story-mark"/>
     <span className="go-gallery__eyebrow">{slide.kicker||'Ürünün hikâyesi'}</span>
     <strong>{slide.line}</strong>
     <span className="go-gallery__story-sub">Hikâyenin tamamı aşağıda, "Ürün Hikâyesi" bölümünde.</span>
    </div>:null}
   </div>)}
  </div>
  {count>1?<>
   <button type="button" className="go-gallery__arrow go-gallery__arrow--prev" onClick={()=>goTo(index-1)} aria-label="Önceki slayt"><ChevronLeft aria-hidden="true"/></button>
   <button type="button" className="go-gallery__arrow go-gallery__arrow--next" onClick={()=>goTo(index+1)} aria-label="Sonraki slayt"><ChevronRight aria-hidden="true"/></button>
   <div className="go-gallery__footer">
    <span className="go-gallery__counter" aria-live="polite">{index+1} / {count}</span>
    <div className="go-gallery__dots">{slides.map((slide,position)=><button type="button" key={slide.key} onClick={()=>goTo(position)} aria-label={`${position+1}. slayta git`} aria-current={position===index?'true':undefined} className={`go-gallery__dot${position===index?' is-active':''}`}/>)}</div>
   </div>
  </>:null}
 </section>;
}
