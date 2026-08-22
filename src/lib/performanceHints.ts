const LINK_MARKER='data-golden-oremar-performance-hint';

function safeSupabaseOrigin(){
  const raw=String(import.meta.env.VITE_SUPABASE_URL||'').trim();
  if(!raw)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password)return null;
    return url.origin;
  }catch{return null;}
}

function ensureLink(rel:'preconnect'|'dns-prefetch',href:string){
  if(typeof document==='undefined')return;
  const selector=`link[${LINK_MARKER}="${rel}"]`;
  const existing=document.head.querySelector<HTMLLinkElement>(selector);
  if(existing){if(existing.href!==href)existing.href=href;return;}
  const link=document.createElement('link');
  link.rel=rel;
  link.href=href;
  link.setAttribute(LINK_MARKER,rel);
  if(rel==='preconnect')link.crossOrigin='anonymous';
  document.head.appendChild(link);
}

export function installBackendPerformanceHints(){
  const origin=safeSupabaseOrigin();
  if(!origin)return;
  ensureLink('dns-prefetch',origin);
  ensureLink('preconnect',origin);
}
