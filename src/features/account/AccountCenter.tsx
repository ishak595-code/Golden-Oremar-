
import React,{useEffect,useState}from'react';
import{ArrowLeft,Bell,Calendar,ChevronRight,Gift,Heart,HelpCircle,Leaf,MapPin,MessageCircle,Package,Settings,ShieldCheck,Store,UserRound,WalletCards}from'lucide-react';
import{getAccountOverview}from'./api';
import type{AccountOverview,AccountView}from'./types';
import{ErrorState,LoadingState}from'./ui';
import ProfilePanel from'./ProfilePanel';
import AddressesPanel from'./AddressesPanel';
import OrdersPanel from'./OrdersPanel';
import FavoritesPanel from'./FavoritesPanel';
import FollowedProducersPanel from'./FollowedProducersPanel';
import GiftsPanel from'./GiftsPanel';
import PaymentsPanel from'./PaymentsPanel';
import SettingsPanel from'./SettingsPanel';
import SupportPanel from'./SupportPanel';
import SellerPanel from'./SellerPanel';
import ProducerProductManager from'../producer-products/ProducerProductManager';
import ProducerProfilePanel from'./ProducerProfilePanel';
import NotificationsPanel from'./NotificationsPanel';
import MessagesPanel from'./MessagesPanel';
import ReviewsPanel from'./ReviewsPanel';

const menu=[
 ['profile','Profilimi Düzenle',UserRound,'Ad, telefon, dil ve izinler'],
 ['orders','Siparişlerim',Package,'Sipariş, kargo, iade ve ödeme durumu'],
 ['reviews','Yorumlarım',MessageCircle,'Teslim edilmiş ürünleri değerlendir'],
 ['favorites','Favorilerim',Heart,'Kaydettiğiniz ürünler'],
 ['followed-producers','Takip Ettiğim Satıcılar',Store,'Takip ettiğiniz doğrulanmış üreticiler'],
 ['gifts','Hediye Ettiklerim',Gift,'Hediye olarak verdiğiniz siparişler'],
 ['addresses','Adreslerim',MapPin,'Teslimat adresleri'],
 ['payments','Ödeme Yöntemlerim',WalletCards,'Güvenli ödeme hareketleri'],
 ['messages','Mesajlarım',MessageCircle,'Destek ve üretici konuşmaları'],
 ['notifications','Bildirimler',Bell,'Sipariş, ödeme, kargo ve sistem bildirimleri'],
 ['contact','İletişim',MessageCircle,'Golden Oremar ile iletişime geçin'],
 ['support','Yardım & Destek',HelpCircle,'Hakkımızda, iade, gizlilik ve destek'],
 ['settings','Ayarlar',Settings,'Bildirimler, oturum ve hesap yönetimi'],
] as const;

