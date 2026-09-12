import React,{useEffect,useRef,useState}from'react';
import{Check,Circle,Copy,ExternalLink,MessageCircle,RotateCcw,X}from'lucide-react';
import{cancelOrder,getOrderDetail,listOrders}from'./api';
import{copyText}from'../navigation/appUrl';
import type{OrderPaymentStatus,OrderStatus}from'./types';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';
import ReturnRequestDialog from'./ReturnRequestDialog';
import ReturnDetailDialog from'./ReturnDetailDialog';
import ProducerQuestionComposer from'./ProducerQuestionComposer';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';

const PAGE_SIZE=20;
const statusText:Record<OrderStatus,string>={draft:'Taslak',pending_payment:'Ödeme bekleniyor',confirmed:'Onaylandı',preparing:'Hazırlanıyor',partially_shipped:'Kısmen gönderildi',shipped:'Kargoda',delivered:'Teslim edildi',completed:'Tamamlandı',cancelled:'İptal edildi',refunded:'İade edildi'};
const paymentText:Record<OrderPaymentStatus,string>={unpaid:'Ödenmedi',authorized:'Yetkilendirildi',partially_paid:'Kısmen ödendi',paid:'Ödendi',partially_refunded:'Kısmi geri ödeme',refunded:'Geri ödendi',failed:'Başarısız',disputed:'İtirazlı'};
const returnStatusText:Record<string,string>={requested:'Talep alındı',under_review:'İnceleniyor',approved:'İade kabul edildi',in_transit:'İade kargoda',received:'İade teslim alındı',rejected:'Reddedildi',refunded:'Geri ödeme yapıldı',closed:'Kapandı'};
const shipmentStatusText:Record<string,string>={pending:'Bekliyor',label_created:'Etiket oluşturuldu',picked_up:'Teslim alındı',in_transit:'Yolda',out_for_delivery:'Teslimat için yola çıktı',delivered:'Teslim edildi',exception:'Teslimat sorunu',returned:'Geri döndü'};
const refundStatusText:Record<string,string>={pending:'Bekliyor',processing:'İşleniyor',succeeded:'Tamamlandı',failed:'Başarısız',cancelled:'İptal edildi'};

type OrdersPageData=Awaited<ReturnType<typeof listOrders>>;
type OrderDetailData=Awaited<ReturnType<typeof getOrderDetail>>;
type CancelCandidate={id:string;orderNumber:string};
type QuestionContext={producerId:string;orderId:string;orderNumber:string;productName:string};

function negativeMinor(value:number){return-value;}
function formatDate(value:string|null){if(!value)return'Tarih yok';const date=new Date(value);return Number.isNaN(date.getTime())?'Tarih kullanılamıyor':date.toLocaleString('tr-TR');}

