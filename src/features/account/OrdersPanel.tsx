import React,{useEffect,useState}from'react';
import{ExternalLink,RotateCcw}from'lucide-react';
import{cancelOrder,getOrderDetail,listOrders}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';
import ReturnRequestDialog from'./ReturnRequestDialog';
import ReturnDetailDialog from'./ReturnDetailDialog';
import{useDialogA11y}from'./useDialogA11y';

const statusText:Record<string,string>={pending_payment:'Ödeme bekleniyor',confirmed:'Onaylandı',preparing:'Hazırlanıyor',partially_shipped:'Kısmen gönderildi',shipped:'Kargoda',delivered:'Teslim edildi',completed:'Tamamlandı',cancelled:'İptal edildi'};
const returnStatusText:Record<string,string>={requested:'Talep alındı',under_review:'İnceleniyor',approved:'Onaylandı',in_transit:'İade kargoda',received:'İade teslim alındı',rejected:'Reddedildi',refunded:'Geri ödeme yapıldı',closed:'Kapandı'};
const paymentText:Record<string,string>={pending:'Bekliyor',authorized:'Yetkilendirildi',captured:'Ödendi',partially_refunded:'Kısmi geri ödeme',refunded:'Geri ödendi',failed:'Başarısız'};

export default function OrdersPanel(){
 const[page,setPage]=useState<any>(null);const[detail,setDetail]=useState<any>(null);const[error,setError]=useState('');const[loading,setLoading]=useState(true);const[returnOrderId,setReturnOrderId]=useState<string|null>(null);const[returnDetailId,setReturnDetailId]=useState<string|null>(null);
 const orderDialogRef=useDialogA11y(()=>setDetail(null),Boolean(detail));
 async function load(){try{setLoading(true);setError('');setPage(await listOrders());}catch(e:any){setError(e?.message||'Siparişler yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function open(id:string){try{setError('');setDetail(await getOrderDetail(id));}catch(e:any){setError(e?.message||'Sipariş detayı yüklenemedi.');}}
 async function refreshDetail(id:string){try{setDetail(await getOrderDetail(id));await load();}catch(e:any){setError(e?.message||'Sipariş detayı yenilenemedi.');}}
 async function cancel(id:string){try{await cancelOrder(id);setDetail(null);await load();}catch(e:any){setError(e?.message||'Sipariş iptal edilemedi.');}}
 if(loading)return<LoadingState label="Siparişler yükleniyor"/>;
 const activeReturn=detail?.returns?.find((r:any)=>['requested','under_review','approved','in_transit','received'].includes(r.status));
 return<Panel title="Siparişlerim" description="Sipariş, ödeme, kargo, iade ve geri ödeme durumlarını tek yerden izleyin.">
  {error?<ErrorState message={error} onRetry={load}/>:null}
  {!page?.items?.length?<EmptyState title="Henüz sipariş yok" body="Sipariş verdiğinizde tüm durum geçmişi burada görünecek."/>:<div className="space-y-3">{page.items.map((o:any)=><button key={o.id} onClick={()=>void open(o.id)} className="min-h-14 w-full rounded-xl border border-gray-200 p-4 text-left dark:border-gray-700"><div className="flex justify-between gap-3"><div><div className="font-bold">{o.orderNumber}{o.gift?<span className="text-xs text-brand-gold"> • Hediye</span>:null}</div><div className="mt-1 text-sm text-gray-500">{statusText[o.status]||o.status} • {o.itemCount} ürün</div>{o.trackingNumber?<div className="mt-1 text-xs text-gray-500">Takip: {o.trackingNumber}</div>:null}</div><div className="font-bold"><Money minor={o.totalMinor} currency={o.currency}/></div></div></button>)}</div>}

  {detail?<div role="dialog" aria-modal="true" aria-label="Sipariş detayı" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4"><div ref={orderDialogRef} tabIndex={-1} className="mx-auto mt-6 max-w-2xl rounded-2xl bg-white p-5 outline-none dark:bg-gray-900">
   <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{detail.orderNumber}</h3><p className="text-sm text-gray-500">{statusText[detail.status]||detail.status}</p><p className="mt-1 text-xs text-gray-500">Ödeme: {paymentText[detail.paymentStatus]||detail.paymentStatus}</p></div><button onClick={()=>setDetail(null)} aria-label="Sipariş detayını kapat" className="min-h-11 rounded-lg border px-4">Kapat</button></div>

   <section className="mt-5" aria-labelledby="order-items-title"><h4 id="order-items-title" className="font-bold">Ürünler</h4><div className="mt-2 space-y-3">{detail.items?.map((i:any)=><div key={i.id} className="rounded-xl border p-3"><div className="font-semibold">{i.productName}</div><div className="text-sm text-gray-500">{i.variantName||'Standart'} • {i.quantity} adet</div><div className="mt-1 font-bold"><Money minor={i.lineTotalMinor} currency={detail.currency}/></div></div>)}</div></section>

   {detail.gift?<div className="mt-5 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-4"><div className="font-bold">Hediye bilgisi</div><p className="mt-1 text-sm">Alıcı: {detail.gift.recipientName}</p>{detail.gift.message?<p className="mt-2 text-sm italic">“{detail.gift.message}”</p>:null}</div>:null}

   {detail.shipments?.length?<section className="mt-5" aria-labelledby="shipments-title"><h4 id="shipments-title" className="font-bold">Kargo</h4>{detail.shipments.map((s:any)=><div key={s.id} className="mt-2 rounded-xl border p-3 text-sm"><div>{s.carrier||'Kargo'} • {s.status}</div>{s.trackingNumber?<div className="mt-1">Takip: {s.trackingNumber}</div>:null}{safeUrl(s.trackingUrl)?<a href={safeUrl(s.trackingUrl)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-green">Kargoyu takip et<ExternalLink className="ml-2 h-4 w-4"/></a>:null}</div>)}</section>:null}

   {detail.statusHistory?.length?<section className="mt-5" aria-labelledby="history-title"><h4 id="history-title" className="font-bold">Sipariş geçmişi</h4><ol className="mt-2 space-y-2">{detail.statusHistory.map((h:any,index:number)=><li key={`${h.at}-${index}`} className="rounded-xl border p-3"><div className="text-sm font-semibold">{statusText[h.to]||h.to}</div><div className="text-xs text-gray-500">{formatDate(h.at)}</div>{h.note?<div className="mt-1 text-sm">{h.note}</div>:null}</li>)}</ol></section>:null}

   {detail.returns?.length?<section className="mt-5" aria-labelledby="returns-title"><h4 id="returns-title" className="font-bold">İade talepleri</h4><div className="mt-2 space-y-2">{detail.returns.map((r:any)=><button key={r.id} onClick={()=>setReturnDetailId(r.id)} className="min-h-14 w-full rounded-xl border p-3 text-left"><div className="flex justify-between gap-3"><div><div className="font-semibold">{r.returnNumber}</div><div className="text-sm text-gray-500">{returnStatusText[r.status]||r.status} • {formatDate(r.requestedAt)}</div></div><span className="font-semibold text-brand-green">Detay</span></div>{r.resolutionNote?<div className="mt-2 text-sm">{r.resolutionNote}</div>:null}</button>)}</div></section>:null}

   {detail.refunds?.length?<section className="mt-5" aria-labelledby="refunds-title"><h4 id="refunds-title" className="font-bold">Geri ödemeler</h4><div className="mt-2 space-y-2">{detail.refunds.map((r:any)=><div key={r.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{r.status}</span><Money minor={r.amountMinor} currency={r.currency}/></div>{r.processedAt?<div className="mt-1 text-xs text-gray-500">{formatDate(r.processedAt)}</div>:null}</div>)}</div></section>:null}

   <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="flex justify-between"><span>Ara toplam</span><Money minor={detail.subtotalMinor} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>İndirim</span><Money minor={-Number(detail.discountMinor||0)} currency={detail.currency}/></div><div className="mt-1 flex justify-between"><span>Kargo</span><Money minor={detail.shippingMinor} currency={detail.currency}/></div><div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Toplam</span><Money minor={detail.totalMinor} currency={detail.currency}/></div></div>

   {detail.status==='pending_payment'?<button onClick={()=>void cancel(detail.id)} className="mt-5 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700">Siparişi iptal et</button>:null}
   {['delivered','completed'].includes(detail.status)?<div className="mt-4">{activeReturn?<div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">Açık iade talebi: <button onClick={()=>setReturnDetailId(activeReturn.id)} className="min-h-11 font-bold underline">{activeReturn.returnNumber} — {returnStatusText[activeReturn.status]||activeReturn.status}</button></div>:<button onClick={()=>setReturnOrderId(detail.id)} className="min-h-12 w-full rounded-xl border border-brand-green font-bold text-brand-green"><RotateCcw className="mr-2 inline h-4 w-4"/>İade / sorun bildir</button>}</div>:null}
  </div></div>:null}

  {returnOrderId?<ReturnRequestDialog orderId={returnOrderId} onClose={()=>setReturnOrderId(null)} onSubmitted={async()=>{const id=returnOrderId;setReturnOrderId(null);await refreshDetail(id);}}/>:null}
  {returnDetailId?<ReturnDetailDialog returnId={returnDetailId} onClose={()=>setReturnDetailId(null)}/>:null}
 </Panel>;
}
function safeUrl(value?:string|null){if(!value)return'';try{const url=new URL(value);return url.protocol==='https:'?url.toString():'';}catch{return'';}}
function formatDate(value?:string|null){if(!value)return'—';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return value;}}
