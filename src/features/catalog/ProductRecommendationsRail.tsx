import React,{useEffect,useMemo,useState}from'react';
import{ChevronRight,Gem,Leaf,Star}from'lucide-react';
import{buildProductUrl,parsePublicRoute}from'../navigation/appUrl';
import{useLiveHomeCatalog,type LegacyHomeProduct}from'./useLiveHomeCatalog';

const ROUTE_EVENT='golden-oremar:route-change';
function safePrice(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
function safeCurrency(value:unknown){const valueText=typeof value==='string'?value.trim().toUpperCase():'';return/^[A-Z]{3}$/.test(valueText)?valueText:null;}
function money(value:number,currency:string){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency,maximumFractionDigits:2}).format(value);}catch{return`${value.toLocaleString('tr-TR')} ${currency}`;}}
function referenceOf(product:LegacyHomeProduct){return product.slug||product.legacyId||product.id;}
function uniqueProducts(items:LegacyHomeProduct[]){return Array.from(new Map(items.map(item=>[item.id,item])).values());}

export default function ProductRecommendationsRail(){
 const[routeVersion,setRouteVersion]=useState(0);
 const{products,loading}=useLiveHomeCatalog();
 useEffect(()=>{const refresh=()=>setRouteVersion(value=>value+1);window.addEventListener(ROUTE_EVENT,refresh);window.addEventListener('popstate',refresh);return()=>{window.removeEventListener(ROUTE_EVENT,refresh);window.removeEventListener('popstate',refresh);};},[]);
 const route=useMemo(()=>parsePublicRoute(),[routeVersion]);
 const reference=route.tab==='product-detail'?route.productReference:null;
 const context=useMemo(()=>{
  if(!reference||!products.length)return null;
  const current=products.find(item=>item.slug===reference||item.id===reference||item.legacyId===reference);
  if(!current)return null;
  const alternatives=uniqueProducts(products.filter(item=>item.id!==current.id&&item.categorySlug===current.categorySlug)).slice(0,8);
  const sameStore=uniqueProducts([
   ...products.filter(item=>item.id!==current.id&&item.categorySlug!==current.categorySlug&&item.producerId===current.producerId&&item.is_featured),
   ...products.filter(item=>item.id!==current.id&&item.categorySlug!==current.categorySlug&&item.producerId===current.producerId),
  ]).slice(0,8);
  return{current,alternatives,sameStore};
 },[products,reference]);
 if(!reference||loading||!context||(!context.alternatives.length&&!context.sameStore.length))return null;
 function openProduct(product:LegacyHomeProduct){const target=referenceOf(product);if(!target)return;const currentDepth=Number(window.history.state?.goldenOremarDepth);const nextDepth=Number.isSafeInteger(currentDepth)&&currentDepth>=0?currentDepth+1:1;const url=buildProductUrl(target);const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab:'product-detail'};window.history.pushState(state,'',url);window.dispatchEvent(new PopStateEvent('popstate',{state}));window.dispatchEvent(new Event(ROUTE_EVENT));window.scrollTo({top:0,behavior:'auto'});}
 function openCategory(){const slug=context.current.categorySlug;if(!slug)return;const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('tab','categories');url.searchParams.set('category',slug);const currentDepth=Number(window.history.state?.goldenOremarDepth);const nextDepth=Number.isSafeInteger(currentDepth)&&currentDepth>=0?currentDepth+1:1;const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab:'categories'};window.history.pushState(state,'',url.toString());window.dispatchEvent(new PopStateEvent('popstate',{state}));window.dispatchEvent(new Event(ROUTE_EVENT));window.scrollTo({top:0,behavior:'auto'});}
 return<section data-go-feature="live-product-recommendations" className="go-product-recommendations go-product-recommendations--premium" aria-labelledby="product-recommendations-title">
  <div className="go-product-recommendations__intro"><span className="go-product-recommendations__eyebrow">Keşif devam ediyor</span><h2 id="product-recommendations-title">Bir ürün değil, birbirine bağlı bir seçki.</h2><p>İncelediğiniz üründen aynı kategoriye veya Golden Oremar'ın başka bir seçkisine tek dokunuşla geçin.</p></div>
  {context.alternatives.length?<RecommendationGroup eyebrow="Aynı kategoriden" title={`${context.current.category} içinde başka seçenekler`} description="Aynı kategori içinde fiyat, paket ve ürün özelliklerini karşılaştırabileceğiniz alternatifler." items={context.alternatives} onOpen={openProduct} actionLabel={`${context.current.category} kategorisini aç`} onAction={openCategory}/>:null}
  {context.sameStore.length?<RecommendationGroup eyebrow="Aynı mağazadan" title="Bir sonraki keşfiniz" description="Aynı mağazanın farklı kategorilerinden, vitrinde keşfedebileceğiniz başka ürünler." items={context.sameStore} onOpen={openProduct}/>:null}
 </section>;
}

function RecommendationGroup({eyebrow,title,description,items,onOpen,actionLabel,onAction}:{eyebrow:string;title:string;description:string;items:LegacyHomeProduct[];onOpen:(product:LegacyHomeProduct)=>void;actionLabel?:string;onAction?:()=>void}){return<section className="go-product-recommendations__group"><div className="go-product-recommendations__group-head"><div><span>{eyebrow}</span><h3>{title}</h3><p>{description}</p></div>{actionLabel&&onAction?<button type="button" onClick={onAction}>{actionLabel}<ChevronRight aria-hidden="true"/></button>:null}</div><div className="go-product-recommendations__rail hide-scrollbar">{items.map(product=><RecommendationCard key={product.id} product={product} onOpen={()=>onOpen(product)}/>)}</div></section>;}

function RecommendationCard({product,onOpen}:{product:LegacyHomeProduct;onOpen:()=>void}){const price=safePrice(product.price),currency=safeCurrency(product.currency),ruby=product.producerVerified&&product.producerBadgeTone==='ruby';return<button type="button" onClick={onOpen} className="go-product-recommendations__item go-product-recommendations__item--premium text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><span className="go-product-recommendations__media">{product.image?<img src={product.image} alt={`${product.name} ürün görseli`} loading="lazy" decoding="async"/>:<span className="go-product-recommendations__media-placeholder"><Leaf aria-hidden="true"/><small>Ürün görseli doğrulanıyor</small></span>}</span><span className="go-product-recommendations__content"><span className="go-product-recommendations__meta"><span>{product.category}</span>{ruby?<span className="go-product-recommendations__ruby"><Gem aria-hidden="true"/>Yakut</span>:null}</span><strong>{product.name}</strong>{product.unit?<span className="go-product-recommendations__unit">{product.unit}</span>:null}<span className="go-product-recommendations__bottom"><span>{price!==null&&currency?<b>{money(price,currency)}</b>:<small>Fiyat yakında</small>}{product.reviewCount!==null&&product.reviewCount>0?<span className="go-product-recommendations__rating"><Star aria-hidden="true"/><em>{product.rating!==null?product.rating.toFixed(1):'—'} ({product.reviewCount})</em></span>:null}</span><ChevronRight aria-hidden="true"/></span></span></button>;}
