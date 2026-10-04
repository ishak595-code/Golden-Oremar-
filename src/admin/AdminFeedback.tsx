import React,{useCallback,useEffect,useState}from'react';
import{ArrowLeft,CheckCircle2,Inbox,Loader2,Mail,MailOpen,Phone,RefreshCw,RotateCcw,UserRound}from'lucide-react';
import{feedbackAdminError,feedbackSender,getFeedback,listFeedback,updateFeedback,type FeedbackDetail,type FeedbackFilter,type FeedbackStatus,type FeedbackSummary}from'./feedbackAdminApi';
import{useBackHandler}from'../features/navigation/backHandlers';

const FILTERS:Array<{value:FeedbackFilter;label:string}>=[{value:'all',label:'Tümü'},{value:'unread',label:'Okunmamış'},{value:'read',label:'Okundu'},{value:'resolved',label:'Çözüldü'}];
const STATUS_LABEL:Record<FeedbackStatus,string>={new:'Okunmadı',assigned:'Okundu',in_progress:'Okundu',resolved:'Çözüldü',spam:'Spam'};
const PAGE=30;

function when(value:string|null){if(!value)return'';const d=new Date(value);if(Number.isNaN(d.getTime()))return'';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(d);}catch{return d.toISOString();}}
function tone(status:FeedbackStatus){return status==='new'?'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100':status==='resolved'?'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100':'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-200';}
function sourceLabel(source:string){return source==='app-feedback'?'Uygulama geri bildirimi':'İletişim formu';}

