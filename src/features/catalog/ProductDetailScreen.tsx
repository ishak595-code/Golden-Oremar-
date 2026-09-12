import React,{useEffect,useMemo,useRef,useState}from'react';
import{ArrowLeft,CheckCircle2,ChevronLeft,ChevronRight,Copy,ExternalLink,Gift,Heart,MapPin,MessageCircle,Minus,PackageCheck,Plus,QrCode,Share2,ShoppingCart,Star,Store,Truck,X,ZoomIn}from'lucide-react';
import{getProductDetail,listProductReviews,publicCatalogUrl,toggleProductFavorite}from'./api';
import PremiumOrderConfigurator from'./PremiumOrderConfigurator';
import{buildOrderCustomization,buildProductExperience,defaultOrderOptions,validateOrderOptions,type SelectedOrderOptions}from'./productExperience';
import ProductSafetyPanel from'../content/ProductSafetyPanel';
import{getProductSafety}from'../content/productSafetyApi';
import ProducerQuestionComposer from'../account/ProducerQuestionComposer';
import{setCartItem}from'../cart/api';
import{buildProductUrl,buildSearchUrl,copyText,shareOrCopy}from'../navigation/appUrl';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import ProductImageWithSkeleton from'./ProductImageWithSkeleton';

type Props={
 reference:string;
 authenticated:boolean;
 favoriteReferences?:string[];
 onFavoriteChanged?:(reference:string,isFavorite:boolean)=>void;
 onBack:()=>void;
 onLoginRequired:()=>void;
 onCartChanged?:()=>Promise<void>|void;
 onGift:(reference:string)=>void;
 onProducer:(id:string,slug:string,name:string)=>void;
 onCategory?:(slug:string,name:string)=>void;
};

function safeText(value:unknown,max=1000){return typeof value==='string'?value.trim().slice(0,max):'';}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
function safeRating(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=5?value:null;}
function safeCurrency(value:unknown){const currency=safeText(value,3).toUpperCase();return/^[A-Z]{3}$/.test(currency)?currency:null;}
function safeReference(value:unknown,max=220){const normalized=safeText(value,max);return normalized||null;}
function firstInteger(...values:unknown[]){for(const value of values){const parsed=safeInteger(value);if(parsed!==null)return parsed;}return null;}
function firstRating(...values:unknown[]){for(const value of values){const parsed=safeRating(value);if(parsed!==null)return parsed;}return null;}

