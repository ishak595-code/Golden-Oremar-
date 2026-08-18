import React,{useEffect,useMemo,useState}from'react';
import{CreditCard,Pencil,Plus,ShieldCheck,Star,Trash2,X}from'lucide-react';
import{listPaymentActivity}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';
import{formatAccountDate,paymentMethodLabel as paymentActivityMethodLabel,paymentStatusLabel,providerLabel}from'./presentation';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import{
 getPaymentReadiness,
 listMyPaymentMethods,
 paymentMethodLabel,
 removeMyPaymentMethod,
 setMyDefaultPaymentMethod,
 updateMyPaymentMethodMetadata,
 type PaymentReadiness,
 type SavedPaymentMethod,
}from'../payments/api';

const PAGE_SIZE=20;
function verifiedMinor(value:unknown){const parsed=Number(value);return Number.isSafeInteger(parsed)?parsed:null;}
function verifiedCurrency(value:unknown){const normalized=String(value||'').trim().toUpperCase();return /^[A-Z]{3}$/.test(normalized)?normalized:null;}
function paymentKey(item:any,index:number){
 const id=String(item?.id||'').trim();
 if(id)return`id:${id}`;
 return`fallback:${String(item?.orderNumber||'')}|${String(item?.processedAt||item?.createdAt||item?.updatedAt||'')}|${String(item?.amountMinor??'')}|${String(item?.provider||'')}|${String(item?.paymentMethodType||'')}|${index}`;
}
function safeDisplay(value:unknown,max=120){return typeof value==='string'?value.trim().slice(0,max):'';}

