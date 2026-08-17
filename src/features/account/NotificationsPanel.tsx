import React,{useEffect,useState}from'react';
import{listNotifications,markAllNotificationsRead,markNotificationRead}from'./api';
import{EmptyState,ErrorState,LoadingState,Panel}from'./ui';

const PAGE_SIZE=30;
function unread(value:unknown){const count=Number(value);return Number.isFinite(count)&&count>0?Math.floor(count):0;}

export default function NotificationsPanel({onOpenAction,onUnreadCountChange}:{onOpenAction?:(url:string,metadata:any)=>void;onUnreadCountChange?:(count:number)=>void}){
 const[data,setData]=useState<any>(null);
 const[loading,setLoading]=useState(true);
 const[loadingMore,setLoadingMore]=useState(false);
 const[hasMore,setHasMore]=useState(false);
 const[error,setError]=useState('');

 async function load(reset=true){
  const items=Array.isArray(data?.items)?data.items:[];
  const before=reset?null:(items[items.length-1]?.createdAt||null);
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   setError('');
   const next=await listNotifications(PAGE_SIZE,before);
   const nextItems=Array.isArray(next?.items)?next.items:[];
   setHasMore(nextItems.length===PAGE_SIZE);
   setData((previous:any)=>{
    if(reset||!previous)return next;
    const unique=new Map<string,any>();
    [...(previous.items||[]),...nextItems].forEach(item=>unique.set(String(item.id),item));
    return {...previous,...next,items:Array.from(unique.values())};
   });
   onUnreadCountChange?.(unread(next?.unreadCount));
  }
  catch(e:any){setError(e?.message||'Bildirimler yüklenemedi.');}
  finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }
 useEffect(()=>{void load(true);},[]);

 async function open(item:any){
  try{
   if(!item.readAt){
    await markNotificationRead(item.id);
    const nextUnread=Math.max(0,unread(data?.unreadCount)-1);
    const readAt=new Date().toISOString();
    setData((previous:any)=>previous?{
     ...previous,
     unreadCount:nextUnread,
     items:(previous.items||[]).map((candidate:any)=>candidate.id===item.id?{...candidate,readAt}:candidate),
    }:previous);
    onUnreadCountChange?.(nextUnread);
   }
   if(item.actionUrl){onOpenAction?.(item.actionUrl,item.metadata||{});return;}
  }catch(e:any){setError(e?.message||'Bildirim açılamadı.');}
 }

 async function markAll(){
  try{
   await markAllNotificationsRead();
   const readAt=new Date().toISOString();
   setData((previous:any)=>previous?{
    ...previous,
    unreadCount:0,
    items:(previous.items||[]).map((item:any)=>item.readAt?item:{...item,readAt}),
   }:previous);
   onUnreadCountChange?.(0);
  }
  catch(e:any){setError(e?.message||'Bildirimler güncellenemedi.');}
 }

 if(loading)return<LoadingState label="Bildirimler yükleniyor"/>;
 return<Panel title="Bildirimler" description="Sipariş, ödeme, kargo, iade, mesaj ve sistem bildirimleri.">
   {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
   <div className="mb-4 flex items-center justify-between gap-3">
     <div className="text-sm text-gray-500" aria-live="polite">Okunmamış: <strong>{unread(data?.unreadCount)}</strong></div>
     {unread(data?.unreadCount)>0?<button type="button" onClick={()=>void markAll()} className="min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tümünü okundu işaretle</button>:null}
   </div>
   {!data?.items?.length?<EmptyState title="Yeni bildiriminiz yok" body="Önemli sipariş ve hesap gelişmeleri burada görünecek."/>:<>
   <div className="space-y-2">{data.items.map((item:any)=>
     <button type="button" key={item.id} onClick={()=>void open(item)}
       aria-label={`${item.readAt?'Okundu':'Okunmamış'} bildirim: ${item.title}. ${item.message}`}
       className={`min-h-16 w-full rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${item.readAt?'bg-white dark:bg-gray-900':'border-brand-gold/40 bg-brand-gold/5'}`}>
       <div className="font-bold">{item.title}</div>
       <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.message}</p>
       <div className="mt-2 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('tr-TR')}</div>
     </button>
   )}</div>
   {hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore?'Yükleniyor…':'Daha fazla bildirim göster'}</button></div>:null}
   </>}
 </Panel>;
}
