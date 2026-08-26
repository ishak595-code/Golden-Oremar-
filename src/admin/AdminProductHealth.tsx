import React,{useEffect,useMemo,useState}from'react';
import{BookOpen,RefreshCw,Search,ShieldCheck}from'lucide-react';
import{adminListProducts,type AdminProduct}from'./productAdminApi';
import{catalogMediaHealthErrorMessage,getSuperAdminCatalogMediaHealth,type CatalogMediaHealth,type CatalogMediaHealthItem}from'./catalogMediaHealthApi';
import ProductPublishReadinessPanel from'./ProductPublishReadinessPanel';
import ProductHealthEditorForm from'../features/content/ProductHealthEditorForm';
import{editorPayloadFromPublished,getAdminProductHealthEditor,listAdminProductHealthChanges,productHealthErrorMessage,type AdminProductHealthEditor,type AdminProductHealthRequest}from'../features/content/productHealthEditorApi';

type Selection={productId:string;requestId:string|null};

export function AdminProductHealth(){
 const[products,setProducts]=useState<AdminProduct[]>([]);
 const[requests,setRequests]=useState<AdminProductHealthRequest[]>([]);
 const[mediaHealth,setMediaHealth]=useState<CatalogMediaHealth|null>(null);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');
 const[mediaError,setMediaError]=useState('');
 const[query,setQuery]=useState('');
 const[selected,setSelected]=useState<Selection|null>(null);
 const[editor,setEditor]=useState<AdminProductHealthEditor|null>(null);
 const[editorLoading,setEditorLoading]=useState(false);

 async function load(silent=false){
  try{
   if(!silent)setLoading(true);
   setError('');setMediaError('');
   const[coreResult,mediaResult]=await Promise.allSettled([
    Promise.all([adminListProducts(),listAdminProductHealthChanges()]),
    getSuperAdminCatalogMediaHealth(),
   ]);
   if(coreResult.status==='fulfilled'){setProducts(coreResult.value[0]);setRequests(coreResult.value[1]);}
   else setError(productHealthErrorMessage(coreResult.reason,'Ürün bilgi yönetimi yüklenemedi.'));
   if(mediaResult.status==='fulfilled')setMediaHealth(mediaResult.value);
   else{setMediaHealth(null);setMediaError(catalogMediaHealthErrorMessage(mediaResult.reason));}
  }finally{if(!silent)setLoading(false);}
 }

 useEffect(()=>{void load();},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase('tr-TR');const rows=products.filter(row=>row.status!=='archived');return q?rows.filter(row=>`${row.name} ${row.slug} ${row.producer_name}`.toLocaleLowerCase('tr-TR').includes(q)):rows;},[products,query]);
 async function open(selection:Selection){try{setSelected(selection);setEditorLoading(true);setError('');setEditor(await getAdminProductHealthEditor(selection.productId));}catch(err){setSelected(null);setEditor(null);setError(productHealthErrorMessage(err,'Ürün bilgi editörü açılamadı.'));}finally{setEditorLoading(false);}}
 async function finishEditor(){setSelected(null);setEditor(null);await load(true);}

 if(selected&&editorLoading)return<div role="status" className="rounded-2xl border p-8 text-center">Ürün bilgi editörü yükleniyor...</div>;
 if(selected&&editor){const proposal=selected.requestId?editor.requests.find(row=>row.requestId===selected.requestId)?.payload:null;const initial=proposal||editorPayloadFromPublished(editor.published);return<ProductHealthEditorForm mode="super_admin" productId={editor.productId} productName={`${editor.productName} · ${editor.producerName}`} initial={initial} requestId={selected.requestId} onBack={()=>{setSelected(null);setEditor(null);}} onDone={finishEditor}/>;}

 return<div className="space-y-6">
  <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="h-6 w-6 text-brand-green"/><h2 className="text-2xl font-black">Ürün İçerik ve Sağlık Kontrolü</h2></div><p className="mt-2 max-w-3xl text-sm text-gray-500">Super Admin bütün satıcıların ürün içeriğini, sağlık bilgisini ve yayın hazırlığını tek yüzeyde görür. Müşteriye teknik gate ifadeleri gösterilmez ve yayın kararı yalnız mevcut owner publish komutundan geçer.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50"><RefreshCw aria-hidden="true" className={`mr-2 inline h-4 w-4 ${loading?'animate-spin':''}`}/>Yenile</button></header>
  {error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>:null}
  <ProductPublishReadinessPanel onOpenProduct={productId=>void open({productId,requestId:null})}/>
  <CatalogMediaHealthPanel health={mediaHealth} error={mediaError}/>
  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-black">Bekleyen satıcı teklifleri <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs">{requests.length}</span></h3>{!requests.length?<p className="mt-2 text-sm text-amber-900">Bekleyen ürün bilgi teklifi yok.</p>:<div className="mt-3 grid gap-3 lg:grid-cols-2">{requests.map(row=><article key={row.requestId} className="rounded-xl border bg-white p-4"><div className="font-black">{row.productName}</div><div className="mt-1 text-sm text-gray-500">{row.producerName}</div><div className="mt-2 text-xs text-gray-500">Güncelleme: {formatDate(row.updatedAt)}</div><button type="button" onClick={()=>void open({productId:row.productId,requestId:row.requestId})} className="mt-3 min-h-11 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green">Teklifi incele</button></article>)}</div>}</section>
  <section><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-black">Tüm ürünler</h3><label className="relative w-full sm:max-w-md"><span className="sr-only">Ürün ara</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ürün veya satıcı ara" className="min-h-11 w-full rounded-xl border pl-10 pr-3"/></label></div>{loading?<div role="status" className="mt-4 rounded-2xl border p-8 text-center">Ürünler yükleniyor...</div>:!filtered.length?<div className="mt-4 rounded-2xl border p-8 text-center text-gray-500">Eşleşen ürün yok.</div>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{filtered.map(row=><article key={row.id} className="rounded-2xl border bg-white p-4 dark:bg-gray-800"><div className="flex gap-3"><BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-green"/><div className="min-w-0"><div className="font-black">{row.name}</div><div className="mt-1 text-sm text-gray-500">{row.producer_name} · {row.status}</div></div></div><button type="button" onClick={()=>void open({productId:row.id,requestId:null})} className="mt-3 min-h-11 rounded-xl border border-brand-green px-4 font-bold text-brand-green">Bilgileri aç / düzenle</button></article>)}</div>}</section>
 </div>;
}

function CatalogMediaHealthPanel({health,error}:{health:CatalogMediaHealth|null;error:string}){
 const summary=health?.summary;
 return<section className="rounded-2xl border bg-white p-4 dark:bg-gray-800" aria-labelledby="catalog-media-health-title">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 id="catalog-media-health-title" className="font-black">Katalog medya sağlığı</h3><p className="mt-1 text-sm text-gray-500">Yayın altyapısındaki gerçek Storage görsellerinin bütünlük özeti. Eksik, yetim veya doğrulanmamış dosyalar burada görünür.</p></div>{health?<div className="text-xs text-gray-500">Kontrol: {formatDate(health.scannedAt)}</div>:null}</div>
  {error?<div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>:null}
  {!error&&!summary?<div role="status" className="mt-3 rounded-xl border p-4 text-sm text-gray-500">Medya sağlık özeti yükleniyor...</div>:null}
  {summary?<><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><MediaMetric label="Sağlıklı" value={summary.healthy}/><MediaMetric label="Eksik" value={summary.missing}/><MediaMetric label="Yetim" value={summary.orphan}/><MediaMetric label="Geçersiz" value={summary.invalid}/></div><div className="mt-3 text-xs text-gray-500">Toplam {summary.total} medya kaydı · Son karantinaya alınan ürün: {health?.lastQuarantinedCount??0}</div>{health&&health.items.length?<div className="mt-4 space-y-2"><h4 className="text-sm font-black">Müdahale gereken kayıtlar</h4>{health.items.map((item,index)=><MediaIssue key={`${item.path}-${index}`} item={item}/>)}</div>:<p className="mt-4 text-sm font-semibold text-brand-green">Medya bütünlüğünde müdahale gerektiren kayıt yok.</p>}</>:null}
 </section>;
}
function MediaMetric({label,value}:{label:string;value:number}){return<div className="rounded-xl border p-3"><div className="text-xs font-semibold text-gray-500">{label}</div><div className="mt-1 text-2xl font-black tabular-nums">{value}</div></div>;}
function MediaIssue({item}:{item:CatalogMediaHealthItem}){return<div className="rounded-xl border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border px-2 py-0.5 text-xs font-bold">{mediaStatusLabel(item.status)}</span>{item.productName?<span className="font-bold">{item.productName}</span>:<span className="font-bold">Bağlı ürün yok</span>}</div><div className="mt-2 break-all text-xs text-gray-500">{item.path}</div></div>;}
function mediaStatusLabel(status:CatalogMediaHealthItem['status']){const labels:Record<CatalogMediaHealthItem['status'],string>={missing_object:'Dosya eksik',orphan_object:'Yetim dosya',invalid_path:'Geçersiz yol',invalid_mime:'Geçersiz MIME',invalid_size:'Geçersiz boyut',unverified_binary:'Binary doğrulanmamış'};return labels[status];}
function formatDate(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'Tarih doğrulanamadı':date.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'});}
