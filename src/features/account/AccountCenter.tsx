import React,{useEffect,useRef,useState}from'react';
import{ArrowLeft,Bell,Calendar,ChevronRight,Gift,Heart,HelpCircle,Leaf,MapPin,MessageCircle,Package,Settings,ShieldCheck,Store,UserRound,WalletCards}from'lucide-react';
import{getAccountOverview}from'./api';
import type{AccountOverview,AccountView}from'./types';
import{ErrorState,LoadingState}from'./ui';
import type{AppTheme}from'../appearance/theme';

const ProfilePanel=React.lazy(()=>import('./ProfilePanel'));
const AddressesPanel=React.lazy(()=>import('./AddressesPanel'));
const OrdersPanel=React.lazy(()=>import('./OrdersPanel'));
const FavoritesPanel=React.lazy(()=>import('./FavoritesPanel'));
const FollowedProducersPanel=React.lazy(()=>import('./FollowedProducersPanel'));
const GiftsPanel=React.lazy(()=>import('./GiftsPanel'));
const PaymentsPanel=React.lazy(()=>import('./PaymentsPanel'));
const SettingsPanel=React.lazy(()=>import('./SettingsPanel'));
const SupportPanel=React.lazy(()=>import('./SupportPanel'));
const SellerPanel=React.lazy(()=>import('./SellerPanel'));
const ProducerProductManager=React.lazy(()=>import('../producer-products/ProducerProductManager'));
const ProducerProfilePanel=React.lazy(()=>import('./ProducerProfilePanel'));
const NotificationsPanel=React.lazy(()=>import('./NotificationsPanel'));
const MessagesPanel=React.lazy(()=>import('./MessagesPanel'));
const ReviewsPanel=React.lazy(()=>import('./ReviewsPanel'));

const menu=[
 ['profile','Profilimi Düzenle',UserRound,'Ad, telefon, dil ve izinler'],
 ['orders','Siparişlerim',Package,'Sipariş, kargo, iade ve ödeme durumu'],
 ['reviews','Yorumlarım',MessageCircle,'Teslim edilmiş ürünleri değerlendir'],
 ['favorites','Favorilerim',Heart,'Kaydettiğiniz ürünler'],
 ['followed-producers','Takip Ettiğim Satıcılar',Store,'Takip ettiğiniz doğrulanmış üreticiler'],
 ['gifts','Hediye Ettiklerim',Gift,'Hediye olarak verdiğiniz siparişler'],
 ['addresses','Adreslerim',MapPin,'Teslimat adresleri'],
 ['payments','Ödeme Geçmişim',WalletCards,'Doğrulanmış ödeme ve geri ödeme hareketleri'],
 ['messages','Mesajlarım',MessageCircle,'Destek ve üretici konuşmaları'],
 ['notifications','Bildirimler',Bell,'Sipariş, ödeme, kargo ve sistem bildirimleri'],
 ['contact','İletişim',MessageCircle,'Golden Oremar ile iletişime geçin'],
 ['support','Yardım & Destek',HelpCircle,'Hakkımızda, iade, gizlilik ve destek'],
 ['settings','Ayarlar',Settings,'Bildirimler, oturum ve hesap yönetimi'],
] as const;

const accountRoles=new Set(['user','vendor','admin','super_admin']);
function nonNegativeCount(value:unknown){const count=Number(value);return Number.isSafeInteger(count)&&count>=0?count:null;}
function summaryCount(value:unknown){const count=nonNegativeCount(value);return count===null?'Doğrulanamadı':count;}
function normalizeOverview(value:any):AccountOverview{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Hesap özeti sunucudan doğrulanamadı.');
 const profile=value.profile;
 const summary=value.summary;
 if(!profile||typeof profile!=='object'||Array.isArray(profile))throw new Error('Hesap profiliniz sunucudan doğrulanamadı.');
 if(!summary||typeof summary!=='object'||Array.isArray(summary))throw new Error('Hesap sayaçları sunucudan doğrulanamadı.');
 const profileId=String(profile.id||'').trim();
 if(!profileId||profileId.length>128||!/^[A-Za-z0-9_-]+$/.test(profileId))throw new Error('Hesap kimliği doğrulanamadı.');
 const producer=value.producer&&typeof value.producer==='object'&&!Array.isArray(value.producer)?value.producer:null;
 const closure=value.account_closure&&typeof value.account_closure==='object'&&!Array.isArray(value.account_closure)?value.account_closure:null;
 return{
  ...value,
  profile:{...profile,id:profileId},
  summary,
  addresses:Array.isArray(value.addresses)?value.addresses:[],
  roles:Array.isArray(value.roles)?value.roles.map((role:any)=>String(role||'').trim()).filter((role:string)=>accountRoles.has(role)):[],
  producer,
  account_closure:closure,
 } as AccountOverview;
}

