import React,{useEffect,useMemo,useState}from'react';
import{ChevronRight,Star}from'lucide-react';
import{buildProductUrl,parsePublicRoute}from'../navigation/appUrl';
import{useLiveHomeCatalog,type LegacyHomeProduct}from'./useLiveHomeCatalog';

const ROUTE_EVENT='golden-oremar:route-change';
function safePrice(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
function safeCurrency(value:unknown){const valueText=typeof value==='string'?value.trim().toUpperCase():'';return/^[A-Z]{3}$/.test(valueText)?valueText:null;}
function money(value:number,currency:string){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency}).format(value);}catch{return`${value.toLocaleString('tr-TR')} ${currency}`;}}
function referenceOf(product:LegacyHomeProduct){return product.slug||product.legacyId||product.id;}

export default function ProductRecommendationsRail(){
 const[routeVersion,setRouteVersion]=useState(0);
 const{products,loading}=useLiveHomeCatalog();
 useEffect(()=>{const refresh=()=>setRouteVersion(value=>value+1);window.addEventListener(ROUTE_EVENT,refresh);window.addEventListener('popstate',refresh);return()=>{window.removeEventListener(ROUTE_EVENT,refresh);window.removeEventListener('popstate',refresh);};},[]);
 const route=useMemo(()=>parsePublicRoute(),[routeVersion]);
 const reference=route.tab==='product-detail'?route.productReference:null;
 const recommendations=useMemo(()=>{
  if(!reference||!products.length)return[];
  const current=products.find(item=>item.slug===reference||item.id===reference||item.legacyId===reference);
  if(!current)return[];
  const sameCategory=products.filter(item=>item.id!==current.id&&item.categorySlug===current.categorySlug);
  const featured=products.filter(item=>item.id!==current.id&&item.categorySlug!==current.categorySlug&&item.is_featured);
  const fallback=products.filter(item=>item.id!==current.id);
  return Array.from(new Map([...sameCategory,...featured,...fallback].map(item=>[item.id,item])).values()).slice(0,8);
 },[products,reference]);
 if(!reference||loading||recommendations.length===0)return null;
 function openProduct(product:LegacyHomeProduct){
  const target=referenceOf(product);if(!target)return;
  const currentDepth=Number(window.history.state?.goldenOremarDepth);
  const nextDepth=Number.isSafeInteger(currentDepth)&&currentDepth>=0?currentDepth+1:1;
  const url=buildProductUrl(target);
  const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab:'product-detail'};
  window.history.pushState(state,'',url);
  window.dispatchEvent(new PopStateEvent('popstate',{state}));
  window.scrollTo({top:0,behavior:'auto'});
 }
 return<section className="go-product-recommendations" aria-labelledby="product-recommendations-title">
  <div className="mb-3 flex items-end justify-between gap-3"><div><div className="go-premium-section__eyebrow">Golden Oremar seçkisi</div><h2 id="product-recommendations-title" className="mt-1 text-2xl font-black text-brand-text">Benzer ve Önerilen Ürünler</h2><p className="mt-1 text-sm text-brand-muted">İncelediğiniz ürünle aynı seçkiden canlı katalog önerileri.</p></div></div>
  <div className="go-product-recommendations__rail hide-scrollbar">{recommendations.map(product=>{const price=safePrice(product.price),currency=safeCurrency(product.currency);return<button type="button" key={product.id} onClick={()=>openProduct(product)} className="go-product-recommendations__item text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{product.image?<img src={product.image} alt={`${product.name} ürün görseli`} loading="lazy" decoding="async"/>:<div className="grid aspect-[4/3] place-items-center bg-brand-card px-4 text-center text-sm text-brand-muted">Ürün görseli yakında</div>}<span className="block p-3.5"><span className="block text-[10px] font-black uppercase tracking-[.12em] text-brand-gold">{product.category}</span><span className="mt-1 line-clamp-2 block min-h-11 font-black leading-snug text-brand-text">{product.name}</span><span className="mt-2 flex items-end justify-between gap-2"><span>{price!==null&&currency?<span className="block font-black text-brand-green dark:text-brand-gold">{money(price,currency)}</span>:<span className="text-xs font-bold text-brand-muted">Fiyat yakında</span>}{product.reviewCount!==null&&product.reviewCount>0?<span className="mt-1 flex items-center gap-1 text-xs text-brand-muted"><Star aria-hidden="true" className="h-3.5 w-3.5 fill-brand-gold text-brand-gold"/><strong className="text-brand-text">{product.rating!==null?product.rating.toFixed(1):'—'}</strong><span>({product.reviewCount})</span></span>:null}</span><ChevronRight aria-hidden="true" className="mb-1 h-5 w-5 shrink-0 text-brand-gold"/></span></span></button>;})}</div>
 </section>;
}
