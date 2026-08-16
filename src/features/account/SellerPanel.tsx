
import React,{useEffect,useState}from'react';
import{getMyProducerApplicationDraft,getMyProducerDashboard,updateProducerInventory,withdrawProducerProductChange}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';

export default function SellerPanel({
 producer,onOpenApplication,onOpenProductManager
}:{producer:any|null;onOpenApplication?:()=>void;onOpenProductManager?:()=>void}){
 const[dash,setDash]=useState<any>(null);const[draft,setDraft]=useState<any>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 async function load(){
  try{
   setLoading(true);setError('');
   if(producer){setDash(await getMyProducerDashboard());setDraft(null);}
   else{setDraft(await getMyProducerApplicationDraft());setDash(null);}
  }catch(e:any){setError(e?.message||'Satıcı bilgileri yüklenemedi.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[producer?.id]);
 if(loading)return<LoadingState label="Satıcı hesabı yükleniyor"/>;
 if(error)return<ErrorState message={error} onRetry={load}/>;

 if(!producer){
   return<Panel title="Satıcı Ol" description="Golden Oremar satıcı başvuruları doğrulama ve belge incelemesinden geçer.">
    {draft?<div className="rounded-xl border p-4">
      <div className="font-bold">Başvuru durumu: {draft.status}</div>
      <p className="mt-2 text-sm text-gray-500">{draft.public_name||draft.brand_name||'Satıcı başvurunuz'}</p>
      {draft.rejection_reason?<p className="mt-2 text-sm text-red-700">{draft.rejection_reason}</p>:null}
      <button onClick={onOpenApplication} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white">
        {draft.status==='draft'||draft.status==='needs_information'?'Başvuruya devam et':'Başvuruyu görüntüle'}
      </button>
    </div>:<EmptyState title="Henüz satıcı başvurunuz yok" body="Köy/üretim yeri, ürünler, üretim yöntemi ve gerekli belgelerle başvuru yapabilirsiniz."
      action={<button onClick={onOpenApplication} className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white">Satıcı başvurusunu başlat</button>}/>}
   </Panel>;
 }

 const summary=dash?.summary||{};
 return<div className="space-y-5">
  <Panel title={dash?.profile?.display_name||'Satıcı Paneli'} description="Ürün, stok, izlenebilirlik ve finans özetinizi yönetin.">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3"><div className="text-xl font-bold">{summary.publishedProducts||0}</div><div className="text-xs">Yayındaki ürün</div></div>
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3"><div className="text-xl font-bold">{summary.reviewProducts||0}</div><div className="text-xs">İncelemede</div></div>
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3"><div className="text-xl font-bold">{summary.pendingChanges||0}</div><div className="text-xs">Bekleyen değişiklik</div></div>
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3"><div className="text-xl font-bold">{summary.lowStockVariants||0}</div><div className="text-xs">Düşük stok</div></div>
   </div>
   <div className="mt-4 text-sm font-semibold text-brand-green">
    {dash?.profile?.is_verified?'Üretici doğrulandı':''}{dash?.profile?.production_location?' • '+dash.profile.production_location:''}
   </div>
   <button onClick={onOpenProductManager} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white">Ürün yönetimini aç</button>
  </Panel>

  <Panel title="Stok Yönetimi" description="Rezervasyondaki müşteri stoğu korunur; güncelleme sürüm kontrollüdür.">
   {!dash?.inventory?.length?<EmptyState title="Stok kaydı yok" body="Ürün varyantları oluştuğunda burada görünecek."/>:
   <div className="space-y-3">{dash.inventory.map((i:any)=><InventoryRow key={i.variantId} item={i} onSaved={load}/>)}</div>}
  </Panel>

  <Panel title="Bekleyen Ürün Değişiklikleri">
   {!dash?.changeRequests?.length?<EmptyState title="Bekleyen değişiklik yok" body="Yayındaki bir üründe değişiklik yaptığınızda admin onayı için burada görünür."/>:
   <div className="space-y-3">{dash.changeRequests.map((r:any)=><div key={r.id} className="rounded-xl border p-4">
    <div className="font-bold">{r.productName}</div><div className="text-sm text-gray-500">Durum: {r.status}</div>
    {r.reviewReason?<p className="mt-2 text-sm text-red-700">{r.reviewReason}</p>:null}
    {r.status==='pending'?<button onClick={async()=>{await withdrawProducerProductChange(r.id);await load();}} className="mt-3 min-h-11 rounded-lg border px-3 font-semibold">Talebi geri çek</button>:null}
   </div>)}</div>}
  </Panel>

  <Panel title="Lot ve İzlenebilirlik">
   <div className="grid grid-cols-3 gap-2">
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center"><div className="font-bold">{summary.draftBatches||0}</div><div className="text-xs">Taslak</div></div>
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center"><div className="font-bold">{summary.reviewBatches||0}</div><div className="text-xs">İncelemede</div></div>
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-center"><div className="font-bold">{summary.releasedBatches||0}</div><div className="text-xs">Yayınlandı</div></div>
   </div>
  </Panel>

  <Panel title="Finans">
   {!dash?.finance?.balances?.length?<p className="text-sm text-gray-500">Henüz finans hareketi yok.</p>:
   <div className="space-y-2">{dash.finance.balances.map((b:any,index:number)=><div key={index} className="rounded-xl border p-3">
    <div className="text-sm text-gray-500">{b.currency||'TRY'}</div>
    <div className="font-bold"><Money minor={b.availableMinor||b.available_minor||0} currency={b.currency||'TRY'}/></div>
   </div>)}</div>}
  </Panel>
 </div>;
}

function InventoryRow({item,onSaved}:{item:any;onSaved:()=>Promise<void>|void}){
 const[available,setAvailable]=useState(Number(item.availableQuantity||0));const[reorder,setReorder]=useState(Number(item.reorderLevel||0));const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function save(){
  try{setBusy(true);setError('');await updateProducerInventory({variantId:item.variantId,availableQuantity:available,reorderLevel:reorder,expectedVersion:Number(item.version)});await onSaved();}
  catch(e:any){setError(e?.message||'Stok güncellenemedi.');}finally{setBusy(false);}
 }
 return<div className="rounded-xl border p-4">
  <div className="font-bold">{item.productName} — {item.variantName}</div>
  <div className="mt-1 text-sm text-gray-500">Satılabilir: {item.sellableQuantity} • Rezerve: {item.reservedQuantity}</div>
  {error?<div role="alert" className="mt-2 text-sm text-red-700">{error}</div>:null}
  <div className="mt-3 grid grid-cols-2 gap-3">
   <label><span className="text-xs font-semibold">Toplam mevcut</span><input type="number" min="0" value={available} onChange={e=>setAvailable(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3"/></label>
   <label><span className="text-xs font-semibold">Düşük stok eşiği</span><input type="number" min="0" value={reorder} onChange={e=>setReorder(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3"/></label>
  </div>
  <button onClick={save} disabled={busy} className="mt-3 min-h-11 w-full rounded-lg border font-bold disabled:opacity-50">{busy?'Kaydediliyor…':'Stoğu güncelle'}</button>
 </div>;
}