export default function AccountCenter({
 requestedView,theme,onThemeChange,onOpenProduct,onOpenProducer,onStartGift,onOpenMessages,onOpenNotificationAction,onUnreadNotificationCountChange,onOpenContact,onOpenHealth,onOpenEvents,onOpenAdmin,onOpenSellerApplication,onOpenSellerProductManager,onBack
}:{
 requestedView?:string; theme?:AppTheme; onThemeChange?:(theme:AppTheme)=>void; onOpenProduct?:(slug:string)=>void; onOpenProducer?:(slug:string)=>void; onStartGift?:()=>void; onOpenMessages?:()=>void; onOpenNotificationAction?:(url:string,metadata:any)=>void; onUnreadNotificationCountChange?:(count:number)=>void; onOpenContact?:()=>void; onOpenHealth?:()=>void; onOpenEvents?:()=>void; onOpenAdmin?:()=>void; onOpenSellerApplication?:()=>void; onOpenSellerProductManager?:()=>void; onBack?:()=>void;
}){
 const[overview,setOverview]=useState<AccountOverview|null>(null);const[view,setView]=useState<AccountView>('home');const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[refreshError,setRefreshError]=useState('');const[messageConversationId,setMessageConversationId]=useState('');const[orderDetailId,setOrderDetailId]=useState('');
 const viewContentRef=useRef<HTMLDivElement|null>(null);const homeTitleRef=useRef<HTMLHeadingElement|null>(null);const previousViewRef=useRef<AccountView>('home');
 async function refresh(silent=false){
  try{
   if(!silent)setLoading(true);
   setError('');setRefreshError('');
   const next=normalizeOverview(await getAccountOverview());
   setOverview(next);
   const unread=nonNegativeCount(next.summary?.unread_notification_count);
   if(unread!==null)onUnreadNotificationCountChange?.(unread);
  }catch(e:any){
   const message=e?.message||'Hesap bilgileri yüklenemedi.';
   if(silent&&overview)setRefreshError(message);else setError(message);
  }
  finally{if(!silent)setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
  const map:Record<string,AccountView>={
   menu:'home',home:'home',edit_profile:'profile',profile:'profile',orders:'orders',reviews:'reviews',addresses:'addresses',
   favorites:'favorites','followed-vendors':'followed-producers','followed-producers':'followed-producers',gifts:'gifts',payments:'payments',
   notifications:'notifications',settings:'settings','vendor-dashboard':'seller',seller:'seller','producer-products':'producer-products',
   'producer-profile-edit':'producer-profile-edit',support:'support',feedback:'support'
  };
  if(!requestedView)return;
  if(requestedView.startsWith('orders:')){setOrderDetailId(requestedView.slice('orders:'.length));setView('orders');return;}
  if(requestedView==='orders'){setOrderDetailId('');setView('orders');return;}
  if(requestedView.startsWith('messages:')){setMessageConversationId(requestedView.slice('messages:'.length));setView('messages');return;}
  if(requestedView==='messages'){setMessageConversationId('');setView('messages');return;}
  if(requestedView==='contact'){onOpenContact?.();return;}
  if(requestedView==='vendor-apply'){onOpenSellerApplication?.();return;}
  const next=map[requestedView];
  if(next)setView(next);
 },[requestedView,onOpenContact,onOpenSellerApplication]);
 useEffect(()=>{
  const previous=previousViewRef.current;
  previousViewRef.current=view;
  if(previous===view)return;
  const frame=window.requestAnimationFrame(()=>{
   if(view==='home'){
    homeTitleRef.current?.focus({preventScroll:true});
    return;
   }
   const container=viewContentRef.current;
   if(!container)return;
   const heading=container.querySelector<HTMLElement>('[data-account-panel-heading],h1,h2,h3');
   if(heading){
    if(!heading.hasAttribute('tabindex'))heading.setAttribute('tabindex','-1');
    heading.focus({preventScroll:true});
   }else container.focus({preventScroll:true});
  });
  return()=>window.cancelAnimationFrame(frame);
 },[view]);
 if(loading)return<LoadingState label="Hesabınız yükleniyor"/>;
 if(error||!overview)return<ErrorState message={error||'Hesap bulunamadı.'} onRetry={()=>void refresh()}/>;

 const body=()=>{
  if(view==='profile')return<ProfilePanel overview={overview} onChanged={()=>void refresh(true)}/>;
  if(view==='orders')return<OrdersPanel initialOrderId={orderDetailId||null}/>;
  if(view==='reviews')return<ReviewsPanel userId={overview.profile.id} onOpenProduct={onOpenProduct}/>;
  if(view==='addresses')return<AddressesPanel addresses={overview.addresses} onChanged={()=>void refresh(true)}/>;
  if(view==='favorites')return<FavoritesPanel onOpenProduct={onOpenProduct}/>;
  if(view==='followed-producers')return<FollowedProducersPanel onOpenProducer={onOpenProducer}/>;
  if(view==='gifts')return<GiftsPanel onStartGift={onStartGift}/>;
  if(view==='payments')return<PaymentsPanel/>;
  if(view==='notifications')return<NotificationsPanel onOpenAction={onOpenNotificationAction} onUnreadCountChange={onUnreadNotificationCountChange}/>;
  if(view==='messages')return<MessagesPanel initialConversationId={messageConversationId}/>;
  if(view==='support')return<SupportPanel locale={overview.profile.locale} onOpenMessages={()=>{if(onOpenMessages)onOpenMessages();else{setMessageConversationId('');setView('messages');}}}/>;
  if(view==='seller')return<SellerPanel producer={overview.producer} onOpenApplication={onOpenSellerApplication} onOpenProductManager={()=>{if(onOpenSellerProductManager)onOpenSellerProductManager();else setView('producer-products');}}/>;
  if(view==='producer-products')return<ProducerProductManager onBack={()=>setView('seller')}/>;
  if(view==='producer-profile-edit')return<ProducerProfilePanel onChanged={()=>void refresh(true)}/>;
  if(view==='settings')return<SettingsPanel closure={overview.account_closure} profile={overview.profile} onChanged={()=>void refresh(true)} theme={theme} onThemeChange={onThemeChange}/>;
  return null;
 };

 if(view!=='home')return<div className="space-y-4">
  <button type="button" onClick={()=>setView('home')} className="min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4"/>Hesabıma dön</button>
  {refreshError?<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Değişiklik kaydedildi ancak hesap özeti yeniden yüklenemedi: {refreshError}<button type="button" onClick={()=>void refresh(true)} className="ml-2 min-h-11 rounded-lg border border-amber-300 px-3 font-semibold dark:border-amber-800">Tekrar dene</button></div>:null}
  <div ref={viewContentRef} tabIndex={-1} className="outline-none"><React.Suspense fallback={<LoadingState label="Hesap bölümü yükleniyor"/>}>{body()}</React.Suspense></div>
 </div>;

 const roles=Array.isArray(overview.roles)?overview.roles:[];
 const producerSignals=[overview.producer?.is_verified?'Üretici doğrulandı':'',overview.producer?.origin_verified?'Menşe doğrulandı':''].filter(Boolean);
 return<section aria-labelledby="account-title" className="space-y-5">
  {refreshError?<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Hesap özeti yenilenemedi. Mevcut bilgiler korunuyor. <button type="button" onClick={()=>void refresh(true)} className="ml-2 min-h-11 rounded-lg border border-amber-300 px-3 font-semibold dark:border-amber-800">Tekrar dene</button></div>:null}
  <div className="rounded-2xl bg-brand-green p-5 text-white">
    <div className="flex items-center justify-between gap-3">
      <div><h1 ref={homeTitleRef} tabIndex={-1} id="account-title" className="text-2xl font-bold outline-none">Hesabım</h1><p className="mt-1 text-sm text-white/80">{overview.profile.display_name || overview.profile.email || 'Hesap bilgisi'}</p></div>
      {onBack?<button type="button" onClick={onBack} className="min-h-11 rounded-xl border border-white/30 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Geri</button>:null}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Hesap özeti">
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{summaryCount(overview.summary.order_count)}</div><div className="text-xs">Sipariş</div></div>
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{summaryCount(overview.summary.favorite_count)}</div><div className="text-xs">Favori</div></div>
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{summaryCount(overview.summary.followed_producer_count)}</div><div className="text-xs">Takip</div></div>
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{summaryCount(overview.summary.gift_count)}</div><div className="text-xs">Hediye</div></div>
    </div>
  </div>

  {overview.producer?<div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4">
    <div className="font-bold">{overview.producer.display_name || 'Üretici hesabı'}</div>
    {producerSignals.length?<div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{producerSignals.join(' • ')}</div>:null}
  </div>:null}

  <div className="grid gap-3">
   <div className="grid gap-3 sm:grid-cols-2">
    <button type="button" onClick={onOpenHealth} disabled={!onOpenHealth} className="min-h-16 rounded-2xl border border-gray-200 bg-white p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-800 dark:bg-gray-900">
     <div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><Leaf className="h-5 w-5"/></div>
     <div><div className="font-bold">Sağlık & Tarifler</div><div className="text-sm text-gray-500">Tarifler ve ürün içerikleri</div></div></div>
    </button>
    <button type="button" onClick={onOpenEvents} disabled={!onOpenEvents} className="min-h-16 rounded-2xl border border-gray-200 bg-white p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-800 dark:bg-gray-900">
     <div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><Calendar className="h-5 w-5"/></div>
     <div><div className="font-bold">Etkinlikler</div><div className="text-sm text-gray-500">Golden Oremar etkinlikleri</div></div></div>
    </button>
   </div>

   {overview.producer ? <button type="button" onClick={()=>setView('producer-profile-edit')} className="min-h-16 w-full rounded-2xl border border-gray-200 bg-white p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-800 dark:bg-gray-900"><div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Store className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="font-bold">Mağaza Profilini Düzenle</div><div className="text-sm text-gray-500">Hikâye, görseller ve doğrulanmış menşe değişiklik talebi</div></div><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></div></button> : null}

   <button type="button" onClick={()=>setView('seller')} className="min-h-16 w-full rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
     <div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Store className="h-5 w-5"/></div>
     <div className="min-w-0 flex-1"><div className="font-bold">{overview.producer?'Satıcı Paneli':'Satıcı Ol'}</div>
     <div className="text-sm text-gray-500">{overview.producer?'Ürün, stok, lot ve finans yönetimi':'Golden Oremar üretici başvurusu'}</div></div><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></div>
   </button>
   {roles.some(role=>role==='admin'||role==='super_admin')&&onOpenAdmin?(
    <button type="button" onClick={onOpenAdmin} className="min-h-16 w-full rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
     <div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><ShieldCheck className="h-5 w-5"/></div>
     <div className="min-w-0 flex-1"><div className="font-bold">Yönetim Paneli</div><div className="text-sm text-gray-500">Golden Oremar yönetimi</div></div><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></div>
    </button>
   ):null}
   {menu.map(([key,label,Icon,description])=><button type="button" key={key} onClick={()=>{if(key==='contact'){onOpenContact?.();return;}if(key==='orders')setOrderDetailId('');if(key==='messages')setMessageConversationId('');setView(key as AccountView);}} disabled={key==='contact'&&!onOpenContact} className="min-h-16 w-full rounded-2xl border border-gray-200 bg-white p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-800 dark:bg-gray-900">
     <div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><Icon className="h-5 w-5"/></div>
     <div className="min-w-0 flex-1"><div className="font-bold">{label}</div><div className="text-sm text-gray-500">{description}</div></div><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></div>
   </button>)}
  </div>
 </section>;
}
