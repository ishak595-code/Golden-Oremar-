import{useCallback,useEffect,useRef,useState}from'react';
import{ArrowRight,X}from'lucide-react';
import type{CatalogItem}from'../../catalog/api';
import ProductArtwork,{isBrandFallbackImage}from'../../catalog/ProductArtwork';
import{buildProductUrl}from'../../navigation/appUrl';
import{currentSeason}from'../../customer-experience/customerCopy';
import{prefersReducedMotion}from'../../../lib/reducedMotion';

/**
 * "Bugünün Önerisi": a compact band at the top of the home page, like the
 * campaign bands of the big shopping apps, so the categories stay in view.
 * One product per slide; it moves on by itself every 10 seconds, can be
 * swiped and closed (closed for the rest of the day). It turns quietly:
 * there is no play/pause control on the band.
 *
 * Accessibility: a labelled carousel region; each slide is one link with the
 * product name and price. Slides are never hidden from screen readers while
 * the band turns: a slide TalkBack is reading stays in place even when the
 * band has moved on (hiding it made "what I touched disappear"). It never moves while the visitor touches it, while
 * focus is inside it, when the page is hidden, or when reduced motion is on
 * (it then stays still). Once the visitor swipes, taps or focuses it, it
 * stops turning for the rest of the visit, which is the pause mechanism that
 * WCAG 2.2.2 asks for, without a button on the band.
 */
const INTERVAL_MS=10_000;
const CLOSED_KEY='golden-oremar:home-spotlight-closed';
const today=()=>new Date().toISOString().slice(0,10);
function closedToday(){try{return localStorage.getItem(CLOSED_KEY)===today();}catch{return false;}}

function priceText(minor:number,currency:string){const digits=minor%100===0?0:2;const amount=(minor/100).toLocaleString('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits});return currency.toUpperCase()==='TRY'?`${amount} TL`:`${amount} ${currency}`;}

function SlideImage({item}:{item:CatalogItem}){
 const photo=typeof item.imagePath==='string'&&item.imagePath.trim()&&!isBrandFallbackImage(item.imagePath)?item.imagePath.trim():'';
 const[failed,setFailed]=useState(false);
 return photo&&!failed?<img src={photo} alt="" decoding="async" onError={()=>setFailed(true)}/>:<ProductArtwork name={item.name} slug={item.slug} categorySlug={item.category?.slug} categoryName={item.category?.name} productType={item.handlingProfile?.productType} safetyClass={item.handlingProfile?.safetyClass} variant="card"/>;
}

type Props={items:CatalogItem[];title:string;buttonText:string;onOpen:(item:CatalogItem)=>void};
export default function HomeSpotlight({items,title,buttonText,onOpen}:Props){
 const season=currentSeason();
 const heading=title.trim()||'Bugünün Önerisi';
 const cta=buttonText.trim()||'Öneriyi Keşfet';
 const trackRef=useRef<HTMLDivElement>(null);
 const[index,setIndex]=useState(0);
 const[closed,setClosed]=useState(closedToday);
 const[paused,setPaused]=useState(()=>prefersReducedMotion());
 const stop=()=>{setPaused(true);};
 const[held,setHeld]=useState(false);
 const count=items.length;

 const goTo=useCallback((next:number)=>{const track=trackRef.current;if(!track)return;const target=(next+count)%count;track.scrollTo({left:target*track.clientWidth,behavior:prefersReducedMotion()?'auto':'smooth'});},[count]);
 useEffect(()=>{
  if(paused||held||count<2||closed)return;
  const timer=window.setInterval(()=>{if(!document.hidden)goTo(index+1);},INTERVAL_MS);
  return()=>window.clearInterval(timer);
 },[paused,held,count,closed,index,goTo]);

 if(closed||!count)return null;
 function close(){try{localStorage.setItem(CLOSED_KEY,today());}catch{/* the band still closes for this visit */}setClosed(true);}
 const onScroll=()=>{const track=trackRef.current;if(!track||!track.clientWidth)return;const next=Math.round(track.scrollLeft/track.clientWidth);if(next!==index)setIndex(Math.min(count-1,Math.max(0,next)));};

 return<section className="go-home-section go-spotlight" aria-roledescription="carousel" aria-label={`${heading}, ${season.name} seçkisi`} onPointerEnter={()=>setHeld(true)} onPointerLeave={()=>setHeld(false)} onTouchStart={()=>{setHeld(true);stop();}} onTouchEnd={()=>window.setTimeout(()=>setHeld(false),1500)} onFocus={()=>{setHeld(true);stop();}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setHeld(false);}}>
  <div ref={trackRef} className="go-spotlight__track hide-scrollbar" onScroll={onScroll} aria-live={paused||held?'polite':'off'}>
   {items.map((item,position)=>{const price=priceText(item.variant.priceMinor,item.currency);return<div key={item.id} className="go-spotlight__slide" role="group" aria-roledescription="slide" aria-label={`${position+1} / ${count}`}>
    <a href={buildProductUrl(item.slug)} tabIndex={position===index?0:-1} className="go-spotlight__card" data-home-spotlight={item.slug} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onOpen(item);}}>
     <span className="go-spotlight__copy">
      <span className="go-spotlight__eyebrow">{heading}</span>
      <strong className="go-spotlight__name">{item.name}</strong>
      <span className="go-spotlight__foot"><span className="go-spotlight__price">{price}</span><span className="go-spotlight__cta">{cta}<ArrowRight/></span></span>
     </span>
     <span className="go-spotlight__media" aria-hidden="true"><SlideImage item={item}/></span>
    </a>
   </div>;})}
  </div>
  <button type="button" className="go-spotlight__close" onClick={close} aria-label="Önerileri bugünlük kapat"><X aria-hidden="true"/></button>
  {count>1?<span className="go-spotlight__count" aria-hidden="true">{index+1}/{count}</span>:null}
 </section>;
}
