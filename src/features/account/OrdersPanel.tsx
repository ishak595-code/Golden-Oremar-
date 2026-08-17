import React,{useEffect,useState}from'react';
import{ExternalLink,RotateCcw}from'lucide-react';
import{cancelOrder,getOrderDetail,listOrders}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';
import ReturnRequestDialog from'./ReturnRequestDialog';
import ReturnDetailDialog from'./ReturnDetailDialog';
import{useDialogA11y}from'./useDialogA11y';

const PAGE_SIZE=20;
const statusText:Record<string,string>={pending_payment:'Ödeme bekleniyor',confirmed:'Onaylandı',preparing:'Hazırlanıyor',partially_shipped:'Kısmen gönderildi',shipped:'Kargoda',delivered:'Teslim edildi',completed:'Tamamlandı',cancelled:'İptal edildi'};
const returnStatusText:Record<string,string>={requested:'Talep alındı',under_review:'İnceleniyor',approved:'Onaylandı',in_transit:'İade kargoda',received:'İade teslim alındı',rejected:'Reddedildi',refunded:'Geri ödeme yapıldı',closed:'Kapandı'};
const paymentText:Record<string,string>={pending:'Bekliyor',authorized:'Yetkilendirildi',captured:'Ödendi',partially_refunded:'Kısmi geri ödeme',refunded:'Geri ödendi',failed:'Başarısız'};