export default function OrdersPanel({initialOrderId}:{initialOrderId?:string|null}){
 const[page,setPage]=useState<OrdersPageData|null>(null);const[detail,setDetail]=useState<OrderDetailData|null>(null);const[error,setError]=useState('');const[listStatus,setListStatus]=useState('');const[loading,setLoading]=useState(true);const[loadingMore,setLoadingMore]=useState(false);const[openingId,setOpeningId]=useState<string|null>(null);const[detailError,setDetailError]=useState('');const[detailStatus,setDetailStatus]=useState('');const[returnOrderId,setReturnOrderId]=useState<string|null>(null);const[returnDetailId,setReturnDetailId]=useState<string|null>(null);const[cancelCandidate,setCancelCandidate]=useState<CancelCandidate|null>(null);const[cancelBusy,setCancelBusy]=useState(false);const[questionContext,setQuestionContext]=useState<QuestionContext|null>(null);
 const nestedOpen=Boolean(returnOrderId||returnDetailId||cancelCandidate);
 const orderDialogRef=useAccessibleDialog<HTMLDivElement>(Boolean(detail)&&!nestedOpen,()=>{setQuestionContext(null);setDetail(null);});
 const cancelDialogRef=useAccessibleDialog<HTMLDivElement>(Boolean(cancelCandidate),()=>{if(!cancelBusy)setCancelCandidate(null);});
 
 useEffect(()=>{if(!detailStatus)return;const timer=setTimeout(()=>setDetailStatus(''),4000);return()=>clearTimeout(timer);},[detailStatus]);

 async function load(reset=true){
  const currentItems=page?.items??[];const offset=reset?0:currentItems.length;
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   setError('');
   const next=await listOrders(PAGE_SIZE,offset);
   setPage(previous=>{
    if(reset||!previous)return next;
    const unique=new Map<string,OrdersPageData['items'][number]>();
    previous.items.forEach(item=>unique.set(item.id,item));
    next.items.forEach(item=>unique.set(item.id,item));
    return{...next,offset:0,items:Array.from(unique.values())};
   });
  }catch{setError(reset?'Siparişlerinizi şu anda gösteremiyoruz. Lütfen yeniden deneyin.':'Daha fazla sipariş şu anda yüklenemedi.');}
  finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }
 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{const id=initialOrderId?.trim();if(id)void open(id);},[initialOrderId]);
 async function open(id:string){const normalized=id.trim();if(!normalized||openingId)return;try{setOpeningId(normalized);setQuestionContext(null);setError('');setListStatus('');setDetailError('');setDetailStatus('');setDetail(await getOrderDetail(normalized));}catch(e:any){setError(e?.message?.trim()||'Sipariş detayı açılamadı.');}finally{setOpeningId(null);}}
 async function refreshDetail(id:string){try{setDetailError('');setDetailStatus('');const updated=await getOrderDetail(id);setDetail(updated);await load(true);setDetailStatus('✓ Sipariş detayı güncellendi.');}catch(e:any){setDetailError(e?.message?.trim()||'Sipariş detayı yenilenemedi.');}}
 async function confirmCancel(){if(!cancelCandidate||cancelBusy)return;try{setCancelBusy(true);setDetailError('');setDetailStatus('');await cancelOrder(cancelCandidate.id);setCancelCandidate(null);setQuestionContext(null);setDetail(null);await load(true);setListStatus('✓ Sipariş başarıyla iptal edildi. Satıcı ve admin bilgilendirildi.');}catch(error){const message=error instanceof Error?error.message:'';if(message.includes('İptal için çok geç')||message.includes('too late')||message.includes('cannot cancel')){setDetailError('Bu sipariş artık iptal edilemez. Sipariş zaten hazırlanıyor veya kargoya verildi. İade talebi oluşturabilirsiniz.');}else if(message.includes('already cancelled')||message.includes('zaten iptal')){setDetailError('Bu sipariş zaten iptal edilmiş.');}else if(message.includes('paid')||message.includes('ödeme')){setDetailError('Ödenmiş siparişler otomatik olarak iptal edilemez. Destek ekibiyle iletişime geçin.');}else{setDetailError('Sipariş şu anda iptal edilemedi. Lütfen durumu kontrol edip yeniden deneyin. Sorun devam ederse destek ekibiyle iletişime geçin.');}setCancelCandidate(null);}finally{setCancelBusy(false);}}
 if(loading)return<LoadingState label="Siparişler yükleniyor"/>;
 if(!page)return<Panel title="Siparişlerim" description="Sipariş, ödeme, kargo, iade ve geri ödeme durumlarını tek yerden izleyin."><ErrorState message={error||'Siparişlerinizi şu anda gösteremiyoruz.'} onRetry={()=>void load(true)}/></Panel>;
 const items=page.items;const total=page.total;const hasMore=items.length<total;
 const returns=detail?.returns??[];const activeReturn=returns.find(r=>['requested','under_review','approved','in_transit','received'].includes(r.status));
 return<Panel title="Siparişlerim" description="Sipariş, ödeme, kargo, iade, geri ödeme ve satın alma sonrası üretici sorularını tek yerden yönetin.">
  {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
  {listStatus?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{listStatus}</div>:null}
  <div className="sr-only" aria-live="polite">{openingId?'Sipariş detayı yükleniyor.':loadingMore?'Daha fazla sipariş yükleniyor.':''}</div>
  {!items.length?<EmptyState title="Henüz sipariş yok" body="Sipariş verdiğinizde tüm durum geçmişi burada görünecek."/>:<>
   <div className="mb-3 text-sm text-gray-500">{items.length} / {total} sipariş gösteriliyor</div>
   <div className="space-y-3">{items.map(o=>{const busy=openingId===o.id;return <button type="button" key={o.id} disabled={Boolean(openingId)} aria-busy={busy} onClick={()=>void open(o.id)} className="min-h-14 w-full rounded-xl border border-gray-200 p-4 text-left disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700"><div className="flex justify-between gap-3"><div><div className="font-bold">{o.orderNumber}{o.gift?<span className="text-xs text-brand-gold"> • Hediye</span>:null}</div><div className="mt-1 text-sm text-gray-500">{busy?'Detay yükleniyor…':`${statusText[o.status]} • ${o.itemCount} ürün`}</div>{o.trackingNumber?<div className="mt-1 text-xs text-gray-500">Takip: {o.trackingNumber}</div>:null}</div><div className="font-bold"><Money minor={o.totalMinor} currency={o.currency}/></div></div></button>;})}</div>
   {hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore?'Yükleniyor…':'Daha fazla sipariş göster'}</button></div>:null}
  </>}

  {detail?<div role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4"><div ref={orderDialogRef} tabIndex={-1} className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white p-5 outline-none dark:bg-gray-900">
   <div className="flex items-start justify-between gap-3"><div><h3 id="order-detail-title" className="text-xl font-bold">{detail.orderNumber}</h3><p className="text-sm text-gray-500">{statusText[detail.status]}</p><p className="mt-1 text-xs text-gray-500">Ödeme: {paymentText[detail.paymentStatus]}</p></div><button type="button" onClick={()=>{setQuestionContext(null);setDetail(null);}} aria-label="Sipariş detayını kapat" className="min-h-11 rounded-lg border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Kapat</button></div>
   {detailError?<div className="mt-4"><ErrorState message={detailError}/></div>:null}
   {detailStatus?<div role="status" aria-live="polite" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{detailStatus}</div>:null}

   <section className="mt-5" aria-labelledby="order-items-title"><h4 id="order-items-title" className="font-bold">Ürünler</h4><div className="mt-2 space-y-3">{detail.items.length?detail.items.map(i=><div key={i.id} className="rounded-xl border p-3"><div className="font-semibold">{i.productName}</div><div className="text-sm text-gray-500">{i.variantName?`${i.variantName} • `:''}{i.quantity} adet</div><div className="mt-1 font-bold"><Money minor={i.lineTotalMinor} currency={detail.currency}/></div>{i.producerId?<button type="button" onClick={()=>{setDetailError('');setDetailStatus('');setQuestionContext({producerId:i.producerId as string,orderId:detail.id,orderNumber:detail.orderNumber,productName:i.productName});}} className="mt-3 min-h-11 w-full rounded-xl border border-brand-green/40 px-3 font-semibold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><MessageCircle aria-hidden="true" className="mr-2 inline h-4 w-4"/>Soru sor</button>:null}</div>):<div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">Bu siparişte ürün bulunmuyor.</div>}</div></section>

   {questionContext?<ProducerQuestionComposer className="mt-4" context={{kind:'order',producerId:questionContext.producerId,orderId:questionContext.orderId,orderNumber:detail.orderNumber,productName:questionContext.productName}} onCancel={()=>setQuestionContext(null)} onStarted={()=>{setQuestionContext(null);setDetailStatus('Sorunuz üreticiye gönderildi. Yanıt Hesabım > Mesajlarım bölümüne düşecek.');}}/>:null}

   {detail.gift?<div className="mt-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4"><div className="font-bold">Hediye bilgisi</div><p className="mt-1 text-sm">Alıcı: {detail.gift.recipientName}</p>{detail.gift.message?<p className="mt-2 text-sm italic">“{detail.gift.message}”</p>:null}</div>:null}

   <OrderStatusTimeline currentStatus={detail.status} statusHistory={detail.statusHistory}/>

   {detail.shipments.length?<section className="mt-5" aria-labelledby="shipments-title"><h4 id="shipments-title" className="font-bold">Kargo bilgileri</h4>{detail.shipments.map(s=><div key={s.id} className="mt-2 rounded-xl border-2 border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"><div className="font-semibold">{s.carrier||'Kargo firması belirtilmedi'}</div><div className="mt-1 text-sm text-gray-500">{shipmentStatusText[s.status]||s.status}</div>{s.trackingNumber?<div className="mt-2 flex items-center gap-2"><span className="font-mono text-sm font-bold text-brand-green">{s.trackingNumber}</span><button type="button" onClick={async()=>{try{await copyText(s.trackingNumber as string);setDetailStatus('✓ Takip numarası kopyalandı.');}catch{setDetailError('Kopyalama başarısız.');}}} className="grid min-h-8 min-w-8 place-items-center rounded-lg border-2 border-brand-green/30 bg-brand-green/5 hover:bg-brand-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label="Takip numarasını kopyala"><Copy aria-hidden="true" className="h-3.5 w-3.5 text-brand-green"/></button></div>:null}{s.trackingUrl?<a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center rounded-xl border-2 border-brand-green bg-brand-green px-4 font-bold text-white shadow-sm hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Kargoyu takip et<ExternalLink aria-hidden="true" className="ml-2 h-4 w-4"/></a>:null}</div>)}</section>:null}

   {detail.statusHistory.length?<details className="mt-5 rounded-xl border-2 border-gray-200 dark:border-gray-700"><summary className="min-h-12 cursor-pointer p-4 font-bold hover:bg-gray-50 dark:hover:bg-gray-800">Detaylı sipariş geçmişi</summary><div className="border-t-2 border-gray-200 p-4 dark:border-gray-700"><ol className="space-y-2">{detail.statusHistory.map((h,index)=><li key={`${h.at}-${h.to}-${index}`} className="rounded-xl border bg-gray-50 p-3 dark:bg-gray-800"><div className="text-sm font-semibold">{statusText[h.to]}</div><div className="text-xs text-gray-500">{formatDate(h.at)}</div>{h.note?<div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{h.note}</div>:null}</li>)}</ol></div></details>:null}

   {returns.length?<section className="mt-5" aria-labelledby="returns-title"><h4 id="returns-title" className="font-bold">İade talepleri</h4><div className="mt-2 space-y-2">{returns.map(r=><button type="button" key={r.id} onClick={()=>setReturnDetailId(r.id)} className="min-h-14 w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><div className="flex justify-between gap-3"><div><div className="font-semibold">{r.returnNumber}</div><div className="text-sm text-gray-500">{returnStatusText[r.status]||r.status} • {formatDate(r.requestedAt)}</div></div><span className="font-semibold text-brand-green">Detay</span></div>{r.resolutionNote?<div className="mt-2 text-sm">{r.resolutionNote}</div>:null}</button>)}</div></section>:null}

   {detail.refunds.length?<section className="mt-5" aria-labelledby="refunds-title"><h4 id="refunds-title" className="font-bold">Geri ödemeler</h4><div className="mt-2 space-y-2">{detail.refunds.map(r=><div key={r.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{refundStatusText[r.status]||r.status}</span><Money minor={r.amountMinor} currency={r.currency}/></div>{r.processedAt?<div className="mt-1 text-xs text-gray-500">{formatDate(r.processedAt)}</div>:null}</div>)}</div></section>:null}

   <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="flex justify-between"><span>Ara toplam</span><Money minor={detail.subtotalMinor} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>İndirim</span><Money minor={negativeMinor(detail.discountMinor)} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>Kargo</span><Money minor={detail.shippingMinor} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>Vergi</span><Money minor={detail.taxMinor} currency={detail.currency}/></div><div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Toplam</span><Money minor={detail.totalMinor} currency={detail.currency}/></div></div>

   {detail.status==='pending_payment'||detail.status==='confirmed'?<button type="button" onClick={()=>{setDetailError('');setDetailStatus('');setQuestionContext(null);setCancelCandidate({id:detail.id,orderNumber:detail.orderNumber});}} className="mt-5 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-400">Siparişi iptal et</button>:null}
   {['delivered','completed'].includes(detail.status)?<div className="mt-4">{activeReturn?<div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">Açık iade talebi: <button type="button" onClick={()=>{setQuestionContext(null);setReturnDetailId(activeReturn.id);}} className="min-h-11 font-bold underline">{activeReturn.returnNumber} - {returnStatusText[activeReturn.status]||activeReturn.status}</button></div>:<button type="button" onClick={()=>{setQuestionContext(null);setReturnOrderId(detail.id);}} className="min-h-12 w-full rounded-xl border border-brand-green font-bold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><RotateCcw aria-hidden="true" className="mr-2 inline h-4 w-4"/>İade / sorun bildir</button>}</div>:null}
  </div></div>:null}

  {cancelCandidate?<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><div ref={cancelDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="cancel-order-title" aria-describedby="cancel-order-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900"><h3 id="cancel-order-title" className="text-lg font-bold">Siparişi iptal etmek istiyor musunuz?</h3><p id="cancel-order-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{cancelCandidate.orderNumber} numaralı sipariş iptal edilecek ve bu işlem geri alınamaz. Sadece ödeme bekleniyor veya onaylandı durumundaki siparişler iptal edilebilir.</p><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Not: Sipariş henüz hazırlanmaya başlanmadıysa iptal edilebilir. Hazırlanan veya kargodaki siparişler için İade / Sorun Bildir kullanın.</p><div aria-live="polite" className="sr-only">{cancelBusy?'Sipariş iptal ediliyor.':''}</div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={cancelBusy} onClick={()=>setCancelCandidate(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button><button type="button" disabled={cancelBusy} onClick={()=>void confirmCancel()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{cancelBusy?'İptal ediliyor…':'Siparişi İptal Et'}</button></div></div></div>:null}

  {returnOrderId?<ReturnRequestDialog orderId={returnOrderId} onClose={()=>setReturnOrderId(null)} onSubmitted={async()=>{const id=returnOrderId;setReturnOrderId(null);await refreshDetail(id);}}/>:null}
  {returnDetailId?<ReturnDetailDialog returnId={returnDetailId} onClose={()=>setReturnDetailId(null)}/>:null}
 </Panel>;
}

function OrderStatusTimeline({currentStatus,statusHistory}:{currentStatus:OrderStatus;statusHistory:Array<{to:OrderStatus;at:string;note?:string}>}){
 const isCancelled=currentStatus==='cancelled';
 const isRefunded=currentStatus==='refunded';
 const normalFlow:OrderStatus[]=['pending_payment','confirmed','preparing','shipped','delivered'];
 const steps=normalFlow.map(status=>{
  const historyEntry=statusHistory.find(h=>h.to===status);
  const reached=Boolean(historyEntry);
  const isCurrent=currentStatus===status;
  const isPast=!isCurrent&&reached;
  const isFuture=!reached&&!isCurrent;
  return{status,reached,isCurrent,isPast,isFuture,timestamp:historyEntry?.at||null};
 });
 const cancelledEntry=statusHistory.find(h=>h.to==='cancelled');
 const refundedEntry=statusHistory.find(h=>h.to==='refunded');
 const timelineLabels:Record<OrderStatus,string>={'draft':'Taslak','pending_payment':'Ödeme bekleniyor','confirmed':'Onaylandı','preparing':'Hazırlanıyor','partially_shipped':'Kısmen gönderildi','shipped':'Kargoda','delivered':'Teslim edildi','completed':'Tamamlandı','cancelled':'İptal edildi','refunded':'İade edildi'};
 return<section className="mt-5" aria-label="Sipariş durumu"><h4 className="font-bold">Sipariş durumu</h4><div className="mt-3 rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-gray-50/50 to-white p-4 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-900" role="list" aria-label="Sipariş aşamaları">{isCancelled||isRefunded?<div className="flex items-center gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30" role="listitem" aria-label={timelineLabels[currentStatus]}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-red-600 bg-red-100 dark:bg-red-950"><X aria-hidden="true" className="h-5 w-5 text-red-700 dark:text-red-400"/></div><div className="min-w-0 flex-1"><div className="font-bold text-red-900 dark:text-red-200">{timelineLabels[currentStatus]}</div>{(isCancelled&&cancelledEntry||isRefunded&&refundedEntry)?<div className="mt-0.5 text-xs text-red-700 dark:text-red-300">{formatDate((isCancelled?cancelledEntry:refundedEntry)?.at||null)}</div>:null}</div></div>:null}<div className="space-y-3">{steps.map((step,index)=>{const isLast=index===steps.length-1;return<div key={step.status} className="flex items-start gap-3" role="listitem" aria-label={`${timelineLabels[step.status]}${step.isCurrent?' - mevcut durum':step.reached?' - tamamlandı':' - beklemede'}`}><div className="flex flex-col items-center"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition ${step.isCurrent?'border-brand-green bg-brand-green shadow-lg':step.reached?'border-green-600 bg-green-100 dark:border-green-500 dark:bg-green-950':'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'}`}>{step.reached?<Check aria-hidden="true" className={`h-5 w-5 ${step.isCurrent?'text-white':'text-green-700 dark:text-green-400'}`}/>:<Circle aria-hidden="true" className="h-4 w-4 text-gray-400"/>}</div>{!isLast?<div className={`mt-1 h-8 w-0.5 ${step.reached?'bg-green-600 dark:bg-green-500':'bg-gray-300 dark:bg-gray-600'}`} aria-hidden="true"/>:null}</div><div className="min-w-0 flex-1 pt-1.5"><div className={`font-semibold ${step.isCurrent?'text-brand-green dark:text-brand-gold':step.reached?'text-gray-900 dark:text-gray-100':'text-gray-500 dark:text-gray-400'}`}>{timelineLabels[step.status]}</div>{step.timestamp?<div className="mt-0.5 text-xs text-gray-500">{formatDate(step.timestamp)}</div>:null}</div></div>;})}</div></div></section>;
}
