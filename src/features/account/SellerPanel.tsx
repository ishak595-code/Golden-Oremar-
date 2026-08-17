import React,{useEffect,useState}from'react';
import{getMyProducerApplicationDraft,getMyProducerDashboard,updateProducerInventory,withdrawProducerProductChange}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';

const ProducerOrdersPanel=React.lazy(()=>import('../producer-orders/ProducerOrdersPanel'));
const ProducerTraceabilityPanel=React.lazy(()=>import('../producer-traceability/ProducerTraceabilityPanel'));
const ProducerFinancePanel=React.lazy(()=>import('../producer-finance/ProducerFinancePanel'));

const applicationStatus:Record<string,string>={draft:'Taslak',submitted:'İncelemede',under_review:'İncelemede',needs_information:'Ek bilgi gerekiyor',approved:'Onaylandı',rejected:'Reddedildi',withdrawn:'Geri çekildi'};
const changeStatus:Record<string,string>={pending:'Onay bekliyor',approved:'Onaylandı',rejected:'Reddedildi',withdrawn:'Geri çekildi'};

export default function SellerPanel({
 producer,onOpenApplication,onOpenProductManager
}:{producer:any|null;onOpenApplication?:()=>void;onOpenProductManager?:()=>void}){
 const[dash,setDash]=useState<any>(null);const[draft,setDraft]=useState<any>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[subview,setSubview]=useState<'dashboard'|'orders'|'traceability'|'finance'>('dashboard');
 async function load(){
  try{
   setLoading(true);setError('');
   if(producer){setDash(await getMyProducerDashboard());setDraft(null);}
   else{setDraft(await getMyProducerApplicationDraft());setDash(null);}
  }catch(e:any){setError(e?.message||'Satıcı bilgileri yüklenemedi.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{setSubview('dashboard');void load();},[producer?.id]);
 if(loading&&subview==='dashboard')return<LoadingState label="Satıcı hesabı yükleniyor"/>;
 if(error&&subview==='dashboard')return<ErrorState message={error} onRetry={load}/>;

 if(!producer){
   return<Panel title="Satıcı Ol" description="Golden Oremar satıcı başvuruları doğrulama ve belge incelemesinden geçer.">
    {draft?<div className="rounded-xl border p-4">
      <div className="font-bold">Başvuru durumu: {applicationStatus[draft.status]||draft.status}</div>
      <p className="mt-2 text-sm text-gray-500">{draft.public_name||draft.brand_name||'Satıcı başvurunuz'}</p>
      {draft.rejection_reason?<p className="mt-2 text-sm text-red-700 dark:text-red-300">{draft.rejection_reason}</p>:null}
      <button type="button" disabled={!onOpenApplication} onClick={onOpenApplication} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
        {draft.status==='draft'||draft.status==='needs_information'?'Başvuruya devam et':'Başvuruyu görüntüle'}
      </button>
    </div>:<EmptyState title="Henüz satıcı başvurunuz yok" body="Köy/üretim yeri, ürünler, üretim yöntemi ve gerekli belgelerle başvuru yapabilirsiniz."
      action={<button type="button" disabled={!onOpenApplication} onClick={onOpenApplication} className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Satıcı başvurusunu başlat</button>}/>}
   </Panel>;
 }

 if(subview!=='dashboard')return<React.Suspense fallback={<LoadingState label="Satıcı operasyonu yükleniyor"/>}>{subview==='orders'?<ProducerOrdersPanel onBack={()=>setSubview('dashboard')} onChanged={load}/>:subview==='traceability'?<ProducerTraceabilityPanel onBack={()=>setSubview('dashboard')} onChanged={load}/>:<ProducerFinancePanel onBack={()=>setSubview('dashboard')}/>}</React.Suspense>;

 const summary=dash?.summary||{};
 return<div className="space-y-5">
  <Panel title={dash?.profile?.display_name||'Satıcı Paneli'} description="Sipariş, ürün, stok, izlenebilirlik ve finans operasyonlarınızı yönetin.">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{summary.publishedProducts||0}</div><div className="text-xs">Yayındaki ürün</div></div>
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{summary.reviewProducts||0}</div><div className="text-xs">İncelemede</div></div>
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{summary.pendingChanges||0}</div><div className="text-xs">Bekleyen değişiklik</div></div>
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{summary.lowStockVariants||0}</div><div className="text-xs">Düşük stok</div></div>
   </div>
   <div className="mt-4 text-sm font-semibold text-brand-green">{dash?.profile?.is_verified?'Üretici doğrulandı':''}{dash?.profile?.production_location?' • '+dash.profile.production_location:''}</div>
  </Panel>

  <section aria-labelledby="seller-operations-title"><h2 id="seller-operations-title" className="mb-3 text-lg font-bold">Operasyonlar</h2><div className="grid gap-3 sm:grid-cols-2">
   <button type="button" onClick={()=>setSubview('orders')} className="min-h-20 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><div className="font-bold">Siparişler</div><div className="mt-1 text-sm text-gray-500">Size ait ödenmiş kalemleri hazırlayın ve gerçek takip numarasıyla kargoya verin.</div><span className="mt-2 inline-block font-semibold text-brand-green">Sipariş operasyonunu aç</span></button>
   <button type="button" disabled={!onOpenProductManager} onClick={onOpenProductManager} className="min-h-20 rounded-2xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><div className="font-bold">Ürün Yönetimi</div><div className="mt-1 text-sm text-gray-500">Yeni ürün, varyant ve yayın değişikliklerini yönetin.</div><span className="mt-2 inline-block font-semibold text-brand-green">Ürün yönetimini aç</span></button>
   <button type="button" onClick={()=>setSubview('traceability')} className="min-h-20 rounded-2xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><div className="font-bold">Lot & İzlenebilirlik</div><div className="mt-1 text-sm text-gray-500">Hasat, üretim, köy, parti olayları ve yayınlanan trace kodları.</div><span className="mt-2 inline-block font-semibold text-brand-green">Lot yönetimini aç</span></button>
   <button type="button" onClick={()=>setSubview('finance')} className="min-h-20 rounded-2xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><div className="font-bold">Finans</div><div className="mt-1 text-sm text-gray-500">Gerçek bakiye ve payout geçmişini görüntüleyin.</div><span className="mt-2 inline-block font-semibold text-brand-green">Finans detaylarını aç</span></button>
  </div></section>

  <Panel title="Stok Yönetimi" description="Rezervasyondaki müşteri stoğu korunur; güncelleme sürüm kontrollüdür.">
   {!dash?.inventory?.length?<EmptyState title="Stok kaydı yok" body="Ürün varyantları oluştuğunda burada görünecek."/>:<div className="space-y-3">{dash.inventory.map((i:any)=><InventoryRow key={i.variantId} item={i} onSaved={load}/>)}</div>}
  </Panel>

  <Panel title="Bekleyen Ürün Değişiklikleri">
   {!dash?.changeRequests?.length?<EmptyState title="Bekleyen değişiklik yok" body="Yayındaki bir üründe değişiklik yaptığınızda admin onayı için burada görünür."/>:<div className="space-y-3">{dash.changeRequests.map((r:any)=><div key={r.id} className="rounded-xl border p-4"><div className="font-bold">{r.productName}</div><div className="text-sm text-gray-500">Durum: {changeStatus[r.status]||r.status}</div>{r.reviewReason?<p className="mt-2 text-sm text-red-700 dark:text-red-300">{r.reviewReason}</p>:null}{r.status==='pending'?<button type="button" onClick={async()=>{try{setError('');await withdrawProducerProductChange(r.id);await load();}catch(e:any){setError(e?.message||'Değişiklik talebi geri çekilemedi.');}}} className="mt-3 min-h-11 rounded-lg border px-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Talebi geri çek</button>:null}</div>)}</div>}
  </Panel>

  <Panel title="Lot Özeti"><div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="font-bold">{summary.draftBatches||0}</div><div className="text-xs">Taslak</div></div><div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="font-bold">{summary.reviewBatches||0}</div><div className="text-xs">İncelemede</div></div><div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="font-bold">{summary.releasedBatches||0}</div><div className="text-xs">Yayınlandı</div></div></div></Panel>

  <Panel title="Finans Özeti">{!dash?.finance?.balances?.length?<p className="text-sm text-gray-500">Henüz finans hareketi yok.</p>:<div className="space-y-2">{dash.finance.balances.map((b:any,index:number)=><div key={`${b.currency||'TRY'}-${index}`} className="rounded-xl border p-3"><div className="text-sm text-gray-500">{b.currency||'TRY'}</div><div className="font-bold"><Money minor={b.availableMinor||b.availableToPayoutMinor||0} currency={b.currency||'TRY'}/></div></div>)}</div>}</Panel>
 </div>;
}

function InventoryRow({item,onSaved}:{item:any;onSaved:()=>Promise<void>|void}){
 const[available,setAvailable]=useState(Number(item.availableQuantity||0));const[reorder,setReorder]=useState(Number(item.reorderLevel||0));const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function save(){
  const normalizedAvailable=Number(available);const normalizedReorder=Number(reorder);
  if(!Number.isInteger(normalizedAvailable)||normalizedAvailable<0){setError('Toplam mevcut stok sıfır veya pozitif tam sayı olmalıdır.');return;}
  if(!Number.isInteger(normalizedReorder)||normalizedReorder<0){setError('Düşük stok eşiği sıfır veya pozitif tam sayı olmalıdır.');return;}
  try{setBusy(true);setError('');await updateProducerInventory({variantId:item.variantId,availableQuantity:normalizedAvailable,reorderLevel:normalizedReorder,expectedVersion:Number(item.version)});await onSaved();}catch(e:any){setError(e?.message||'Stok güncellenemedi.');}finally{setBusy(false);}
 }
 return<div className="rounded-xl border p-4"><div className="font-bold">{item.productName} • {item.variantName}</div><div className="mt-1 text-sm text-gray-500">Satılabilir: {item.sellableQuantity} • Rezerve: {item.reservedQuantity}</div>{error?<div role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>:null}<div className="mt-3 grid grid-cols-2 gap-3"><label><span className="text-xs font-semibold">Toplam mevcut</span><input type="number" inputMode="numeric" min="0" step="1" value={available} onChange={e=>setAvailable(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3"/></label><label><span className="text-xs font-semibold">Düşük stok eşiği</span><input type="number" inputMode="numeric" min="0" step="1" value={reorder} onChange={e=>setReorder(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3"/></label></div><button type="button" onClick={()=>void save()} disabled={busy} className="mt-3 min-h-11 w-full rounded-lg border font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{busy?'Kaydediliyor…':'Stoğu güncelle'}</button></div>;
}
