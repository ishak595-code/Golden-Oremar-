import React,{useEffect,useMemo,useRef,useState}from'react';
import{AlertCircle,ArrowRight,RefreshCw}from'lucide-react';
import{publicCatalogUrl}from'../catalog/api';
import{CUSTOMER_COPY,homeSectionDisplayCopy}from'../customer-experience/customerCopy';
import HomeEventsSpotlight from'./HomeEventsSpotlight';
import{browserHomeLocale,type HomeSectionModel}from'./homeExperienceApi';
import{useHomeExperience}from'./useHomeExperience';
import CategoryCard from'./components/CategoryCard';
import PremiumImage from'./components/PremiumImage';
import ProductCard from'./components/ProductCard';
import SectionHeader from'./components/SectionHeader';

type ProductReference={id:string;slug:string;legacyId?:string|null};
type Props={onProductClick:(product:ProductReference)=>void};

function navigateToCategories(categorySlug?:string){const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('tab','categories');if(categorySlug)url.searchParams.set('category',categorySlug);const depth=Number(window.history.state?.goldenOremarDepth);const nextDepth=Number.isSafeInteger(depth)&&depth>=0?depth+1:1;const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab:'categories'};window.history.pushState(state,'',url.toString());window.dispatchEvent(new PopStateEvent('popstate',{state}));window.scrollTo({top:0,behavior:'auto'});}

export default function HomeSection({onProductClick}:Props){
 const locale=browserHomeLocale();
 const{experience,loading,error,retry,loadSection}=useHomeExperience(locale);
 const orderedCategories=useMemo(()=>{
  if(!experience)return[];
  const bySlug=new Map(experience.categories.map(category=>[category.slug,category]));
  const byId=new Map(experience.categories.map(category=>[category.id,category]));
  const used=new Set<string>();
  const managed=experience.categoryOrder.flatMap(config=>{const category=bySlug.get(config.targetCategory)||byId.get(config.targetCategory);if(!category||used.has(category.id))return[];used.add(category.id);return[{category,config}];});
  const fallback=experience.categories.filter(category=>!used.has(category.id)).map(category=>({category,config:null}));
  return[...managed,...fallback].slice(0,12);
 },[experience]);

 if(loading&&!experience)return<HomeLoading/>;
 if(!experience)return<HomeError message={error||CUSTOMER_COPY.home.loadErrorFallback} onRetry={()=>void retry().catch(()=>undefined)}/>;
 const initialSections=experience.sections.filter(section=>!section.deferred&&section.items.length>0);
 const deferredSections=experience.sections.filter(section=>section.deferred);
 const eventSpotlight=experience.eventSpotlight;
 function renderEvents(placement:'after_hero'|'after_categories'|'before_products'){return eventSpotlight?.enabled===true&&eventSpotlight.placement===placement?<HomeEventsSpotlight settings={eventSpotlight}/>:null;}

 return<div className="go-premium-home-v2" data-home-contract-version={experience.version}>
  <h1 className="sr-only">{experience.brand.name} ürünleri</h1>
  <div className="go-home-content">
   {orderedCategories.length?<section className="go-home-section go-home-categories" aria-labelledby="home-categories-title" data-server-heading={experience.interface.categoriesTitle}>
    <SectionHeader id="home-categories-title" title={CUSTOMER_COPY.home.categoriesTitle} subtitle={CUSTOMER_COPY.home.categoriesSubtitle} actionLabel={CUSTOMER_COPY.home.categoriesAction} onAction={()=>navigateToCategories()}/>
    <div className="go-category-rail hide-scrollbar" role="list" aria-label={CUSTOMER_COPY.home.categoriesTitle}>
     {orderedCategories.map(({category,config})=>{const image=category.imagePath||config?.image||null;return<div role="listitem" key={category.id}><CategoryCard name={config?.title||category.name} subtitle={config?.subtitle||null} imageUrl={image?publicCatalogUrl(image):null} onClick={()=>navigateToCategories(category.slug)}/></div>;})}
    </div>
   </section>:null}

   {renderEvents('after_categories')}

   {initialSections.map((section,index)=><ProductSection key={section.key} section={section} onProductClick={onProductClick} eagerFirst={index===0}/>) }

   {renderEvents('after_hero')}

   {experience.campaign?<CampaignCard campaign={experience.campaign}/>:null}

   {renderEvents('before_products')}

   {deferredSections.map(section=><DeferredProductSection key={section.key} descriptor={section} loadSection={loadSection} onProductClick={onProductClick}/>) }

   {experience.interface.footerText?<section className="go-brand-provenance" aria-label={`${experience.brand.name} hakkında`}><span>{experience.brand.name}</span><p>{experience.interface.footerText}</p></section>:null}

   <button type="button" className="go-discover-all" onClick={()=>navigateToCategories()}><span>{CUSTOMER_COPY.home.discoverAll}</span><ArrowRight aria-hidden="true"/></button>
  </div>
 </div>;
}

