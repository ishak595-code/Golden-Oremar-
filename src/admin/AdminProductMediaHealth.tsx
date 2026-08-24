import React,{useEffect,useState}from'react';
import{AlertTriangle,CheckCircle2,Database,ImageOff,RefreshCw}from'lucide-react';
import{supabase}from'../lib/supabase';

type AffectedProduct={productId:string;productName:string;status:string;active:boolean;imageId:string;storagePath:string;health:string};
type MediaHealth={totalImageRows:number;healthy:number;missing:number;invalid:number;orphan:number;lastScanAt:string|null;lastQuarantinedCount:number;lastStaleVerificationCount:number;affectedProducts:AffectedProduct[]};

function integer(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0;}
function text(value:unknown,max=1200){return typeof value==='string'?value.trim().slice(0,max):'';}
function normalize(value:unknown):MediaHealth{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Medya sağlık cevabı doğrulanamadı.');
 const row=value as Record<string,unknown>;
 const affected=Array.isArray(row.affectedProducts)?row.affectedProducts.slice(0,200).map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Etkilenen ürün kaydı doğrulanamadı.');
  const source=item as Record<string,unknown>;
  return{productId:text(source.productId,160),productName:text(source.productName,300)||'Ürün',status:text(source.status,40),active:source.active===true,imageId:text(source.imageId,160),storagePath:text(source.storagePath),health:text(source.health,80)};
 }):[];
 return{totalImageRows:integer(row.totalImageRows),healthy:integer(row.healthy),missing:integer(row.missing),invalid:integer(row.invalid),orphan:integer(row.orphan),lastScanAt:text(row.lastScanAt,80)||null,lastQuarantinedCount:integer(row.lastQuarantinedCount),lastStaleVerificationCount:integer(row.lastStaleVerificationCount),affectedProducts:affected};
}
function date(value:string|null){if(!value)return'Henüz taranmadı';const d=new Date(value);return Number.isNaN(d.getTime())?'Tarih doğrulanamadı':d.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'});}
function healthLabel(value:string){if(value==='missing_object')return'Object eksik';if(value==='invalid_path')return'Path geçersiz';if(value==='unverified_object')return'Binary doğrulanmadı';if(value==='invalid_object')return'Object doğrulaması bozuk';return value||'Bilinmiyor';}

export default function AdminProductMediaHealth(){
 const[data,setData]=useState<MediaHealth|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){try{setLoading(true);setError('');const{data:raw,error:rpcError}=await supabase.rpc('admin_product_media_health_v1');if(rpcError)throw rpcError;setData(normalize(raw));}catch(err){setError(err instanceof Error&&err.message.trim()?err.message:'Medya sağlığı yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 if(loading&&!data)return<section aria-labelledby="product-media-health-title" className="rounded-2xl border p-5"><div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-semibold text-gray-500"><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin"/>Ürün medya bütünlüğü yükleniyor…</div></section>;
 return<section aria-labelledby="product-media-health-title" className="rounded-2xl border bg-white p-4 dark:bg-gray-900 sm:p-5">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Database aria-hidden="true" className="h-5 w-5 text-brand-green"/><h3 id="product-media-health-title" className="text-lg font-black">Ürün Medya Bütünlüğü</h3></div><p className="mt-1 max-w-3xl text-sm text-gray-500">Storage object, DB görsel referansı ve binary doğrulama durumunu platform genelinde gösterir. Eksik veya doğrulanmamış medya yayın kapısını geçemez.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"><RefreshCw aria-hidden="true" className={`mr-2 inline h-4 w-4 ${loading?'animate-spin':''}`}/>Yenile</button></div>
  {error?<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
  {data?<><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{[
   ['Toplam',data.totalImageRows],['Healthy',data.healthy],['Missing',data.missing],['Invalid',data.invalid],['Orphan',data.orphan]
  ].map(([label,value])=><div key={String(label)} className="rounded-xl border bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>)}</div>
  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>Son tarama: <strong className="text-gray-700 dark:text-gray-200">{date(data.lastScanAt)}</strong></span><span>Son karantina: <strong>{data.lastQuarantinedCount}</strong></span><span>Temizlenen stale verification: <strong>{data.lastStaleVerificationCount}</strong></span></div>
  {!data.affectedProducts.length?<div className="mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"><CheckCircle2 aria-hidden="true" className="h-5 w-5"/>Ürün medya referanslarında açık bütünlük problemi yok.</div>:<div className="mt-4"><div className="mb-2 flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-300"><AlertTriangle aria-hidden="true" className="h-4 w-4"/>{data.affectedProducts.length} problemli medya kaydı gösteriliyor</div><div className="max-h-80 space-y-2 overflow-auto pr-1">{data.affectedProducts.map(row=><article key={`${row.imageId}:${row.storagePath}`} className="rounded-xl border p-3"><div className="flex gap-3"><ImageOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><div className="min-w-0"><div className="font-black">{row.productName}</div><div className="mt-1 text-xs text-gray-500">{row.status}{row.active?' · aktif':' · pasif'} · {healthLabel(row.health)}</div><div className="mt-1 break-all font-mono text-[11px] text-gray-500">{row.storagePath}</div></div></div></article>)}</div></div>}</>:null}
 </section>;
}