/** Geri bildirim inbox: newest first, filter by status, read / resolve. Admins only (checked in the database). */
export default function AdminFeedback(){
 const[filter,setFilter]=useState<FeedbackFilter>('all');
 const[items,setItems]=useState<FeedbackSummary[]>([]);
 const[total,setTotal]=useState(0);
 const[unread,setUnread]=useState(0);
 const[loading,setLoading]=useState(true);
 const[loadingMore,setLoadingMore]=useState(false);
 const[error,setError]=useState('');
 const[detail,setDetail]=useState<FeedbackDetail|null>(null);
 const[openingId,setOpeningId]=useState('');
 const[busy,setBusy]=useState(false);
 const[notice,setNotice]=useState('');

 const load=useCallback(async(next:FeedbackFilter)=>{try{setLoading(true);setError('');const page=await listFeedback(next,PAGE,0);setItems(page.items);setTotal(page.total);setUnread(page.unreadCount);}catch(err){setError(feedbackAdminError(err));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load(filter);},[filter,load]);
 useBackHandler(Boolean(detail),()=>{setDetail(null);});

 async function more(){try{setLoadingMore(true);const page=await listFeedback(filter,PAGE,items.length);setItems(current=>[...current,...page.items.filter(item=>!current.some(c=>c.id===item.id))]);setTotal(page.total);setUnread(page.unreadCount);}catch(err){setError(feedbackAdminError(err));}finally{setLoadingMore(false);}}
 async function open(item:FeedbackSummary){
  try{setOpeningId(item.id);setNotice('');setError('');
   let full=await getFeedback(item.id);
   if(full.status==='new'){const r=await updateFeedback(item.id,'read');setUnread(r.unreadCount);full={...full,status:r.status,readAt:full.readAt||new Date().toISOString()};setItems(current=>current.map(c=>c.id===item.id?{...c,status:r.status}:c));}
   setDetail(full);window.scrollTo({top:0});
  }catch(err){setError(feedbackAdminError(err));}finally{setOpeningId('');}
 }
 async function act(action:'resolve'|'reopen'|'unread'){
  if(!detail)return;
  try{setBusy(true);setNotice('');const r=await updateFeedback(detail.id,action);setUnread(r.unreadCount);
   setItems(current=>current.map(c=>c.id===detail.id?{...c,status:r.status}:c));
   if(action==='unread'){setDetail(null);setNotice('Okunmadı olarak işaretlendi.');return;}
   setDetail(d=>d?{...d,status:r.status,resolvedAt:action==='resolve'?new Date().toISOString():null}:d);
   setNotice(action==='resolve'?'Çözüldü olarak işaretlendi.':'Yeniden açıldı.');
  }catch(err){setError(feedbackAdminError(err));}finally{setBusy(false);}
 }

 if(detail)return<div className="space-y-4">
  <button type="button" onClick={()=>setDetail(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 font-semibold dark:border-gray-700 dark:bg-gray-800"><ArrowLeft className="h-5 w-5" aria-hidden="true"/>Geri bildirimlere dön</button>
  <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6" aria-labelledby="feedback-detail-title">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{sourceLabel(detail.source)}</p><h2 id="feedback-detail-title" className="mt-1 text-xl font-black text-gray-900 dark:text-white">{detail.category}</h2><p className="mt-1 text-sm text-gray-500">{when(detail.createdAt)}</p></div>
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tone(detail.status)}`}>{STATUS_LABEL[detail.status]}</span>
   </div>
   <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
    <div className="flex items-center gap-2"><UserRound className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true"/><dt className="sr-only">Gönderen</dt><dd className="font-semibold">{feedbackSender(detail)}</dd></div>
    {detail.email?<div className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true"/><dt className="sr-only">E-posta</dt><dd className="min-w-0 truncate"><a className="font-semibold text-brand-green underline-offset-2 hover:underline dark:text-brand-gold" href={`mailto:${detail.email}?subject=${encodeURIComponent(`Re: ${detail.subject||detail.category}`)}`}>{detail.email}</a></dd></div>:null}
    {detail.phone?<div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true"/><dt className="sr-only">Telefon</dt><dd>{detail.phone}</dd></div>:null}
   </dl>
   <div className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-4 text-base leading-7 text-gray-900 dark:bg-gray-900/60 dark:text-gray-100">{detail.message}</div>
   <p className="mt-3 text-xs text-gray-500">{[detail.readAt?`Okundu: ${when(detail.readAt)}${detail.readBy?` · ${detail.readBy}`:''}`:'',detail.resolvedAt?`Çözüldü: ${when(detail.resolvedAt)}${detail.resolvedBy?` · ${detail.resolvedBy}`:''}`:''].filter(Boolean).join(' — ')}</p>
   {notice?<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">{notice}</p>:null}
   {error?<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>:null}
   <div className="mt-5 flex flex-wrap gap-2">
    {detail.status==='resolved'
     ?<button type="button" disabled={busy} onClick={()=>void act('reopen')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-4 font-bold disabled:opacity-50 dark:border-gray-600"><RotateCcw className="h-4 w-4" aria-hidden="true"/>Yeniden aç</button>
     :<button type="button" disabled={busy} onClick={()=>void act('resolve')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green shadow-sm disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/>:<CheckCircle2 className="h-4 w-4" aria-hidden="true"/>}Çözüldü olarak işaretle</button>}
    <button type="button" disabled={busy} onClick={()=>void act('unread')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-4 font-bold disabled:opacity-50 dark:border-gray-600"><Mail className="h-4 w-4" aria-hidden="true"/>Okunmadı yap</button>
   </div>
  </article>
 </div>;

 return<div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-2xl font-black text-gray-900 dark:text-white">Geri Bildirimler</h2><p className="mt-1 text-sm text-gray-500">Uygulamadan ve iletişim formundan gelen mesajlar, en yeni üstte.</p></div>
   <button type="button" onClick={()=>void load(filter)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 font-semibold dark:border-gray-700 dark:bg-gray-800" aria-label="Geri bildirimleri yenile"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} aria-hidden="true"/>Yenile</button>
  </div>
  <div role="tablist" aria-label="Durum filtresi" className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(f=><button key={f.value} type="button" role="tab" aria-selected={filter===f.value} onClick={()=>setFilter(f.value)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${filter===f.value?'border-brand-green bg-brand-green text-brand-on-green':'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>{f.label}{f.value==='unread'&&unread?<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${filter==='unread'?'bg-white/25':'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'}`}>{unread}</span>:null}</button>)}</div>
  {notice?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">{notice}</p>:null}
  {error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}<button type="button" onClick={()=>void load(filter)} className="ml-3 underline">Tekrar dene</button></div>:null}
  {loading&&!items.length?<div className="flex items-center gap-2 p-6 text-gray-500" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true"/>Geri bildirimler yükleniyor…</div>
  :!items.length&&!error?<div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"><Inbox className="mx-auto h-8 w-8 text-brand-muted" aria-hidden="true"/><p className="mt-3 font-bold">Bu filtrede mesaj yok</p><p className="mt-1 text-sm text-gray-500">Yeni geri bildirimler burada en üstte görünür.</p></div>
  :<>
   <p className="text-sm text-gray-500">{items.length} / {total} mesaj</p>
   <ul className="space-y-2">{items.map(item=><li key={item.id}><button type="button" onClick={()=>void open(item)} disabled={Boolean(openingId)} aria-label={`${item.category}, ${feedbackSender(item)}, ${STATUS_LABEL[item.status]}`} className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:border-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${item.status==='new'?'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20':'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">{item.status==='new'?<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"/>:<MailOpen className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true"/>}<span className="truncate">{item.category}</span></p><p className="mt-0.5 text-xs text-gray-500">{feedbackSender(item)} · {when(item.createdAt)}</p></div><span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${tone(item.status)}`}>{openingId===item.id?'Açılıyor…':STATUS_LABEL[item.status]}</span></div>
    <p className="mt-2 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">{item.preview}</p>
   </button></li>)}</ul>
   {items.length<total?<div className="flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void more()} className="min-h-11 rounded-xl border border-gray-200 bg-white px-5 font-semibold disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800">{loadingMore?'Yükleniyor…':'Daha fazla göster'}</button></div>:null}
  </>}
 </div>;
}
