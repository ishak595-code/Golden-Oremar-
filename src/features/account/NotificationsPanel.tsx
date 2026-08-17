import React,{useEffect,useState}from'react';
import{listNotifications,markAllNotificationsRead,markNotificationRead}from'./api';
import{EmptyState,ErrorState,LoadingState,Panel}from'./ui';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';

const PAGE_SIZE=30;
function verifiedUnread(value:unknown){const count=Number(value);return Number.isSafeInteger(count)&&count>=0?count:null;}
function formatNotificationDate(value:unknown){const raw=String(value||'').trim();if(!raw)return'Tarih bilgisi yok';const date=new Date(raw);if(Number.isNaN(date.getTime()))return'Tarih bilgisi geçersiz';try{return date.toLocaleString('tr-TR');}catch{return'Tarih bilgisi geçersiz';}}
function notificationKey(item:any,index:number){const id=String(item?.id||'').trim();return id?`id:${id}`:`fallback:${String(item?.createdAt||'')}|${String(item?.title||'')}|${index}`;}

export default function NotificationsPanel({onOpenAction,onUnreadCountChange}:{onOpenAction?:(url:string,metadata:any)=>void;onUnreadCountChange?:(count:number)=>void}){
 const[data,setData]=useState<any>(null);const[loading,setLoading]=useState(true);const[loadingMore,setLoadingMore]=useState(false);const[hasMore,setHasMore]=useState(false);const[error,setError]=useState('');const[loadMoreError,setLoadMoreError]=useState('');const[openingId,setOpeningId]=useState<string|null>(null);const[markAllBusy,setMarkAllBusy]=useState(false);const[actionStatus,setActionStatus]=useState('');
 async function load(reset=true){
  const items=Array.isArray(data?.items)?data.items:[];const before=reset?null:(String(items[items.length-1]?.createdAt||'').trim()||null);
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   if(reset)setError('');else setLoadMoreError('');
   if(reset)setActionStatus('');
   const next=await listNotifications(PAGE_SIZE,before);const nextItems=Array.isArray(next?.items)?next.items:[];
   setHasMore(nextItems.length===PAGE_SIZE);
   setData((previous:any)=>{
    if(reset||!previous)return{...next,items:nextItems};
    const previousItems=Array.isArray(previous?.items)?previous.items:[];
    const unique=new Map<string,any>();
    previousItems.forEach((item:any,index:number)=>unique.set(notificationKey(item,index),item));
    nextItems.forEach((item:any,index:number)=>unique.set(notificationKey(item,previousItems.length+index),item));
    return {...previous,...next,items:Array.from(unique.values())};
   });
   const nextUnread=verifiedUnread(next?.unreadCount);
   if(nextUnread!==null)onUnreadCountChange?.(nextUnread);
  }catch(e:any){const message=e?.message||'Bildirimler yüklenemedi.';if(reset)setError(message);else setLoadMoreError(message);}
  finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }
 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{const restore=()=>{if(openingId||markAllBusy)return;setLoadMoreError('');void load(true);};window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[openingId,markAllBusy]);

 async function open(item:any){
  const id=String(item?.id||'').trim();if(!id||openingId||markAllBusy)return;
  try{
   setOpeningId(id);setError('');setActionStatus('');
   if(!item?.readAt){
    await markNotificationRead(id);
    const currentUnread=verifiedUnread(data?.unreadCount);
    let nextUnread=currentUnread===null?null:Math.max(0,currentUnread-1);
    try{const latest=await listNotifications(1);const verified=verifiedUnread(latest?.unreadCount);if(verified!==null)nextUnread=verified;}catch{}
    const readAt=new Date().toISOString();
    setData((previous:any)=>previous?{...previous,unreadCount:nextUnread,items:(Array.isArray(previous?.items)?previous.items:[]).map((candidate:any)=>String(candidate?.id||'').trim()===id?{...candidate,readAt}:candidate)}:previous);
    if(nextUnread!==null)onUnreadCountChange?.(nextUnread);
   }
   const actionUrl=String(item?.actionUrl||'').trim();
   if(actionUrl&&onOpenAction){onOpenAction(actionUrl,item?.metadata&&typeof item.metadata==='object'?item.metadata:{});return;}
   setActionStatus(actionUrl?'Bildirim okundu. Bu bildirim için uygulama içi hedef şu anda kullanılamıyor.':'Bildirim okundu.');
  }catch(e:any){setError(e?.message||'Bildirim açılamadı.');}finally{setOpeningId(null);}
 }

 async function markAll(){
  if(markAllBusy||openingId)return;
  try{
   setMarkAllBusy(true);setError('');setActionStatus('');await markAllNotificationsRead();
   const readAt=new Date().toISOString();
   try{
    const latest=await listNotifications(PAGE_SIZE,null);const latestItems=Array.isArray(latest?.items)?latest.items:[];const latestUnread=verifiedUnread(latest?.unreadCount);
    setData({...latest,items:latestItems});setHasMore(latestItems.length===PAGE_SIZE);if(latestUnread!==null)onUnreadCountChange?.(latestUnread);
   }catch{
    setData((previous:any)=>previous?{...previous,unreadCount:0,items:(Array.isArray(previous?.items)?previous.items:[]).map((item:any)=>item?.readAt?item:{...item,readAt})}:previous);onUnreadCountChange?.(0);
   }
   setActionStatus('Tüm bildirimler okundu olarak işaretlendi.');
  }catch(e:any){setError(e?.message||'Bildirimler güncellenemedi.');}finally{setMarkAllBusy(false);}
 }

 if(loading)return<LoadingState label="Bildirimler yükleniyor"/>;
 const items=Array.isArray(data?.items)?data.items:[];const unreadCount=verifiedUnread(data?.unreadCount);
 return<Panel title="Bildirimler" description="Sipariş, ödeme, kargo, iade, mesaj ve sistem bildirimleri.">
   {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
   {actionStatus?<div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{actionStatus}</div>:null}
   <div className="mb-4 flex items-center justify-between gap-3"><div className="text-sm text-gray-500" aria-live="polite">Okunmamış: <strong>{unreadCount===null?'Doğrulanamadı':unreadCount}</strong></div>{unreadCount!==null&&unreadCount>0?<button type="button" disabled={markAllBusy||Boolean(openingId)} onClick={()=>void markAll()} className="min-h-11 rounded-xl border px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{markAllBusy?'İşaretleniyor…':'Tümünü okundu işaretle'}</button>:null}</div>
   <div className="sr-only" aria-live="polite">{openingId?'Bildirim açılıyor.':markAllBusy?'Bildirimler okundu olarak işaretleniyor.':loadingMore?'Daha fazla bildirim yükleniyor.':loadMoreError||''}</div>
   {!items.length?<EmptyState title="Yeni bildiriminiz yok" body="Önemli sipariş ve hesap gelişmeleri burada görünecek."/>:<>
   <div className="space-y-2">{items.map((item:any,index:number)=>{const id=String(item?.id||'').trim();const busy=openingId===id;const actionUrl=String(item?.actionUrl||'').trim();const hasNavigableAction=Boolean(actionUrl&&onOpenAction);const title=String(item?.title||'').trim()||'Başlıksız bildirim';const message=String(item?.message||'').trim()||'Bildirim içeriği doğrulanamadı';return <button type="button" key={notificationKey(item,index)} disabled={!id||Boolean(openingId)||markAllBusy} aria-busy={busy} onClick={()=>void open(item)} aria-label={`${item?.readAt?'Okundu':'Okunmamış'} bildirim: ${title}. ${message}${hasNavigableAction?'. İlgili ekrana gider.':''}`} className={`min-h-16 w-full rounded-xl border p-4 text-left disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${item?.readAt?'bg-white dark:bg-gray-900':'border-brand-gold/40 bg-brand-gold/5'}`}><div className="font-bold">{title}</div><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{message}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400"><span>{busy?'Açılıyor…':formatNotificationDate(item?.createdAt)}</span>{hasNavigableAction?<span className="font-semibold text-brand-green dark:text-brand-gold">İlgili ekranı aç</span>:null}{!id?<span className="text-red-700 dark:text-red-300">Bildirim kimliği doğrulanamadı</span>:null}</div></button>;})}</div>
   {loadMoreError?<div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><p>Daha eski bildirimler yüklenemedi. Mevcut bildirimler korunuyor.</p><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="mt-2 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold disabled:opacity-50 dark:border-amber-800">Tekrar dene</button></div>:null}
   {hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore||Boolean(openingId)||markAllBusy} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore?'Yükleniyor…':'Daha fazla bildirim göster'}</button></div>:null}
   </>}
 </Panel>;
}
