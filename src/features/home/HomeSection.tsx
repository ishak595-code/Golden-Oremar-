import React,{useMemo,useState}from'react';
import{ArrowDownUp,ChevronRight,Filter,Leaf,SlidersHorizontal,Sparkles}from'lucide-react';
import CatalogProductCard from'../catalog/CatalogProductCard';
import{useCatalogFilterOptions}from'../catalog/useCatalogFilterOptions';
import{useLiveHomeCatalog,type LegacyHomeProduct}from'../catalog/useLiveHomeCatalog';
import{usePublicStorefrontConfig}from'../storefront/usePublicStorefrontConfig';
import HomeEventsSpotlight from'./HomeEventsSpotlight';

type Props={
 searchQuery:string;
 setSearchQuery:(value:string)=>void;
 onProductClick:(product:LegacyHomeProduct)=>void;
 onAddToCart:(product:LegacyHomeProduct,quantity:number)=>Promise<void>|void;
 onToggleFavorite:(product:LegacyHomeProduct)=>Promise<void>|void;
 favorites:string[];
 onShare:(product:LegacyHomeProduct)=>Promise<void>|void;
 onGift:(product:LegacyHomeProduct)=>Promise<void>|void;
};
type SortOption='featured'|'rating'|'price-asc'|'price-desc';

