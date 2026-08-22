import React,{useCallback,useEffect,useRef,useState}from'react';
import{App as CapApp}from'@capacitor/app';
import{Capacitor}from'@capacitor/core';
import{Haptics,ImpactStyle}from'@capacitor/haptics';
import{Bell,CheckCircle,Grid,Heart,Home,Mic,Search,ShoppingCart,User,X}from'lucide-react';
import{useCustomerSession}from'./features/auth/useCustomerSession';
import{useUnreadNotificationCount}from'./features/account/useUnreadNotificationCount';
import{useAccessibleDialog}from'./features/accessibility/useAccessibleDialog';
import{listFavoriteReferences as serverFavoriteReferences,searchCatalog as serverCatalogSearch,toggleProductFavorite as serverToggleProductFavorite}from'./features/catalog/api';
import CatalogSearchOverlay from'./features/catalog/CatalogSearchOverlay';
import{useAuthRecoveryCoordinator}from'./features/auth/useAuthRecoveryCoordinator';
import{getAdminSessionStatus,signOutCurrentSession}from'./features/auth/api';
import{getCart as getServerCart,publicCatalogUrl as serverCatalogUrl,resolveDefaultVariant,setCartItem as setServerCartItem}from'./features/cart/api';
import{useDeviceTheme}from'./features/appearance/useDeviceTheme';
import{useConnectivity}from'./features/resilience/useConnectivity';
import{subscribeNativePushActions}from'./features/notifications/nativePush';
import{buildProductUrl,buildProducerUrl,buildSearchUrl,parsePublicRoute,resolveAppActionTarget,shareOrCopy}from'./features/navigation/appUrl';
import HomeSection from'./features/home/HomeSection';

const AdminPage=React.lazy(()=>import('./pages/AdminPage').then(module=>({default:module.AdminPage})));
const AccountCenter=React.lazy(()=>import('./features/account/AccountCenter'));
const ProducerApplicationFlow=React.lazy(()=>import('./features/producer-onboarding/ProducerApplicationFlow'));
const PublicInfoScreen=React.lazy(()=>import('./features/storefront/PublicInfoScreen'));
const PublicHealthScreen=React.lazy(()=>import('./features/content/PublicHealthScreen'));
const PublicEventsScreen=React.lazy(()=>import('./features/engagement/PublicEventsScreen'));
const PublicContactScreen=React.lazy(()=>import('./features/engagement/PublicContactScreen'));
const CategoryDirectoryScreen=React.lazy(()=>import('./features/catalog/CategoryDirectoryScreen'));
const PublicProducerScreen=React.lazy(()=>import('./features/catalog/PublicProducerScreen'));
const ProductDetailScreen=React.lazy(()=>import('./features/catalog/ProductDetailScreen'));
const CatalogSearchResults=React.lazy(()=>import('./features/catalog/CatalogSearchResults'));
const AuthScreen=React.lazy(()=>import('./features/auth/AuthScreen'));
const PasswordRecoveryScreen=React.lazy(()=>import('./features/auth/PasswordRecoveryScreen'));
const CartCheckoutFlow=React.lazy(()=>import('./features/cart/CartCheckoutFlow'));
const GiftOrderFlow=React.lazy(()=>import('./features/gifts/GiftOrderFlow'));

type Tab='home'|'categories'|'cart'|'account'|'product-detail'|'search-results'|'producer-profile'|'events'|'health'|'contact'|'about'|'admin';
const SUPPORTED_TABS=new Set<Tab>(['home','categories','cart','account','product-detail','search-results','producer-profile','events','health','contact','about','admin']);

function RouteLoading({label='Ekran yükleniyor'}:{label?:string}){return<div role="status" aria-live="polite" className="mx-auto flex min-h-40 max-w-7xl items-center justify-center p-6 text-sm font-semibold text-gray-500">{label}</div>;}
function safeTab(value:unknown):Tab{const candidate=String(value||'home')as Tab;return SUPPORTED_TABS.has(candidate)?candidate:'home';}
function tabUrl(tab:Tab){const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('tab',tab);return url.toString();}
function normalizeInitialTab(route:ReturnType<typeof parsePublicRoute>,tab:Tab):Tab{if(tab==='product-detail'&&!route.productReference)return'home';if(tab==='producer-profile'&&!route.producerReference)return'home';return tab;}
function routeDepthFromState(state:any){const value=Number(state?.goldenOremarDepth);return Number.isSafeInteger(value)&&value>=0?value:0;}
function snapshotItemCount(snapshot:any,items:any[]){const reported=Number(snapshot?.itemCount);if(Number.isSafeInteger(reported)&&reported>=0)return reported;return items.reduce((total,item)=>total+Math.max(0,Math.floor(Number(item?.quantity)||0)),0);}

