import{useEffect,useState}from'react';
import{scrollBehavior}from'../../../lib/reducedMotion';

/**
 * A quiet text strip under "Bugünün Önerisi": Bugün | Mevsim | Yeni | Hediye.
 * No icons, no grid. It stays under the header while the page scrolls; the
 * showcase in view is marked with a thin gold underline, and a tap scrolls to
 * its showcase. A tab whose showcase is missing (switched off, or empty) is
 * left out.
 */
const TABS:ReadonlyArray<{key:string;label:string}>=[
 {key:'featured',label:'Bugün'},
 {key:'seasonal',label:'Mevsim'},
 {key:'new_arrivals',label:'Yeni'},
 {key:'natural',label:'Hediye'},
];
const target=(key:string)=>document.querySelector<HTMLElement>(`[data-home-key="${key}"]`);

export default function HomeSectionTabs({keys}:{keys:readonly string[]}){
 const[present,setPresent]=useState<string[]>(()=>TABS.filter(tab=>keys.includes(tab.key)).map(tab=>tab.key));
 const[active,setActive]=useState('');
 useEffect(()=>{
  let frame=0;
  const measure=()=>{
   frame=0;
   const header=document.querySelector('header');if(header)document.documentElement.style.setProperty('--go-home-header-h',`${Math.round(header.getBoundingClientRect().height)}px`);
   const shown=TABS.filter(tab=>keys.includes(tab.key)&&target(tab.key)).map(tab=>tab.key);
   setPresent(current=>current.join()===shown.join()?current:shown);
   const line=(document.querySelector('.go-section-tabs')?.getBoundingClientRect().bottom||120)+48;
   // The showcase whose title most recently passed under the strip, whatever the page order.
   let current='',best=-Infinity;
   for(const key of shown){const top=target(key)?.getBoundingClientRect().top??Infinity;if(top<=line&&top>best){best=top;current=key;}}
   setActive(current);
  };
  const schedule=()=>{if(!frame)frame=window.requestAnimationFrame(measure);};
  measure();
  // No timer: it measures when the page scrolls, resizes, or grows (a showcase
  // filling in), so the screen reader tree changes only when the marked tab does.
  const content=document.querySelector('.go-home-content');
  const grow=typeof ResizeObserver!=='undefined'&&content?new ResizeObserver(schedule):null;
  if(grow&&content)grow.observe(content);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  return()=>{grow?.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);if(frame)window.cancelAnimationFrame(frame);};
 },[keys]);
 if(present.length<2)return null;
 return<nav className="go-section-tabs" aria-label="Ana sayfa seçkileri">
  {TABS.filter(tab=>present.includes(tab.key)).map(tab=><button key={tab.key} type="button" aria-current={active===tab.key?'true':undefined} className={active===tab.key?'is-active':undefined} onClick={()=>{const el=target(tab.key);if(!el)return;el.scrollIntoView({behavior:scrollBehavior(),block:'start'});setActive(tab.key);
  // Showcases above may fill in while the page moves; land on the title once more if they pushed it away.
  window.setTimeout(()=>{const want=parseFloat(getComputedStyle(el).scrollMarginTop)||0;if(Math.abs(el.getBoundingClientRect().top-want)>40)el.scrollIntoView({behavior:'auto',block:'start'});},1100);el.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});}}>{tab.label}</button>)}
 </nav>;
}