export default function OrdersPanel({initialOrderId}:{initialOrderId?:string|null}){
 const[page,setPage]=useState<any>(null);const[detail,setDetail]=useState<any>(null);const[error,setError]=useState('');const[listStatus,setListStatus]=useState('');const[loading,setLoading]=useState(true);const[loadingMore,setLoadingMore]=useState(false);const[openingId,setOpeningId]=useState<string|null>(null);const[detailError,setDetailError]=useState('');const[detailStatus,setDetailStatus]=useState('');const[returnOrderId,setReturnOrderId]=useState<string|null>(null);const[returnDetailId,setReturnDetailId]=useState<string|null>(null);const[cancelCandidate,setCancelCandidate]=useState<any>(null);const[cancelBusy,setCancelBusy]=useState(false);
 const nestedOpen=Boolean(returnOrderId||returnDetailId||cancelCandidate);
 const orderDialogRef=useDialogA11y(()=>setDetail(null),Boolean(detail)&&!nestedOpen);
 const cancelDialogRef=useDialogA11y(()=>{if(!cancelBusy)setCancelCandidate(null);},Boolean(cancelCandidate));

 async function load(reset=true){
  const offset=reset?0:Number(page?.items?.length||0);
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   setError('');
   const next=await listOrders(PAGE_SIZE,offset);
   setPage((previous:any)=>{
    if(reset||!previous)return next;
    const unique=new Map<string,any>();
    [...(previous.items||[]),...(next.items||[])].forEach(item=>unique.set(String(item.id),item));
    return {...next,offset:0,items:Array.from(unique.values())};
   });
  }catch(e:any){setError(e?.message||'Siparişler yüklenemedi.');}
  finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }
 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{if(initialOrderId)void open(initialOrderId);},[initialOrderId]);
 async function open(id:string){if(openingId)return;try{setOpeningId(id);setError('');setListStatus('');setDetailError('');setDetailStatus('');setDetail(await getOrderDetail(id));}catch(e:any){setError(e?.message||'Sipariş detayı yüklenemedi.');}finally{setOpeningId(null);}}
 async function refreshDetail(id:string){try{setDetailError('');setDetailStatus('');setDetail(await getOrderDetail(id));await load(true);setDetailStatus('Sipariş detayı güncellendi.');}catch(e:any){setDetailError(e?.message||'Sipariş detayı yenilenemedi.');}}
 async function confirmCancel(){const id=cancelCandidate?.id;if(!id||cancelBusy)return;try{setCancelBusy(true);setDetailError('');setDetailStatus('');await cancelOrder(id);setCancelCandidate(null);setDetail(null);await load(true);setListStatus('Sipariş iptal edildi.');}catch(e:any){setCancelCandidate(null);setDetailError(e?.message||'Sipariş iptal edilemedi.');}finally{setCancelBusy(false);}}
 if(loading)return<LoadingState label="Siparişler yükleniyor"/>;
 const activeReturn=detail?.returns?.find((r:any)=>['requested','under_review','approved','in_transit','received'].includes(r.status));
 const hasMore=Number(page?.items?.length||0)<Number(page?.total||0);
 return<Panel title="Siparişlerim" description="Sipariş, ödeme, kargo, iade ve geri ödeme durumlarını tek yerden izleyin.">
  {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
  {listStatus?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{listStatus}</div>:null}
  <div className="sr-only" aria-live="polite">{openingId?'Sipariş detayı yükleniyor.':loadingMore?'Daha fazla sipariş yükleniyor.':''}</div>
  {!page?.items?.length?<EmptyState title="Henüz sipariş yok" body="Sipariş verdiğinizde tüm durum geçmişi burada görünecek."/>:<>
   <div className="mb-3 text-sm text-gray-500">{page.items.length} / {page.total} sipariş gösteriliyor</div>
   <div className="space-y-3">{page.items.map((o:any)=><button type="button" key={o.id} disabled={Boolean(openingId)} aria-busy={openingId===o.id} onClick={()=>void open(o.id)} className="min-h-14 w-full rounded-xl border border-gray-200 p-4 text-left disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700"><div className="flex justify-between gap-3"><div><div className="font-bold">{o.orderNumber}{o.gift?<span className="text-xs text-brand-gold"> • Hediye</span>:null}</div><div className="mt-1 text-sm text-gray-500">{openingId===o.id?'Detay yükleniyor…':`${statusText[o.status]||o.status} • ${o.itemCount} ürün`}</div>{o.trackingNumber?<div className="mt-1 text-xs text-gray-500">Takip: {o.trackingNumber}</div>:null}</div><div className="font-bold"><Money minor={o.totalMinor} currency={o.currency}/></div></div></button>)}</div>
   {hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore?'Yükleniyor…':'Daha fazla sipariş göster'}</button></div>:null}
  </>}

  {detail?<div role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4"><div ref={orderDialogRef} tabIndex={-1} className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white p-5 outline-none dark:bg-gray-900">
   <div className="flex items-start justify-between gap-3"><div><h3 id="order-detail-title" className="text-xl font-bold">{detail.orderNumber}</h3><p className="text-sm text-gray-500">{statusText[detail.status]||detail.status}</p><p className="mt-1 text-xs text-gray-500">Ödeme: {paymentText[detail.paymentStatus]||detail.paymentStatus}</p></div><button type="button" onClick={()=>setDetail(null)} aria-label="Sipariş detayını kapat" className="min-h-11 rounded-lg border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Kapat</button></div>
   {detailError?<div className="mt-4"><ErrorState message={detailError}/></div>:null}
   {detailStatus?<div role="status" aria-live="polite" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{detailStatus}</div>:null}

   <section className="mt-5" aria-labelledby="order-items-title"><h4 id="order-items-title" className="font-bold">Ürünler</h4><div className="mt-2 space-y-3">{detail.items?.map((i:any)=><div key={i.id} className="rounded-xl border p-3"><div className="font-semibold">{i.productName}</div><div className="text-sm text-gray-500">{i.variantName||'Standart'} • {i.quantity} adet</div><div className="mt-1 font-bold"><Money minor={i.lineTotalMinor} currency={detail.currency}/></div></div>)}</div></section>

   {detail.gift?<div className="mt-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4"><div className="font-bold">Hediye bilgisi</div><p className="mt-1 text-sm">Alıcı: {detail.gift.recipientName}</p>{detail.gift.message?<p className="mt-2 text-sm italic">“{detail.gift.message}”</p>:null}</div>:null}

   {detail.shipments?.length?<section className="mt-5" aria-labelledby="shipments-title"><h4 id="shipments-title" className="font-bold">Kargo</h4>{detail.shipments.map((s:any)=><div key={s.id} className="mt-2 rounded-xl border p-3 text-sm"><div>{s.carrier||'Kargo'} • {s.status}</div>{s.trackingNumber?<div className="mt-1">Takip: {s.trackingNumber}</div>:null}{safeUrl(s.trackingUrl)?<a href={safeUrl(s.trackingUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-green">Kargoyu takip et<ExternalLink aria-hidden="true" className="ml-2 h-4 w-4"/></a>:null}</div>)}</section>:null}

   {detail.statusHistory?.length?<section className="mt-5" aria-labelledby="history-title"><h4 id="history-title" className="font-bold">Sipariş geçmişi</h4><ol className="mt-2 space-y-2">{detail.statusHistory.map((h:any,index:number)=><li key={`${h.at}-${index}`} className="rounded-xl border p-3"><div className="text-sm font-semibold">{statusText[h.to]||h.to}</div><div className="text-xs text-gray-500">{formatDate(h.at)}</div>{h.note?<div className="mt-1 text-sm">{h.note}</div>:null}</li>)}</ol></section>:null}

   {detail.returns?.length?<section className="mt-5" aria-labelledby="returns-title"><h4 id="returns-title" className="font-bold">İade talepleri</h4><div className="mt-2 space-y-2">{detail.returns.map((r:any)=><button type="button" key={r.id} onClick={()=>setReturnDetailId(r.id)} className="min-h-14 w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><div className="flex justify-between gap-3"><div><div className="font-semibold">{r.returnNumber}</div><div className="text-sm text-gray-500">{returnStatusText[r.status]||r.status} • {formatDate(r.requestedAt)}</div></div><span className="font-semibold text-brand-green">Detay</span></div>{r.resolutionNote?<div className="mt-2 text-sm">{r.resolutionNote}</div>:null}</button>)}</div></section>:null}

   {detail.refunds?.length?<section className="mt-5" aria-labelledby="refunds-title"><h4 id="refunds-title" className="font-bold">Geri ödemeler</h4><div className="mt-2 space-y-2">{detail.refunds.map((r:any)=><div key={r.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{r.status}</span><Money minor={r.amountMinor} currency={r.currency}/></div>{r.processedAt?<div className="mt-1 text-xs text-gray-500">{formatDate(r.processedAt)}</div>:null}</div>)}</div></section>:null}

   <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="flex justify-between"><span>Ara toplam</span><Money minor={detail.subtotalMinor} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>İndirim</span><Money minor={-Number(detail.discountMinor||0)} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>Kargo</span><Money minor={detail.shippingMinor} currency={detail.currency}/></div><div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Toplam</span><Money minor={detail.totalMinor} currency={detail.currency}/></div></div>

   {detail.status==='pending_payment'?<button type="button" onClick={()=>{setDetailError('');setDetailStatus('');setCancelCandidate({id:detail.id,orderNumber:detail.orderNumber});}} className="mt-5 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Siparişi iptal et</button>:null}
   {['delivered','completed'].includes(detail.status)?<div className="mt-4">{activeReturn?<div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">Açık iade talebi: <button type="button" onClick={()=>setReturnDetailId(activeReturn.id)} className="min-h-11 font-bold underline">{activeReturn.returnNumber} — {returnStatusText[activeReturn.status]||activeReturn.status}</button></div>:<button type="button" onClick={()=>setReturnOrderId(detail.id)} className="min-h-12 w-full rounded-xl border border-brand-green font-bold text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><RotateCcw aria-hidden="true" className="mr-2 inline h-4 w-4"/>İade / sorun bildir</button>}</div>:null}
  </div></div>:null}

  {cancelCandidate?<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><div ref={cancelDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="cancel-order-title" aria-describedby="cancel-order-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900"><h3 id="cancel-order-title" className="text-lg font-bold">Siparişi iptal etmek istiyor musunuz?</h3><p id="cancel-order-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{cancelCandidate.orderNumber} numaralı ödeme bekleyen sipariş iptal edilecek. İşlem yalnız backend izin veriyorsa tamamlanır ve geri alınamaz.</p><div aria-live="polite" className="sr-only">{cancelBusy?'Sipariş iptal ediliyor.':''}</div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={cancelBusy} onClick={()=>setCancelCandidate(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button><button type="button" disabled={cancelBusy} onClick={()=>void confirmCancel()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{cancelBusy?'İptal ediliyor…':'Siparişi İptal Et'}</button></div></div></div>:null}

  {returnOrderId?<ReturnRequestDialog orderId={returnOrderId} onClose={()=>setReturnOrderId(null)} onSubmitted={async()=>{const id=returnOrderId;setReturnOrderId(null);await refreshDetail(id);}}/>:null}
  {returnDetailId?<ReturnDetailDialog returnId={returnDetailId} onClose={()=>setReturnDetailId(null)}/>:null}
 </Panel>;
}
function safeUrl(value?:string|null){if(!value)return'';try{const url=new URL(value);return url.protocol==='https:'?url.toString():'';}catch{return'';}}
function formatDate(value?:string|null){if(!value)return'—';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return value;}}
