import React,{useEffect,useMemo,useRef,useState}from'react';
import{addToGuestCart}from'../cart/guestCart';
import{ArrowLeft,BadgeCheck,Bell,BellRing,CheckCircle2,ChevronLeft,ChevronRight,Copy,ExternalLink,Gift,Heart,MapPin,MessageCircle,Minus,PackageCheck,Plus,QrCode,Share2,ShieldCheck,ShoppingCart,Star,Store,User,X}from'lucide-react';
import{getProductDetail,listProductReviews,publicCatalogUrl,toggleProducerFollow,toggleProductFavorite}from'./api';
// The review form is loaded only when a customer taps "Değerlendirme yaz".
const ProductReviewComposer=React.lazy(()=>import('./ProductReviewComposer'));
import PremiumOrderConfigurator from'./PremiumOrderConfigurator';
import{buildOrderCustomization,buildProductExperience,defaultOrderOptions,validateOrderOptions,type SelectedOrderOptions}from'./productExperience';
import{HealthInfo,UsageInfo,hasHealthInfo,hasUsageInfo}from'./ProductCareSections';
import{getProductSafety}from'../content/productSafetyApi';
import ProducerQuestionComposer from'../account/ProducerQuestionComposer';
import{setCartItem}from'../cart/api';
import{getCheckoutPaymentCapabilities}from'../payments/commerceApi';
import OfflineOrderSheet from'../orders/OfflineOrderSheet';
import{getOfflineOrderingConfig,offlineOrderingAvailable}from'../orders/offlineOrderApi';
import{buildProductUrl,copyText,shareOrCopy}from'../navigation/appUrl';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import{productMaker,shortOrigin}from'./productMakers';
import ProductGallery,{type GallerySlide}from'./ProductGallery';
import{isBrandFallbackImage}from'./ProductArtwork';
import{SHIPPED_ORIGIN_PHOTOS}from'../media/productOriginPhotoManifest';
import{DetailAccordion,DetailAccordionGroup}from'./DetailAccordion';
import{isFollowingStore}from'./storeFollowApi';
import'./productDetailV4.css';
import{productSeo,type SeoAvailability}from'../seo/seoModel';
import{applySeo,clearSeoStructuredData,publicSeoOrigin}from'../seo/applySeo';
import{withdrawalTier,WITHDRAWAL_COPY}from'./withdrawalRight';
import{buildTabUrl}from'../navigation/appUrl';
import ProductRecommendationsShelf from'./ProductRecommendationsShelf';
import type{ProductRecommendation}from'./productRecommendationsApi';

/* Editorial product page (2026-10-03): photo with its slide bar, the
   prestige line and "Kargo bizden" under it, title, price (for the chosen
   quantity) and pack, the purchase buttons, then the story, the product
   information, the facts table (Kökeni, Üretim, Ambalaj, İade, Stok, Teslimat),
   health, how to use it, the producer, the reviews and, after them, the
   products that suit this one. The price is shown once. */

type Props={
 reference:string;
 authenticated:boolean;
 favoriteReferences?:string[];
 onFavoriteChanged?:(reference:string,isFavorite:boolean)=>void;
 onBack:()=>void;
 onLoginRequired:()=>void;
 onCartChanged?:()=>Promise<void>|void;
 onGift:(reference:string,quantity:number)=>void;
 onProducer:(id:string,slug:string,name:string)=>void;
 onCategory?:(slug:string,name:string)=>void;
 /** Opens another product (recommendations inside the page). */
 onOpenProduct?:(reference:string)=>void;
 /** Adds a recommended product (the shelf after the reviews) to the cart. */
 onAddCatalogItem?:(item:ProductRecommendation,quantity:number)=>Promise<void>|void;
};

const ORIGIN_PHOTOS=new Set(SHIPPED_ORIGIN_PHOTOS);
function safeText(value:unknown,max=1000){return typeof value==='string'?value.trim().slice(0,max):'';}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
function safeRating(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=5?value:null;}
function safeCurrency(value:unknown){const currency=safeText(value,3).toUpperCase();return/^[A-Z]{3}$/.test(currency)?currency:null;}
function safeReference(value:unknown,max=220){const normalized=safeText(value,max);return normalized||null;}
function firstInteger(...values:unknown[]){for(const value of values){const parsed=safeInteger(value);if(parsed!==null)return parsed;}return null;}
function firstRating(...values:unknown[]){for(const value of values){const parsed=safeRating(value);if(parsed!==null)return parsed;}return null;}

