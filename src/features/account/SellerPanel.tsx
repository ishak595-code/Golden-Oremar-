import React,{useEffect,useState}from'react';
import{getMyProducerApplicationDraft,getMyProducerDashboard,updateProducerInventory,withdrawProducerProductChange}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';

const ProducerOrdersPanel=React.lazy(()=>import('../producer-orders/ProducerOrdersPanel'));
const ProducerTraceabilityPanel=React.lazy(()=>import('../producer-traceability/ProducerTraceabilityPanel'));
const ProducerFinancePanel=React.lazy(()=>import('../producer-finance/ProducerFinancePanel'));

const applicationStatus:Record<string,string>={draft:'Taslak',submitted:'İncelemede',under_review:'İncelemede',needs_information:'Ek bilgi gerekiyor',approved:'Onaylandı',rejected:'Reddedildi',withdrawn:'Geri çekildi'};
const changeStatus:Record<string,string>={pending:'Onay bekliyor',approved:'Onaylandı',rejected:'Reddedildi',withdrawn:'Geri çekildi'};

function safeCount(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?Math.floor(parsed):0;}
function financeMinor(primary:unknown,fallback:unknown){const selected=primary??fallback;const parsed=Number(selected);return selected!=null&&Number.isSafeInteger(parsed)?parsed:Number.NaN;}
function financeCurrency(value:unknown){const currency=String(value||'').trim().toUpperCase();return/^[A-Z]{3}$/.test(currency)?currency:'';}

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
      {draft.rejection_reason?<p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{draft.rejection_reason}</p>:null}
      <button type="button" disabled={!onOpenApplication} onClick={onOpenApplication} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
        {draft.status==='draft'||draft.status==='needs_information'?'Başvuruya devam et':'Başvuruyu görüntüle'}
      </button>
    </div>:<EmptyState title="Henüz satıcı başvurunuz yok" body="Köy/üretim yeri, ürünler, üretim yöntemi ve gerekli belgelerle başvuru yapabilirsiniz."
      action={<button type="button" disabled={!onOpenApplication} onClick={onOpenApplication} className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Satıcı başvurusunu başlat</button>}/>}
   </Panel>;
 }

 if(subview!=='dashboard')return<React.Suspense fallback={<LoadingState label="Satıcı operasyonu yükleniyor"/>}>{subview==='orders'?<ProducerOrdersPanel onBack={()=>setSubview('dashboard')} onChanged={load}/>:subview==='traceability'?<ProducerTraceabilityPanel onBack={()=>setSubview('dashboard')} onChanged={load}/>:<ProducerFinancePanel onBack={()=>setSubview('dashboard')}/>}</React.Suspense>;

 const summary=dash?.summary||{};
 const trustLine=[dash?.profile?.is_verified?'Üretici doğrulandı':'',dash?.profile?.production_location||''].filter(Boolean).join(' • ');
 return<div className="space-y-5">
  {error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
  <Panel title={dash?.profile?.display_name||'Satıcı Paneli'} description="Sipariş, ürün, stok, izlenebilirlik ve finans operasyonlarınızı yönetin.">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Satıcı hesap özeti">
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{safeCount(summary.publishedProducts)}</div><div className="text-xs">Yayındaki ürün</div></div>
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{safeCount(summary.reviewProducts)}</div><div className="text-xs">İncelemede</div></div>
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{safeCount(summary.pendingChanges)}</div><div className="text-xs">Bekleyen değişiklik</div></div>
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xl font-bold">{safeCount(summary.lowStockVariants)}</div><div className="text-xs">Düşük stok</div></div>
   </div>
   {trustLine?<div className="mt-4 text-sm font-semibold text-brand-green">{trustLine}</div>:null}
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
   {!dash?.changeRequests?.length?<EmptyState title="Bekleyen değişiklik yok" body="Yayındaki bir üründe değişiklik yaptığınızda admin onayı için burada görünür."/>:<div className="space-y-3">{dash.changeRequests.map((r:any)=><div key={r.id} className="rounded-xl border p-4"><div className="font-bold">{r.productName}</div><div className="text-sm text-gray-500">Durum: {changeStatus[r.status]||r.status}</div>{r.reviewReason?<p className="mt-2 text-sm text-red-700 dark:text-red-300">{r.reviewReason}</p>:null}{r.status==='pending'?<WithdrawChangeButton requestId={r.id} productName={r.productName} onWithdrawn={load} onError={setError}/>:null}</div>)}</div>}
  </Panel>

  <Panel title="Lot Özeti"><div className="grid grid-cols-3 gap-2" aria-label="Lot durum özeti"><div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="font-bold">{safeCount(summary.draftBatches)}</div><div className="text-xs">Taslak</div></div><div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="font-bold">{safeCount(summary.reviewBatches)}</div><div className="text-xs">İncelemede</div></div><div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-800"><div className="font-bold">{safeCount(summary.releasedBatches)}</div><div className="text-xs">Yayınlandı</div></div></div></Panel>

  <Panel title="Finans Özeti">{!dash?.finance?.balances?.length?<p className="text-sm text-gray-500">Henüz finans hareketi yok.</p>:<div className="space-y-2">{dash.finance.balances.map((b:any,index:number)=>{const currency=financeCurrency(b?.currency);return <div key={`${currency||'unknown'}-${index}`} className="rounded-xl border p-3"><div className="text-sm text-gray-500">{currency||'Para birimi doğrulanamadı'}</div><div className="font-bold"><Money minor={financeMinor(b?.availableMinor,b?.availableToPayoutMinor)} currency={currency}/></div></div>;})}</div>}</Panel>
 </div>;
}

