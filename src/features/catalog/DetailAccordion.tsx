import React,{createContext,useCallback,useContext,useId,useRef,useState}from'react';
import{ChevronDown,type LucideIcon}from'lucide-react';

/**
 * The product page's sections: closed until tapped, one open at a time.
 *
 * Opening a section closes the one before it and brings the new one into
 * view, so the page reads as one connected story instead of a long wall of
 * text. Content mounts on first open (recommendations and reviews are only
 * fetched when a customer asks for them) and stays mounted afterwards, so
 * closing and reopening is instant.
 *
 * Accessibility: each header is a real button with aria-expanded and
 * aria-controls; the panel is a labelled region. Screen readers hear
 * "Ürün Özellikleri, düğme, daraltılmış" and the teaser line as its
 * description.
 */

type GroupState={open:string|null;toggle:(id:string)=>void};
const GroupContext=createContext<GroupState|null>(null);

export function DetailAccordionGroup({children,initialOpen=null,className=''}:{children:React.ReactNode;initialOpen?:string|null;className?:string}){
 const[open,setOpen]=useState<string|null>(initialOpen);
 const toggle=useCallback((id:string)=>setOpen(current=>current===id?null:id),[]);
 return<GroupContext.Provider value={{open,toggle}}><div className={`go-detail-accordions ${className}`}>{children}</div></GroupContext.Provider>;
}

type Props={id:string;title:string;teaser?:string;icon?:LucideIcon;tone?:'default'|'gold';children:React.ReactNode};

export function DetailAccordion({id,title,teaser,icon:Icon,tone='default',children}:Props){
 const group=useContext(GroupContext);
 const[localOpen,setLocalOpen]=useState(false);
 const open=group?group.open===id:localOpen;
 const[mounted,setMounted]=useState(open);
 const headerRef=useRef<HTMLButtonElement>(null);
 const reactId=useId().replace(/:/g,'');
 const panelId=`detail-panel-${id}-${reactId}`,headerId=`detail-header-${id}-${reactId}`,teaserId=`detail-teaser-${id}-${reactId}`;
 function toggle(){
  const opening=!open;
  if(opening)setMounted(true);
  if(group)group.toggle(id);else setLocalOpen(opening);
  if(opening){
   // Wait for the previous section to start closing, then keep the header
   // of the opened one in view. Respect reduced motion.
   window.setTimeout(()=>{
    const header=headerRef.current;if(!header)return;
    const top=header.getBoundingClientRect().top;
    if(top<72||top>window.innerHeight*0.6){
     const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
     window.scrollTo({top:window.scrollY+top-84,behavior:reduce?'auto':'smooth'});
    }
   },230);
  }
 }
 return<section className={`go-detail-accordion${open?' is-open':''}${tone==='gold'?' go-detail-accordion--gold':''}`} data-accordion-id={id}>
  <h2 className="go-detail-accordion__heading">
   <button ref={headerRef} type="button" id={headerId} aria-expanded={open} aria-controls={panelId} aria-describedby={teaser?teaserId:undefined} onClick={toggle} className="go-detail-accordion__header">
    {Icon?<span className="go-detail-accordion__icon" aria-hidden="true"><Icon/></span>:null}
    <span className="go-detail-accordion__titles"><span className="go-detail-accordion__title">{title}</span>{teaser?<span id={teaserId} className="go-detail-accordion__teaser">{teaser}</span>:null}</span>
    <ChevronDown aria-hidden="true" className="go-detail-accordion__chevron"/>
   </button>
  </h2>
  <div id={panelId} role="region" aria-labelledby={headerId} className="go-detail-accordion__panel" hidden={!open&&!mounted?true:undefined} inert={!open?true:undefined}>
   <div className="go-detail-accordion__clip"><div className="go-detail-accordion__body">{mounted?children:null}</div></div>
  </div>
 </section>;
}