export default function ProductDetailScreen({reference,authenticated,favoriteReferences=[],onFavoriteChanged,onBack,onLoginRequired,onCartChanged,onGift,onProducer,onCategory,onOpenProduct,onAddCatalogItem}:Props){
 const[detail,setDetail]=useState<any>(null);
 const[safetyContent,setSafetyContent]=useState<any>(null);
 const[reviews,setReviews]=useState<any>(null);
 const[reviewComposerOpen,setReviewComposerOpen]=useState(false);
 const[following,setFollowing]=useState(false);
 const[followBusy,setFollowBusy]=useState(false);
 const[followError,setFollowError]=useState('');
 const[variantId,setVariantId]=useState('');
 const[quantity,setQuantity]=useState(1);
 const[selectedOrderOptions,setSelectedOrderOptions]=useState<SelectedOrderOptions>({});
 const[selectedImagePath,setSelectedImagePath]=useState('');
 const[imageViewerOpen,setImageViewerOpen]=useState(false);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState(false);
 const[offlineOrderOpen,setOfflineOrderOpen]=useState(false);
 const[offlineGift,setOfflineGift]=useState(false);
 const[shareBusy,setShareBusy]=useState(false);
 const[error,setError]=useState('');
 const[status,setStatus]=useState('');
 const[favoriteOverride,setFavoriteOverride]=useState<boolean|null>(null);
 const[questionOpen,setQuestionOpen]=useState(false);
 const[showHeaderTitle,setShowHeaderTitle]=useState(false);
 const[viewerZoom,setViewerZoom]=useState<{x:number;y:number}|null>(null);
 const titleRef=useRef<HTMLHeadingElement|null>(null);
 const swipeStartRef=useRef<{x:number;y:number}|null>(null);
 const requestId=useRef(0);
 const imageViewerDialogRef=useAccessibleDialog<HTMLDivElement>(imageViewerOpen,()=>setImageViewerOpen(false));
 
 // Page metadata from the loaded product, via the same builder the build-time
 // prerender uses. This runs after the live data arrives, so the document
 // Google finally renders carries the current price and stock state rather
 // than the build snapshot. Cleared on leave so Product schema does not
 // linger on other screens.
 useEffect(()=>{
  if(!detail)return;
  const d:any=detail;
  const variants:any[]=Array.isArray(d.variants)?d.variants:[];
  const variant=variants.find(v=>v?.default)||variants[0]||null;
  const images:any[]=Array.isArray(d.images)?d.images:[];
  const primary=images.find(i=>i?.primary)||images[0]||null;
  const stockMode=String(d.stockMode||'');
  const soldOut=variant&&(variant.available===false||(typeof variant.availableQuantity==='number'&&variant.availableQuantity<=0&&stockMode!=='preorder'));
  const availability:SeoAvailability=stockMode==='preorder'?'preorder':soldOut?'out_of_stock':'in_stock';
  const slug=String(d.slug||'').trim();
  if(!slug)return;
  applySeo(productSeo({
   slug,
   name:String(d.name||'').trim()||'Ürün',
   description:String(d.shortDescription||d.description||'').trim(),
   imageUrl:primary?.path?publicCatalogUrl(primary.path)||null:null,
   priceMinor:typeof variant?.priceMinor==='number'?variant.priceMinor:null,
   currency:String(variant?.currency||d.currency||'TRY'),
   availability,
   brandName:d.producer?.name?String(d.producer.name):null,
   categoryName:d.category?.name?String(d.category.name):null,
   categorySlug:d.category?.slug?String(d.category.slug):null,
   ratingAverage:null,
   ratingCount:0,
  },publicSeoOrigin()));
  return()=>clearSeoStructuredData();
 },[detail]);
 useEffect(()=>{if(!status)return;const timer=setTimeout(()=>setStatus(''),4000);return()=>clearTimeout(timer);},[status]);
 // The top bar names the product once its title has scrolled out of view.
 useEffect(()=>{const el=titleRef.current;if(!el||typeof IntersectionObserver==='undefined'){setShowHeaderTitle(false);return;}const observer=new IntersectionObserver(([entry])=>setShowHeaderTitle(!entry.isIntersecting&&entry.boundingClientRect.top<0),{threshold:0});observer.observe(el);return()=>observer.disconnect();},[detail,loading]);
 // Phones show the calm bottom bar only while the purchase buttons are out of view.
 useEffect(()=>{setViewerZoom(null);},[selectedImagePath,imageViewerOpen]);

 async function load(){
  const current=++requestId.current;
  try{
   setLoading(true);setError('');setStatus('');setFavoriteOverride(null);setQuestionOpen(false);setImageViewerOpen(false);setViewerZoom(null);setDetail(null);setReviews(null);setReviewComposerOpen(false);setFollowError('');
   const product=await getProductDetail(reference);
   if(requestId.current!==current)return;
   setDetail(product);
   const variants=Array.isArray(product?.variants)?product.variants:[];
   const defaultVariant=variants.find((item:any)=>item?.default===true&&item?.available===true)||variants.find((item:any)=>item?.available===true)||variants[0];
   setVariantId(safeReference(defaultVariant?.id,160)||'');
   setQuantity(1);
   const images=Array.isArray(product?.images)?product.images.filter((item:any)=>!isBrandFallbackImage(item?.path)):[];
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
 // Real photos only. The store logo the catalogue uses for products without
 // a photo is replaced by the product's drawn artwork in the gallery.
 const images=Array.isArray(detail?.images)?detail.images.filter((item:any)=>safeText(item?.path,1200)&&!isBrandFallbackImage(item.path)):[];
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
 // Whether the signed-in customer already follows this store (same metric
 // the catalogue cards use). A failed lookup leaves the button at "follow".
 const followProducerId=safeReference(detail?.producer?.id,160);
 useEffect(()=>{let active=true;setFollowing(false);if(!authenticated||!followProducerId)return;isFollowingStore(followProducerId).then(value=>{if(active&&value!==null)setFollowing(value);}).catch(()=>{});return()=>{active=false;};},[authenticated,followProducerId]);
 useEffect(()=>{if(!imageViewerOpen||images.length<2)return;const onKeyDown=(event:KeyboardEvent)=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const delta=event.key==='ArrowLeft'?-1:1;const next=(selectedImageIndex+delta+images.length)%images.length;setSelectedImagePath(safeText(images[next]?.path,1200));};document.addEventListener('keydown',onKeyDown,true);return()=>document.removeEventListener('keydown',onKeyDown,true);},[imageViewerOpen,images,selectedImageIndex]);

 const favoriteReference=String(detail?.legacyId||detail?.id||'');
 const isFavorite=favoriteOverride??favoriteReferences.includes(favoriteReference);
 const featureItems=normalizeFeatures(detail?.features);
 const reviewCount=firstInteger(reviews?.summary?.count,detail?.reviewSummary?.count);
 const averageRating=firstRating(reviews?.summary?.averageRating,detail?.reviewSummary?.averageRating);

 function purchaseIssueMessage(){if(orderConfigurationError)return orderConfigurationError;if(soldOut)return'Bu ürün şu anda stokta yok. Stok güncellemesi için lütfen daha sonra tekrar kontrol edin.';if(!priceReady)return'Fiyat bilgisi şu anda gösterilemiyor. Lütfen sayfayı yenileyin.';if(!stockReady)return'Stok bilgisi yenileniyor. Lütfen birkaç saniye bekleyin.';return'Bu seçenek şu anda satın alınamıyor. Lütfen farklı bir seçenek deneyin.';}
 function moveImage(delta:number){if(images.length<2)return;const next=(selectedImageIndex+delta+images.length)%images.length;setSelectedImagePath(safeText(images[next]?.path,1200));}
 function selectedOptionsPayload(){const customization=buildOrderCustomization(experience,selectedOrderOptions);return customization?{orderCustomization:customization}:{};}
 // A visitor's choice goes to the cart on this device; signing in moves it
 // into the account cart (see cart/guestCart.ts).
 function addToGuestCartFromPage(){
  addToGuestCart({variantId:variantReference!,selectedOptions:selectedOptionsPayload(),productSlug:safeText(detail?.slug,220)||safeText(detail?.id,160),productName:safeText(detail?.name,300),variantName:safeText(variant?.name,240),producerName:safeText(detail?.producer?.name,240),priceMinor:priceMinor!,currency:currency!,imagePath:safeText((images.find((item:any)=>item?.primary===true)||images[0])?.path,1000)||null},quantity);
 }
 async function addToCart(){
  if(!purchaseReady||!variantReference){setError(purchaseIssueMessage());return;}
  if(!authenticated){try{setError('');addToGuestCartFromPage();setStatus(preorder?'Sipariş sepete eklendi.':'Sepete eklendi.');}catch(err){setError(err instanceof Error&&err.message?err.message:'Ürün sepete eklenemedi.');}return;}
  try{setBusy(true);setError('');setStatus('');await setCartItem({variantId:variantReference,quantity,selectedOptions:selectedOptionsPayload()});await onCartChanged?.();setStatus(preorder?'Sipariş sepete eklendi.':'Sepete eklendi.');}
  catch(err){setError(err instanceof Error&&err.message?err.message:'Ürün sepete eklenemedi. Lütfen tekrar deneyin.');}
  finally{setBusy(false);}
 }
 function pushInternalRoute(url:string,tab:string){const currentDepth=Number(window.history.state?.goldenOremarDepth);const nextDepth=Number.isSafeInteger(currentDepth)&&currentDepth>=0?currentDepth+1:1;const state={...window.history.state,goldenOremar:true,goldenOremarDepth:nextDepth,tab};window.history.pushState(state,'',url);window.dispatchEvent(new PopStateEvent('popstate',{state}));window.scrollTo({top:0,behavior:'auto'});}
 function navigateToCart(){pushInternalRoute(buildTabUrl('cart'),'cart');}
 // "Hemen Satın Al": members pay online when card payment is on. Until
 // then (and always for guests) the order goes through WhatsApp or bank
 // transfer in a sheet right here, so nobody is sent away to sign up first.
 async function onlinePaymentOpen(){if(!authenticated)return false;try{const caps=await getCheckoutPaymentCapabilities();return caps.hostedCheckout||caps.savedCardPayment;}catch{return false;}}
 /* Gifts need no account: while card payment is off they go through the
    same WhatsApp / Havale order sheet, opened in gift mode. */
 async function giftNow(){
  if(!purchaseReady||!variantReference){setError(purchaseIssueMessage());return;}
  try{setBusy(true);setError('');if(!(await onlinePaymentOpen())&&offlineOrderingAvailable(await getOfflineOrderingConfig())){setOfflineGift(true);setOfflineOrderOpen(true);return;}}catch{/* fall through */}finally{setBusy(false);}
  if(authenticated)onGift(detail.slug||detail.id,quantity);else onLoginRequired();
 }
 async function buyNow(){
  if(!purchaseReady||!variantReference){setError(purchaseIssueMessage());return;}
  try{setBusy(true);setError('');setOfflineGift(false);if(!(await onlinePaymentOpen())&&offlineOrderingAvailable(await getOfflineOrderingConfig())){setOfflineOrderOpen(true);return;}}catch{/* fall back to the cart */}finally{setBusy(false);}
  if(!authenticated){try{setError('');addToGuestCartFromPage();navigateToCart();}catch(err){setError(err instanceof Error&&err.message?err.message:'Satın alma işlemi başlatılamadı.');}return;}
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

 const editorial:Record<string,unknown>=detail?.editorial&&typeof detail.editorial==='object'&&!Array.isArray(detail.editorial)?detail.editorial:{};
 const ed=(key:string,max=600)=>safeText(editorial[key],max);
 // A short, clean name. A qualifier that used to sit in parentheses
 // ("Tane kuru") is listed under "Ürün bilgileri ve özellikleri" instead.
 const detailName=cleanTitle(safeText(detail.name,300))||'Ürün';
 const isNonFood=detail?.handlingProfile?.safetyClass==='non_food_safety'||detail?.handlingProfile?.productType==='non_food';
 const categoryName=safeText(detail?.category?.name,160);
 const categorySlug=safeReference(detail?.category?.slug,220);
 const producerLocation=safeText(detail?.producer?.locationLabel,240)||safeText(detail?.origin,240);
 const maker=productMaker(detail?.slug,detail?.makerName);
 // No confirmed person yet: name the village's producers, which the origin record supports. Never a guessed person.
 const makerVillage=maker?'':shortOrigin(detail?.origin,true);
 // Künye under "Üreticisini tanı": who made it, where, what is verified.
 // One row each. The village row opens the place on a map.
 const kunye:{key:string;label:string;text:string;href?:string}[]=[];
 if(maker||makerVillage)kunye.push({key:'maker',label:'Üreten',text:maker||`${makerVillage} üreticileri`});
 if(producerLocation){const place=producerLocation.split(',').map(part=>part.trim()).filter(Boolean).map((part,index)=>index===0&&part.includes(' - ')?part.split(' - ').pop()!.trim():part).join(', ');kunye.push({key:'village',label:'Köy',text:producerLocation,href:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`});}
 {const official=detail?.producer?.storeKind==='official';const notes=[detail?.producer?.originVerified===true?'Menşei doğrulandı':'',detail?.producer?.verified===true?(official?'resmi mağaza':'doğrulanmış üretici'):'',...activeBadges.filter((badge:any)=>!['official_store','verified_origin'].includes(safeText(badge.key,80))).map((badge:any)=>safeText(badge.label,120)).filter(Boolean).slice(0,3)].filter(Boolean);if(notes.length)kunye.push({key:'verified',label:'Doğrulama',text:notes.join(', ')});}
 // "Stok" in the facts table, right under İade, from the chosen pack's real
 // stock: Tükendi, Son N adet (5 or fewer), Stokta; pre-orders say Ön sipariş.
 const stockFact=!variant?'':soldOut?'Tükendi':preorder?'Ön sipariş':tracked&&variantStock!==null&&variantStock<=5?`Son ${variantStock} adet`:stockReady?'Stokta':'';
 const producerId=safeReference(detail?.producer?.id,160);
 const productId=safeReference(detail?.id,160);
 const questionReady=Boolean(producerId&&productId);
 const cartAdded=status==='Sepete eklendi.'||status==='Sipariş sepete eklendi.';
 // "Teslimat" in the facts table: when the order is handed to the carrier.
 // Pre-orders say what their own record says (the stored harvest and dispatch
 // sentence, e.g. "Yeni sezon hasadıyla gönderilir (Haziran-Temmuz)"); the
 // rest of the catalogue is dispatched within 2-4 working days.
 const computedDispatch=(()=>{
  if(!preorder)return'2-4 iş günü içinde kargoya verilir';
  if(preorderLeadDays!==null&&preorderLeadDays>0)return`Siparişten sonra yaklaşık ${preorderLeadDays} günde kargoya verilir`;
  const stored=sentencesOf(safeText(detail?.specifications?.preOrderTime,300))[0]?.replace(/[.\s]+$/,'')||'';
  return stored||'2-4 iş günü içinde kargoya verilir';
 })();
 // The product's own record (Ürün sayfası içeriği in the admin and seller
 // panels) decides the dispatch sentence; an empty value hides it. Older
 // records without the key keep the rule above.
 const dispatchLine=typeof editorial.dispatchText==='string'?ed('dispatchText',160):computedDispatch;
 const withdrawal=(()=>{const tier=withdrawalTier((detail as any)?.handlingProfile);return tier?{tier,copy:WITHDRAWAL_COPY[tier]}:null;})();
 // Shipping for this product: free ("Kargo bizden") or the real fee
 // ("Kargo ücreti 49 TL"), the same rule the cart and checkout charge.
 // A written shipping line from the record takes its place.
 const shippingFeeMinor=(()=>{const shipping=(detail as any)?.shipping;const fee=safeInteger(shipping?.feeMinor);return shipping&&typeof shipping==='object'&&fee!==null&&fee>0?fee:0;})();
 const shippingLine=ed('shippingNote',80)||(shippingFeeMinor>0?`Kargo ücreti ${priceText(shippingFeeMinor,'TRY')}`:'Kargo bizden');
 const coldChain=typeof editorial.coldChain==='boolean'?editorial.coldChain:detail?.handlingProfile?.requiresColdChain===true;

 const unitLabel=safeText(variant?.name,120)||safeText(detail?.unitLabel,120);
 // The pack in words ("1 kg • Özel bez kese"), never "1 adet": the editorial
 // pack line while the variant it was written for is selected, otherwise the
 // variant's own name without a leading "1 adet".
 const packLine=(()=>{const pack=ed('pack',160),packFor=ed('packFor',160),current=safeText(variant?.name,160);if(pack&&(!packFor||!current||packFor===current))return pack;return unitLabel.replace(/^\s*1\s*adet\b\s*[•·,\-–]?\s*/i,'').trim();})();
 // Kilogram price from the net amount on the label ("500 g", "2 kg"), as the
 // big grocers show it. Never from the packed shipping weight, never for
 // pieces or liquids, and not when the pack is exactly 1 kg.
 const labelGrams=(()=>{const match=/(\d+(?:[.,]\d+)?)\s*(kg|gr|gram|g)\b/i.exec(unitLabel);if(!match||/adet|ort\.|min\.|\d\s*-\s*\d|\d\s*(l|lt|litre|ml)\b/i.test(unitLabel))return null;const amount=Number(match[1].replace(',','.'));if(!Number.isFinite(amount)||amount<=0)return null;return Math.round(/^kg$/i.test(match[2])?amount*1000:amount);})();
 const kgPriceMinor=priceReady&&labelGrams!==null&&labelGrams>=50&&labelGrams<=50000&&labelGrams!==1000?Math.round(priceMinor!*1000/labelGrams):null;
 const discountPercent=compareAtPriceReady?Math.round((1-priceMinor!/compareAtPriceMinor!)*100):0;
 const totalMinor=priceReady?priceMinor!*quantity:null;
 // Discount for the chosen quantity: old total struck through, new total, and
 // one small badge "%20 · 80 TL indirim". Screen readers hear one short line.
 const discountShown=compareAtPriceReady&&discountPercent>=1;
 const oldTotalMinor=discountShown?compareAtPriceMinor!*quantity:null;
 const dropMinor=discountShown?(compareAtPriceMinor!-priceMinor!)*quantity:null;
 // One line under the photo: place · how it is made · one trait ("Yüksekova ·
 // Odun isiyle geleneksel kurutma · Sınırlı hasat"), from the product's own record.
 const prestigeParts=ed('prestige',160).split('·').map(part=>part.trim()).filter(Boolean).slice(0,3);
 const storyText=safeText(experience.story,3000);
 // Each sentence appears once on the page: the product information drops a
 // sentence the story already tells, and the short description one either says.
 const aboutText=withoutRepeatedSentences(ed('about',1200),[storyText]);
 const descriptionText=withoutRepeatedSentences(safeText(detail?.shortDescription,1000),[storyText,aboutText]);
 // The facts table: Kökeni, Üretim and Ambalaj from the product's own record
 // ("Üretim" is left out when the prestige line under the photo already says
 // it), then İade and Teslimat. Perishables keep their legal return text (no
 // right of withdrawal); the return terms appear only here on the page.
 const productionFact=(()=>{const value=ed('production',160);return value&&mostlyCovered(value,prestigeParts.join(' '))?'':value;})();
 const computedReturn=withdrawal?(withdrawal.tier==='none'?'Cayma hakkı yok; hasarlı veya hatalı üründe iade hakkınız saklıdır':'14 gün içinde, paket açılmamışsa ücretsiz iade'):'';
 const returnText=typeof editorial.returnText==='string'?ed('returnText',200):computedReturn;
 // The shipping fee line ("Kargo bizden") is shown once, under the photo; it is not repeated here.
 const deliveryLines=[dispatchLine,...(coldChain?['Soğuk zincirle gönderilir']:[])];
 const facts:Array<[string,string[]]>=([['Kökeni',[ed('origin',120)]],['Üretim',[productionFact]],['Ambalaj',[ed('packaging',120)]],['İade',[returnText]],['Stok',[stockFact]],['Teslimat',deliveryLines]] as Array<[string,string[]]>).map(([label,lines]):[string,string[]]=>[label,lines.filter(Boolean)]).filter(([,lines])=>lines.length>0);
 function startReview(){if(!authenticated){onLoginRequired();return;}setReviewComposerOpen(true);}
 // Following the store: same data as the store page and Hesabım > Takip
 // Ettiğim Satıcılar (toggle_producer_follow_v1). Not an aria-pressed
 // toggle, so screen readers never add "kapalı"; the visible text names it.
 async function toggleFollow(){
  if(!authenticated){onLoginRequired();return;}
  if(!producerId||followBusy)return;
  try{setFollowBusy(true);setFollowError('');const result:any=await toggleProducerFollow(producerId);setFollowing(result?.following===true);}
  catch{setFollowError('Takip işlemi şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin.');}
  finally{setFollowBusy(false);}
 }
 const gallerySlides:GallerySlide[]=[
  ...(images.length?images.slice(0,12).flatMap((image:any,index:number)=>{const path=safeText(image?.path,1200);const src=publicCatalogUrl(path);return src?[{kind:'photo' as const,key:`photo:${path}:${index}`,src,path,alt:safeText(image?.alt,300)||detailName}]:[];}):[]),
 ];
 if(!gallerySlides.length)gallerySlides.push({kind:'artwork',key:'artwork'});
 // The second photo shows where the product comes from (the mountains, the
 // drying, the bez kese being filled), once one has been shipped for it.
 {const originSlug=safeText(detail?.slug,220);if(originSlug&&ORIGIN_PHOTOS.has(originSlug))gallerySlides.splice(1,0,{kind:'scene',key:`scene:${originSlug}`,src:`/product-photos/origin/${originSlug}.webp`,alt:`${detailName}: geldiği yer`});}
 /* The product's own video (detail v10) is a slide right after the photos,
    not a separate block further down. */
 const productVideoUrl=(()=>{const v:any=(detail as any)?.video;return v?.kind==='youtube'?safeText(v.url,600):v?.kind==='file'?(typeof v.url==='string'&&/^https:\/\//.test(v.url)?v.url:publicCatalogUrl(v.path)):null;})();
 if(productVideoUrl)gallerySlides.push({kind:'video',key:`video:${productVideoUrl}`,url:productVideoUrl});
 const showHealth=hasHealthInfo(safetyContent);
 const showUsage=hasUsageInfo(safetyContent,productVideoUrl||null);
 const purchaseLabel=busy?'İşleniyor…':soldOut?'Tükendi':preorder?'Sipariş Ver':'Sepete Ekle';

 return<article className="go-pdp mx-auto max-w-6xl px-4 pb-10 sm:px-6">
  <div className="sticky z-30 -mx-4 mb-4 flex min-h-16 items-center gap-2 border-b border-brand-border bg-brand-card/95 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6" style={{top:'env(safe-area-inset-top, 0px)', paddingTop:'env(safe-area-inset-top, 0px)'}}>
   <button type="button" onClick={onBack} aria-label="Geri" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-border bg-brand-card"><ArrowLeft aria-hidden="true" className="h-5 w-5"/></button>
   <div className="min-w-0 flex-1 text-center"><div className="truncate text-sm font-black text-brand-text" aria-live="off">{showHeaderTitle?detailName:'Ürün Detayı'}</div></div>
   <button type="button" onClick={()=>void favorite()} disabled={busy} aria-label={isFavorite?'Favorilerden çıkar':'Favorilere ekle'} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-border bg-brand-card disabled:opacity-50"><Heart aria-hidden="true" className={`h-5 w-5 ${isFavorite?'fill-red-500 text-red-500':'text-brand-text'}`}/></button>
   <button type="button" onClick={()=>void shareProduct()} disabled={shareBusy} aria-label="Ürünü paylaş" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-brand-border bg-brand-card disabled:opacity-50"><Share2 aria-hidden="true" className="h-5 w-5"/></button>
  </div>

  {error?<div role="alert" className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
  {status?<div role="status" aria-live="polite" className="mb-4 rounded-2xl border-2 border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">{cartAdded?<div className="flex items-center justify-between gap-3"><span>{status}</span><button type="button" onClick={navigateToCart} className="min-h-11 rounded-full border-2 border-green-700 bg-green-700 px-3 font-black text-white shadow-sm transition-all hover:bg-green-800">Sepete Git</button></div>:status}</div>:null}

  <div className="go-detail-grid grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
   <div className="go-detail-media"><ProductGallery slides={gallerySlides} productName={detailName} productSlug={safeText(detail?.slug,220)} categorySlug={categorySlug} categoryName={categoryName} productType={safeText(detail?.handlingProfile?.productType,60)} safetyClass={safeText(detail?.handlingProfile?.safetyClass,60)} onOpenPhoto={path=>{setSelectedImagePath(path);setImageViewerOpen(true);}}/>{prestigeParts.length?<p className="go-prestige">{prestigeParts.map((part,index)=><React.Fragment key={part}>{index?<span className="go-prestige__dot" aria-hidden="true"> · </span>:null}<span>{part}</span></React.Fragment>)}</p>:null}<p className="go-prestige-note">{shippingLine}</p></div>

   <section className="go-buybox" aria-labelledby="product-detail-title">
    <h1 id="product-detail-title" ref={titleRef} className="go-buybox__title">{detailName}</h1>

    <div className="go-price-card">
     <div className="go-price-card__main">
      {priceReady?(discountShown?<p className="go-price-card__amounts"><span className="sr-only" aria-live="polite">{`Önceki fiyat ${priceText(oldTotalMinor,currency)}, şimdi ${priceText(totalMinor,currency)}`}</span><span className="go-price-card__price" aria-hidden="true">{priceText(totalMinor,currency)}</span><s className="go-price-card__was" aria-hidden="true">{priceText(oldTotalMinor,currency)}</s><span className="go-price-card__discount" aria-hidden="true">%{discountPercent} · {priceText(dropMinor,currency)} indirim</span></p>:<p className="go-price-card__amounts"><span className="go-price-card__price" aria-live="polite">{priceText(totalMinor,currency)}</span></p>):<p className="go-price-card__missing">Fiyat şu anda gösterilemiyor</p>}
     </div>
     {packLine||kgPriceMinor!==null?<p className="go-price-card__unit">{packLine?<span className="go-price-card__pack">{packLine}</span>:null}{kgPriceMinor!==null?<span className="go-price-card__kg">kg fiyatı {priceText(kgPriceMinor,currency)}</span>:null}</p>:null}
     {preorder?<p className="go-price-card__preorder">Sipariş üzerine hazırlanır</p>:null}
    </div>

    <div className="go-buy">
     {Array.isArray(detail.variants)&&detail.variants.length>1?<label className="go-buy__field"><span>Paket</span><select value={variantId} onChange={event=>setVariantId(event.target.value)} className="input">{detail.variants.map((item:any)=>{const id=safeReference(item?.id,160)||'';return<option key={id||safeText(item?.name,240)} value={id} disabled={item?.available===false}>{safeText(item?.name,240)||'Seçenek'}{item?.available===false?' (Stokta yok)':''}</option>;})}</select></label>:null}

     <PremiumOrderConfigurator lead={experience.orderLead} schema={experience.optionSchema} selected={selectedOrderOptions} onChange={setSelectedOrderOptions} disabled={busy||soldOut}/>

     <div className="go-buy__qty"><span id="product-quantity-label" className="go-buy__qty-label">Adet</span><div className="go-buy__stepper" role="group" aria-labelledby="product-quantity-label"><button type="button" onClick={()=>setQuantity(value=>Math.max(1,value-1))} disabled={!purchaseReady||busy||quantity<=1} aria-label="Azalt"><Minus aria-hidden="true"/></button><output aria-live="polite">{quantity}</output><button type="button" onClick={()=>setQuantity(value=>Math.min(maxQuantity,value+1))} disabled={!purchaseReady||busy||quantity>=maxQuantity} aria-label="Artır"><Plus aria-hidden="true"/></button></div></div>

     {!purchaseReady&&!soldOut&&stockReady?<p className="go-buy__issue">{purchaseIssueMessage()}</p>:null}

     <div className="go-buy__actions product-detail-commerce-dock" role="group" aria-label="Satın al">
      <button type="button" onClick={()=>void addToCart()} disabled={busy||!purchaseReady} className="product-detail-commerce-cart go-buy__primary"><ShoppingCart aria-hidden="true"/><span>{purchaseLabel}</span></button>
      <div className="go-buy__secondary">
       <button type="button" onClick={()=>void buyNow()} disabled={busy||!purchaseReady} className="product-detail-commerce-buy">{preorder?<span>Siparişi Tamamla</span>:<span>Hemen Satın Al</span>}</button>
       <button type="button" onClick={()=>void giftNow()} disabled={busy||!purchaseReady} className="product-detail-commerce-gift"><Gift aria-hidden="true"/><span>Hediye Et</span></button>
      </div>
     </div>
    </div>
   </section>
  </div>

  <div className="go-pdp__lower">
   <DetailAccordionGroup>
    {storyText?<DetailAccordion id="story" title="Bu ürünün hikâyesi"><p className="go-detail-story">{storyText}</p></DetailAccordion>:null}
    <DetailAccordion id="info" title="Ürün bilgileri ve özellikleri">
     {aboutText?<p className="go-detail-about">{aboutText}</p>:null}
     {descriptionText?<p className="go-detail-description">{descriptionText}</p>:null}
     {featureItems.length?<ul className="go-detail-features">{featureItems.map((item,index)=><li key={`${item}-${index}`}><CheckCircle2 aria-hidden="true"/><span>{item}</span></li>)}</ul>:null}
     <ProductFacts detail={detail} variant={variant} qualifier={ed('qualifier',160)} packLine={packLine}/>
    </DetailAccordion>
   </DetailAccordionGroup>

   {facts.length?<dl className="go-facts" aria-label="Kısa bilgiler">{facts.map(([label,lines])=><div key={label} className="go-facts__row"><dt>{label}</dt><dd>{lines.map(line=><span key={line} className="go-facts__line">{line}</span>)}</dd></div>)}</dl>:null}

   {showHealth||showUsage||hasTraceability||(Array.isArray(detail.certifications)&&detail.certifications.length)?<DetailAccordionGroup>
    {showHealth?<DetailAccordion id="safety" title={isNonFood?'Güvenli kullanım':'Sağlık bilgileri'}><HealthInfo content={safetyContent}/></DetailAccordion>:null}
    {showUsage?<DetailAccordion id="usage" title={isNonFood?'Nasıl kullanılır?':'Nasıl tüketilir?'}><UsageInfo content={safetyContent} productName={detailName} galleryVideoUrl={productVideoUrl||null}/></DetailAccordion>:null}
    {hasTraceability?<DetailAccordion id="trace" title="Lot ve izlenebilirlik"><Traceability detail={detail} hasTraceability={hasTraceability} onCopy={copyTrace}/></DetailAccordion>:null}
    {Array.isArray(detail.certifications)&&detail.certifications.length?<DetailAccordion id="certs" title="Sertifikalar"><Certifications items={detail.certifications}/></DetailAccordion>:null}
   </DetailAccordionGroup>:null}

   <section className="go-producer" aria-labelledby="product-producer-heading">
    <h2 id="product-producer-heading" className="go-producer__title">Üreticisini tanı</h2>
    {detail.producer?.id?<button type="button" onClick={()=>onProducer(String(detail.producer.id),safeText(detail.producer.slug,220)||String(detail.producer.id),safeText(detail.producer.name,240)||'Üretici')} className="go-store-card" aria-label={`${safeText(detail.producer.name,240)||'Üretici'} mağazasına git`}>
     <span className="go-store-card__logo" aria-hidden="true">{safeText(detail.producer.logoPath,600)&&publicCatalogUrl(safeText(detail.producer.logoPath,600))?<img src={publicCatalogUrl(safeText(detail.producer.logoPath,600))||undefined} alt="" loading="lazy" decoding="async" onError={event=>{event.currentTarget.style.display='none';}}/>:null}<Store/></span>
     <span className="go-store-card__body"><span className="go-store-card__name"><span>{safeText(detail.producer.name,240)||'Üretici'}</span></span>
      <span className="go-store-card__meta">Mağazanın tüm ürünlerini gör</span></span>
     <span className="go-store-card__go"><ChevronRight aria-hidden="true"/></span>
    </button>:null}
    {kunye.length?<ul className="go-kunye" data-product-kunye="true" aria-label="Ürün künyesi">{kunye.map(row=>{const Icon=({maker:User,village:MapPin,verified:BadgeCheck} as Record<string,typeof MapPin>)[row.key];const body=<><span className="go-kunye__icon" aria-hidden="true"><Icon/></span><span className="go-kunye__text"><span className="go-kunye__label">{row.label}</span><span className="go-kunye__value">{row.text}</span></span>{row.href?<span className="go-kunye__go" aria-hidden="true"><span>Haritada aç</span><ExternalLink/></span>:null}</>;return<li key={row.key}>{row.href?<a href={row.href} target="_blank" rel="noopener noreferrer" className="go-kunye__row go-kunye__row--link" aria-label={`${row.label}: ${row.text}. Haritada aç`}>{body}</a>:<div className="go-kunye__row">{body}</div>}</li>;})}</ul>:null}
    {questionReady?<button type="button" onClick={()=>{if(!authenticated){onLoginRequired();return;}setQuestionOpen(value=>!value);setError('');setStatus('');}} aria-expanded={questionOpen} className="go-store-ask"><MessageCircle aria-hidden="true"/>Üreticiye soru sor</button>:null}
    {questionOpen&&producerId&&productId?<ProducerQuestionComposer className="mt-1" context={{kind:'product',producerId,productId,productName:detailName}} onCancel={()=>setQuestionOpen(false)} onStarted={()=>{setQuestionOpen(false);setStatus('Sorunuz üreticiye gönderildi. Yanıtı Hesabım > Mesajlarım bölümünden takip edebilirsiniz.');}}/>:null}
    {producerId?<div className="go-store-follow"><button type="button" onClick={()=>void toggleFollow()} disabled={followBusy} aria-describedby={`store-follow-hint-${producerId}`} className={`go-store-follow__button${following?' is-following':''}`}>{following?<BellRing aria-hidden="true"/>:<Bell aria-hidden="true"/>}<span>{followBusy?'Güncelleniyor…':following?'Takip ediliyor':'Mağazayı takip et'}</span></button><p id={`store-follow-hint-${producerId}`} role={followError?'alert':undefined} className={`go-store-follow__hint${followError?' is-error':''}`}>{followError||(following?'Yeni ürünlerinden haberin olacak · Bırakmak için dokun':'Yeni ürünler gelince haberin olsun')}</p></div>:null}
   </section>

   <DetailAccordionGroup>
    <DetailAccordion id="reviews" title="Müşteri Yorumları" teaser={reviewCount?`${averageRating!==null?averageRating.toFixed(1):'-'} puan · ${reviewCount} yorum`:'Tadına bakan ilk siz olun, ilk yorumu siz yazın'}><Reviews reviews={reviews} reviewCount={reviewCount} averageRating={averageRating} onWrite={startReview} composer={reviewComposerOpen&&productId?<React.Suspense fallback={<p className="go-review-composer__note">Yorum formu açılıyor…</p>}><ProductReviewComposer productId={productId} productName={detailName} onClose={()=>setReviewComposerOpen(false)}/></React.Suspense>:null}/></DetailAccordion>
   </DetailAccordionGroup>

   <ProductRecommendationsShelf reference={safeText(detail.slug,220)||reference} currentId={productId} onOpenProduct={next=>onOpenProduct?onOpenProduct(next):pushInternalRoute(buildProductUrl(next),'product-detail')} onAddToCart={(item,quantity)=>onAddCatalogItem?.(item,quantity)}/>
  </div>


  {imageViewerOpen&&selectedImageUrl?<div className="fixed inset-0 z-[120] flex bg-black/95 p-2 sm:p-5"><div ref={imageViewerDialogRef} role="dialog" aria-modal="true" aria-labelledby="product-image-viewer-title" tabIndex={-1} className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-black/95 text-white outline-none"><div className="flex min-h-14 items-center gap-3 border-b border-white/15 px-3 sm:px-4"><h2 id="product-image-viewer-title" className="min-w-0 flex-1 truncate text-sm font-black">{detailName}</h2><span className="hidden text-xs font-semibold text-white/60 sm:inline">{viewerZoom?'Uzaklaştırmak için dokunun':'Yakınlaştırmak için dokunun'}</span>{images.length>1?<span className="text-xs font-bold text-white/70">{selectedImageIndex+1} / {images.length}</span>:null}<button type="button" onClick={()=>setImageViewerOpen(false)} aria-label="Görseli kapat" className="grid min-h-11 min-w-11 place-items-center rounded-full border-2 border-white/20 bg-white/10 transition hover:bg-white/20"><X aria-hidden="true" className="h-5 w-5"/></button></div><div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4" style={{touchAction:viewerZoom?'none':'pan-y pinch-zoom'}} onTouchStart={event=>{if(event.touches.length!==1){swipeStartRef.current=null;return;}const touch=event.touches[0];swipeStartRef.current={x:touch.clientX,y:touch.clientY};}} onTouchMove={event=>{if(!viewerZoom||event.touches.length!==1)return;const rect=event.currentTarget.getBoundingClientRect();const touch=event.touches[0];setViewerZoom({x:Math.max(0,Math.min(100,(touch.clientX-rect.left)/rect.width*100)),y:Math.max(0,Math.min(100,(touch.clientY-rect.top)/rect.height*100))});}} onTouchEnd={event=>{const start=swipeStartRef.current;swipeStartRef.current=null;if(!start||viewerZoom||images.length<2)return;const touch=event.changedTouches[0];const dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.4)moveImage(dx<0?1:-1);}} onMouseMove={event=>{if(!viewerZoom)return;const rect=event.currentTarget.getBoundingClientRect();setViewerZoom({x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});}}>{images.length>1?<button type="button" onClick={()=>moveImage(-1)} aria-label="Önceki ürün görseli" className="absolute left-2 z-10 grid min-h-12 min-w-12 place-items-center rounded-full border-2 border-white/20 bg-black/70 backdrop-blur-sm transition hover:bg-black/85 sm:left-4 sm:min-h-14 sm:min-w-14"><ChevronLeft aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7"/></button>:null}<img src={selectedImageUrl} alt={safeText(selectedImage.alt,300)||detailName} className={`go-viewer-img max-h-full max-w-full object-contain${viewerZoom?' is-zoomed':''}`} style={viewerZoom?{transform:'scale(2.4)',transformOrigin:`${viewerZoom.x}% ${viewerZoom.y}%`}:undefined} onClick={event=>{if(viewerZoom){setViewerZoom(null);return;}const rect=event.currentTarget.getBoundingClientRect();setViewerZoom({x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});}} decoding="async" onError={e=>{const img=e.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='1';img.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E';img.style.maxWidth='240px';img.style.opacity='0.3';}}/>{images.length>1?<button type="button" onClick={()=>moveImage(1)} aria-label="Sonraki ürün görseli" className="absolute right-2 z-10 grid min-h-12 min-w-12 place-items-center rounded-full border-2 border-white/20 bg-black/70 backdrop-blur-sm transition hover:bg-black/85 sm:right-4 sm:min-h-14 sm:min-w-14"><ChevronRight aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7"/></button>:null}</div>{images.length>1?<div className="hide-scrollbar flex gap-2 overflow-x-auto border-t border-white/15 p-3 sm:p-4">{images.slice(0,12).map((image:any,index:number)=>{const src=publicCatalogUrl(image?.path);const isSelected=selectedImage?.path===image.path;return src?<button type="button" key={`viewer-${safeText(image.path,1200)}:${index}`} onClick={()=>setSelectedImagePath(safeText(image.path,1200))} aria-label={`${detailName} görseli ${index+1}`} aria-pressed={isSelected} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white/5 transition sm:h-20 sm:w-20 ${isSelected?'border-brand-gold shadow-lg':'border-white/20 hover:border-white/40'}`}><img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" onError={e=>{const img=e.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='1';img.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"%3E%3Cpath d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"%3E%3C/path%3E%3Cpolyline points="9 22 9 12 15 12 15 22"%3E%3C/polyline%3E%3C/svg%3E';img.style.padding='12px';img.style.opacity='0.25';}}/>{isSelected?<div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-brand-gold" aria-hidden="true"/>:null}</button>:null;})}</div>:null}</div></div>:null}
  <OfflineOrderSheet open={offlineOrderOpen} onClose={()=>setOfflineOrderOpen(false)} gift={offlineGift} authenticated={authenticated} onLoginRequired={onLoginRequired} source="product" lines={variantReference&&priceMinor!==null&&currency?[{key:variantReference,productName:safeText(detail?.name,300),variantName:safeText(variant?.name,240),quantity,priceMinor,currency}]:[]} items={variantReference?[{variantId:variantReference,quantity,selectedOptions:selectedOptionsPayload()}]:[]}/>
 </article>;
}