export default function ProductDetailScreen({reference,authenticated,favoriteReferences=[],onFavoriteChanged,onBack,onLoginRequired,onCartChanged,onGift,onProducer,onCategory}:Props){
 const[detail,setDetail]=useState<any>(null);
 const[safetyContent,setSafetyContent]=useState<any>(null);
 const[reviews,setReviews]=useState<any>(null);
 const[variantId,setVariantId]=useState('');
 const[quantity,setQuantity]=useState(1);
 const[selectedOrderOptions,setSelectedOrderOptions]=useState<SelectedOrderOptions>({});
 const[selectedImagePath,setSelectedImagePath]=useState('');
 const[imageViewerOpen,setImageViewerOpen]=useState(false);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState(false);
 const[shareBusy,setShareBusy]=useState(false);
 const[error,setError]=useState('');
 const[status,setStatus]=useState('');
 const[favoriteOverride,setFavoriteOverride]=useState<boolean|null>(null);
 const[questionOpen,setQuestionOpen]=useState(false);
 const requestId=useRef(0);
 const imageViewerDialogRef=useAccessibleDialog<HTMLDivElement>(imageViewerOpen,()=>setImageViewerOpen(false));
 
 useEffect(()=>{if(!status)return;const timer=setTimeout(()=>setStatus(''),4000);return()=>clearTimeout(timer);},[status]);

 async function load(){
  const current=++requestId.current;
  try{
   setLoading(true);setError('');setStatus('');setFavoriteOverride(null);setQuestionOpen(false);setImageViewerOpen(false);setDetail(null);setReviews(null);
   const product=await getProductDetail(reference);
   if(requestId.current!==current)return;
   setDetail(product);
   const variants=Array.isArray(product?.variants)?product.variants:[];
   const defaultVariant=variants.find((item:any)=>item?.default===true&&item?.available===true)||variants.find((item:any)=>item?.available===true)||variants[0];
   setVariantId(safeReference(defaultVariant?.id,160)||'');
   setQuantity(1);
   const images=Array.isArray(product?.images)?product.images:[];
   const firstImage=images.find((item:any)=>item?.primary===true)||images[0];
   setSelectedImagePath(safeText(firstImage?.path,1200));
   if(product?.id){
    try{const nextReviews=await listProductReviews(product.id,20,0);if(requestId.current===current)setReviews(nextReviews);}catch{if(requestId.current===current)setReviews(null);}
   }
  }catch{if(requestId.current===current)setError('Ürün bilgileri şu anda yüklenemedi. Lütfen tekrar deneyin.');}
  finally{if(requestId.current===current)setLoading(false);}
 }
 useEffect(()=>{void load();return()=>{requestId.current+=1;};},[reference]);
 useEffect(()=>{let active=true;setSafetyContent(null);getProductSafety(reference,'tr').then(data=>{if(active)setSafetyContent(data);}).catch(()=>{if(active)setSafetyContent(null);});return()=>{active=false;};},[reference]);

 const experience=useMemo(()=>buildProductExperience(detail||{}),[detail]);
 useEffect(()=>{setSelectedOrderOptions(defaultOrderOptions(experience.optionSchema));},[detail?.id,experience.customizationKind]);
 const variant=useMemo(()=>Array.isArray(detail?.variants)?detail.variants.find((item:any)=>item?.id===variantId)||null:null,[detail,variantId]);
 const images=Array.isArray(detail?.images)?detail.images:[];
 const selectedImage=images.find((item:any)=>item?.path===selectedImagePath)||images.find((item:any)=>item?.primary===true)||images[0]||null;
 const selectedImageIndex=Math.max(0,images.findIndex((item:any)=>item?.path===selectedImage?.path));
 const selectedImageUrl=selectedImage?.path?publicCatalogUrl(selectedImage.path):'';
 const activeBadges=Array.isArray(detail?.trustBadges)?detail.trustBadges.filter((badge:any)=>badge&&typeof badge==='object'&&badge.active===true&&safeText(badge.label,120)):[];
 const hasTraceability=detail?.traceability?.hasReleasedBatches===true;
 const tracked=detail?.stockMode==='tracked'||detail?.stockMode==='seasonal';
 const variantStock=safeInteger(variant?.availableQuantity);
 const stockReady=!tracked||variantStock!==null;
 const soldOut=variant?.available===false||(tracked&&variantStock!==null&&variantStock<=0);
 const maxQuantity=tracked&&variantStock!==null?Math.max(1,Math.min(99,variantStock)):99;
 const preorder=detail?.stockMode==='preorder';
 const preorderLeadDays=safeInteger(detail?.preorderLeadDays);
 const currency=safeCurrency(detail?.currency);
 const priceMinor=safeInteger(variant?.priceMinor);
 const compareAtPriceMinor=safeInteger(variant?.compareAtPriceMinor);
 const priceReady=currency!==null&&priceMinor!==null;
 const compareAtPriceReady=currency!==null&&priceMinor!==null&&compareAtPriceMinor!==null&&compareAtPriceMinor>priceMinor;
 const variantReference=safeReference(variant?.id,160);
 const orderConfigurationError=validateOrderOptions(experience.optionSchema,selectedOrderOptions);
 const purchaseReady=variant?.available===true&&variantReference!==null&&priceReady&&stockReady&&!soldOut&&!orderConfigurationError;
 useEffect(()=>{setQuantity(current=>Math.max(1,Math.min(current,maxQuantity)));},[variantId,maxQuantity]);
 useEffect(()=>{if(!imageViewerOpen||images.length<2)return;const onKeyDown=(event:KeyboardEvent)=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const delta=event.key==='ArrowLeft'?-1:1;const next=(selectedImageIndex+delta+images.length)%images.length;setSelectedImagePath(safeText(images[next]?.path,1200));};document.addEventListener('keydown',onKeyDown,true);return()=>document.removeEventListener('keydown',onKeyDown,true);},[imageViewerOpen,images,selectedImageIndex]);

 const favoriteReference=String(detail?.legacyId||detail?.id||'');
 const isFavorite=favoriteOverride??favoriteReferences.includes(favoriteReference);
 const featureItems=normalizeFeatures(detail?.features);
 const reviewCount=firstInteger(reviews?.summary?.count,detail?.reviewSummary?.count);
 const averageRating=firstRating(reviews?.summary?.averageRating,detail?.reviewSummary?.averageRating);

 function purchaseIssueMessage(){if(orderConfigurationError)return orderConfigurationError;if(soldOut)return'Bu ürün şu anda stokta yok. Stok güncellemesi için lütfen daha sonra tekrar kontrol edin.';if(!priceReady)return'Fiyat bilgisi şu anda gösterilemiyor. Lütfen sayfayı yenileyin.';if(!stockReady)return'Stok bilgisi yenileniyor. Lütfen birkaç saniye bekleyin.';return'Bu seçenek şu anda satın alınamıyor. Lütfen farklı bir seçenek deneyin.';}
 function moveImage(delta:number){if(images.length<2)return;const next=(selectedImageIndex+delta+images.length)%images.length;setSelectedImagePath(safeText(images[next]?.path,1200));}
 function selectedOptionsPayload(){const customization=buildOrderCustomization(experience,selectedOrderOptions);return customization?{orderCustomization:customization}:{};}
 async function addToCart(){
  if(!authenticated){onLoginRequired();return;}
  if(!purchaseReady||!variantReference){setError(purchaseIssueMessage());return;}
  try{setBusy(true);setError('');setStatus('');await setCartItem({variantId:variantReference,quantity,selectedOptions:selectedOptionsPayload()});await onCartChanged?.();setStatus(preorder?'Sipariş sepete eklendi.':'Sepete eklendi.');}
  catch(err){setError(err instanceof Error&&err.message?err.message:'Ürün sepete eklenemedi. Lütfen tekrar deneyin.');}
  finally{setBusy(false);}
 }
 function pushInternalRoute(url:string,tab:string){const currentDepth=Number(window.history.state?.goldenOremarDepth);const nextDepth=Number.isSafeInteger(currentDepth)&&currentDepth>=0?currentDepth+1:1;const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab};window.history.pushState(state,'',url);window.dispatchEvent(new PopStateEvent('popstate',{state}));window.scrollTo({top:0,behavior:'auto'});}
 function navigateToCart(){const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('tab','cart');pushInternalRoute(url.toString(),'cart');}
 function navigateToCategory(slug:string){pushInternalRoute(buildSearchUrl({query:'',categorySlug:slug,producerId:null}),'search-results');}
 async function buyNow(){
  if(!authenticated){onLoginRequired();return;}
  if(!purchaseReady||!variantReference){setError(purchaseIssueMessage());return;}
  try{setBusy(true);setError('');setStatus('');await setCartItem({variantId:variantReference,quantity,selectedOptions:selectedOptionsPayload()});await onCartChanged?.();navigateToCart();}
  catch(err){setError(err instanceof Error&&err.message?err.message:'Satın alma işlemi başlatılamadı. Lütfen tekrar deneyin.');}
  finally{setBusy(false);}
 }
 async function favorite(){
  if(!authenticated){onLoginRequired();return;}
  const target=safeReference(detail?.slug)||safeReference(detail?.id,160);
  if(!target){setError('Favori işlemi şu anda kullanılamıyor.');return;}
  try{setBusy(true);setError('');setStatus('');const result=await toggleProductFavorite(target);const next=result?.isFavorite===true;const ref=String(result?.productReference||favoriteReference);setFavoriteOverride(next);onFavoriteChanged?.(ref,next);setStatus(next?'Favorilerinize eklendi.':'Favorilerinizden çıkarıldı.');}
  catch{setError('Favori işlemi tamamlanamadı. Lütfen tekrar deneyin.');}
  finally{setBusy(false);}
 }
 async function shareProduct(){
  if(shareBusy)return;
  try{setShareBusy(true);setError('');setStatus('');const productReference=safeReference(detail?.slug)||safeReference(reference)||safeReference(detail?.legacyId)||safeReference(detail?.id,160);if(!productReference)throw new Error();const result=await shareOrCopy({title:safeText(detail?.name,300)||'Golden Oremar ürünü',text:safeText(detail?.shortDescription||detail?.description,800),url:buildProductUrl(productReference)});if(result==='copied')setStatus('Ürün bağlantısı kopyalandı.');else if(result==='shared')setStatus('Paylaşım menüsü açıldı.');}
  catch{setError('Ürün bağlantısı şu anda paylaşılamıyor.');}
  finally{setShareBusy(false);}
 }
 async function copyTrace(code:string){try{await copyText(code);setStatus('İzlenebilirlik kodu kopyalandı.');}catch{setError('Kod kopyalanamadı.');}}

 if(loading)return<div role="status" aria-live="polite" className="mx-auto max-w-5xl p-8 text-center text-brand-muted">Ürün hazırlanıyor…</div>;
 if(error&&!detail)return<div className="mx-auto max-w-5xl p-5"><div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div><button type="button" onClick={onBack} className="mt-4 min-h-11 rounded-full border border-brand-border px-5 font-bold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4"/>Geri dön</button></div>;
 if(!detail)return null;

 const detailName=safeText(detail.name,300)||'Ürün';
 const categoryName=safeText(detail?.category?.name,160);
 const categorySlug=safeReference(detail?.category?.slug,220);
 const producerLocation=safeText(detail?.producer?.locationLabel,240)||safeText(detail?.origin,240);
 const producerId=safeReference(detail?.producer?.id,160);
 const productId=safeReference(detail?.id,160);
 const questionReady=Boolean(producerId&&productId);
 const cartAdded=status==='Sepete eklendi.'||status==='Sipariş sepete eklendi.';

 return<article className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
  <div className="sticky z-30 -mx-4 mb-4 flex min-h-16 items-center gap-2 border-b border-brand-border bg-brand-card/95 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6" style={{top:'env(safe-area-inset-top, 0px)', paddingTop:'env(safe-area-inset-top, 0px)'}}>
   <button type="button" onClick={onBack} aria-label="Geri" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-border bg-brand-card"><ArrowLeft aria-hidden="true" className="h-5 w-5"/></button>
   <div className="min-w-0 flex-1 text-center"><div className="truncate text-sm font-black text-brand-text">Ürün Detayı</div></div>
   <button type="button" onClick={()=>void favorite()} disabled={busy} aria-label={isFavorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={isFavorite} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-border bg-brand-card disabled:opacity-50"><Heart aria-hidden="true" className={`h-5 w-5 ${isFavorite?'fill-red-500 text-red-500':'text-brand-text'}`}/></button>
   <button type="button" onClick={()=>void shareProduct()} disabled={shareBusy} aria-label="Ürünü paylaş" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-border bg-brand-card disabled:opacity-50"><Share2 aria-hidden="true" className="h-5 w-5"/></button>
  </div>

  {error?<div role="alert" className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">⚠ {error}</div>:null}
  {status?<div role="status" aria-live="polite" className="mb-4 rounded-2xl border-2 border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">{cartAdded?<div className="flex items-center justify-between gap-3"><span>✓ {status}</span><button type="button" onClick={navigateToCart} className="min-h-11 rounded-full border-2 border-green-700 bg-green-700 px-3 font-black text-white shadow-sm transition-all hover:bg-green-800">Sepete Git</button></div>:`✓ ${status}`}</div>:null}

  <div className="grid gap-6 lg:grid-cols-2">
   <section aria-label="Ürün görselleri">
    <div className="group relative">
     <ProductImageWithSkeleton src={selectedImageUrl} alt={safeText(selectedImage.alt,300)||detailName} aspectRatio="square" objectFit="contain" priority className="rounded-3xl border-2 border-brand-border shadow-sm"/>
     {images.length>1?<div className="absolute left-3 top-3 rounded-full border-2 border-white/80 bg-black/60 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur-sm dark:border-gray-700">{selectedImageIndex+1} / {images.length}</div>:null}
     <button type="button" onClick={()=>setImageViewerOpen(true)} aria-label="Görseli büyüt" className="absolute bottom-3 right-3 grid min-h-11 min-w-11 place-items-center rounded-full border-2 border-white/80 bg-black/60 text-white shadow-lg backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 dark:border-gray-700"><ZoomIn aria-hidden="true" className="h-5 w-5"/></button>
    </div>
    {images.length>1?<div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">{images.slice(0,12).map((image:any,index:number)=>{const src=publicCatalogUrl(image?.path);const isSelected=selectedImage?.path===image.path;return src?<button type="button" key={`${safeText(image.path,1200)}:${index}`} onClick={()=>setSelectedImagePath(safeText(image.path,1200))} aria-label={`${detailName} görseli ${index+1}`} aria-pressed={isSelected} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-brand-card transition ${isSelected?'border-brand-gold shadow-lg ring-2 ring-brand-gold/30':'border-brand-border hover:border-brand-gold/50'}`}><img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" onError={e=>{const img=e.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='1';img.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"%3E%3Cpath d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"%3E%3C/path%3E%3Cpolyline points="9 22 9 12 15 12 15 22"%3E%3C/polyline%3E%3C/svg%3E';img.style.padding='12px';img.style.opacity='0.3';}}/>{isSelected?<div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-brand-gold" aria-hidden="true"/>:null}</button>:null;})}</div>:null}
   </section>

   <section>
    {categoryName?categorySlug?<button type="button" onClick={()=>onCategory?onCategory(categorySlug,categoryName):navigateToCategory(categorySlug)} aria-label={`${categoryName} kategorisini aç`} className="group inline-flex min-h-11 items-center gap-1 rounded-full border border-brand-gold/35 bg-brand-gold/5 px-3 text-xs font-black uppercase tracking-[0.12em] text-brand-gold transition hover:border-brand-gold hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><span>{categoryName}</span><ChevronRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"/></button>:<div className="text-xs font-black uppercase tracking-[0.14em] text-brand-gold">{categoryName}</div>:null}
    <div className="mt-3 text-xs font-black tracking-[0.08em] text-brand-gold">{experience.kicker}</div>
    <h1 className="mt-1 text-3xl font-black leading-tight text-brand-green dark:text-brand-gold">{detailName}</h1>
    {producerLocation?<div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-muted"><MapPin aria-hidden="true" className="h-4 w-4 text-brand-gold"/><span>{producerLocation}</span></div>:null}

    <div className="mt-4 rounded-3xl border-2 border-brand-border bg-brand-card p-4 shadow-lg"><div className="flex items-end justify-between gap-3"><div>{priceReady?<div><div className="text-2xl font-black text-brand-green dark:text-brand-gold">{money(priceMinor,currency)}</div>{compareAtPriceReady?<div className="mt-1 text-sm font-semibold text-brand-muted line-through">Önce {money(compareAtPriceMinor,currency)}</div>:null}</div>:<div className="font-bold text-brand-muted">Fiyat şu anda gösterilemiyor</div>}{preorder?<div className="mt-1 text-xs font-black uppercase tracking-wider text-brand-gold">Sipariş üzerine hazırlanır</div>:null}</div><div className={`text-sm font-bold ${soldOut?'text-red-700 dark:text-red-300':'text-brand-muted'}`}>{soldOut?'❌ Stokta yok':tracked&&variantStock!==null?variantStock<=5?`⚠️ ${variantStock} adet kaldı`:'✓ Stokta':'✓ Satışta'}</div></div></div>

    {safeText(detail.shortDescription,1000)?<p className="mt-4 text-[15px] leading-7 text-brand-muted">{safeText(detail.shortDescription,1000)}</p>:null}

    {Array.isArray(detail.variants)&&detail.variants.length>1?<label className="mt-5 block"><span className="text-sm font-black">Paket / seçenek <span className="text-red-500" aria-label="zorunlu">*</span></span><select value={variantId} onChange={event=>setVariantId(event.target.value)} className="input mt-2">{detail.variants.map((item:any)=>{const id=safeReference(item?.id,160)||'';return<option key={id||safeText(item?.name,240)} value={id} disabled={item?.available===false}>{safeText(item?.name,240)||'Seçenek'}{item?.available===false?' (Stokta yok)':''}</option>;})}</select></label>:null}

    <PremiumOrderConfigurator lead={experience.orderLead} schema={experience.optionSchema} selected={selectedOrderOptions} onChange={setSelectedOrderOptions} disabled={busy||soldOut}/>

    <div className="mt-5 flex items-center justify-between gap-3"><span className="text-sm font-black">Adet <span className="text-red-500" aria-label="zorunlu">*</span></span><div className="inline-flex items-center rounded-full border-2 border-brand-border bg-brand-card shadow-sm"><button type="button" onClick={()=>setQuantity(value=>Math.max(1,value-1))} disabled={!purchaseReady||busy||quantity<=1} aria-label="Miktarı azalt" className="grid min-h-11 min-w-11 place-items-center rounded-l-full transition-all hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-40"><Minus aria-hidden="true" className="h-4 w-4"/></button><output aria-live="polite" className="min-w-10 px-1 text-center font-black">{quantity}</output><button type="button" onClick={()=>setQuantity(value=>Math.min(maxQuantity,value+1))} disabled={!purchaseReady||busy||quantity>=maxQuantity} aria-label="Miktarı artır" className="grid min-h-11 min-w-11 place-items-center rounded-r-full transition-all hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-40"><Plus aria-hidden="true" className="h-4 w-4"/></button></div></div>

    {!purchaseReady&&!soldOut&&stockReady?<div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">⚠️ {purchaseIssueMessage()}</div>:null}

    <div className="product-detail-commerce-dock mt-5" aria-label="Satın alma seçenekleri">
     <div className="product-detail-commerce-actions grid gap-2"><button type="button" aria-label="Hediye et" onClick={()=>authenticated?onGift(detail.slug||detail.id):onLoginRequired()} disabled={busy||!purchaseReady} className="product-detail-commerce-gift min-h-12 font-black disabled:cursor-not-allowed disabled:opacity-50"><Gift aria-hidden="true" className="h-4 w-4"/><span>Hediye Et</span></button><button type="button" onClick={()=>void addToCart()} disabled={busy||!purchaseReady} className="product-detail-commerce-cart min-h-12 font-black disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart aria-hidden="true" className="h-4 w-4"/><span>{busy?'İşleniyor…':preorder?'Sipariş Ver':'Sepete Ekle'}</span></button><button type="button" onClick={()=>void buyNow()} disabled={busy||!purchaseReady} className="product-detail-commerce-buy min-h-12 font-black disabled:cursor-not-allowed disabled:opacity-50">{preorder?<span>Siparişi Tamamla</span>:<span>Hemen Satın Al</span>}</button></div>
    </div>

    {preorder?<div className="mt-3 flex items-start gap-2 rounded-2xl border-2 border-brand-gold/25 bg-brand-gold/5 p-3 text-sm font-semibold leading-relaxed text-brand-muted"><Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"/><span>{preorderLeadDays!==null&&preorderLeadDays>0?`Bu ürün siparişten sonra hazırlanır. Kayıtlı hazırlık süresi yaklaşık ${preorderLeadDays} gündür.`:'Bu ürün hazır stok mantığıyla değil, sipariş üzerine hazırlık akışıyla ilerler.'}</span></div>:null}

    {detail.producer?.id?<button type="button" onClick={()=>onProducer(String(detail.producer.id),safeText(detail.producer.slug,220)||String(detail.producer.id),safeText(detail.producer.name,240)||'Üretici')} className="mt-5 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-brand-border bg-brand-card p-3 text-left"><Store aria-hidden="true" className="h-5 w-5 text-brand-gold"/><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-bold">{safeText(detail.producer.name,240)||'Üretici'}{detail.producer?.verified===true?<CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand-green"/>:null}</span>{producerLocation?<span className="mt-0.5 block text-sm text-brand-muted">{producerLocation}</span>:null}</span><span className="text-sm font-bold text-brand-green">Mağazaya git</span></button>:null}

    {questionReady?<button type="button" onClick={()=>{if(!authenticated){onLoginRequired();return;}setQuestionOpen(value=>!value);setError('');setStatus('');}} aria-expanded={questionOpen} className="mt-2 min-h-11 w-full rounded-xl border-2 border-brand-green bg-white px-4 font-bold text-brand-green shadow-sm transition-all hover:bg-brand-green/5 active:scale-[0.98] dark:bg-gray-900 dark:hover:bg-brand-green/10"><MessageCircle aria-hidden="true" className="mr-2 inline h-4 w-4"/>Üreticiye soru sor</button>:null}
    {questionOpen&&producerId&&productId?<ProducerQuestionComposer className="mt-3" context={{kind:'product',producerId,productId,productName:detailName}} onCancel={()=>setQuestionOpen(false)} onStarted={()=>{setQuestionOpen(false);setStatus('✓ Sorunuz üreticiye gönderildi. Yanıtı Hesabım > Mesajlarım bölümünden takip edebilirsiniz.');}}/>:null}

    {activeBadges.length?<div className="mt-4 flex flex-wrap gap-2">{activeBadges.slice(0,6).map((badge:any)=><span key={safeText(badge.key,80)||safeText(badge.label,120)} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 dark:bg-green-950/30 dark:text-green-200"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>{safeText(badge.label,120)}</span>)}</div>:null}
    {reviewCount!==null&&reviewCount>0?<div className="mt-4 flex items-center gap-2 text-sm"><Star aria-hidden="true" className="h-5 w-5 fill-brand-gold text-brand-gold"/><strong>{averageRating!==null?averageRating.toFixed(1):'-'}</strong><span className="text-brand-muted">{reviewCount} yorum</span></div>:null}
   </section>
  </div>

  <section aria-labelledby="product-story-title" className="mt-8 overflow-hidden rounded-3xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-card shadow-sm">
   <div className="p-5 sm:p-7"><div className="text-xs font-black uppercase tracking-[0.16em] text-brand-gold">{experience.kicker}</div><h2 id="product-story-title" className="mt-2 text-2xl font-black text-brand-green dark:text-brand-gold">Ürün Hikâyesi</h2><p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-brand-muted">{experience.story}</p>{safeText(detail.origin,240)?<div className="mt-5 flex items-center gap-2 border-t border-brand-gold/20 pt-4 text-sm font-black text-brand-text"><MapPin aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safeText(detail.origin,240)}</div>:null}</div>
  </section>

  <div className="mt-6 space-y-3">
   {featureItems.length?<Accordion title="Ürün Özellikleri"><ul className="grid gap-2 sm:grid-cols-2">{featureItems.map((item,index)=><li key={`${item}-${index}`} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">{item}</li>)}</ul></Accordion>:null}
   <Accordion title="Gıda Güvenliği & Kullanım"><ProductSafetyPanel safety={safetyContent?.safety} summary={safetyContent?.summary} heading="Güvenli kullanım bilgileri"/></Accordion>
   <Accordion title="Teslimat Bilgileri"><ShippingReadiness detail={detail} variant={variant}/></Accordion>
   <Accordion title="Lot & İzlenebilirlik"><Traceability detail={detail} hasTraceability={hasTraceability} onCopy={copyTrace}/></Accordion>
   {Array.isArray(detail.certifications)&&detail.certifications.length?<Accordion title="Sertifikalar"><Certifications items={detail.certifications}/></Accordion>:null}
   <Accordion title="Müşteri Yorumları"><Reviews reviews={reviews} reviewCount={reviewCount} averageRating={averageRating}/></Accordion>
  </div>

  {imageViewerOpen&&selectedImageUrl?<div className="fixed inset-0 z-[120] flex bg-black/95 p-2 sm:p-5"><div ref={imageViewerDialogRef} role="dialog" aria-modal="true" aria-labelledby="product-image-viewer-title" tabIndex={-1} className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-black/95 text-white outline-none"><div className="flex min-h-14 items-center gap-3 border-b border-white/15 px-3 sm:px-4"><h2 id="product-image-viewer-title" className="min-w-0 flex-1 truncate text-sm font-black">{detailName}</h2>{images.length>1?<span className="text-xs font-bold text-white/70">{selectedImageIndex+1} / {images.length}</span>:null}<button type="button" onClick={()=>setImageViewerOpen(false)} aria-label="Görseli kapat" className="grid min-h-11 min-w-11 place-items-center rounded-full border-2 border-white/20 bg-white/10 transition hover:bg-white/20"><X aria-hidden="true" className="h-5 w-5"/></button></div><div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4" style={{touchAction:'pinch-zoom'}}>{images.length>1?<button type="button" onClick={()=>moveImage(-1)} aria-label="Önceki ürün görseli" className="absolute left-2 z-10 grid min-h-12 min-w-12 place-items-center rounded-full border-2 border-white/20 bg-black/70 backdrop-blur-sm transition hover:bg-black/85 sm:left-4 sm:min-h-14 sm:min-w-14"><ChevronLeft aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7"/></button>:null}<img src={selectedImageUrl} alt={safeText(selectedImage.alt,300)||detailName} className="max-h-full max-w-full object-contain" decoding="async" onError={e=>{const img=e.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='1';img.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E';img.style.maxWidth='240px';img.style.opacity='0.3';}}/>{images.length>1?<button type="button" onClick={()=>moveImage(1)} aria-label="Sonraki ürün görseli" className="absolute right-2 z-10 grid min-h-12 min-w-12 place-items-center rounded-full border-2 border-white/20 bg-black/70 backdrop-blur-sm transition hover:bg-black/85 sm:right-4 sm:min-h-14 sm:min-w-14"><ChevronRight aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7"/></button>:null}</div>{images.length>1?<div className="hide-scrollbar flex gap-2 overflow-x-auto border-t border-white/15 p-3 sm:p-4">{images.slice(0,12).map((image:any,index:number)=>{const src=publicCatalogUrl(image?.path);const isSelected=selectedImage?.path===image.path;return src?<button type="button" key={`viewer-${safeText(image.path,1200)}:${index}`} onClick={()=>setSelectedImagePath(safeText(image.path,1200))} aria-label={`${detailName} görseli ${index+1}`} aria-pressed={isSelected} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white/5 transition sm:h-20 sm:w-20 ${isSelected?'border-brand-gold shadow-lg':'border-white/20 hover:border-white/40'}`}><img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" onError={e=>{const img=e.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='1';img.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"%3E%3Cpath d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"%3E%3C/path%3E%3Cpolyline points="9 22 9 12 15 12 15 22"%3E%3C/polyline%3E%3C/svg%3E';img.style.padding='12px';img.style.opacity='0.25';}}/>{isSelected?<div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-brand-gold" aria-hidden="true"/>:null}</button>:null;})}</div>:null}</div></div>:null}
 </article>;
}

function Accordion({title,children}:{title:string;children:React.ReactNode}){return<details className="customer-disclosure"><summary>{title}</summary><div className="customer-disclosure-body">{children}</div></details>;}

function ShippingReadiness({detail,variant}:{detail:any;variant:any}){
 const exp=detail?.export&&typeof detail.export==='object'&&!Array.isArray(detail.export)?detail.export:{};
 const status=safeText(exp.status,80);
 const statusText=status==='eligible'?'Yurtdışı gönderime uygunluk bilgisi mevcut. Teslimat ücreti ve hedef ülke koşulları sipariş öncesinde ayrıca gösterilir.':status==='manual_review'?'Yurtdışı teslimat için ürün ve hedef ülke özelinde uygunluk kontrolü yapılır.':status==='domestic_only'?'Bu ürün şu anda Türkiye içi teslimata açıktır.':'Teslimat seçenekleri adresinize göre sipariş sırasında gösterilir.';
 const weight=safeInteger(variant?.weightGrams),shelfLife=safeInteger(exp.shelfLifeDays);
 return<div><p className="text-sm leading-6 text-brand-muted">{statusText}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{typeof exp.perishable==='boolean'?<Info label="Bozulabilir ürün" value={exp.perishable?'Evet':'Hayır'}/>:null}{typeof exp.requiresColdChain==='boolean'?<Info label="Soğuk zincir" value={exp.requiresColdChain?'Gerekli':'Gerekli değil'}/>:null}{shelfLife!==null&&shelfLife>0?<Info label="Raf ömrü" value={`${shelfLife} gün`}/>:null}{weight!==null&&weight>0?<Info label="Sevkiyat ağırlığı" value={formatWeight(weight)}/>:null}</div></div>;
}
function Info({label,value}:{label:string;value:string}){return<div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xs text-brand-muted">{label}</div><div className="mt-1 font-bold">{value}</div></div>;}

function Traceability({detail,hasTraceability,onCopy}:{detail:any;hasTraceability:boolean;onCopy:(code:string)=>Promise<void>}){
 if(!hasTraceability||!Array.isArray(detail.traceability?.batches)||!detail.traceability.batches.length)return<p className="text-sm text-brand-muted">İzlenebilirlik bilgisi henüz yayınlanmadı.</p>;
 return<div className="space-y-3">{detail.traceability.batches.map((batch:any,index:number)=>{const traceCode=safeText(batch?.traceCode,200);if(!traceCode)return null;return<article key={`${traceCode}:${index}`} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-bold"><QrCode aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safeText(batch.batchCode,200)||'Ürün partisi'}</div><div className="mt-1 text-xs text-brand-muted">Kod: {traceCode}</div></div><button type="button" onClick={()=>void onCopy(traceCode)} className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-bold"><Copy aria-hidden="true" className="mr-1 inline h-4 w-4"/>Kopyala</button></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{batch.harvestDate?<div>Hasat: {dateOnly(batch.harvestDate)}</div>:null}{batch.productionDate?<div>Üretim: {dateOnly(batch.productionDate)}</div>:null}{batch.packagingDate?<div>Paketleme: {dateOnly(batch.packagingDate)}</div>:null}{batch.bestBeforeDate?<div>Tavsiye edilen tüketim: {dateOnly(batch.bestBeforeDate)}</div>:null}{batch.origin?<div>Menşe: {joinLocation(batch.origin)}</div>:null}</div>{safeText(batch.publicNotes,3000)?<p className="mt-3 text-sm leading-6 text-brand-muted">{safeText(batch.publicNotes,3000)}</p>:null}</article>;})}</div>;
}

function Certifications({items}:{items:any[]}){return<div className="space-y-2">{items.slice(0,30).map((cert:any,index:number)=><div key={`${safeText(cert?.type,160)}:${index}`} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><div className="flex items-center gap-2 font-bold"><PackageCheck aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safeText(cert?.type,160)||'Sertifika'}</div>{safeText(cert?.issuer,240)?<div className="mt-1 text-brand-muted">{safeText(cert.issuer,240)}</div>:null}{safeUrl(cert?.verificationUrl)?<a href={safeUrl(cert.verificationUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-bold text-brand-green">Belgeyi görüntüle<ExternalLink aria-hidden="true" className="ml-1 h-4 w-4"/></a>:null}</div>)}</div>;}

function Reviews({reviews,reviewCount,averageRating}:{reviews:any;reviewCount:number|null;averageRating:number|null}){
 if(reviewCount===0)return<div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800"><Star aria-hidden="true" className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"/><p className="mt-3 font-semibold text-gray-600 dark:text-gray-300">Henüz müşteri yorumu yok</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Bu ürüne ilk yorumu yapan siz olun!</p></div>;
 return<div>{reviewCount!==null&&reviewCount>0?<div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-brand-gold/30 bg-brand-gold/5 p-3"><Star aria-hidden="true" className="h-5 w-5 fill-brand-gold text-brand-gold"/><strong className="font-black">{averageRating!==null?averageRating.toFixed(1):'-'}</strong><span className="text-sm font-semibold text-brand-muted">{reviewCount} yorum</span></div>:null}{Array.isArray(reviews?.items)&&reviews.items.length?<div className="space-y-3">{reviews.items.slice(0,20).map((review:any,index:number)=>{const rating=safeRating(review?.rating);return<article key={safeReference(review?.id,160)||`review-${index}`} className="rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"><div className="flex items-center justify-between gap-3"><strong className="font-bold">{safeText(review?.reviewerName,160)||'Müşteri'}</strong>{rating!==null?<div className="flex items-center gap-1" aria-label={`${rating} yıldız`}>{Array.from({length:5}).map((_,i)=><Star key={i} aria-hidden="true" className={`h-4 w-4 ${i<rating?'fill-brand-gold text-brand-gold':'text-gray-300 dark:text-gray-600'}`}/>)}</div>:null}</div>{review?.verifiedPurchase===true?<div className="mt-1 flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>Doğrulanmış satın alma</div>:null}{safeText(review?.title,240)?<h3 className="mt-2 font-bold text-gray-900 dark:text-white">{safeText(review.title,240)}</h3>:null}{safeText(review?.body,5000)?<p className="mt-1 text-sm leading-relaxed text-brand-muted">{safeText(review.body,5000)}</p>:null}{safeText(review?.merchantReply,5000)?<div className="mt-3 rounded-lg border-l-4 border-brand-gold bg-brand-gold/5 p-3 text-sm dark:border-brand-gold/60"><strong className="font-bold">Üretici yanıtı:</strong> <span className="text-brand-muted">{safeText(review.merchantReply,5000)}</span></div>:null}</article>;})}</div>:<div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900/60 dark:bg-amber-950/30"><p className="font-semibold text-amber-900 dark:text-amber-100">⚠️ Yorumlar şu anda görüntülenemiyor</p><p className="mt-1 text-sm text-amber-700 dark:text-amber-200">Lütfen daha sonra tekrar deneyin.</p></div>}</div>;
}

function normalizeFeatures(value:any):string[]{if(Array.isArray(value))return value.flatMap(item=>typeof item==='string'&&item.trim()?[item.trim().slice(0,500)]:item&&typeof item==='object'&&!Array.isArray(item)?Object.entries(item).map(([key,val])=>`${labelKey(key)}: ${formatValue(val)}`):[]).filter(Boolean).slice(0,24);if(value&&typeof value==='object'&&!Array.isArray(value))return Object.entries(value).map(([key,val])=>`${labelKey(key)}: ${formatValue(val)}`).filter(item=>!item.endsWith(': ')).slice(0,24);return[];}
function labelKey(value:string){return value.replace(/[_-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase()).slice(0,120);}
function formatValue(value:any){if(Array.isArray(value))return value.slice(0,20).map(item=>safeText(String(item),120)).filter(Boolean).join(', ');if(value===true)return'Evet';if(value===false)return'Hayır';if(value==null)return'';if(typeof value==='object')return'Ayrıntılı bilgi';return safeText(String(value),500);}
function money(minor:number|null,currency:string|null){if(minor===null||currency===null)return'Fiyat bilgisi yok';const amount=(minor/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});if(currency==='TRY')return`${amount} TL`;try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);}catch{return`${amount} ${currency}`;}}
function formatWeight(grams:number|null){if(grams===null||!Number.isFinite(grams)||grams<=0)return'';return grams>=1000?`${(grams/1000).toLocaleString('tr-TR',{maximumFractionDigits:2})} kg`:`${grams.toLocaleString('tr-TR')} g`;}
function dateOnly(value?:string|null){const raw=safeText(value,80);if(!raw)return'';const date=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(`${raw}T12:00:00`):new Date(raw);if(Number.isNaN(date.getTime()))return'';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium'}).format(date);}catch{return'';}}
function safeUrl(value?:string|null){const raw=safeText(value,1200);if(!raw)return'';try{const url=new URL(raw);return url.protocol==='https:'?url.toString():'';}catch{return'';}}
function joinLocation(origin:any){if(!origin||typeof origin!=='object'||Array.isArray(origin))return'';return[origin?.village,origin?.district,origin?.province,origin?.countryCode].map((item:any)=>safeText(item,120)).filter(Boolean).join(', ');}