function safeText(value:unknown,max=300){return typeof value==='string'?value.trim().slice(0,max):'';}
function safePrice(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
function safeRating(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=5?value:null;}
function prefersReducedMotion(){return typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;}

export default function HomeSection({searchQuery,setSearchQuery,onProductClick,onAddToCart,onToggleFavorite,favorites,onShare,onGift}:Props){
 const{staticContent,heroCategories,homeSections,eventSpotlight,salesReadiness,loading:storefrontLoading,error:storefrontError}=usePublicStorefrontConfig('tr');
 const{products,categories,loading:catalogLoading,error:catalogError}=useLiveHomeCatalog();
 const{categories:filterCategories,origins,loading:filtersLoading,error:filtersError}=useCatalogFilterOptions();
 const[activeCategory,setActiveCategory]=useState<string|null>(null);
 const[activeOrigin,setActiveOrigin]=useState<string|null>(null);
 const[sort,setSort]=useState<SortOption>('featured');
 const[filtersOpen,setFiltersOpen]=useState(false);
 const interfaceContent=staticContent?.interface??null;
 const heroTitle=safeText(interfaceContent?.heroTitle,300)||'Doğallığın seçkin hali.';
 const heroSubtitle=safeText(interfaceContent?.heroSubtitle,600)||'Kaynağı ve üreticisi belli, özenle seçilmiş ürünleri keşfedin.';
 const heroButtonText=safeText(interfaceContent?.heroButtonText,120)||'Ürünleri keşfet';
 const categoriesTitle=safeText(interfaceContent?.categoriesTitle,200)||'Kategoriler';
 const loading=storefrontLoading||catalogLoading||filtersLoading;
 const hasLoadError=Boolean(storefrontError||catalogError||filtersError);
 const salesPaused=salesReadiness?.status==='blocked_pending_business_identity';

 const quickCategories=useMemo(()=>{
  const liveById=new Map(categories.filter(category=>category.productCount>0).map(category=>[category.id,category]));
  const managed=heroCategories.map(config=>liveById.get(config.targetCategory)).filter((category):category is NonNullable<typeof category>=>Boolean(category));
  const managedIds=new Set(managed.map(category=>category.id));
  const fallback=categories.filter(category=>category.productCount>0&&!managedIds.has(category.id));
  return[...managed,...fallback].slice(0,10);
 },[categories,heroCategories]);
 const filteredProducts=useMemo(()=>{
  const query=searchQuery.trim().toLocaleLowerCase('tr-TR');
  return[...products].filter(product=>{
   const matchesQuery=!query||[product.name,product.category,product.producerName,product.origin,...product.tags].filter(Boolean).some(value=>String(value).toLocaleLowerCase('tr-TR').includes(query));
   const matchesCategory=!activeCategory||product.categorySlug===activeCategory;
   const matchesOrigin=!activeOrigin||safeText(product.origin,240).toLocaleLowerCase('tr-TR').includes(activeOrigin.toLocaleLowerCase('tr-TR'));
   return matchesQuery&&matchesCategory&&matchesOrigin;
  }).sort((a,b)=>{
   if(sort==='price-asc'||sort==='price-desc'){
    const ap=safePrice(a.price),bp=safePrice(b.price);
    if(ap===null&&bp===null)return 0;if(ap===null)return 1;if(bp===null)return-1;
    return sort==='price-asc'?ap-bp:bp-ap;
   }
   if(sort==='rating'){
    const ar=safeRating(a.rating),br=safeRating(b.rating);
    if(ar===null&&br===null)return 0;if(ar===null)return 1;if(br===null)return-1;return br-ar;
   }
   return Number(b.is_featured)-Number(a.is_featured);
  });
 },[products,searchQuery,activeCategory,activeOrigin,sort]);

 function sectionProducts(id:string){
  const source=id==='featured'
   ?products.filter(product=>product.is_featured||product.homeSection==='featured')
   :id==='pre_order'
    ?products.filter(product=>product.preOrder)
    :products.filter(product=>product.homeSection===id);
  return Array.from(new Map(source.map(product=>[product.id,product])).values()).slice(0,10);
 }
 function isFavorite(product:LegacyHomeProduct){return favorites.includes(String(product.legacyId||product.id));}
 function chooseCategory(slug:string){setActiveCategory(slug);requestAnimationFrame(()=>document.getElementById('products')?.scrollIntoView({behavior:prefersReducedMotion()?'auto':'smooth',block:'start'}));}
 function clearFilters(){setSearchQuery('');setActiveCategory(null);setActiveOrigin(null);setSort('featured');}
 function renderEvents(placement:'after_hero'|'after_categories'|'before_products'){return!searchQuery&&eventSpotlight?.enabled&&eventSpotlight.placement===placement?<HomeEventsSpotlight settings={eventSpotlight}/>:null;}
 const activeCategoryName=filterCategories.find(item=>item.id===activeCategory)?.name||categories.find(item=>item.id===activeCategory)?.name||'';

 return<>
  <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6" aria-labelledby="home-title">
   {loading?<div role="status" aria-live="polite" className="mb-3 rounded-xl border border-brand-border bg-brand-card px-4 py-2.5 text-center text-sm font-semibold text-brand-muted">Ürünler hazırlanıyor…</div>:null}
   {hasLoadError?<CustomerNotice>Mağaza içeriğinin bir bölümü şu anda yenilenemiyor. Biraz sonra tekrar deneyebilirsiniz.</CustomerNotice>:null}
   {salesPaused&&salesReadiness?<CustomerNotice>{safeText(salesReadiness.message,500)}</CustomerNotice>:null}

   {!searchQuery?<div className="mb-5 px-1"><div className="flex items-start justify-between gap-4"><div className="min-w-0 max-w-3xl"><div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-brand-gold"><Leaf aria-hidden="true" className="h-3.5 w-3.5"/>Golden Oremar</div><h1 id="home-title" className="mt-1 text-2xl font-black leading-tight text-brand-green dark:text-brand-gold sm:text-3xl">{heroTitle}</h1><p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-5 text-brand-muted">{heroSubtitle}</p></div><button type="button" onClick={()=>document.getElementById('products')?.scrollIntoView({behavior:prefersReducedMotion()?'auto':'smooth'})} className="hidden min-h-11 shrink-0 items-center rounded-full border border-brand-border bg-brand-card px-4 text-sm font-bold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold sm:inline-flex">{heroButtonText}<ChevronRight aria-hidden="true" className="ml-1 h-4 w-4"/></button></div></div>:<h1 id="home-title" className="sr-only">Golden Oremar ürünleri</h1>}

   {renderEvents('after_hero')}

   {!searchQuery&&quickCategories.length?<section className="mb-6" aria-labelledby="home-categories-title"><div className="mb-2 flex items-center justify-between gap-3"><h2 id="home-categories-title" className="text-lg font-black text-brand-text">{categoriesTitle}</h2><span className="text-xs font-semibold text-brand-muted">Kaydırarak keşfedin</span></div><div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto pb-1" role="list">{quickCategories.map(category=><button type="button" role="listitem" key={category.id} onClick={()=>chooseCategory(category.id)} aria-pressed={activeCategory===category.id} className={`min-h-11 shrink-0 snap-start rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${activeCategory===category.id?'border-brand-green bg-brand-green text-brand-on-green':'border-brand-border bg-brand-card text-brand-text'}`}>{category.name}</button>)}</div></section>:null}

   {renderEvents('after_categories')}
  </section>

  {!searchQuery&&!activeCategory?<section className="mx-auto max-w-7xl space-y-7 px-4 sm:px-6">{homeSections.filter(section=>section.active).map(section=>{const items=sectionProducts(section.id);if(!items.length)return null;return<section key={section.id} aria-labelledby={`home-section-${section.id}`}><div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold">Golden Oremar seçkisi</div><h2 id={`home-section-${section.id}`} className="mt-0.5 text-xl font-black text-brand-text">{section.title}</h2></div></div><div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-2">{items.map(product=><div key={product.id} className="w-[20rem] max-w-[88vw] shrink-0 snap-start sm:w-[22rem]"><CatalogProductCard compact product={product} onClick={()=>onProductClick(product)} onAddToCart={onAddToCart} onToggleFavorite={()=>onToggleFavorite(product)} isFavorite={isFavorite(product)} onShare={()=>onShare(product)} onGift={()=>onGift(product)}/></div>)}</div></section>;})}</section>:null}

  <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">{renderEvents('before_products')}</div>

  <section id="products" className="mx-auto mb-24 mt-6 max-w-7xl scroll-mt-24 px-4 sm:px-6" aria-labelledby="products-title">
   <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold">Mağaza</div><h2 id="products-title" className="mt-0.5 truncate text-xl font-black text-brand-text sm:text-2xl">{searchQuery?`“${searchQuery.trim().slice(0,80)}” sonuçları`:activeCategoryName||'Tüm ürünler'}</h2></div><button type="button" onClick={()=>setFiltersOpen(value=>!value)} aria-expanded={filtersOpen} aria-controls="home-filters" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-brand-border bg-brand-card px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Filter aria-hidden="true" className="mr-2 h-4 w-4"/>{filtersOpen?'Kapat':'Filtrele'}</button></div>

   {filtersOpen?<div id="home-filters" className="mb-4 rounded-2xl border border-brand-border bg-brand-card p-4"><div className="mb-3 flex items-center gap-2 font-bold"><SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-brand-gold"/>Seçiminizi daraltın</div><div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Kategori<select value={activeCategory||''} onChange={event=>setActiveCategory(event.target.value||null)} className="mt-1 min-h-11 w-full rounded-xl border border-brand-border bg-transparent px-3"><option value="">Tüm kategoriler</option>{filterCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm font-semibold">Üretim yeri<select value={activeOrigin||''} onChange={event=>setActiveOrigin(event.target.value||null)} className="mt-1 min-h-11 w-full rounded-xl border border-brand-border bg-transparent px-3"><option value="">Tüm bölgeler</option>{origins.map(origin=><option key={origin} value={origin}>{origin}</option>)}</select></label><label className="text-sm font-semibold">Sıralama<span className="relative mt-1 flex min-h-11 items-center rounded-xl border border-brand-border px-3"><ArrowDownUp aria-hidden="true" className="mr-2 h-4 w-4 text-brand-gold"/><select value={sort} onChange={event=>setSort(event.target.value as SortOption)} className="min-h-10 flex-1 bg-transparent outline-none"><option value="featured">Öne çıkanlar</option><option value="rating">En yüksek puan</option><option value="price-asc">Fiyat artan</option><option value="price-desc">Fiyat azalan</option></select></span></label></div><div className="mt-3 flex items-center justify-end border-t border-brand-border pt-3"><button type="button" onClick={clearFilters} className="min-h-11 rounded-full border border-brand-border px-4 text-sm font-bold">Filtreleri temizle</button></div></div>:null}

   {catalogLoading?<ProductSkeleton/>:filteredProducts.length?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredProducts.map(product=><CatalogProductCard compact key={product.id} product={product} onClick={()=>onProductClick(product)} onAddToCart={onAddToCart} onToggleFavorite={()=>onToggleFavorite(product)} isFavorite={isFavorite(product)} onShare={()=>onShare(product)} onGift={()=>onGift(product)}/>)}</div>:<div className="rounded-2xl border border-dashed border-brand-border bg-brand-card p-7 text-center"><Sparkles aria-hidden="true" className="mx-auto h-7 w-7 text-brand-gold"/><h3 className="mt-3 text-lg font-bold">Aradığınız ürün şu anda görünmüyor</h3><p className="mt-1 text-sm text-brand-muted">Filtreleri temizleyerek tüm ürünlere dönebilirsiniz.</p><button type="button" onClick={clearFilters} className="mt-4 min-h-11 rounded-full bg-brand-green px-5 font-bold text-brand-on-green">Tüm ürünleri göster</button></div>}
  </section>
 </>;
}

function CustomerNotice({children}:{children:React.ReactNode}){return<div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{children}</div>;}
function ProductSkeleton(){return<div role="status" aria-live="polite" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({length:4}).map((_,index)=><div key={index} className="h-40 animate-pulse rounded-2xl border border-brand-border bg-brand-card"/>)}<span className="sr-only">Ürünler hazırlanıyor</span></div>;}