function ProductSection({section,onProductClick,eagerFirst=false}:{section:HomeSectionModel;onProductClick:(product:ProductReference)=>void;eagerFirst?:boolean}){if(!section.items.length)return null;const copy=homeSectionDisplayCopy(section.source.kind,section.title,section.subtitle);return<section className="go-home-section go-product-section-v2" aria-labelledby={`home-section-${section.key}`} data-server-section-title={section.title}>
 <SectionHeader id={`home-section-${section.key}`} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}/>
 <div className="go-product-list-v4 flex flex-col gap-4" role="list">{section.items.map((item,index)=><ProductCard key={item.id} item={item} eager={eagerFirst&&index===0} onClick={()=>onProductClick(item)}/>)}</div>
 </section>;}

function DeferredProductSection({descriptor,loadSection,onProductClick}:{descriptor:HomeSectionModel;loadSection:(key:string)=>Promise<HomeSectionModel|null>;onProductClick:(product:ProductReference)=>void}){
 const hostRef=useRef<HTMLElement|null>(null);const[section,setSection]=useState<HomeSectionModel|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState('');const requested=useRef(false);
 const copy=homeSectionDisplayCopy(descriptor.source.kind,descriptor.title,descriptor.subtitle);
 const request=()=>{if(requested.current)return;requested.current=true;setLoading(true);setError('');void loadSection(descriptor.key).then(result=>setSection(result)).catch(()=>{requested.current=false;setError(CUSTOMER_COPY.home.sectionRefreshError);}).finally(()=>setLoading(false));};
 useEffect(()=>{const node=hostRef.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){request();return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){request();observer.disconnect();}},{rootMargin:'560px 0px'});observer.observe(node);return()=>observer.disconnect();},[descriptor.key,loadSection]);
 return<section ref={hostRef} className="go-home-section go-product-section-v2 go-product-section-v2--deferred" aria-labelledby={`home-section-${descriptor.key}`} data-server-section-title={descriptor.title}>
  <SectionHeader id={`home-section-${descriptor.key}`} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}/>
  {section?.items.length?<div className="go-product-list-v4 flex flex-col gap-4" role="list">{section.items.map(item=><ProductCard key={item.id} item={item} onClick={()=>onProductClick(item)}/>)}</div>:loading?<ProductRowsSkeleton/>:error?<div className="go-inline-error" role="status"><AlertCircle aria-hidden="true"/><span>{error}</span><button type="button" onClick={request}>{CUSTOMER_COPY.home.retry}</button></div>:<div className="go-section-reserved-space" aria-hidden="true"/>}
 </section>;
}

function CampaignCard({campaign}:{campaign:{title:string;description:string|null;bannerPath:string|null}}){const banner=campaign.bannerPath?publicCatalogUrl(campaign.bannerPath):null;return<section className="go-home-section go-campaign-v2" aria-label={campaign.title}>{banner?<PremiumImage src={banner} alt="" className="go-campaign-v2__media"/>:null}<div className="go-campaign-v2__copy"><span>Kampanya</span><h2>{campaign.title}</h2>{campaign.description?<p>{campaign.description}</p>:null}</div></section>;}
function HomeError({message,onRetry}:{message:string;onRetry:()=>void}){return<div className="go-home-state" role="alert"><AlertCircle aria-hidden="true"/><h1>{CUSTOMER_COPY.home.loadErrorTitle}</h1><p>{message}</p><button type="button" onClick={onRetry}><RefreshCw aria-hidden="true"/>{CUSTOMER_COPY.home.retry}</button></div>;}
function ProductRowsSkeleton(){return<div className="go-product-list-v4 go-product-list-v4--skeleton flex flex-col gap-4" role="status" aria-label="Ürünler yükleniyor">{[0,1,2].map(index=><div className="go-product-skeleton" key={index}><span/><div><i/><i/><i/></div></div>)}</div>;}
function HomeLoading(){return<div className="go-premium-home-v2"><div className="go-home-content"><section className="go-home-section"><div className="go-heading-skeleton"/><div className="go-category-skeleton-rail">{[0,1,2].map(index=><div className="go-category-skeleton" key={index}/>)}</div></section><section className="go-home-section"><div className="go-heading-skeleton go-heading-skeleton--wide"/><ProductRowsSkeleton/></section></div></div>;}
