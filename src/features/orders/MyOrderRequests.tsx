import React,{useCallback,useEffect,useState}from'react';
import{MessageCircle}from'lucide-react';
import{formatMoney}from'../cart/checkoutHelpers';
import{listMyOrderRequests,type MyOrderRequest}from'./offlineOrderApi';
import{PENDING_ORDERS_EVENT,currentDeviceUserId,listPendingOrders,syncPendingOrders,type PendingOrder}from'./pendingOrders';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';

const STATUS:Record<string,string>={new:'Alındı',contacted:'İletişime geçildi',confirmed:'Onaylandı',paid:'Ödeme alındı',shipped:'Kargoda',completed:'Tamamlandı',cancelled:'İptal edildi'};
type Row={id:string;code:string;method:'whatsapp'|'bank_transfer';when:string;status:string;badge:string|null;lines:string[];total:string;hint:string|null};

function date(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'});}
function fromServer(r:MyOrderRequest):Row{return{id:r.idempotencyKey||r.reference,code:r.reference,method:r.method,when:date(r.createdAt),status:STATUS[r.status]||r.status,badge:null,lines:r.items.map(i=>`${i.quantity} × ${i.productName}${i.variantName?` (${i.variantName})`:''}`),total:formatMoney(r.totalMinor,r.currency),hint:[r.shippingMinor===null?'Kargo ücreti onayda belirlenir.':'',r.pricesVerified?'':'Fiyat mağaza onayıyla kesinleşir.'].filter(Boolean).join(' ')||null};}
function fromDevice(p:PendingOrder):Row{const total=p.lines.reduce((s,l)=>s+l.unitPriceMinor*l.quantity,0);return{id:p.key,code:p.reference||p.deviceCode,method:p.method,when:date(p.createdAt),status:p.status==='synced'?'Alındı':p.status==='failed'?'Kaydedilemedi':'Gönderildi',badge:p.status==='pending'?'WhatsApp ile gönderildi · eşitleme bekliyor':p.status==='failed'?'Sisteme kaydedilemedi; WhatsApp mesajınız mağazada':null,lines:p.lines.map(l=>`${l.quantity} × ${l.productName}${l.variantName?` (${l.variantName})`:''}`),total:formatMoney(total,p.lines[0]?.currency||'TRY'),hint:'Kargo ücreti onayda belirlenir.'};}

/** WhatsApp and Havale/EFT orders in Siparişlerim, including those still waiting on this device. */
export default function MyOrderRequests({onCount}:{onCount?:(count:number)=>void}){
 const[rows,setRows]=useState<Row[]>([]);
 const load=useCallback(async()=>{
  const userId=await currentDeviceUserId();
  if(listPendingOrders(userId).some(p=>p.status==='pending'))await syncPendingOrders(userId).catch(()=>0);
  const device=listPendingOrders(userId);
  let server:MyOrderRequest[]=[];let reached=false;
  if(userId){try{server=await listMyOrderRequests(30);reached=true;}catch{reached=false;}}
  const onServer=new Set(server.flatMap(r=>[r.idempotencyKey,r.reference]));
  /* Device records the server already lists are shown once; synced ones stay visible if the list could not load. */
  const local=device.filter(p=>!onServer.has(p.key)&&!(p.reference&&onServer.has(p.reference))&&(p.status!=='synced'||!reached));
  const next=[...local.map(fromDevice),...server.map(fromServer)];
  setRows(next);onCount?.(next.length);
 },[onCount]);
 useEffect(()=>{void load();const reload=()=>void load();window.addEventListener(PENDING_ORDERS_EVENT,reload);window.addEventListener(NETWORK_RESTORED_EVENT,reload);window.addEventListener('online',reload);return()=>{window.removeEventListener(PENDING_ORDERS_EVENT,reload);window.removeEventListener(NETWORK_RESTORED_EVENT,reload);window.removeEventListener('online',reload);};},[load]);
 if(!rows.length)return null;
 return<section aria-labelledby="my-order-requests" className="mb-5">
  <h3 id="my-order-requests" className="mb-2 flex items-center gap-2 text-base font-black"><MessageCircle aria-hidden="true" className="h-5 w-5 text-[#25D366]"/>WhatsApp ve Havale siparişleri</h3>
  <ul className="space-y-3">{rows.map(row=><li key={row.id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
   <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black">{row.code}</p><p className="text-xs text-gray-500">{row.method==='bank_transfer'?'Havale/EFT':'WhatsApp'}{row.when?` · ${row.when}`:''}</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold dark:bg-gray-800">{row.status}</span></div>
   {row.badge?<p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{row.badge}</p>:null}
   <ul className="mt-2 space-y-0.5 text-sm">{row.lines.map((line,index)=><li key={index}>{line}</li>)}</ul>
   <p className="mt-2 text-sm font-bold">Toplam: {row.total}</p>
   {row.hint?<p className="mt-1 text-xs text-gray-500">{row.hint}</p>:null}
  </li>)}</ul>
 </section>;
}