function ProductFacts({detail,variant,qualifier,packLine}:{detail:any;variant:any;qualifier:string;packLine:string}){
 const handling=detail?.handlingProfile&&typeof detail.handlingProfile==='object'?detail.handlingProfile:{};
 const stockMode=String(detail?.stockMode||'');
 const rows:Array<[string,string]>=[
  ['Özellik',qualifier],
  // The pack line sits under the price; repeated here only when there is none.
  ['Paket',packLine?'':safeText(variant?.name,160)||safeText(detail?.unitLabel,160)],
  ['Ağırlık (paketli)',formatWeight(safeInteger(variant?.weightGrams))],
  ['Satış şekli',stockMode==='preorder'?'Sipariş üzerine hazırlanır':stockMode==='seasonal'?'Mevsimlik üretim':stockMode==='tracked'?'Hazır stoktan':''],
  ['Saklama',handling.requiresColdChain===true?'Soğuk zincir gerekir':handling.isPerishable===true?'Bozulabilir, serin tutun':handling.isPerishable===false?'Oda sıcaklığında saklanabilir':''],
  ['Ürün kodu',safeText(variant?.sku,80)],
 ];
 const cuts=Array.isArray(detail?.specifications?.cutOptions)?detail.specifications.cutOptions.map((cut:any)=>safeText(cut?.label,120)).filter(Boolean).slice(0,6):[];
 return<div><dl className="go-detail-facts">{rows.filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {cuts.length?<div className="go-detail-chips-block"><div className="go-detail-chips-title">Hazırlama seçenekleri</div><div className="go-detail-chips">{cuts.map((cut:string)=><span key={cut}>{cut}</span>)}</div></div>:null}
 </div>;
}


function Traceability({detail,hasTraceability,onCopy}:{detail:any;hasTraceability:boolean;onCopy:(code:string)=>Promise<void>}){
 if(!hasTraceability||!Array.isArray(detail.traceability?.batches)||!detail.traceability.batches.length)return<p className="text-sm text-brand-muted">İzlenebilirlik bilgisi henüz yayınlanmadı.</p>;
 return<div className="space-y-3">{detail.traceability.batches.map((batch:any,index:number)=>{const traceCode=safeText(batch?.traceCode,200);if(!traceCode)return null;return<article key={`${traceCode}:${index}`} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-bold"><QrCode aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safeText(batch.batchCode,200)||'Ürün partisi'}</div><div className="mt-1 text-xs text-brand-muted">Kod: {traceCode}</div></div><button type="button" onClick={()=>void onCopy(traceCode)} className="min-h-11 rounded-lg border border-brand-border px-3 text-sm font-bold"><Copy aria-hidden="true" className="mr-1 inline h-4 w-4"/>Kopyala</button></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{batch.harvestDate?<div>Hasat: {dateOnly(batch.harvestDate)}</div>:null}{batch.productionDate?<div>Üretim: {dateOnly(batch.productionDate)}</div>:null}{batch.packagingDate?<div>Paketleme: {dateOnly(batch.packagingDate)}</div>:null}{batch.bestBeforeDate?<div>Tavsiye edilen tüketim: {dateOnly(batch.bestBeforeDate)}</div>:null}{batch.origin?<div>Menşe: {joinLocation(batch.origin)}</div>:null}</div>{safeText(batch.publicNotes,3000)?<p className="mt-3 text-sm leading-6 text-brand-muted">{safeText(batch.publicNotes,3000)}</p>:null}</article>;})}</div>;
}

function Certifications({items}:{items:any[]}){return<div className="space-y-2">{items.slice(0,30).map((cert:any,index:number)=><div key={`${safeText(cert?.type,160)}:${index}`} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><div className="flex items-center gap-2 font-bold"><PackageCheck aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safeText(cert?.type,160)||'Sertifika'}</div>{safeText(cert?.issuer,240)?<div className="mt-1 text-brand-muted">{safeText(cert.issuer,240)}</div>:null}{safeUrl(cert?.verificationUrl)?<a href={safeUrl(cert.verificationUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-bold text-brand-green">Belgeyi görüntüle<ExternalLink aria-hidden="true" className="ml-1 h-4 w-4"/></a>:null}</div>)}</div>;}

function StarRow({value,size='sm'}:{value:number;size?:'sm'|'lg'}){const rounded=Math.round(Math.max(0,Math.min(5,value)));return<span className={`go-stars go-stars--${size}`} aria-hidden="true">{Array.from({length:5}).map((_,index)=>{const fill=rounded>=index+1?'full':'empty';return<span key={index} className={`go-star go-star--${fill}`}><Star/></span>;})}</span>;}

function Reviews({reviews,reviewCount,averageRating,onWrite,composer}:{reviews:any;reviewCount:number|null;averageRating:number|null;onWrite:()=>void;composer:React.ReactNode}){
 const items:any[]=Array.isArray(reviews?.items)?reviews.items.slice(0,20):[];
 const summary=reviews?.summary&&typeof reviews.summary==='object'?reviews.summary:{};
 const bars=[5,4,3,2,1].map(star=>({star,count:safeInteger(summary[`rating${star}`])??0}));
 const barTotal=bars.reduce((sum,bar)=>sum+bar.count,0);
 const policy=<p className="go-reviews__policy"><ShieldCheck aria-hidden="true"/>Değerlendirmeler yalnız bu ürünü satın alıp teslim alan müşterilerimizden gelir; her yorum gerçek bir siparişe bağlıdır.</p>;
 // "Değerlendirme yaz" is offered in every state (no reviews yet, reviews
 // unavailable, a list), so a tap on the section always leads somewhere.
 const write=composer||<button type="button" onClick={onWrite} className="go-reviews__write"><Star aria-hidden="true"/>Değerlendirme yaz</button>;
 if(reviewCount===0||(reviewCount===null&&reviews&&!items.length))return<div className="go-reviews"><div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800"><Star aria-hidden="true" className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"/><p className="mt-3 font-semibold text-gray-600 dark:text-gray-300">Henüz müşteri yorumu yok</p></div>{write}{policy}</div>;
 if(!reviews&&reviewCount===null)return<div className="go-reviews"><div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900/60 dark:bg-amber-950/30"><p className="font-semibold text-amber-900 dark:text-amber-100">Yorumlar şu anda görüntülenemiyor</p><p className="mt-1 text-sm text-amber-700 dark:text-amber-200">Lütfen daha sonra tekrar deneyin.</p></div>{write}{policy}</div>;
 return<div className="go-reviews">
  <div className="go-reviews__summary">
   <div className="go-reviews__score"><strong>{averageRating!==null?averageRating.toFixed(1):'-'}</strong><StarRow value={averageRating??0} size="lg"/><span>{reviewCount??items.length} değerlendirme</span></div>
   {barTotal>0?<ul className="go-reviews__bars" aria-label="Puan dağılımı">{bars.map(bar=><li key={bar.star}><span className="go-reviews__bar-label">{bar.star} yıldız</span><span className="go-reviews__bar" aria-hidden="true"><span style={{width:`${Math.round(bar.count/barTotal*100)}%`}}/></span><span className="go-reviews__bar-count">{bar.count}</span></li>)}</ul>:null}
  </div>
  {items.length?<div className="space-y-3">{items.map((review:any,index:number)=>{const rating=safeRating(review?.rating);const date=dateOnly(review?.createdAt||review?.publishedAt);return<article key={safeReference(review?.id,160)||`review-${index}`} className="go-review-card"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate font-bold">{safeText(review?.reviewerName,160)||'Müşteri'}</strong>{date?<span className="text-xs text-brand-muted">{date}</span>:null}</div>{rating!==null?<span className="flex items-center gap-1" aria-label={`${rating} yıldız`}><StarRow value={rating}/></span>:null}</div>{review?.verifiedPurchase===true?<div className="mt-1 flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>Doğrulanmış satın alma</div>:null}{safeText(review?.title,240)?<h3 className="mt-2 font-bold">{safeText(review.title,240)}</h3>:null}{safeText(review?.body,5000)?<p className="mt-1 text-sm leading-relaxed text-brand-muted">{safeText(review.body,5000)}</p>:null}{safeText(review?.merchantReply,5000)?<div className="mt-3 rounded-lg border-l-4 border-brand-gold bg-brand-gold/5 p-3 text-sm"><strong className="font-bold">Üretici yanıtı:</strong> <span className="text-brand-muted">{safeText(review.merchantReply,5000)}</span></div>:null}</article>;})}</div>:null}
  {write}
  {policy}
 </div>;
}

function normalizeFeatures(value:any):string[]{if(Array.isArray(value))return value.flatMap(item=>typeof item==='string'&&item.trim()?[item.trim().slice(0,500)]:item&&typeof item==='object'&&!Array.isArray(item)?Object.entries(item).map(([key,val])=>`${labelKey(key)}: ${formatValue(val)}`):[]).filter(Boolean).slice(0,24);if(value&&typeof value==='object'&&!Array.isArray(value))return Object.entries(value).map(([key,val])=>`${labelKey(key)}: ${formatValue(val)}`).filter(item=>!item.endsWith(': ')).slice(0,24);return[];}
function labelKey(value:string){return value.replace(/[_-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase()).slice(0,120);}
function formatValue(value:any){if(Array.isArray(value))return value.slice(0,20).map(item=>safeText(String(item),120)).filter(Boolean).join(', ');if(value===true)return'Evet';if(value===false)return'Hayır';if(value==null)return'';if(typeof value==='object')return'Ayrıntılı bilgi';return safeText(String(value),500);}
/** "320 TL"; kuruş only when there are any ("12,50 TL"). */
function priceText(minor:number|null,currency:string|null){if(minor===null||currency===null)return'Fiyat bilgisi yok';const digits=minor%100===0?0:2;const amount=(minor/100).toLocaleString('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits});if(currency==='TRY')return`${amount} TL`;try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(minor/100);}catch{return`${amount} ${currency}`;}}
/** The display name without a parenthesised qualifier: "İsli Kaya Üzümleri (Tane Kuru)" reads "İsli Kaya Üzümleri". */
const sentenceKey=(value:string)=>value.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim();
const sentencesOf=(value:string)=>value.replace(/([.!?…])\s+/g,'$1\n').split('\n').map(part=>part.trim()).filter(Boolean);
/** The text without the sentences any of the other texts already contain. */
function withoutRepeatedSentences(text:string,others:string[]){
 if(!text)return'';
 const seen=new Set(others.flatMap(other=>sentencesOf(other||'').map(sentenceKey)).filter(Boolean));
 return sentencesOf(text).filter(sentence=>!seen.has(sentenceKey(sentence))).join(' ');
}
/** True when most words of the value (by their first five letters) already appear in the other text. */
function mostlyCovered(value:string,other:string){
 const stems=(text:string)=>new Set(sentenceKey(text).split(' ').filter(word=>word.length>2).map(word=>word.slice(0,5)));
 const words=[...stems(value)],known=stems(other);
 return words.length>0&&words.filter(word=>known.has(word)).length/words.length>=.6;
}
function cleanTitle(value:string){return value.replace(/\s*\([^)]*\)/g,'').replace(/\s{2,}/g,' ').trim();}
function formatWeight(grams:number|null){if(grams===null||!Number.isFinite(grams)||grams<=0)return'';return grams>=1000?`${(grams/1000).toLocaleString('tr-TR',{maximumFractionDigits:2})} kg`:`${grams.toLocaleString('tr-TR')} g`;}
function dateOnly(value?:string|null){const raw=safeText(value,80);if(!raw)return'';const date=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(`${raw}T12:00:00`):new Date(raw);if(Number.isNaN(date.getTime()))return'';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium'}).format(date);}catch{return'';}}
function safeUrl(value?:string|null){const raw=safeText(value,1200);if(!raw)return'';try{const url=new URL(raw);return url.protocol==='https:'?url.toString():'';}catch{return'';}}
function joinLocation(origin:any){if(!origin||typeof origin!=='object'||Array.isArray(origin))return'';return[origin?.village,origin?.district,origin?.province,origin?.countryCode].map((item:any)=>safeText(item,120)).filter(Boolean).join(', ');}
