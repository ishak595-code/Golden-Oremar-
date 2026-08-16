import React,{useEffect,useState}from'react';
import{ArrowLeft,ExternalLink,RefreshCw}from'lucide-react';
import{getMyReturnDetail,getReturnEvidenceSignedUrl}from'./returnsApi';
import{ErrorState,LoadingState,Money}from'./ui';
import{useDialogA11y}from'./useDialogA11y';

const statusLabels:Record<string,string>={requested:'Talep alındı',under_review:'İnceleniyor',approved:'Onaylandı',in_transit:'İade kargoda',received:'İade teslim alındı',rejected:'Reddedildi',refunded:'Geri ödeme yapıldı',closed:'Kapandı'};
const reasonLabels:Record<string,string>={damaged:'Ürün hasarlı geldi',wrong_item:'Yanlış ürün gönderildi',quality_issue:'Kalite / tazelik sorunu',missing_item:'Siparişte ürün eksik',changed_mind:'Fikrim değişti',delivery_issue:'Teslimat kaynaklı sorun',other:'Diğer'};

export default function ReturnDetailDialog({returnId,onClose}:{returnId:string;onClose:()=>void}){
 const dialogRef=useDialogA11y(onClose);
 const[data,setData]=useState<any>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 async function load(){try{setLoading(true);setError('');setData(await getMyReturnDetail(returnId));}catch(e:any){setError(e?.message||'İade detayı yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[returnId]);
 async function openEvidence(path:string){try{const url=await getReturnEvidenceSignedUrl(path);window.open(url,'_blank','noopener,noreferrer');}catch(e:any){setError(e?.message||'Kanıt dosyası açılamadı.');}}
 if(loading)return<div role="dialog" aria-modal="true" aria-label="İade detayı"><LoadingState label="İade detayı yükleniyor"/></div>;
 return<div role="dialog" aria-modal="true" aria-labelledby="return-detail-title" className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-4"><div ref={dialogRef} tabIndex={-1} className="mx-auto mt-4 max-w-2xl rounded-2xl bg-white p-5 outline-none dark:bg-gray-900">
  <div className="flex items-start justify-between gap-3"><div><h3 id="return-detail-title" className="text-xl font-bold">{data?.returnNumber||'İade talebi'}</h3><p className="mt-1 text-sm font-semibold text-brand-green">{statusLabels[data?.status]||data?.status}</p></div><div className="flex gap-2"><button onClick={()=>void load()} className="min-h-11 rounded-xl border px-3" aria-label="İade detayını yenile"><RefreshCw className="h-4 w-4"/></button><button onClick={onClose} className="min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft className="mr-2 inline h-4 w-4"/>Geri</button></div></div>
  {error?<div className="mt-4"><ErrorState message={error} onRetry={load}/></div>:null}
  <div className="mt-5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="text-sm text-gray-500">Neden</div><div className="font-semibold">{reasonLabels[data?.reasonCode]||data?.reasonCode}</div><p className="mt-2 whitespace-pre-wrap text-sm">{data?.customerMessage}</p></div>
  {data?.reviewReason?<div className="mt-4 rounded-xl border border-red-200 p-4"><div className="font-bold">İnceleme notu</div><p className="mt-1 text-sm">{data.reviewReason}</p></div>:null}
  {data?.resolutionNote?<div className="mt-4 rounded-xl border p-4"><div className="font-bold">Çözüm</div><p className="mt-1 text-sm">{data.resolutionNote}</p></div>:null}
  <div className="mt-5"><h4 className="font-bold">İade edilen ürünler</h4><div className="mt-2 space-y-3">{(data?.items||[]).map((item:any)=><article key={item.id} className="rounded-xl border p-4"><div className="font-semibold">{item.productName}</div><div className="text-sm text-gray-500">{item.variantName||'Standart'} • {item.quantity} adet</div>{item.refundAmountMinor!=null?<div className="mt-2 font-bold"><Money minor={item.refundAmountMinor} currency={item.currency||'TRY'}/></div>:null}{item.evidencePaths?.length?<div className="mt-3"><div className="text-sm font-semibold">Kanıt dosyaları</div><div className="mt-2 flex flex-wrap gap-2">{item.evidencePaths.map((path:string,index:number)=><button key={path} onClick={()=>void openEvidence(path)} className="min-h-11 rounded-lg border px-3 text-sm font-semibold">Kanıt {index+1}<ExternalLink className="ml-2 inline h-4 w-4"/></button>)}</div></div>:null}</article>)}</div></div>
  {data?.refunds?.length?<div className="mt-5"><h4 className="font-bold">Geri ödeme</h4><div className="mt-2 space-y-2">{data.refunds.map((refund:any)=><div key={refund.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{refund.status}</span><Money minor={refund.amountMinor} currency={refund.currency}/></div>{refund.processedAt?<div className="mt-1 text-xs text-gray-500">{formatDate(refund.processedAt)}</div>:null}</div>)}</div></div>:null}
  <div className="mt-5 text-xs text-gray-500">Talep: {formatDate(data?.requestedAt)}{data?.reviewedAt?` • İnceleme: ${formatDate(data.reviewedAt)}`:''}{data?.closedAt?` • Kapanış: ${formatDate(data.closedAt)}`:''}</div>
 </div></div>;
}
function formatDate(value?:string|null){if(!value)return'—';try{return new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return value;}}
