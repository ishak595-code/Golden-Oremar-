import React,{useEffect,useMemo,useRef,useState}from'react';
import{ArrowLeft,FileText,Image as ImageIcon,Paperclip,RefreshCw,Send,X}from'lucide-react';
import{attachmentDisplayName,getConversationMessages,getMessageAttachmentUrl,listMyConversations,markConversationRead,removeUnusedMessageAttachments,sendConversationMessage,setConversationOpenState,uploadMessageAttachment,type ConversationMessage,type ConversationStatus,type ConversationSummary}from'./messagesApi';
import{EmptyState,ErrorState,LoadingState,Panel}from'./ui';

type DraftFile={file:File;id:string};
const allowedAccept='image/jpeg,image/png,image/webp,image/avif,application/pdf';
const allowedTypes=new Set(['image/jpeg','image/png','image/webp','image/avif','application/pdf']);
const MESSAGE_PAGE_SIZE=60;
const CONVERSATION_PAGE_SIZE=30;
const statusLabels:Record<ConversationStatus,string>={open:'Açık',waiting_customer:'Müşteri yanıtı bekleniyor',waiting_support:'Destek yanıtı bekleniyor',closed:'Kapalı'};
let draftSequence=0;

function messageTime(message:ConversationMessage){return new Date(message.createdAt).getTime();}
function conversationTime(item:ConversationSummary){return new Date(item.lastMessageAt??item.updatedAt).getTime();}
function draftId(){if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();draftSequence+=1;return`draft-${Date.now()}-${draftSequence}`;}
function mergeMessages(current:ConversationMessage[],incoming:ConversationMessage[]){const unique=new Map<string,ConversationMessage>();for(const message of current)unique.set(message.id,message);for(const message of incoming)unique.set(message.id,message);return Array.from(unique.values()).sort((a,b)=>messageTime(a)-messageTime(b));}
function mergeConversations(current:ConversationSummary[],incoming:ConversationSummary[]){const unique=new Map<string,ConversationSummary>();for(const item of current)unique.set(item.id,item);for(const item of incoming)unique.set(item.id,item);return Array.from(unique.values()).sort((a,b)=>conversationTime(b)-conversationTime(a));}