export default function AccountCenter({
 requestedView,theme,onThemeChange,onOpenProduct,onOpenProducer,onStartGift,onOpenMessages,onOpenNotificationAction,onOpenContact,onOpenHealth,onOpenEvents,onOpenAdmin,onOpenSellerApplication,onOpenSellerProductManager,onBack
}:{
 requestedView?:string; theme?:string; onThemeChange?:(theme:'light'|'dark')=>void; onOpenProduct?:(slug:string)=>void; onOpenProducer?:(slug:string)=>void; onStartGift?:()=>void; onOpenMessages?:()=>void; onOpenNotificationAction?:(url:string,metadata:any)=>void; onOpenContact?:()=>void; onOpenHealth?:()=>void; onOpenEvents?:()=>void; onOpenAdmin?:()=>void; onOpenSellerApplication?:()=>void; onOpenSellerProductManager?:()=>void; onBack?:()=>void;
}){
 const[overview,setOverview]=useState<AccountOverview|null>(null);const[view,setView]=useState<AccountView>('home');const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[messageConversationId,setMessageConversationId]=useState('');const[orderDetailId,setOrderDetailId]=useState('');
 async function refresh(){try{setLoading(true);setError('');setOverview(await getAccountOverview());}catch(e:any){setError(e?.message||'Hesap bilgileri yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
  const map:Record<string,AccountView>={
   menu:'home',edit_profile:'profile',profile:'profile',orders:'orders',addresses:'addresses',
   favorites:'favorites','followed-vendors':'followed-producers',gifts:'gifts',payments:'payments',
   notifications:'notifications',settings:'settings','vendor-apply':'seller','vendor-dashboard':'seller',
   support:'support'
  };
  if(!requestedView)return;
  if(requestedView.startsWith('orders:')){setOrderDetailId(requestedView.slice('orders:'.length));setView('orders');return;}
  if(requestedView==='orders'){setOrderDetailId('');setView('orders');return;}
  if(requestedView.startsWith('messages:')){setMessageConversationId(requestedView.slice('messages:'.length));setView('messages');return;}
  if(requestedView==='messages'){setMessageConversationId('');setView('messages');return;}
  if(requestedView==='contact'){onOpenContact?.();return;}
  const next=map[requestedView];
  if(next)setView(next);
 },[requestedView,onOpenContact]);
 if(loading)return<LoadingState label="Hesabınız yükleniyor"/>;
 if(error||!overview)return<ErrorState message={error||'Hesap bulunamadı.'} onRetry={refresh}/>;

 const body=()=>{
  if(view==='profile')return<ProfilePanel overview={overview} onChanged={refresh}/>;
  if(view==='orders')return<OrdersPanel initialOrderId={orderDetailId||null}/>;
  if(view==='reviews')return<ReviewsPanel userId={overview.profile.id} onOpenProduct={onOpenProduct}/>;
  if(view==='addresses')return<AddressesPanel addresses={overview.addresses} onChanged={refresh}/>;
  if(view==='favorites')return<FavoritesPanel onOpenProduct={onOpenProduct}/>;
  if(view==='followed-producers')return<FollowedProducersPanel onOpenProducer={onOpenProducer}/>;
  if(view==='gifts')return<GiftsPanel onStartGift={onStartGift}/>;
  if(view==='payments')return<PaymentsPanel/>;
  if(view==='notifications')return<NotificationsPanel onOpenAction={onOpenNotificationAction}/>;
  if(view==='messages')return<MessagesPanel initialConversationId={messageConversationId}/>;
  if(view==='support')return<SupportPanel locale={overview.profile.locale} onOpenMessages={()=>setView('messages')}/>;
  if(view==='seller')return<SellerPanel producer={overview.producer} onOpenApplication={onOpenSellerApplication} onOpenProductManager={()=>{if(onOpenSellerProductManager)onOpenSellerProductManager();else setView('producer-products');}}/>;
  if(view==='producer-products')return<ProducerProductManager onBack={()=>setView('seller')}/>;
  if(view==='producer-profile-edit')return<ProducerProfilePanel onChanged={refresh}/>;
  if(view==='settings')return<SettingsPanel closure={overview.account_closure} profile={overview.profile} onChanged={refresh} theme={theme} onThemeChange={onThemeChange}/>;
  return null;
 };

 if(view!=='home')return<div className="space-y-4">
  <button onClick={()=>setView('home')} className="min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft className="mr-2 inline h-4 w-4"/>Hesabıma dön</button>
  {body()}
 </div>;

 return<section aria-labelledby="account-title" className="space-y-5">
  <div className="rounded-2xl bg-brand-green p-5 text-white">
    <div className="flex items-center justify-between gap-3">
      <div><h1 id="account-title" className="text-2xl font-bold">Hesabım</h1><p className="mt-1 text-sm text-white/80">{overview.profile.display_name || overview.profile.email}</p></div>
      {onBack?<button onClick={onBack} className="min-h-11 rounded-xl border border-white/30 px-4">Geri</button>:null}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{overview.summary.order_count}</div><div className="text-xs">Sipariş</div></div>
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{overview.summary.favorite_count}</div><div className="text-xs">Favori</div></div>
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{overview.summary.followed_producer_count}</div><div className="text-xs">Takip</div></div>
      <div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-bold">{overview.summary.gift_count}</div><div className="text-xs">Hediye</div></div>
    </div>
  </div>

  {overview.producer?<div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4">
    <div className="font-bold">{overview.producer.display_name}</div>
    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{overview.producer.is_verified?'Üretici doğrulandı':''}{overview.producer.origin_verified?' • Menşe doğrulandı':''}</div>
  </div>:null}

  <div className="grid gap-3">
   <div className="grid gap-3 sm:grid-cols-2">
    <button onClick={onOpenHealth} className="min-h-16 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left">
     <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><Leaf className="h-5 w-5"/></div>
     <div><div className="font-bold">Sağlık & Tarifler</div><div className="text-sm text-gray-500">Tarifler ve ürün içerikleri</div></div></div>
    </button>
    <button onClick={onOpenEvents} className="min-h-16 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left">
     <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><Calendar className="h-5 w-5"/></div>
     <div><div className="font-bold">Etkinlikler</div><div className="text-sm text-gray-500">Golden Oremar etkinlikleri</div></div></div>
    </button>
   </div>

   {overview.producer ? <button onClick={()=>setView('producer-profile-edit')} className="min-h-16 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left"><div className="flex items-center gap-3"><div className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Store className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="font-bold">Mağaza Profilini Düzenle</div><div className="text-sm text-gray-500">Hikâye, görseller ve doğrulanmış menşe değişiklik talebi</div></div><ChevronRight className="h-5 w-5 text-gray-400"/></div></button> : null}

   <button onClick={()=>setView('seller')} className="min-h-16 w-full rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-4 text-left">
     <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Store className="h-5 w-5"/></div>
     <div className="min-w-0 flex-1"><div className="font-bold">{overview.producer?'Satıcı Paneli':'Satıcı Ol'}</div>
     <div className="text-sm text-gray-500">{overview.producer?'Ürün, stok, lot ve finans yönetimi':'Golden Oremar üretici başvurusu'}</div></div><ChevronRight className="h-5 w-5 text-gray-400"/></div>
   </button>
   {overview.roles.some(role=>role==='admin'||role==='super_admin')&&onOpenAdmin?(
    <button onClick={onOpenAdmin} className="min-h-16 w-full rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-left">
     <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><ShieldCheck className="h-5 w-5"/></div>
     <div className="min-w-0 flex-1"><div className="font-bold">Yönetim Paneli</div><div className="text-sm text-gray-500">Golden Oremar yönetimi</div></div><ChevronRight className="h-5 w-5 text-gray-400"/></div>
    </button>
   ):null}
   {menu.map(([key,label,Icon,description])=><button key={key} onClick={()=>{if(key==='contact'){onOpenContact?.();return;} if(key==='orders')setOrderDetailId(''); setView(key as AccountView);}} className="min-h-16 w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left">
     <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><Icon className="h-5 w-5"/></div>
     <div className="min-w-0 flex-1"><div className="font-bold">{label}</div><div className="text-sm text-gray-500">{description}</div></div><ChevronRight className="h-5 w-5 text-gray-400"/></div>
   </button>)}
  </div>
 </section>;
}
