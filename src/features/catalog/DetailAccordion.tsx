import React,{useEffect,useId,useRef,useState}from'react';
import{ChevronDown,type LucideIcon}from'lucide-react';

/**
 * The product page's sections: closed until tapped, each on its own.
 *
 * A tap anywhere on the header row opens the section in place, downwards,
 * and a second tap closes it. Opening one section never closes another and
 * the page is never scrolled for the customer: closing a section above the
 * one being opened, or an automatic scroll after the opening animation, is
 * what used to make an opened section "disappear" off the screen. The panel
 * has no height or opacity animation either, so its full text is there the
 * moment it opens. The single exception: when the header sits at the very
 * bottom of the screen, so the opened text would start below it, the page
 * moves just enough to show its first lines.
 *
 * Content mounts on first open (reviews are only fetched when a customer asks
 * for them) and stays mounted, so closing and reopening is instant.
 *
 * Accessibility: each header is a real button with aria-expanded and
 * aria-controls, named by its short title alone; the panel is a region
 * labelled by it. Only the reviews section has a one-line note under its
 * title, read once as the button's description.
 */

/** Opens a section from elsewhere on the page. */
export const OPEN_DETAIL_SECTION_EVENT='golden-oremar:open-detail-section';
export function openDetailSection(id:string){window.dispatchEvent(new CustomEvent(OPEN_DETAIL_SECTION_EVENT,{detail:{id}}));}

export function DetailAccordionGroup({children,className=''}:{children:React.ReactNode;className?:string}){
 return<div className={`go-detail-accordions ${className}`}>{children}</div>;
}

type Props={id:string;title:string;teaser?:string;icon?:LucideIcon;tone?:'default'|'gold';/** A slim row, e.g. delivery inside the buy box. */compact?:boolean;children:React.ReactNode};

export function DetailAccordion({id,title,teaser,icon:Icon,tone='default',compact=false,children}:Props){
 const[open,setOpen]=useState(false);
 const[mounted,setMounted]=useState(false);
 const panelRef=useRef<HTMLDivElement>(null);
 const revealRef=useRef(false);
 useEffect(()=>{const onOpen=(event:Event)=>{if((event as CustomEvent<{id?:string}>).detail?.id===id){setMounted(true);setOpen(true);}};window.addEventListener(OPEN_DETAIL_SECTION_EVENT,onOpen);return()=>window.removeEventListener(OPEN_DETAIL_SECTION_EVENT,onOpen);},[id]);
 // Only when the first lines of the opened text would start below the screen.
 useEffect(()=>{
  if(!open||!revealRef.current)return;revealRef.current=false;
  const panel=panelRef.current;if(!panel)return;
  const top=panel.getBoundingClientRect().top,limit=window.innerHeight-72;
  if(top>limit)window.scrollBy({top:top-limit,behavior:'auto'});
 },[open]);
 const reactId=useId().replace(/:/g,'');
 const panelId=`detail-panel-${id}-${reactId}`,headerId=`detail-header-${id}-${reactId}`,teaserId=`detail-teaser-${id}-${reactId}`;
 function toggle(){
  const opening=!open;
  if(opening){setMounted(true);revealRef.current=true;}
  setOpen(opening);
 }

 return<section className={`go-detail-accordion${open?' is-open':''}${tone==='gold'?' go-detail-accordion--gold':''}${compact?' go-detail-accordion--compact':''}`} data-accordion-id={id}>
  <h2 className="go-detail-accordion__heading">
   <button type="button" id={headerId} aria-expanded={open} aria-controls={panelId} aria-describedby={teaser?teaserId:undefined} onClick={toggle} className="go-detail-accordion__header">
    {Icon?<span className="go-detail-accordion__icon" aria-hidden="true"><Icon/></span>:null}
    <span className="go-detail-accordion__titles"><span className="go-detail-accordion__title">{title}</span>{teaser?<span id={teaserId} className="go-detail-accordion__teaser" aria-hidden="true">{teaser}</span>:null}</span>
    <ChevronDown aria-hidden="true" className="go-detail-accordion__chevron"/>
   </button>
  </h2>
  <div ref={panelRef} id={panelId} role="region" aria-labelledby={headerId} className="go-detail-accordion__panel" hidden={!open}>
   <div className="go-detail-accordion__body">{mounted?children:null}</div>
  </div>
 </section>;
}
