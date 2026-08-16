
import React,{useEffect,useState}from'react';
import{listNotifications,markAllNotificationsRead,markNotificationRead}from'./api';
import{EmptyState,ErrorState,LoadingState,Panel}from'./ui';

export default function NotificationsPanel({onOpenAction}:{onOpenAction?:(url:string,metadata:any)=>void}){
 const[data,setData]=useState<any>(null);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');

 async function load(){
  try{setLoading(true);setError('');setData(await listNotifications());}
  catch(e:any){setError(e?.message||'Bildirimler yüklenemedi.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);

 async function open(item:any){
  try{
   if(!item.readAt) await markNotificationRead(item.id);
   if(item.actionUrl) onOpenAction?.(item.actionUrl,item.metadata||{});
   await load();
  }catch(e:any){setError(e?.message||'Bildirim açılamadı.');}
 }

 async function markAll(){
  try{await markAllNotificationsRead();await load();}
  catch(e:any){setError(e?.message||'Bildirimler güncellenemedi.');}
 }

 if(loading)return<LoadingState label="Bildirimler yükleniyor"/>;
 return<Panel title="Bildirimler" description="Sipariş, ödeme, kargo, iade, mesaj ve sistem bildirimleri.">
   {error?<ErrorState message={error} onRetry={load}/>:null}
   <div className="mb-4 flex items-center justify-between gap-3">
     <div className="text-sm text-gray-500">Okunmamış: <strong>{data?.unreadCount||0}</strong></div>
     {(data?.unreadCount||0)>0?<button onClick={markAll} className="min-h-11 rounded-xl border px-4 font-semibold">Tümünü okundu işaretle</button>:null}
   </div>
   {!data?.items?.length?<EmptyState title="Yeni bildiriminiz yok" body="Önemli sipariş ve hesap gelişmeleri burada görünecek."/>:
   <div className="space-y-2">{data.items.map((item:any)=>
     <button key={item.id} onClick={()=>open(item)}
       className={`min-h-16 w-full rounded-xl border p-4 text-left ${item.readAt?'bg-white dark:bg-gray-900':'border-brand-gold/40 bg-brand-gold/5'}`}>
       <div className="font-bold">{item.title}</div>
       <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.message}</p>
       <div className="mt-2 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('tr-TR')}</div>
     </button>
   )}</div>}
 </Panel>;
}