function WithdrawChangeButton({requestId,productName,onWithdrawn,onError}:{requestId:string;productName:string;onWithdrawn:()=>Promise<void>|void;onError:(message:string)=>void}){
 const[busy,setBusy]=useState(false);const[status,setStatus]=useState('');
 async function withdraw(){if(busy)return;try{setBusy(true);setStatus('');onError('');await withdrawProducerProductChange(requestId);setStatus(`${productName} değişiklik talebi geri çekildi.`);await onWithdrawn();}catch(e:any){onError(e?.message||'Değişiklik talebi geri çekilemedi.');}finally{setBusy(false);}}
 return<><button type="button" onClick={()=>void withdraw()} disabled={busy} aria-busy={busy} className="mt-3 min-h-11 rounded-lg border px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{busy?'Geri çekiliyor…':'Talebi geri çek'}</button>{status?<span role="status" aria-live="polite" className="sr-only">{status}</span>:null}</>;
}

function InventoryRow({item,onSaved}:{item:any;onSaved:()=>Promise<void>|void}){
 const[available,setAvailable]=useState(String(Number(item.availableQuantity??0)));const[reorder,setReorder]=useState(String(Number(item.reorderLevel??0)));const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[status,setStatus]=useState('');
 useEffect(()=>{setAvailable(String(Number(item.availableQuantity??0)));setReorder(String(Number(item.reorderLevel??0)));},[item.availableQuantity,item.reorderLevel,item.version]);
 async function save(){
  const normalizedAvailable=Number(available);const normalizedReorder=Number(reorder);const expectedVersion=Number(item.version);
  if(available.trim()===''||!Number.isSafeInteger(normalizedAvailable)||normalizedAvailable<0){setError('Toplam mevcut stok sıfır veya pozitif güvenli bir tam sayı olmalıdır.');return;}
  if(reorder.trim()===''||!Number.isSafeInteger(normalizedReorder)||normalizedReorder<0){setError('Düşük stok eşiği sıfır veya pozitif güvenli bir tam sayı olmalıdır.');return;}
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0){setError('Stok sürüm bilgisi geçersiz. Sayfayı yenileyip tekrar deneyin.');return;}
  try{setBusy(true);setError('');setStatus('');await updateProducerInventory({variantId:item.variantId,availableQuantity:normalizedAvailable,reorderLevel:normalizedReorder,expectedVersion});setStatus('Stok başarıyla güncellendi.');await onSaved();}catch(e:any){setError(e?.message||'Stok güncellenemedi.');}finally{setBusy(false);}
 }
 const sellable=safeCount(item.sellableQuantity);const reserved=safeCount(item.reservedQuantity);
 return<div className="rounded-xl border p-4" aria-busy={busy}><div className="font-bold">{item.productName} • {item.variantName}</div><div className="mt-1 text-sm text-gray-500">Satılabilir: {sellable} • Rezerve: {reserved}</div>{error?<div role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>:null}{status?<div role="status" aria-live="polite" className="mt-2 text-sm text-green-700 dark:text-green-300">{status}</div>:null}<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label><span className="text-xs font-semibold">Toplam mevcut</span><input type="number" inputMode="numeric" min="0" step="1" value={available} onChange={e=>setAvailable(e.target.value)} disabled={busy} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label><label><span className="text-xs font-semibold">Düşük stok eşiği</span><input type="number" inputMode="numeric" min="0" step="1" value={reorder} onChange={e=>setReorder(e.target.value)} disabled={busy} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label></div><button type="button" onClick={()=>void save()} disabled={busy} className="mt-3 min-h-11 w-full rounded-lg border font-bold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{busy?'Kaydediliyor…':'Stoğu güncelle'}</button></div>;
}
