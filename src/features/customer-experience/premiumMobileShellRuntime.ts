let installed=false;
export function installPremiumMobileShellRuntime(){
 if(installed||typeof window==='undefined'||typeof document==='undefined')return;installed=true;
 const root=document.documentElement;let lastY=Math.max(0,window.scrollY);let compact=lastY>96;let ticking=false;
 const apply=(next:boolean)=>{if(compact===next)return;compact=next;root.dataset.goHeaderCompact=next?'true':'false';};
 root.dataset.goHeaderCompact=compact?'true':'false';
 const onScroll=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{const y=Math.max(0,window.scrollY);const delta=y-lastY;if(y<40)apply(false);else if(delta>5&&y>104)apply(true);else if(delta<-7)apply(false);lastY=y;ticking=false;});};
 const syncViewport=()=>{const viewport=window.visualViewport;root.style.setProperty('--go-visual-viewport-height',`${Math.round(viewport?.height||window.innerHeight)}px`);};
 window.addEventListener('scroll',onScroll,{passive:true});window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});window.addEventListener('resize',syncViewport,{passive:true});syncViewport();
}
