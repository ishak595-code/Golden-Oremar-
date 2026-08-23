import React,{useEffect,useMemo,useState}from'react';
import{ChevronRight,MapPin,Store,Tag}from'lucide-react';
import{buildProducerUrl,buildSearchUrl,parsePublicRoute}from'../navigation/appUrl';
import{useLiveHomeCatalog}from'./useLiveHomeCatalog';

const ROUTE_EVENT='golden-oremar:route-change';
function pushRoute(url:string,tab:string){const currentDepth=Number(window.history.state?.goldenOremarDepth);const nextDepth=Number.isSafeInteger(currentDepth)&&currentDepth>=0?currentDepth+1:1;const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab};window.history.pushState(state,'',url);window.dispatchEvent(new PopStateEvent('popstate',{state}));window.dispatchEvent(new Event(ROUTE_EVENT));window.scrollTo({top:0,behavior:'auto'});}
function categoryUrl(slug:string){const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('tab','categories');url.searchParams.set('category',slug);return url.toString();}

export default function ProductDetailConnections(){
 const[routeVersion,setRouteVersion]=useState(0);
 const{products,loading}=useLiveHomeCatalog();
 useEffect(()=>{const refresh=()=>setRouteVersion(value=>value+1);window.addEventListener(ROUTE_EVENT,refresh);window.addEventListener('popstate',refresh);return()=>{window.removeEventListener(ROUTE_EVENT,refresh);window.removeEventListener('popstate',refresh);};},[]);
 const route=useMemo(()=>parsePublicRoute(),[routeVersion]);
 const product=useMemo(()=>{if(route.tab!=='product-detail'||!route.productReference)return null;return products.find(item=>item.slug===route.productReference||item.id===route.productReference||item.legacyId===route.productReference)||null;},[products,route]);
 if(loading||!product)return null;
 const origin=String(product.origin||'').trim();
 return<section className="go-product-context-links" aria-labelledby="product-context-links-title"><div className="go-product-context-links__intro"><span>Bu ürünün dünyası</span><h2 id="product-context-links-title">Detaydan keşfe, tek dokunuşla.</h2><p>Kategoriyi, mağazayı veya aynı menşei taşıyan ürünleri ayrı ayrı keşfedin.</p></div><div className="go-product-context-links__actions"><button type="button" onClick={()=>pushRoute(categoryUrl(product.categorySlug),'categories')}><span className="go-product-context-links__icon"><Tag aria-hidden="true"/></span><span><small>Kategori</small><strong>{product.category}</strong></span><ChevronRight aria-hidden="true"/></button><button type="button" onClick={()=>pushRoute(buildProducerUrl(product.producerId),'producer-profile')}><span className="go-product-context-links__icon"><Store aria-hidden="true"/></span><span><small>Mağaza</small><strong>{product.producerName}</strong></span><ChevronRight aria-hidden="true"/></button>{origin?<button type="button" onClick={()=>pushRoute(buildSearchUrl({query:origin}),'search-results')}><span className="go-product-context-links__icon"><MapPin aria-hidden="true"/></span><span><small>Menşe</small><strong>{origin}</strong></span><ChevronRight aria-hidden="true"/></button>:null}</div></section>;
}
