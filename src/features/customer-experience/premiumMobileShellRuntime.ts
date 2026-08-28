let installed=false;

const COMPACT_ENTER_Y=104;
const EXPAND_TOP_Y=40;
const DIRECTION_DELTA=5;
const EXPAND_REVERSE_TRAVEL=48;

type ScrollDirection='up'|'down'|null;

export function installPremiumMobileShellRuntime(){
 if(installed||typeof window==='undefined'||typeof document==='undefined')return;installed=true;
 const root=document.documentElement;let lastY=Math.max(0,window.scrollY);let compact=lastY>COMPACT_ENTER_Y;let ticking=false;let direction:ScrollDirection=null;let directionAnchorY=lastY;
 const apply=(next:boolean)=>{if(compact===next)return;compact=next;root.dataset.goHeaderCompact=next?'true':'false';};
 root.dataset.goHeaderCompact=compact?'true':'false';
 const onScroll=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{const y=Math.max(0,window.scrollY);const delta=y-lastY;
  if(y<EXPAND_TOP_Y){apply(false);direction='up';directionAnchorY=y;}
  else if(delta>DIRECTION_DELTA){if(direction!=='down'){direction='down';directionAnchorY=lastY;}if(!compact&&y>COMPACT_ENTER_Y)apply(true);}
  else if(delta<-DIRECTION_DELTA){if(direction!=='up'){direction='up';directionAnchorY=lastY;}if(compact&&directionAnchorY-y>=EXPAND_REVERSE_TRAVEL)apply(false);}
  lastY=y;ticking=false;
 });};
 const syncViewport=()=>{const viewport=window.visualViewport;root.style.setProperty('--go-visual-viewport-height',`${Math.round(viewport?.height||window.innerHeight)}px`);};
 window.addEventListener('scroll',onScroll,{passive:true});window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});window.addEventListener('resize',syncViewport,{passive:true});syncViewport();
}