export default function MessagesPanel({initialConversationId}:{initialConversationId?:string|null}){
 const initialId=initialConversationId?.trim()??'';
 const[conversations,setConversations]=useState<ConversationSummary[]>([]);
 const[selectedId,setSelectedId]=useState(initialId);
 const[messages,setMessages]=useState<ConversationMessage[]>([]);
 const[loading,setLoading]=useState(true);
 const[listMoreLoading,setListMoreLoading]=useState(false);
 const[hasMoreConversations,setHasMoreConversations]=useState(false);
 const[threadLoading,setThreadLoading]=useState(false);
 const[olderLoading,setOlderLoading]=useState(false);
 const[hasOlder,setHasOlder]=useState(false);
 const[error,setError]=useState('');
 const[body,setBody]=useState('');
 const[files,setFiles]=useState<DraftFile[]>([]);
 const[sending,setSending]=useState(false);
 const[status,setStatus]=useState('');
 const listTimer=useRef<number|null>(null);
 const threadTimer=useRef<number|null>(null);
 const endRef=useRef<HTMLDivElement>(null);
 const threadRef=useRef<HTMLDivElement>(null);
 const selected=useMemo(()=>conversations.find(item=>item.id===selectedId)??null,[conversations,selectedId]);

 async function loadList(silent=false){
  try{
   if(!silent){setLoading(true);setError('');}
   const rows=await listMyConversations(CONVERSATION_PAGE_SIZE,0);
   setHasMoreConversations(rows.length===CONVERSATION_PAGE_SIZE);
   setConversations(current=>silent?mergeConversations(current,rows):rows);
   if(initialId&&rows.some(row=>row.id===initialId))setSelectedId(current=>current||initialId);
  }catch(e:unknown){if(!silent)setError(e instanceof Error?e.message:'Konuşmalar yüklenemedi.');}
  finally{if(!silent)setLoading(false);}
 }

 async function loadMoreConversations(){
  if(listMoreLoading||!hasMoreConversations)return;
  try{
   setListMoreLoading(true);setError('');
   const rows=await listMyConversations(CONVERSATION_PAGE_SIZE,conversations.length);
   setHasMoreConversations(rows.length===CONVERSATION_PAGE_SIZE);
   setConversations(current=>mergeConversations(current,rows));
  }catch(e:unknown){setError(e instanceof Error?e.message:'Daha fazla konuşma yüklenemedi.');}
  finally{setListMoreLoading(false);}
 }

 async function loadThread(id:string,silent=false){
  if(!id)return;
  try{
   if(!silent){setThreadLoading(true);setError('');}
   const rows=await getConversationMessages(id,MESSAGE_PAGE_SIZE,null);
   setHasOlder(rows.length===MESSAGE_PAGE_SIZE);
   setMessages(current=>silent?mergeMessages(current,rows):rows);
   try{
    await markConversationRead(id);
    setConversations(current=>current.map(item=>item.id===id?{...item,unreadCount:0}:item));
   }catch(e:unknown){if(!silent)setError(e instanceof Error?e.message:'Mesajlar açıldı ancak okundu durumu güncellenemedi.');}
   if(!silent)window.setTimeout(()=>endRef.current?.scrollIntoView({block:'end'}),30);
  }catch(e:unknown){if(!silent)setError(e instanceof Error?e.message:'Mesajlar yüklenemedi.');}
  finally{if(!silent)setThreadLoading(false);}
 }

 async function loadOlder(){
  if(!selectedId||olderLoading||!hasOlder||!messages.length)return;
  const before=messages[0].createdAt;
  const container=threadRef.current;
  const previousHeight=container?.scrollHeight??0;
  try{
   setOlderLoading(true);setError('');
   const rows=await getConversationMessages(selectedId,MESSAGE_PAGE_SIZE,before);
   setHasOlder(rows.length===MESSAGE_PAGE_SIZE);
   setMessages(current=>mergeMessages(current,rows));
   window.requestAnimationFrame(()=>{if(container)container.scrollTop=Math.max(0,container.scrollHeight-previousHeight);});
  }catch(e:unknown){setError(e instanceof Error?e.message:'Eski mesajlar yüklenemedi.');}
  finally{setOlderLoading(false);}
 }

 useEffect(()=>{void loadList();return()=>{if(listTimer.current)window.clearInterval(listTimer.current);if(threadTimer.current)window.clearInterval(threadTimer.current);};},[]);
 useEffect(()=>{if(listTimer.current)window.clearInterval(listTimer.current);listTimer.current=window.setInterval(()=>void loadList(true),30000);return()=>{if(listTimer.current)window.clearInterval(listTimer.current);};},[]);
 useEffect(()=>{if(!selectedId){setMessages([]);setHasOlder(false);return;}void loadThread(selectedId);if(threadTimer.current)window.clearInterval(threadTimer.current);threadTimer.current=window.setInterval(()=>void loadThread(selectedId,true),15000);return()=>{if(threadTimer.current)window.clearInterval(threadTimer.current);};},[selectedId]);

 async function send(){
  if(!selectedId||sending)return;
  const trimmed=body.trim();
  if(!trimmed){setError('Mesaj metni yazın. Ek dosya tek başına mesaj olarak gönderilmez.');return;}
  if(trimmed.length>5000){setError('Mesaj en fazla 5000 karakter olabilir.');return;}
  if(files.length>5){setError('Bir mesajda en fazla 5 ek dosya olabilir.');return;}
  const uploaded:string[]=[];
  try{
   setSending(true);setError('');setStatus(files.length?'Ek dosyalar hazırlanıyor…':'Mesaj hazırlanıyor…');
   for(const item of files)uploaded.push(await uploadMessageAttachment(selectedId,item.file));
   const imageOnly=files.length>0&&files.every(item=>item.file.type.startsWith('image/'));
   setStatus('Mesaj gönderiliyor…');
   await sendConversationMessage({conversationId:selectedId,body:trimmed,attachmentPaths:uploaded,messageType:files.length?(imageOnly?'image':'file'):'text'});
   setBody('');setFiles([]);setStatus('Mesaj gönderildi.');
   await Promise.all([loadThread(selectedId,true),loadList(true)]);
   window.setTimeout(()=>endRef.current?.scrollIntoView({block:'end'}),30);
  }catch(e:unknown){if(uploaded.length)await removeUnusedMessageAttachments(uploaded).catch(()=>{});setError(e instanceof Error?e.message:'Mesaj gönderilemedi.');setStatus('');}
  finally{setSending(false);}
 }

 async function toggleOpen(){
  if(!selected||sending)return;
  const reopen=selected.status==='closed';
  try{
   setError('');setStatus('Konuşma durumu güncelleniyor…');
   await setConversationOpenState(selected.id,reopen);
   await Promise.all([loadList(true),loadThread(selected.id,true)]);
   setStatus(reopen?'Konuşma yeniden açıldı.':'Konuşma kapatıldı.');
  }catch(e:unknown){setError(e instanceof Error?e.message:'Konuşma durumu değiştirilemedi.');setStatus('');}
 }

 function addFiles(fileList:FileList|null){
  if(!fileList||sending)return;
  setError('');
  const incoming=Array.from(fileList);
  if(files.length+incoming.length>5){setError('Bir mesajda en fazla 5 ek dosya olabilir.');return;}
  for(const file of incoming){
   if(file.size<=0||file.size>20*1024*1024){setError('Her ek dosya boş olmamalı ve en fazla 20 MB olabilir.');return;}
   if(!allowedTypes.has(file.type)){setError('Ek dosya JPEG, PNG, WebP, AVIF veya PDF olmalıdır.');return;}
  }
  setFiles(current=>[...current,...incoming.map(file=>({file,id:draftId()}))]);
 }

 async function openAttachment(path:string){try{setError('');const url=await getMessageAttachmentUrl(path);window.open(url,'_blank','noopener,noreferrer');}catch(e:unknown){setError(e instanceof Error?e.message:'Ek dosya açılamadı.');}}

 if(loading)return<LoadingState label="Konuşmalar yükleniyor"/>;
 const canSend=Boolean(selected)&&selected?.status!=='closed';
 return<Panel title="Mesajlarım" description="Ürün soruları, sipariş sonrası üretici iletişimi ve destek konuşmalarınızı tek yerden yönetin.">
  {error?<ErrorState message={error} onRetry={()=>selectedId?void loadThread(selectedId):void loadList()}/>:null}
  <div className="sr-only" role="status" aria-live="polite">{threadLoading?'Mesajlar yükleniyor.':olderLoading?'Eski mesajlar yükleniyor.':listMoreLoading?'Daha fazla konuşma yükleniyor.':sending?'Mesaj gönderiliyor.':status}</div>
  {!selectedId?<>
   <div className="mb-3 flex items-center justify-between gap-3"><div className="text-sm text-gray-500" aria-live="polite">{conversations.length} konuşma gösteriliyor</div><button type="button" onClick={()=>void loadList(false)} disabled={listMoreLoading} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><RefreshCw aria-hidden="true" className="mr-2 inline h-4 w-4"/>Yenile</button></div>
   {!conversations.length?<EmptyState title="Henüz konuşmanız yok" body="Ürün için sorduğunuz sorular, sipariş sonrası üretici iletişimi ve destek konuşmaları burada görünecek."/>:<><div className="space-y-2">{conversations.map(item=><button type="button" key={item.id} onClick={()=>setSelectedId(item.id)} className={`min-h-16 w-full rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${item.unreadCount>0?'border-brand-gold/50 bg-brand-gold/5':''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-bold">{item.title}</div>{item.subject?<div className="mt-1 truncate text-sm text-gray-500">{item.subject}</div>:null}{item.lastMessage?<div className="mt-1 line-clamp-1 text-sm text-gray-600 dark:text-gray-300">{item.lastMessage}</div>:<div className="mt-1 text-sm text-gray-400">Henüz mesaj yok</div>}</div><div className="shrink-0 text-right">{item.unreadCount>0?<span className="inline-grid min-h-6 min-w-6 place-items-center rounded-full bg-brand-gold px-1 text-xs font-bold text-white" aria-label={`${item.unreadCount} okunmamış mesaj`}>{item.unreadCount}</span>:null}<div className="mt-2 text-xs text-gray-400">{formatDate(item.lastMessageAt??item.updatedAt)}</div></div></div></button>)}</div>{hasMoreConversations?<div className="mt-4 flex justify-center"><button type="button" disabled={listMoreLoading} onClick={()=>void loadMoreConversations()} className="min-h-11 rounded-xl border px-5 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{listMoreLoading?'Konuşmalar yükleniyor…':'Daha fazla konuşma göster'}</button></div>:null}</>}
  </>:<div className="space-y-4">
   <div className="flex items-start justify-between gap-3"><button type="button" onClick={()=>{setSelectedId('');setBody('');setFiles([]);setStatus('');}} className="min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4"/>Konuşmalar</button><button type="button" onClick={()=>void loadThread(selectedId)} disabled={threadLoading} className="min-h-11 rounded-xl border px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label="Mesajları yenile"><RefreshCw aria-hidden="true" className="h-4 w-4"/></button></div>
   {!selected?<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Bu konuşma mevcut listede bulunamadı. Konuşma listesini yenileyin.</div>:<div className="rounded-xl border p-4"><div className="font-bold">{selected.title}</div>{selected.subject?<div className="mt-1 text-sm text-gray-500">{selected.subject}</div>:null}<div className="mt-2 flex items-center justify-between gap-3"><span className={`text-xs font-semibold ${selected.status==='closed'?'text-gray-500':selected.status==='waiting_customer'?'text-amber-700 dark:text-amber-300':'text-green-700 dark:text-green-300'}`}>{statusLabels[selected.status]}</span><button type="button" disabled={sending} onClick={()=>void toggleOpen()} className="min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{selected.status==='closed'?'Konuşmayı yeniden aç':'Konuşmayı kapat'}</button></div></div>}
   {threadLoading?<LoadingState label="Mesajlar yükleniyor"/>:<div ref={threadRef} className="max-h-[52vh] space-y-3 overflow-y-auto rounded-2xl border bg-gray-50 p-3 dark:bg-gray-950">{hasOlder?<div className="flex justify-center pb-1"><button type="button" disabled={olderLoading} onClick={()=>void loadOlder()} className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:bg-gray-900">{olderLoading?'Eski mesajlar yükleniyor…':'Daha eski mesajları göster'}</button></div>:messages.length?<div className="text-center text-xs text-gray-400">Konuşmanın başlangıcına ulaştınız.</div>:null}{messages.length?messages.map(message=><article key={message.id} className={`max-w-[88%] rounded-2xl p-3 ${message.isMine?'ml-auto bg-brand-green text-white':'mr-auto bg-white text-gray-900 dark:bg-gray-800 dark:text-white'}`}><div className="text-xs font-semibold opacity-75">{message.isMine?'Siz':message.senderName}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>{message.attachmentPaths.length?<div className="mt-2 space-y-1">{message.attachmentPaths.map(path=><button type="button" key={path} onClick={()=>void openAttachment(path)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${message.isMine?'border-white/30':'border-gray-200 dark:border-gray-700'}`}>{isImagePath(path)?<ImageIcon aria-hidden="true" className="h-4 w-4"/>:<FileText aria-hidden="true" className="h-4 w-4"/>}<span className="min-w-0 flex-1 truncate">{attachmentDisplayName(path)}</span></button>)}</div>:null}<div className="mt-2 text-[11px] opacity-60">{formatDate(message.createdAt)}</div></article>):<div className="p-6 text-center text-sm text-gray-500">Henüz mesaj yok.</div>}<div ref={endRef}/></div>}
   {selected?.status==='closed'?<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Bu konuşma kapalı. Yeni mesaj göndermek için yeniden açın.</div>:canSend?<div className="rounded-2xl border p-4"><label className="block"><span className="text-sm font-semibold">Mesajınız</span><textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={5000} rows={4} disabled={sending} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" placeholder="Mesajınızı yazın…"/><span className="mt-1 block text-xs text-gray-500">{body.length}/5000</span></label><div className="mt-3 flex flex-wrap items-center gap-2"><label className={`inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold focus-within:ring-2 focus-within:ring-brand-gold ${sending?'cursor-not-allowed opacity-50':'cursor-pointer'}`}><Paperclip aria-hidden="true" className="mr-2 h-4 w-4"/>Dosya ekle<input type="file" multiple accept={allowedAccept} disabled={sending} className="sr-only" onChange={event=>{addFiles(event.target.files);event.currentTarget.value='';}}/></label><span className="text-xs text-gray-500">En fazla 5 dosya • 20 MB/dosya</span></div>{files.length?<ul className="mt-3 space-y-2">{files.map(item=><li key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-2 dark:bg-gray-800"><span className="min-w-0 truncate text-sm">{item.file.name}</span><button type="button" disabled={sending} onClick={()=>setFiles(current=>current.filter(file=>file.id!==item.id))} className="min-h-11 rounded-lg border px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label={`${item.file.name} dosyasını kaldır`}><X aria-hidden="true" className="h-4 w-4"/></button></li>)}</ul>:null}<div aria-live="polite" className="mt-2 min-h-5 text-xs text-brand-green">{status}</div><button type="button" onClick={()=>void send()} disabled={sending||!body.trim()} className="mt-2 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Send aria-hidden="true" className="mr-2 inline h-4 w-4"/>{sending?'Gönderiliyor…':'Mesajı gönder'}</button></div>:null}
  </div>}
 </Panel>;
}

function formatDate(value:string){return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));}
function isImagePath(path:string){return/\.(jpe?g|png|webp|avif)$/i.test(path.split('?')[0]);}
