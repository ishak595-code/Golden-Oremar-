let installed=false;

const COMPACT_ENTER_Y=104;
const EXPAND_TOP_Y=40;
const EXPAND_REVERSE_TRAVEL=48;

type ScrollDirection='up'|'down'|null;

export function installPremiumMobileShellRuntime(){
 if(installed||typeof window==='undefined'||typeof document==='undefined')return;installed=true;
 const root=document.documentElement;let lastY=Math.max(0,window.scrollY);let compact=lastY>COMPACT_ENTER_Y;let ticking=false;let inputDirection:ScrollDirection=null;let directionAnchorY=lastY;let touchY:number|null=null;
 const apply=(next:boolean)=>{if(compact===next)return;compact=next;root.dataset.goHeaderCompact=next?'true':'false';};
 const setInputDirection=(next:Exclude<ScrollDirection,null>)=>{if(inputDirection===next)return;inputDirection=next;directionAnchorY=Math.max(0,window.scrollY);};
 root.dataset.goHeaderCompact=compact?'true':'false';
 const onWheel=(event:WheelEvent)=>{if(event.deltaY>2)setInputDirection('down');else if(event.deltaY<-2)setInputDirection('up');};
 const onTouchStart=(event:TouchEvent)=>{touchY=event.touches[0]?.clientY??null;};
 const onTouchMove=(event:TouchEvent)=>{const current=event.touches[0]?.clientY;if(current==null||touchY==null)return;const delta=current-touchY;if(delta>3)setInputDirection('up');else if(delta<-3)setInputDirection('down');touchY=current;};
 const onTouchEnd=()=>{touchY=null;};
 const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Home'||event.key==='PageUp'||event.key==='ArrowUp'||(event.key===' '&&event.shiftKey))setInputDirection('up');else if(event.key==='End'||event.key==='PageDown'||event.key==='ArrowDown'||(event.key===' '&&!event.shiftKey))setInputDirection('down');};
 const onScroll=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{const y=Math.max(0,window.scrollY);const delta=y-lastY;
  if(y<EXPAND_TOP_Y){apply(false);inputDirection=null;directionAnchorY=y;}
  else if(delta>5){if(!compact&&y>COMPACT_ENTER_Y){apply(true);inputDirection='down';directionAnchorY=y;}}
  else if(delta<-7){if(compact&&inputDirection==='up'&&directionAnchorY-y>=EXPAND_REVERSE_TRAVEL)apply(false);}
  lastY=y;ticking=false;
 });};
 const syncViewport=()=>{const viewport=window.visualViewport;root.style.setProperty('--go-visual-viewport-height',`${Math.round(viewport?.height||window.innerHeight)}px`);};
 window.addEventListener('wheel',onWheel,{passive:true});window.addEventListener('touchstart',onTouchStart,{passive:true});window.addEventListener('touchmove',onTouchMove,{passive:true});window.addEventListener('touchend',onTouchEnd,{passive:true});window.addEventListener('touchcancel',onTouchEnd,{passive:true});window.addEventListener('keydown',onKeyDown);window.addEventListener('scroll',onScroll,{passive:true});window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});window.addEventListener('resize',syncViewport,{passive:true});syncViewport();
}