function AppContent(){
 const initialRoute=useRef(parsePublicRoute()).current;
 const initialTab=safeTab(initialRoute.tab);
 const resolvedInitialTab=normalizeInitialTab(initialRoute,initialTab);
 const {currentUser,setCurrentUser,authReady}=useCustomerSession();
 const{theme:appearanceTheme,setTheme:setAppearanceTheme}=useDeviceTheme();
 const authRecovery=useAuthRecoveryCoordinator();
 const{unreadCount,setUnreadCount,refreshUnreadCount}=useUnreadNotificationCount(!!currentUser);
 const{isOnline,restoreSequence}=useConnectivity();
 const[currentTab,setCurrentTab]=useState<Tab>(resolvedInitialTab);
 const[routeDepth,setRouteDepth]=useState(0);
 const routeDepthRef=useRef(0);
 const[accountView,setAccountView]=useState(initialRoute.accountView||'menu');
 const[adminView,setAdminView]=useState(initialRoute.adminView||'dashboard');
 const[selectedProductReference,setSelectedProductReference]=useState<string|null>(initialRoute.productReference);
 const[selectedProducerReference,setSelectedProducerReference]=useState<string|null>(initialRoute.producerReference);
 const[searchQuery,setSearchQuery]=useState(initialRoute.query);
 const[searchCategorySlug,setSearchCategorySlug]=useState<string|null>(initialRoute.categorySlug);
 const[searchProducerId,setSearchProducerId]=useState<string|null>(initialRoute.producerId);
 const[cart,setCart]=useState<any[]>([]);
 const[cartItemCount,setCartItemCount]=useState(0);
 const[favorites,setFavorites]=useState<string[]>([]);
 const[toast,setToast]=useState<{message:string;visible:boolean}>({message:'',visible:false});
 const[showGiftModal,setShowGiftModal]=useState(false);
 const[giftProduct,setGiftProduct]=useState<any>(null);
 const[isSearchFocused,setIsSearchFocused]=useState(false);
 const[isListening,setIsListening]=useState(false);
 const[speechText,setSpeechText]=useState('');
 const[voiceError,setVoiceError]=useState('');
 const recognitionRef=useRef<any>(null);
 const voiceDialogRef=useAccessibleDialog<HTMLDivElement>(isListening,()=>stopVoiceSearch());
 const[adminSession,setAdminSession]=useState<{checked:boolean;isAdmin:boolean;roles:string[]}>({checked:false,isAdmin:false,roles:[]});
 const isAdminLoggedIn=adminSession.checked&&adminSession.isAdmin;

 const showToast=useCallback((message:string)=>{setToast({message,visible:true});window.setTimeout(()=>setToast(previous=>({...previous,visible:false})),3200);},[]);

 useEffect(()=>{
  const normalizedUrl=resolvedInitialTab===initialTab?window.location.href:tabUrl('home');
  routeDepthRef.current=0;
  window.history.replaceState({...window.history.state,goldenOremar:true,goldenOremarDepth:0,tab:resolvedInitialTab},'',normalizedUrl);
  if(resolvedInitialTab!==initialTab){setSelectedProductReference(null);setSelectedProducerReference(null);setAccountView('menu');setAdminView('dashboard');}
 },[]);

 const pushRoute=useCallback((url:string,tab:Tab)=>{
  if(window.location.href!==url){
   const next=routeDepthRef.current+1;
   routeDepthRef.current=next;
   setRouteDepth(next);
   window.history.pushState({goldenOremar:true,goldenOremarDepth:next,tab},'',url);
  }
  setCurrentTab(tab);
  window.scrollTo({top:0,behavior:'auto'});
 },[]);

 const replaceWithHome=useCallback(()=>{
  const url=tabUrl('home');
  routeDepthRef.current=0;
  window.history.replaceState({goldenOremar:true,goldenOremarDepth:0,tab:'home'},'',url);
  setRouteDepth(0);setCurrentTab('home');setSelectedProductReference(null);setSelectedProducerReference(null);setSearchQuery('');setSearchCategorySlug(null);setSearchProducerId(null);setIsSearchFocused(false);window.scrollTo({top:0,behavior:'auto'});
 },[]);

 const navigateToTab=useCallback((tab:Tab)=>{
  if(tab==='admin'&&(!authReady||!adminSession.checked)){
   pushRoute(tabUrl('admin'),'admin');
   return;
  }
  if(tab==='admin'&&!isAdminLoggedIn){
   showToast('Bu alan için doğrulanmış yönetici yetkisi gerekiyor.');
   setAccountView('menu');
   pushRoute(tabUrl('account'),'account');
   return;
  }
  if(tab==='home'){setSearchQuery('');setSearchCategorySlug(null);setSearchProducerId(null);setIsSearchFocused(false);}
  pushRoute(tabUrl(tab),tab);
 },[adminSession.checked,authReady,isAdminLoggedIn,pushRoute,showToast]);

 const openProduct=useCallback((reference:string)=>{
  const normalized=String(reference||'').trim();
  if(!normalized){showToast('Ürün referansı bulunamadı.');return;}
  try{setSelectedProductReference(normalized);pushRoute(buildProductUrl(normalized),'product-detail');}catch{showToast('Ürün bağlantısı oluşturulamadı.');}
 },[pushRoute,showToast]);

 const openProducer=useCallback((reference:string)=>{
  const normalized=String(reference||'').trim();
  if(!normalized){showToast('Üretici referansı bulunamadı.');return;}
  try{setSelectedProducerReference(normalized);pushRoute(buildProducerUrl(normalized),'producer-profile');}catch{showToast('Üretici bağlantısı oluşturulamadı.');}
 },[pushRoute,showToast]);

 const openSearch=useCallback((query:string,categorySlug:string|null=null,producerId:string|null=null)=>{
  const normalized=String(query||'').trim().slice(0,160);
  setSearchQuery(normalized);setSearchCategorySlug(categorySlug);setSearchProducerId(producerId);setIsSearchFocused(false);
  pushRoute(buildSearchUrl({query:normalized,categorySlug,producerId}),'search-results');
 },[pushRoute]);

 useEffect(()=>{
  const applyLocation=(event:PopStateEvent)=>{
   const route=parsePublicRoute();
   const next=normalizeInitialTab(route,safeTab(route.tab));
   const depth=routeDepthFromState(event.state);
   routeDepthRef.current=depth;setRouteDepth(depth);
   setSelectedProductReference(route.productReference);
   setSelectedProducerReference(route.producerReference);
   setSearchQuery(route.query);setSearchCategorySlug(route.categorySlug);setSearchProducerId(route.producerId);
   if(next==='account')setAccountView(route.accountView||'menu');
   if(next==='admin')setAdminView(route.adminView||'dashboard');
   setCurrentTab(next);setIsSearchFocused(false);window.scrollTo({top:0,behavior:'auto'});
  };
  window.addEventListener('popstate',applyLocation);return()=>window.removeEventListener('popstate',applyLocation);
 },[]);

 useEffect(()=>{
  const titles:Partial<Record<Tab,string>>={home:'Golden Oremar | Doğrulanmış Üreticilerden Köy Ürünleri',categories:'Ürün Kategorileri | Golden Oremar',cart:'Sepetim | Golden Oremar',account:'Hesabım | Golden Oremar','product-detail':'Ürün Detayı | Golden Oremar','producer-profile':'Üretici Profili | Golden Oremar','search-results':'Arama Sonuçları | Golden Oremar',events:'Etkinlikler | Golden Oremar',health:'Bilgi Merkezi | Golden Oremar',contact:'İletişim | Golden Oremar',about:'Hakkımızda | Golden Oremar',admin:'Yönetim | Golden Oremar'};
  const descriptions:Partial<Record<Tab,string>>={home:'Doğrulanmış üreticilerden köy ve yöresel ürünleri canlı katalogdan keşfedin.',categories:'Golden Oremar canlı ürün kategorilerini inceleyin.',cart:'Sepet, stok ve sipariş bilgilerinizi güvenli şekilde yönetin.',account:'Sipariş, favori, mesaj, adres ve hesap ayarlarınızı yönetin.','product-detail':'Ürün, üretici, menşe, stok, lot ve güven bilgilerini inceleyin.','producer-profile':'Doğrulanmış üretici profilini ve ürünlerini inceleyin.'};
  const title=titles[currentTab]||'Golden Oremar';const description=descriptions[currentTab]||'Golden Oremar köy ve yöresel ürünler pazaryeri.';document.title=title;
  const setMeta=(selector:string,attribute:'name'|'property',key:string,content:string)=>{let element=document.querySelector<HTMLMetaElement>(selector);if(!element){element=document.createElement('meta');element.setAttribute(attribute,key);document.head.appendChild(element);}element.setAttribute('content',content);};
  setMeta('meta[name="description"]','name','description',description);setMeta('meta[property="og:title"]','property','og:title',title);setMeta('meta[property="og:description"]','property','og:description',description);setMeta('meta[name="twitter:title"]','name','twitter:title',title);setMeta('meta[name="twitter:description"]','name','twitter:description',description);
  const canonical=window.location.href;let canonicalElement=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!canonicalElement){canonicalElement=document.createElement('link');canonicalElement.rel='canonical';document.head.appendChild(canonicalElement);}canonicalElement.href=canonical;
  setMeta('meta[property="og:url"]','property','og:url',canonical);
 },[currentTab,selectedProductReference,selectedProducerReference,searchQuery,searchCategorySlug,searchProducerId]);

 useEffect(()=>{
  let active=true;
  if(!authReady){setAdminSession(previous=>({...previous,checked:false}));return()=>{active=false;};}
  if(!currentUser?.id){setAdminSession({checked:true,isAdmin:false,roles:[]});return()=>{active=false;};}
  setAdminSession(previous=>({...previous,checked:false}));
  getAdminSessionStatus().then(status=>{if(active)setAdminSession({checked:true,isAdmin:status.is_admin===true,roles:status.roles});}).catch(error=>{console.error('Supabase admin session verification failed',error);if(active)setAdminSession({checked:true,isAdmin:false,roles:[]});});
  return()=>{active=false;};
 },[authReady,currentUser?.id]);

 useEffect(()=>{
  if(authReady&&currentTab==='admin'&&adminSession.checked&&!adminSession.isAdmin){setAccountView('menu');window.history.replaceState({goldenOremar:true,goldenOremarDepth:routeDepth,tab:'account'},'',tabUrl('account'));setCurrentTab('account');showToast('Bu alan için doğrulanmış yönetici yetkisi gerekiyor.');}
 },[authReady,currentTab,adminSession.checked,adminSession.isAdmin,routeDepth,showToast]);

 useEffect(()=>{
  let active=true;
  if(!currentUser){setFavorites([]);return()=>{active=false;};}
  serverFavoriteReferences().then(references=>{if(active)setFavorites(references);}).catch(error=>console.error('Supabase favorites hydration failed',error));
  return()=>{active=false;};
 },[currentUser?.id]);

 const applyServerCartSnapshot=useCallback((snapshot:any)=>{
  const items=(snapshot?.items||[]).map((item:any)=>({id:item.productId,slug:item.slug,name:item.productName,price:Number(item.priceMinor||0)/100,image:serverCatalogUrl(item.imagePath),quantity:item.quantity,variantId:item.variantId,variantName:item.variantName,cartItemId:item.cartItemId,selectedOptions:item.selectedOptions||{},sellableQuantity:item.sellableQuantity,producer:item.producer,_serverCart:true}));
  setCart(items);setCartItemCount(snapshotItemCount(snapshot,items));return snapshot;
 },[]);
 const fetchCart=useCallback(async()=>{
  if(!currentUser){setCart([]);setCartItemCount(0);return;}
  try{applyServerCartSnapshot(await getServerCart());}catch(error:any){if(!String(error?.message||'').includes('authentication_required'))console.error('Supabase cart hydration failed',error);setCart([]);setCartItemCount(0);}
 },[currentUser?.id,applyServerCartSnapshot]);
 useEffect(()=>{void fetchCart();},[fetchCart]);
 useEffect(()=>{if(restoreSequence===0)return;showToast('İnternet bağlantısı geri geldi. Güncel veriler doğrulanıyor.');if(currentUser){void fetchCart();void refreshUnreadCount();}},[restoreSequence,currentUser?.id,fetchCart,refreshUnreadCount,showToast]);

 const addToCart=useCallback(async(product:any,quantity=1,silent=false)=>{
  if(!currentUser){showToast('Sepeti kaydetmek için hesabınıza giriş yapın.');setAccountView('menu');navigateToTab('account');return;}
  if(Capacitor.isNativePlatform()){try{await Haptics.impact({style:ImpactStyle.Light});}catch{}}
  try{
   const reference=product?.slug||String(product?.id||'');if(!reference)throw new Error('Ürün referansı bulunamadı.');
   const existing=cart.find((item:any)=>item.slug===product?.slug||String(item.id)===String(product?.id));let variantId=product?.variantId||existing?.variantId;let selectedOptions=existing?.selectedOptions||{};
   if(!variantId){const resolved=await resolveDefaultVariant(reference);variantId=resolved.variant.id;selectedOptions=resolved.variant.options||{};}
   const requested=Math.max(1,Math.min(99,Math.floor(Number(quantity)||1)));const nextQuantity=Math.min(99,Math.max(1,Number(existing?.quantity||0)+requested));applyServerCartSnapshot(await setServerCartItem({variantId,quantity:nextQuantity,selectedOptions}));if(!silent)showToast(`${product?.name||'Ürün'} sepetinize eklendi.`);
  }catch(error:any){const message=String(error?.message||'Ürün sepete eklenemedi.');showToast(message.includes('insufficient_stock')?'Bu ürün için yeterli stok kalmadı.':message);}
 },[currentUser,cart,applyServerCartSnapshot,navigateToTab,showToast]);

 const toggleFavorite=useCallback(async(product:any)=>{
  if(!currentUser){showToast('Favorileri kaydetmek için hesabınıza giriş yapın.');setAccountView('menu');navigateToTab('account');return;}
  if(Capacitor.isNativePlatform()){try{await Haptics.impact({style:ImpactStyle.Light});}catch{}}
  try{const result=await serverToggleProductFavorite(product?.slug||product?.legacyId||product?.id);const reference=String(result?.productReference||product?.legacyId||product?.id||'');setFavorites(previous=>result?.isFavorite?(previous.includes(reference)?previous:[...previous,reference]):previous.filter(item=>item!==reference));showToast(result?.isFavorite?`${product?.name||'Ürün'} favorilerinize eklendi.`:`${product?.name||'Ürün'} favorilerinizden çıkarıldı.`);}catch(error:any){showToast(String(error?.message||'Favori işlemi tamamlanamadı.'));}
 },[currentUser,navigateToTab,showToast]);

 const shareProduct=useCallback(async(product:any)=>{
  try{const reference=product?.slug||product?.legacyId||product?.id;const result=await shareOrCopy({title:String(product?.name||'Golden Oremar ürünü'),text:String(product?.shortDescription||product?.description||'').trim(),url:buildProductUrl(reference)});if(result==='copied')showToast('Ürün bağlantısı panoya kopyalandı.');else if(result==='shared')showToast('Ürün paylaşımı tamamlandı.');else showToast('Paylaşım iptal edildi.');}catch{showToast('Ürün bağlantısı paylaşılamadı.');}
 },[showToast]);

 const openGift=useCallback((product:any)=>{if(!currentUser){setGiftProduct(product);showToast('Hediye siparişi için hesabınıza giriş yapın.');setAccountView('menu');navigateToTab('account');return;}setGiftProduct(product);setShowGiftModal(true);},[currentUser,navigateToTab,showToast]);

 const handleNotificationAction=useCallback((actionUrl:unknown,metadata:Record<string,unknown>={})=>{
  const target=resolveAppActionTarget(actionUrl,metadata);
  if(target.kind==='product')openProduct(target.reference);
  else if(target.kind==='producer')openProducer(target.reference);
  else if(target.kind==='events')navigateToTab('events');
  else if(target.kind==='admin'){setAdminView(target.view);navigateToTab('admin');}
  else if(target.kind==='account'){setAccountView(target.view);pushRoute(tabUrl('account'),'account');}
  else{setAccountView('notifications');pushRoute(tabUrl('account'),'account');}
  void refreshUnreadCount();
 },[navigateToTab,openProduct,openProducer,pushRoute,refreshUnreadCount]);

 useEffect(()=>subscribeNativePushActions(({actionUrl,metadata})=>handleNotificationAction(actionUrl,(metadata||{})as Record<string,unknown>)),[handleNotificationAction]);

 useEffect(()=>{if(!authRecovery.callbackHandled)return;setAccountView('menu');pushRoute(tabUrl('account'),'account');if(!authRecovery.recoveryPending)authRecovery.acknowledgeCallback();},[authRecovery.callbackHandled,authRecovery.recoveryPending,authRecovery.acknowledgeCallback,pushRoute]);
 useEffect(()=>{if(!authRecovery.error)return;showToast(authRecovery.error);authRecovery.clearError();},[authRecovery.error,authRecovery.clearError,showToast]);

 const goBack=useCallback(()=>{
  if(currentTab==='account'&&accountView!=='menu'){setAccountView('menu');return;}
  if(routeDepth>0){window.history.back();return;}
  if(currentTab!=='home')replaceWithHome();
 },[currentTab,accountView,routeDepth,replaceWithHome]);

 function stopVoiceSearch(){try{recognitionRef.current?.abort?.();}catch{}recognitionRef.current=null;setIsListening(false);}
 const processVoiceText=useCallback(async(text:string)=>{
  const value=text.trim();if(!value)return;const lower=value.toLocaleLowerCase('tr-TR');const commands=['sepete ekle','sepetine ekle','satın al'];const command=commands.find(item=>lower.includes(item));
  if(command){const query=value.replace(new RegExp(command,'i'),'').trim();if(query){try{const result=await serverCatalogSearch({query,inStock:true,sort:'relevance',limit:5,offset:0});const product=result.items?.[0];if(product){await addToCart({id:product.id,slug:product.slug,name:product.name,variantId:product.variant?.id},1,true);showToast(`${product.name} sepetinize eklendi.`);return;}}catch(error:any){showToast(String(error?.message||'Sesli ürün komutu tamamlanamadı.'));return;}}}
  openSearch(value);
 },[addToCart,openSearch,showToast]);
 const triggerVoiceSearch=useCallback(()=>{
  const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  setSpeechText('');setVoiceError('');setIsListening(true);
  if(!SpeechRecognition){setVoiceError('Bu cihazda sesli arama desteklenmiyor. Arama kutusunu kullanabilirsiniz.');return;}
  try{const recognition=new SpeechRecognition();recognition.lang='tr-TR';recognition.interimResults=true;recognition.maxAlternatives=1;recognitionRef.current=recognition;let finalText='';recognition.onresult=(event:any)=>{let value='';for(let index=event.resultIndex;index<event.results.length;index+=1){value+=event.results[index][0]?.transcript||'';if(event.results[index].isFinal)finalText+=event.results[index][0]?.transcript||'';}setSpeechText(value||finalText);};recognition.onerror=(event:any)=>{setVoiceError(event.error==='not-allowed'?'Mikrofon izni verilmedi. Cihaz ayarlarından izin verebilir veya arama kutusunu kullanabilirsiniz.':'Ses anlaşılamadı. Tekrar deneyebilirsiniz.');};recognition.onend=()=>{recognitionRef.current=null;const value=finalText.trim();setIsListening(false);if(value)void processVoiceText(value);};recognition.start();}catch{setVoiceError('Sesli arama başlatılamadı. Arama kutusunu kullanabilirsiniz.');}
 },[processVoiceText]);

 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;let disposed=false;let handle:{remove:()=>Promise<void>}|undefined;
  void CapApp.addListener('backButton',()=>{if(authRecovery.recoveryPending)return;if(isListening){stopVoiceSearch();return;}if(isSearchFocused){setIsSearchFocused(false);return;}if(showGiftModal){setShowGiftModal(false);return;}if(currentTab==='account'&&accountView!=='menu'){setAccountView('menu');return;}if(routeDepth>0){window.history.back();return;}if(currentTab!=='home'){replaceWithHome();return;}void CapApp.exitApp();}).then(next=>{if(disposed)void next.remove();else handle=next;});
  return()=>{disposed=true;if(handle)void handle.remove();};
 },[authRecovery.recoveryPending,isListening,isSearchFocused,showGiftModal,currentTab,accountView,routeDepth,replaceWithHome]);

 const renderContent=()=>{
  if(currentTab==='product-detail'&&selectedProductReference)return<ProductDetailScreen reference={selectedProductReference} authenticated={!!currentUser} favoriteReferences={favorites} onFavoriteChanged={(reference,isFavorite)=>setFavorites(previous=>isFavorite?(previous.includes(reference)?previous:[...previous,reference]):previous.filter(item=>item!==reference))} onBack={goBack} onLoginRequired={()=>{showToast('Bu işlem için hesabınıza giriş yapın.');setAccountView('menu');navigateToTab('account');}} onCartChanged={fetchCart} onGift={reference=>openGift({id:reference,slug:reference})} onProducer={(_id,slug)=>openProducer(slug)}/>;
  if(currentTab==='producer-profile'&&selectedProducerReference)return<PublicProducerScreen reference={selectedProducerReference} authenticated={!!currentUser} onBack={goBack} onLoginRequired={()=>{showToast('Bu işlem için hesabınıza giriş yapın.');setAccountView('menu');navigateToTab('account');}} onOpenConversation={conversationId=>{setAccountView(`messages:${conversationId}`);navigateToTab('account');}} onOpenProduct={slug=>openProduct(slug)} onAddToCart={async(product,quantity)=>{await addToCart(product,quantity);}}/>;
  if(currentTab==='search-results')return<CatalogSearchResults query={searchQuery} categorySlug={searchCategorySlug} producerId={searchProducerId} onBack={goBack} onOpenProduct={slug=>openProduct(slug)} onAddToCart={async(item,quantity)=>{await addToCart({id:item.id,slug:item.slug,name:item.name,variantId:item.variant?.id},quantity);}}/>;
  if(currentTab==='account'){
   if(authRecovery.recoveryPending)return<PasswordRecoveryScreen onCompleted={()=>{authRecovery.finishRecovery();setAccountView('menu');showToast('Şifreniz güvenle güncellendi.');}} onCancelled={()=>{authRecovery.finishRecovery();setCurrentUser(null);setAccountView('menu');showToast('Şifre sıfırlama işlemi iptal edildi.');}}/>;
   if(!authReady)return<RouteLoading label="Hesabınız doğrulanıyor"/>;
   if(!currentUser)return<AuthScreen title="Golden Oremar Hesabı" onAuthenticated={()=>setAccountView('menu')}/>;
   if(accountView==='vendor-apply')return<ProducerApplicationFlow currentUser={currentUser} onBack={()=>setAccountView('menu')}/>;
   return<AccountCenter requestedView={accountView} theme={appearanceTheme} onThemeChange={setAppearanceTheme} onBack={goBack} onOpenProduct={slug=>openProduct(slug)} onOpenProducer={slug=>openProducer(slug)} onStartGift={()=>navigateToTab('home')} onOpenContact={()=>navigateToTab('contact')} onOpenHealth={()=>navigateToTab('health')} onOpenEvents={()=>navigateToTab('events')} onOpenAdmin={()=>{setAdminView('dashboard');navigateToTab('admin');}} onOpenSellerApplication={()=>setAccountView('vendor-apply')} onUnreadNotificationCountChange={setUnreadCount} onOpenNotificationAction={(url,metadata)=>handleNotificationAction(url,metadata)}/>;
  }
  if(currentTab==='cart'){
   if(!authReady)return<RouteLoading label="Sepet oturumunuz doğrulanıyor"/>;
   if(!currentUser)return<AuthScreen title="Sepetinizi kullanmak için hesabınıza giriş yapın." description="Sepetiniz, stok durumunuz ve siparişiniz hesabınıza güvenli şekilde bağlanır."/>;
   return<CartCheckoutFlow onBack={goBack} onCartChanged={applyServerCartSnapshot} onOpenAddresses={()=>{setAccountView('addresses');navigateToTab('account');}} onOpenPayments={()=>{setAccountView('payments');navigateToTab('account');}} onOrderCreated={()=>{setCart([]);setCartItemCount(0);setAccountView('orders');navigateToTab('account');}}/>;
  }
  if(currentTab==='categories')return<CategoryDirectoryScreen onOpenProduct={slug=>openProduct(slug)} onAddToCart={async(item,quantity)=>{await addToCart({id:item.id,slug:item.slug,name:item.name,variantId:item.variant?.id},quantity);}}/>;
  if(currentTab==='events')return<PublicEventsScreen onBack={goBack} currentUser={currentUser}/>;
  if(currentTab==='health')return<PublicHealthScreen onBack={goBack} authenticated={!!currentUser} locale={currentUser?.locale||'tr'} onLoginRequired={()=>{showToast('İçerikleri favoriye kaydetmek için hesabınıza giriş yapın.');setAccountView('menu');navigateToTab('account');}} onOpenProduct={slug=>openProduct(slug)}/>;
  if(currentTab==='contact')return<PublicContactScreen onBack={goBack} currentUser={currentUser} locale={currentUser?.locale||'tr'}/>;
  if(currentTab==='about')return<PublicInfoScreen page="about" locale={currentUser?.locale||'tr'} onBack={goBack}/>;
  return<HomeSection searchQuery={searchQuery} setSearchQuery={setSearchQuery} onProductClick={product=>openProduct(product?.slug||product?.legacyId||product?.id)} onAddToCart={addToCart} onToggleFavorite={toggleFavorite} favorites={favorites} onShare={shareProduct} onGift={openGift}/>;
 };

 if(currentTab==='admin'){
  if(!adminSession.checked)return<RouteLoading label="Yönetici yetkisi doğrulanıyor"/>;
  if(isAdminLoggedIn)return<React.Suspense fallback={<RouteLoading label="Yönetim yükleniyor"/>}><AdminPage initialTab={adminView} onBack={goBack} onLogout={async()=>{await signOutCurrentSession();setCurrentUser(null);setAdminSession({checked:true,isAdmin:false,roles:[]});setCart([]);setCartItemCount(0);replaceWithHome();}}/></React.Suspense>;
 }

 return<div className="min-h-screen bg-brand-main pb-28 font-sans text-brand-text">
  {currentTab==='home'?<header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95" style={{paddingTop:'env(safe-area-inset-top, 0px)'}}>
   {!isOnline?<div role="status" aria-live="polite" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100">Çevrimdışısınız. Canlı işlemler bağlantı geri gelene kadar tamamlanamaz.</div>:null}
   <div className="mx-auto max-w-7xl px-4 sm:px-6">
    <div className="flex min-h-16 items-center gap-3 md:min-h-20">
     <button type="button" onClick={()=>navigateToTab('home')} aria-label="Golden Oremar ana sayfası" className="grid min-h-11 min-w-11 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><img src="/logo.svg" alt="" aria-hidden="true" className="h-11 w-11 rounded-xl object-contain"/></button>
     <div className="relative min-w-0 flex-1 md:mx-auto md:max-w-2xl"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input type="search" aria-label="Ürün, üretici veya köy ara" placeholder="Ürün, üretici veya köy ara..." value={searchQuery} onChange={event=>setSearchQuery(event.target.value.slice(0,160))} onFocus={()=>setIsSearchFocused(true)} onBlur={()=>window.setTimeout(()=>setIsSearchFocused(false),180)} onKeyDown={event=>{if(event.key==='Enter'&&searchQuery.trim()){event.preventDefault();openSearch(searchQuery);}}} className="h-11 w-full rounded-xl border border-transparent bg-gray-100 pl-11 pr-14 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-brand-gold/50 dark:bg-gray-800 dark:focus:bg-gray-800"/><button type="button" onClick={searchQuery?()=>setSearchQuery(''):triggerVoiceSearch} aria-label={searchQuery?'Aramayı temizle':'Sesli arama'} className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-lg text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{searchQuery?<X aria-hidden="true" className="h-5 w-5"/>:<Mic aria-hidden="true" className="h-5 w-5"/>}</button></div>
     <div className="flex items-center gap-1"><HeaderAction label={unreadCount?`Bildirimler, ${unreadCount} okunmamış`:'Bildirimler'} onClick={()=>{setAccountView('notifications');navigateToTab('account');}} icon={<Bell aria-hidden="true" className="h-5 w-5"/>} badge={unreadCount}/><HeaderAction label={cartItemCount?`Sepetim, ${cartItemCount} ürün`:'Sepetim'} onClick={()=>navigateToTab('cart')} icon={<ShoppingCart aria-hidden="true" className="h-5 w-5"/>} badge={cartItemCount}/></div>
    </div>
    <CatalogSearchOverlay query={searchQuery} open={isSearchFocused} onQueryChange={setSearchQuery} onProduct={slug=>{setIsSearchFocused(false);openProduct(slug);}} onProducer={(_id,slug)=>{setIsSearchFocused(false);openProducer(slug);}} onCategory={(slug,label)=>{setIsSearchFocused(false);openSearch(label,slug,null);}} onAllResults={value=>openSearch(value)}/>
   </div>
  </header>:null}

  <main><React.Suspense fallback={<RouteLoading/>}>{renderContent()}</React.Suspense></main>

  <nav aria-label="Ana gezinme" className="fixed bottom-4 left-3 right-3 z-[60] mx-auto flex h-[68px] max-w-[44rem] items-center justify-around rounded-3xl border border-gray-200/70 bg-white/95 px-1 shadow-xl backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95" style={{bottom:'calc(0.75rem + env(safe-area-inset-bottom, 0px))'}}><BottomNavButton icon={Home} label="Ana Sayfa" active={currentTab==='home'} onClick={()=>navigateToTab('home')}/><BottomNavButton icon={Grid} label="Kategoriler" active={currentTab==='categories'} onClick={()=>navigateToTab('categories')}/><BottomNavButton icon={Heart} label="Favoriler" active={currentTab==='account'&&accountView==='favorites'} onClick={()=>{setAccountView('favorites');navigateToTab('account');}}/><BottomNavButton icon={ShoppingCart} label="Sepet" active={currentTab==='cart'} onClick={()=>navigateToTab('cart')} badge={cartItemCount}/><BottomNavButton icon={User} label="Hesabım" active={currentTab==='account'&&accountView!=='favorites'} onClick={()=>{setAccountView('menu');navigateToTab('account');}}/></nav>

  {showGiftModal&&giftProduct?<React.Suspense fallback={<RouteLoading label="Hediye sipariş ekranı yükleniyor"/>}><GiftOrderFlow productReference={giftProduct.slug||String(giftProduct.id)} onClose={()=>setShowGiftModal(false)} onOpenPayments={()=>{setShowGiftModal(false);setAccountView('payments');navigateToTab('account');}} onCreated={()=>{showToast('Hediye siparişiniz oluşturuldu ve ödeme doğrulaması bekliyor.');setShowGiftModal(false);setAccountView('gifts');navigateToTab('account');}}/></React.Suspense>:null}

  {isListening?<div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"><div ref={voiceDialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-title" aria-describedby="voice-description" tabIndex={-1} className="relative w-full max-w-lg rounded-t-3xl bg-gray-950 p-6 text-white shadow-2xl outline-none sm:rounded-3xl"><button type="button" onClick={stopVoiceSearch} aria-label="Sesli aramayı kapat" className="absolute right-4 top-4 grid min-h-11 min-w-11 place-items-center rounded-xl bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5"/></button><div className="mx-auto mt-4 grid h-20 w-20 place-items-center rounded-full border border-brand-gold/40 bg-brand-gold/10"><Mic aria-hidden="true" className="h-8 w-8 text-brand-gold"/></div><h2 id="voice-title" className="mt-5 text-center text-xl font-bold">Sesli arama</h2><p id="voice-description" className="mt-2 text-center text-sm text-gray-400">Ürün adını söyleyin. “Karakovan balı sepete ekle” gibi bir komut da kullanabilirsiniz.</p><div role="status" aria-live="polite" className="mt-4 min-h-14 rounded-xl bg-gray-900 p-4 text-center font-semibold">{speechText||'Dinleniyor…'}</div>{voiceError?<div role="alert" className="mt-3 rounded-xl bg-red-950/50 p-3 text-sm text-red-200">{voiceError}</div>:null}</div></div>:null}

  {toast.visible?<div role="status" aria-live="polite" aria-atomic="true" className="fixed left-1/2 z-[130] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-full bg-brand-green px-5 py-3 text-sm font-semibold text-brand-on-green shadow-2xl" style={{top:'calc(4rem + env(safe-area-inset-top, 0px))'}}><CheckCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-gold"/><span>{toast.message}</span></div>:null}
 </div>;
}

export default function App(){return<AppContent/>;}

function HeaderAction({label,onClick,icon,badge=0}:{label:string;onClick:()=>void;icon:React.ReactNode;badge?:number}){return<button type="button" onClick={onClick} aria-label={label} className="relative grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:hover:bg-gray-800">{icon}{badge>0?<span aria-hidden="true" className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{badge>99?'99+':badge}</span>:null}</button>;}
function BottomNavButton({icon:Icon,label,active,onClick,badge=0}:{icon:any;label:string;active:boolean;onClick:()=>void;badge?:number}){return<button type="button" onClick={onClick} aria-current={active?'page':undefined} aria-label={badge>0?`${label}, ${badge} öğe`:label} className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${active?'text-brand-gold':'text-gray-500 dark:text-gray-400'}`}><span className="relative"><Icon aria-hidden="true" className="h-6 w-6"/>{badge>0?<span aria-hidden="true" className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{badge>99?'99+':badge}</span>:null}</span><span className="text-[11px] font-bold">{label}</span></button>;}