export default function PaymentsPanel(){
 const[page,setPage]=useState<any>(null);
 const[methods,setMethods]=useState<SavedPaymentMethod[]>([]);
 const[readiness,setReadiness]=useState<PaymentReadiness|null>(null);
 const[loading,setLoading]=useState(true);
 const[loadingMore,setLoadingMore]=useState(false);
 const[error,setError]=useState('');
 const[loadMoreError,setLoadMoreError]=useState('');
 const[methodStatus,setMethodStatus]=useState('');
 const[methodBusyId,setMethodBusyId]=useState<string|null>(null);
 const[editing,setEditing]=useState<SavedPaymentMethod|null>(null);
 const[editNickname,setEditNickname]=useState('');
 const[editBillingName,setEditBillingName]=useState('');
 const[editCountry,setEditCountry]=useState('');
 const[editPostal,setEditPostal]=useState('');
 const[editError,setEditError]=useState('');
 const[removeCandidate,setRemoveCandidate]=useState<SavedPaymentMethod|null>(null);
 const[addOpen,setAddOpen]=useState(false);
 const editDialogRef=useAccessibleDialog<HTMLFormElement>(!!editing,()=>{if(!methodBusyId)setEditing(null);});
 const removeDialogRef=useAccessibleDialog<HTMLDivElement>(!!removeCandidate,()=>{if(!methodBusyId)setRemoveCandidate(null);});
 const addDialogRef=useAccessibleDialog<HTMLDivElement>(addOpen,()=>setAddOpen(false));

 async function load(reset=true){
  const currentItems=Array.isArray(page?.items)?page.items:[];
  const offset=reset?0:currentItems.length;
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   if(reset)setError('');else setLoadMoreError('');
   if(reset){
    const[next,methodsResult,readinessResult]=await Promise.all([
     listPaymentActivity(PAGE_SIZE,0),
     listMyPaymentMethods(),
     getPaymentReadiness(),
    ]);
    setPage({...next,items:Array.isArray(next?.items)?next.items:[]});
    setMethods(methodsResult);
    setReadiness(readinessResult);
   }else{
    const next=await listPaymentActivity(PAGE_SIZE,offset);
    const nextItems=Array.isArray(next?.items)?next.items:[];
    setPage((previous:any)=>{
     if(!previous)return{...next,items:nextItems};
     const previousItems=Array.isArray(previous?.items)?previous.items:[];
     const unique=new Map<string,any>();
     previousItems.forEach((item:any,index:number)=>unique.set(paymentKey(item,index),item));
     nextItems.forEach((item:any,index:number)=>unique.set(paymentKey(item,offset+index),item));
     return{...next,offset:0,items:Array.from(unique.values())};
    });
   }
  }catch(e:any){
   const message=e?.message||'Ödeme bilgileri yüklenemedi.';
   if(reset)setError(message);else setLoadMoreError(message);
  }finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }

 async function refreshMethods(){
  const[nextMethods,nextReadiness]=await Promise.all([listMyPaymentMethods(),getPaymentReadiness()]);
  setMethods(nextMethods);setReadiness(nextReadiness);
 }

 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{const restore=()=>{setLoadMoreError('');void load(true);};window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[]);

 function openEdit(method:SavedPaymentMethod){
  setMethodStatus('');setEditError('');setEditing(method);
  setEditNickname(method.nickname||'');
  setEditBillingName(method.billingName||'');
  setEditCountry(method.billingCountryCode||'');
  setEditPostal(method.billingPostalCode||'');
 }

 async function saveMetadata(event:React.FormEvent){
  event.preventDefault();
  if(!editing||methodBusyId)return;
  const nickname=editNickname.trim();const billingName=editBillingName.trim();const country=editCountry.trim().toUpperCase();const postal=editPostal.trim();
  if(nickname.length>40){setEditError('Kart rumuzu en fazla 40 karakter olabilir.');return;}
  if(billingName.length>120){setEditError('Kart sahibi/fatura adı en fazla 120 karakter olabilir.');return;}
  if(country&&!/^[A-Z]{2}$/.test(country)){setEditError('Fatura ülke kodu iki harfli ISO kodu olmalıdır.');return;}
  if(postal.length>30){setEditError('Fatura posta kodu en fazla 30 karakter olabilir.');return;}
  try{
   setMethodBusyId(editing.id);setEditError('');setMethodStatus('');
   await updateMyPaymentMethodMetadata(editing.id,{nickname:nickname||null,billingName:billingName||null,billingCountryCode:country||null,billingPostalCode:postal||null});
   await refreshMethods();setEditing(null);setMethodStatus('Kart bilgileri güncellendi.');
  }catch(e:any){setEditError(e?.message||'Kart bilgileri güncellenemedi.');}
  finally{setMethodBusyId(null);}
 }

 async function makeDefault(method:SavedPaymentMethod){
  if(methodBusyId||method.isDefault||method.status!=='active')return;
  try{setMethodBusyId(method.id);setMethodStatus('');await setMyDefaultPaymentMethod(method.id);await refreshMethods();setMethodStatus(`${method.nickname||method.brand} varsayılan ödeme yöntemi yapıldı.`);}catch(e:any){setError(e?.message||'Varsayılan kart değiştirilemedi.');}finally{setMethodBusyId(null);}
 }

 async function removeMethod(){
  if(!removeCandidate||methodBusyId)return;
  try{setMethodBusyId(removeCandidate.id);setMethodStatus('');await removeMyPaymentMethod(removeCandidate.id);await refreshMethods();setRemoveCandidate(null);setMethodStatus('Kayıtlı ödeme yöntemi kaldırıldı.');}catch(e:any){setError(e?.message||'Kayıtlı ödeme yöntemi kaldırılamadı.');}finally{setMethodBusyId(null);}
 }

 if(loading)return<LoadingState label="Ödeme bilgileri yükleniyor"/>;
 const items=Array.isArray(page?.items)?page.items:[];
 const shown=items.length;
 const rawTotal=Number(page?.total);
 const total=Number.isSafeInteger(rawTotal)&&rawTotal>=0?rawTotal:null;
 const hasMore=total!==null&&shown<total;
 const activeMethods=methods.filter(method=>method.status==='active');
 const cardEnrollmentReady=readiness?.liveCardPaymentsEnabled===true&&readiness?.savedPaymentMethodsSupported===true&&Boolean(readiness.provider);
 const defaultMethod=useMemo(()=>activeMethods.find(method=>method.isDefault)||null,[activeMethods]);

 return<Panel title="Ödeme Yöntemleri ve İşlemler" description="Kayıtlı kartlarınızı, kart rumuzlarını ve doğrulanmış ödeme hareketlerinizi yönetin.">
  {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
  {methodStatus?<div role="status" aria-live="polite" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">{methodStatus}</div>:null}

  <section aria-labelledby="saved-cards-title" className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div><h2 id="saved-cards-title" className="text-lg font-bold">Kayıtlı Kartlarım</h2><p className="mt-1 text-sm text-gray-500">Kart rumuzu, kart sahibi/fatura adı ve fatura bilgileri hesabınızda tutulur. Kart numarası yalnız maskeli son 4 hane olarak gösterilir.</p></div>
    <button type="button" onClick={()=>setAddOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Plus aria-hidden="true" className="h-4 w-4"/>Yeni Kart Ekle</button>
   </div>
   <div className="mt-4 flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0"/><p>Kart numarası ve CVC yalnız ödeme sağlayıcısının güvenli kart girişinde kullanılır. CVC kaydedilmez; kayıtlı kartta marka, son 4 hane, son kullanma, rumuz ve fatura metadatası gösterilir.</p></div>
   {defaultMethod?<p className="mt-3 text-sm text-gray-500">Varsayılan: <strong className="text-gray-900 dark:text-gray-100">{paymentMethodLabel(defaultMethod)}</strong></p>:null}
   {!methods.length?<div className="mt-4"><EmptyState title="Kayıtlı kart yok" body="İlk kartınızı güvenli ödeme sağlayıcısı üzerinden ekleyebilirsiniz."/></div>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{methods.map(method=>{
    const busy=methodBusyId===method.id;
    return<article key={method.id} className={`rounded-2xl border p-4 ${method.isDefault?'border-brand-gold bg-amber-50/60 dark:bg-amber-950/20':'border-gray-200 dark:border-gray-800'}`}>
     <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green dark:text-brand-gold"><CreditCard aria-hidden="true" className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{method.nickname||`${method.brand} kart`}</h3>{method.isDefault?<span className="rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs font-bold">Varsayılan</span>:null}{method.status==='expired'?<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">Süresi dolmuş</span>:null}</div><p className="mt-1 text-sm font-semibold">{method.brand} •••• {method.last4}{method.expMonth&&method.expYear?` • ${String(method.expMonth).padStart(2,'0')}/${String(method.expYear).slice(-2)}`:''}</p><p className="mt-1 text-xs text-gray-500">{method.billingName||'Kart sahibi/fatura adı eklenmedi'}{method.billingCountryCode?` • ${method.billingCountryCode}`:''}{method.billingPostalCode?` ${method.billingPostalCode}`:''}</p><p className="mt-1 text-xs text-gray-500">Sağlayıcı: {method.provider}</p></div></div>
     <div className="mt-4 grid grid-cols-3 gap-2"><button type="button" disabled={busy||method.status!=='active'||method.isDefault} onClick={()=>void makeDefault(method)} className="min-h-11 rounded-xl border px-2 text-xs font-semibold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Star aria-hidden="true" className="mx-auto mb-1 h-4 w-4"/>Varsayılan</button><button type="button" disabled={busy} onClick={()=>openEdit(method)} className="min-h-11 rounded-xl border px-2 text-xs font-semibold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Pencil aria-hidden="true" className="mx-auto mb-1 h-4 w-4"/>Düzenle</button><button type="button" disabled={busy} onClick={()=>setRemoveCandidate(method)} className="min-h-11 rounded-xl border border-red-200 px-2 text-xs font-semibold text-red-700 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300"><Trash2 aria-hidden="true" className="mx-auto mb-1 h-4 w-4"/>Kaldır</button></div>
    </article>;
   })}</div>}
  </section>

  <section aria-labelledby="payment-history-title">
   <h2 id="payment-history-title" className="mb-1 text-lg font-bold">Ödeme ve İşlem Geçmişi</h2>
   <p className="mb-4 text-sm text-gray-500">Yalnız backend tarafından doğrulanmış ödeme hareketleri gösterilir.</p>
   <div className="sr-only" aria-live="polite">{loadingMore?'Daha fazla ödeme hareketi yükleniyor.':loadMoreError||''}</div>
   {!shown?<EmptyState title="Ödeme hareketi yok" body="Ödeme sağlayıcısı üzerinden doğrulanan işlemler burada görünecek."/>:<>
    <div className="mb-3 text-sm text-gray-500" aria-live="polite">{shown}{total!==null?` / ${total}`:''} işlem gösteriliyor</div>
    <div className="space-y-3">{items.map((p:any,index:number)=>{
      const id=String(p?.id||'').trim();const date=formatAccountDate(p?.processedAt||p?.createdAt||p?.updatedAt);const currency=verifiedCurrency(p?.currency);const amount=verifiedMinor(p?.amountMinor);const key=id||paymentKey(p,index);
      return <article key={key} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="font-bold">{String(p?.orderNumber||'').trim()||'Sipariş numarası doğrulanamadı'}</div><div className="mt-1 text-sm text-gray-500">{providerLabel(p?.provider)} • {paymentActivityMethodLabel(p?.paymentMethodType)}</div><div className="mt-1 text-sm font-semibold text-brand-green dark:text-brand-gold">{paymentStatusLabel(p?.status)}</div><div className="mt-1 text-xs text-gray-500">{date||'İşlem tarihi doğrulanamadı'}</div></div><div className="font-bold text-brand-green dark:text-brand-gold">{amount!==null&&currency?<Money minor={amount} currency={currency}/>:<span role="status" className="text-red-700 dark:text-red-300">Tutar doğrulanamadı</span>}</div></div></article>;
    })}</div>
    {loadMoreError?<div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><p>Daha eski ödeme hareketleri yüklenemedi. Mevcut kayıtlar korunuyor.</p><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="mt-2 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold disabled:opacity-50 dark:border-amber-800">Tekrar dene</button></div>:null}
    {hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore?'Yükleniyor…':'Daha fazla işlem göster'}</button></div>:null}
   </>}
  </section>

  {editing?<div className="fixed inset-0 z-[90] overflow-y-auto bg-black/65 p-4"><form ref={editDialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-card-title" aria-describedby="edit-card-description" tabIndex={-1} onSubmit={saveMetadata} className="mx-auto mt-8 w-full max-w-lg rounded-2xl bg-white p-5 text-brand-text shadow-2xl outline-none dark:bg-gray-900"><div className="flex items-start justify-between gap-3"><div><h2 id="edit-card-title" className="text-xl font-bold">Kayıtlı kartı düzenle</h2><p id="edit-card-description" className="mt-1 text-sm text-gray-500">{editing.brand} •••• {editing.last4}. Kart numarası ve CVC burada tutulmaz veya gösterilmez.</p></div><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>setEditing(null)} aria-label="Kart düzenleme penceresini kapat" className="grid min-h-11 min-w-11 place-items-center rounded-xl border disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5"/></button></div>{editError?<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{editError}</div>:null}<div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-sm font-semibold">Kart rumuzu</span><input value={editNickname} onChange={e=>setEditNickname(e.target.value.slice(0,40))} maxLength={40} autoComplete="off" placeholder="Örn. Günlük kartım" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label><label className="block sm:col-span-2"><span className="text-sm font-semibold">Kart sahibi / fatura adı</span><input value={editBillingName} onChange={e=>setEditBillingName(e.target.value.slice(0,120))} maxLength={120} autoComplete="cc-name" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label><label className="block"><span className="text-sm font-semibold">Fatura ülke kodu</span><input value={editCountry} onChange={e=>setEditCountry(e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,2))} maxLength={2} autoComplete="country" placeholder="CH" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label><label className="block"><span className="text-sm font-semibold">Fatura posta kodu</span><input value={editPostal} onChange={e=>setEditPostal(e.target.value.slice(0,30))} maxLength={30} autoComplete="postal-code" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label></div><p className="mt-3 text-xs text-gray-500">Kart numarası veya son kullanma bilgisini değiştirmek gerekiyorsa güvenli ödeme sağlayıcısı üzerinden kartı yeniden doğrulamak gerekir.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>setEditing(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50">Vazgeç</button><button disabled={Boolean(methodBusyId)} className="min-h-11 rounded-xl bg-brand-green font-bold text-white disabled:opacity-50">{methodBusyId?'Kaydediliyor…':'Kaydet'}</button></div></form></div>:null}

  {removeCandidate?<div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4"><div ref={removeDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="remove-card-title" aria-describedby="remove-card-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-2xl outline-none dark:bg-gray-900"><h2 id="remove-card-title" className="text-lg font-bold">Kayıtlı kart kaldırılsın mı?</h2><p id="remove-card-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{paymentMethodLabel(removeCandidate)} hesabınızdan kaldırılacak. Bu işlem geçmiş ödeme kayıtlarını silmez.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>setRemoveCandidate(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50">Vazgeç</button><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>void removeMethod()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50">{methodBusyId?'Kaldırılıyor…':'Kartı Kaldır'}</button></div></div></div>:null}

  {addOpen?<div className="fixed inset-0 z-[90] overflow-y-auto bg-black/65 p-4"><div ref={addDialogRef} role="dialog" aria-modal="true" aria-labelledby="add-card-title" aria-describedby="add-card-description" tabIndex={-1} className="mx-auto mt-8 w-full max-w-lg rounded-2xl bg-white p-5 text-brand-text shadow-2xl outline-none dark:bg-gray-900"><div className="flex items-start justify-between gap-3"><div><h2 id="add-card-title" className="text-xl font-bold">Yeni kart ekle</h2><p id="add-card-description" className="mt-1 text-sm text-gray-500">Kart numarası, son kullanma ve CVC güvenli ödeme sağlayıcısı ekranında girilir. Kart doğrulandıktan sonra bu ekranda rumuz verilebilir.</p></div><button type="button" onClick={()=>setAddOpen(false)} aria-label="Yeni kart penceresini kapat" className="grid min-h-11 min-w-11 place-items-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5"/></button></div><div className="mt-5 rounded-2xl border border-gray-200 p-4 dark:border-gray-800"><div className="flex gap-3"><CreditCard aria-hidden="true" className="h-6 w-6 shrink-0 text-brand-green"/><div><h3 className="font-bold">Güvenli kart girişi</h3><p className="mt-1 text-sm text-gray-500">{cardEnrollmentReady?`Ödeme sağlayıcısı ${safeDisplay(readiness?.provider,40)} kart kaydı için hazır.`:'Canlı ödeme sağlayıcısı henüz etkinleştirilmedi. Kart alanlarını uygulama veritabanına doğrudan yazmak yerine provider tokenizasyonu zorunlu tutuluyor.'}</p></div></div></div>{cardEnrollmentReady?<button type="button" className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white">Güvenli kart ekranını aç</button>:<button type="button" disabled className="mt-5 min-h-12 w-full cursor-not-allowed rounded-xl bg-gray-300 px-4 font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">Ödeme sağlayıcısı yapılandırılmayı bekliyor</button>}<p className="mt-3 text-xs text-gray-500">Golden Oremar veritabanı tam kart numarası veya CVC tutmaz. Sağlayıcı doğrulamasından sonra yalnız güvenli referans ve maskeli kart bilgileri kaydedilir.</p></div></div>:null}
 </Panel>;
}
