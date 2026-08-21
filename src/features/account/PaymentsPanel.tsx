import React,{useEffect,useState}from'react';
import{CreditCard,Pencil,Plus,Star,Trash2}from'lucide-react';
import{listPaymentActivity}from'./api';
import type{PaymentActivityItem,PaymentActivityPage}from'./types';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';
import{formatAccountDate,paymentMethodLabel as paymentActivityMethodLabel,paymentStatusLabel,providerLabel}from'./presentation';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import PaymentMethodEnrollmentDialog from'../payments/PaymentMethodEnrollmentDialog';
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

export default function PaymentsPanel(){
 const[page,setPage]=useState<PaymentActivityPage|null>(null);
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
 const[enrollmentOpen,setEnrollmentOpen]=useState(false);
 const editDialogRef=useAccessibleDialog<HTMLFormElement>(!!editing,()=>{if(!methodBusyId)setEditing(null);});
 const removeDialogRef=useAccessibleDialog<HTMLDivElement>(!!removeCandidate,()=>{if(!methodBusyId)setRemoveCandidate(null);});

 async function load(reset=true){
  const currentItems=page?.items??[];
  const offset=reset?0:currentItems.length;
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   if(reset)setError('');else setLoadMoreError('');
   if(reset){
    const[next,methodsResult,readinessResult]=await Promise.all([listPaymentActivity(PAGE_SIZE,0),listMyPaymentMethods(),getPaymentReadiness()]);
    setPage(next);setMethods(methodsResult);setReadiness(readinessResult);
   }else{
    const next=await listPaymentActivity(PAGE_SIZE,offset);
    setPage(previous=>{if(!previous)return next;const unique=new Map<string,PaymentActivityItem>();previous.items.forEach(item=>unique.set(item.id,item));next.items.forEach(item=>unique.set(item.id,item));return{...next,offset:0,items:Array.from(unique.values())};});
   }
  }catch(e:unknown){const message=e instanceof Error&&e.message?e.message:'Ödeme bilgileri yüklenemedi.';if(reset)setError(message);else setLoadMoreError(message);}finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }
 async function refreshMethods(){const[nextMethods,nextReadiness]=await Promise.all([listMyPaymentMethods(),getPaymentReadiness()]);setMethods(nextMethods);setReadiness(nextReadiness);}
 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{const restore=()=>{setLoadMoreError('');void load(true);};window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[]);
 function openEdit(method:SavedPaymentMethod){setMethodStatus('');setEditError('');setEditing(method);setEditNickname(method.nickname||'');setEditBillingName(method.billingName||'');setEditCountry(method.billingCountryCode||'');setEditPostal(method.billingPostalCode||'');}
 async function saveMetadata(event:React.FormEvent){event.preventDefault();if(!editing||methodBusyId)return;const nickname=editNickname.trim(),billingName=editBillingName.trim(),country=editCountry.trim().toUpperCase(),postal=editPostal.trim();if(nickname.length>40){setEditError('Kart rumuzu en fazla 40 karakter olabilir.');return;}if(billingName.length>120){setEditError('Kart sahibi/fatura adı en fazla 120 karakter olabilir.');return;}if(country&&!/^[A-Z]{2}$/.test(country)){setEditError('Fatura ülke kodu iki harfli ISO kodu olmalıdır.');return;}if(postal.length>30){setEditError('Fatura posta kodu en fazla 30 karakter olabilir.');return;}try{setMethodBusyId(editing.id);setEditError('');setMethodStatus('');await updateMyPaymentMethodMetadata(editing.id,{nickname:nickname||null,billingName:billingName||null,billingCountryCode:country||null,billingPostalCode:postal||null});await refreshMethods();setEditing(null);setMethodStatus('Kart bilgileri güncellendi.');}catch(e:unknown){setEditError(e instanceof Error&&e.message?e.message:'Kart bilgileri güncellenemedi.');}finally{setMethodBusyId(null);}}
 async function makeDefault(method:SavedPaymentMethod){if(methodBusyId||method.isDefault||method.status!=='active')return;try{setMethodBusyId(method.id);setMethodStatus('');await setMyDefaultPaymentMethod(method.id);await refreshMethods();setMethodStatus(`${method.nickname||method.brand} varsayılan ödeme yöntemi yapıldı.`);}catch(e:unknown){setError(e instanceof Error&&e.message?e.message:'Varsayılan kart değiştirilemedi.');}finally{setMethodBusyId(null);}}
 async function removeMethod(){if(!removeCandidate||methodBusyId)return;try{setMethodBusyId(removeCandidate.id);setMethodStatus('');await removeMyPaymentMethod(removeCandidate.id);await refreshMethods();setRemoveCandidate(null);setMethodStatus('Kayıtlı ödeme yöntemi iyzico ve hesabınızdan kaldırıldı.');}catch(e:unknown){setError(e instanceof Error&&e.message?e.message:'Kayıtlı ödeme yöntemi kaldırılamadı.');}finally{setMethodBusyId(null);}}
 if(loading)return<LoadingState label="Ödeme bilgileri yükleniyor"/>;
 if(!page)return<Panel title="Ödeme Yöntemleri ve İşlemler" description="Kayıtlı kartlarınızı ve doğrulanmış ödeme hareketlerinizi yönetin."><ErrorState message={error||'Ödeme verisi doğrulanamadı.'} onRetry={()=>void load(true)}/></Panel>;
 const items=page.items,shown=items.length,total=page.total,hasMore=shown<total,activeMethods=methods.filter(method=>method.status==='active'),cardEnrollmentReady=readiness?.cardEnrollmentEnabled===true&&readiness.savedPaymentMethodsSupported===true&&readiness.provider==='iyzico',defaultMethod=activeMethods.find(method=>method.isDefault)||null;
 return<Panel title="Ödeme Yöntemleri ve İşlemler" description="Kayıtlı kartlarınızı, varsayılan kartınızı ve doğrulanmış işlem geçmişinizi tek yerden yönetin.">
  {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
  {methodStatus?<div role="status" aria-live="polite" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">{methodStatus}</div>:null}
  <section aria-labelledby="saved-cards-title" className="mb-7 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="saved-cards-title" className="text-lg font-bold">Kayıtlı Kartlarım</h2><p className="mt-1 text-sm text-gray-500">Kart kaydetmek isteğe bağlıdır. Tam kart numarası Golden Oremar veritabanında tutulmaz.</p></div><button type="button" disabled={!cardEnrollmentReady} onClick={()=>setEnrollmentOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50"><Plus aria-hidden="true" className="h-4 w-4"/>Yeni Kart Ekle</button></div>
   {!cardEnrollmentReady?<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Kart kaydetme, gerçek iyzico merchant yapılandırması ve Super Admin onayı tamamlanana kadar kapalı tutulur.</div>:null}
   {defaultMethod?<p className="mt-3 text-sm text-gray-500">Varsayılan: <strong className="text-gray-900 dark:text-gray-100">{paymentMethodLabel(defaultMethod)}</strong></p>:null}
   {!methods.length?<div className="mt-4"><EmptyState title="Kayıtlı kart yok" body={cardEnrollmentReady?'İsterseniz sonraki ödemeler için bir kart kaydedebilirsiniz. Tek seferlik ödeme için kart kaydetmek zorunlu değildir.':'Kart kasası güvenli şekilde kapalı.'}/></div>:<div className="mt-4 grid gap-3 lg:grid-cols-2">{methods.map(method=>{const busy=methodBusyId===method.id;return<article key={method.id} className={`rounded-2xl border p-4 ${method.isDefault?'border-brand-gold bg-amber-50/60 dark:bg-amber-950/20':'border-gray-200 dark:border-gray-800'}`}><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green dark:text-brand-gold"><CreditCard aria-hidden="true" className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{method.nickname||`${method.brand} kart`}</h3>{method.isDefault?<span className="rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs font-bold">Varsayılan</span>:null}{method.status==='expired'?<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Süresi dolmuş</span>:null}</div><p className="mt-1 text-sm font-semibold">{paymentMethodLabel(method)}</p><p className="mt-1 text-xs text-gray-500">{method.billingName||'Fatura adı eklenmedi'}{method.billingCountryCode?` • ${method.billingCountryCode}`:''}{method.billingPostalCode?` ${method.billingPostalCode}`:''}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2"><button type="button" disabled={busy||method.status!=='active'||method.isDefault} onClick={()=>void makeDefault(method)} className="min-h-11 rounded-xl border px-2 text-xs font-semibold disabled:opacity-45"><Star aria-hidden="true" className="mx-auto mb-1 h-4 w-4"/>Varsayılan</button><button type="button" disabled={busy} onClick={()=>openEdit(method)} className="min-h-11 rounded-xl border px-2 text-xs font-semibold disabled:opacity-45"><Pencil aria-hidden="true" className="mx-auto mb-1 h-4 w-4"/>Düzenle</button><button type="button" disabled={busy} onClick={()=>setRemoveCandidate(method)} className="min-h-11 rounded-xl border border-red-200 px-2 text-xs font-semibold text-red-700 disabled:opacity-45"><Trash2 aria-hidden="true" className="mx-auto mb-1 h-4 w-4"/>Kaldır</button></div></article>;})}</div>}
  </section>
  <section aria-labelledby="payment-history-title"><h2 id="payment-history-title" className="mb-1 text-lg font-bold">Ödeme ve İşlem Geçmişi</h2><p className="mb-4 text-sm text-gray-500">Yalnız backend tarafından doğrulanmış ödeme hareketleri gösterilir.</p>{!shown?<EmptyState title="Ödeme hareketi yok" body="Doğrulanmış işlemler burada görünecek."/>:<><div className="mb-3 text-sm text-gray-500" aria-live="polite">{shown} / {total} işlem gösteriliyor</div><div className="space-y-3">{items.map(p=>{const date=formatAccountDate(p.capturedAt||p.authorizedAt||p.createdAt);return<article key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="font-bold">{p.orderNumber}</div><div className="mt-1 text-sm text-gray-500">{providerLabel(p.provider)} • {paymentActivityMethodLabel(p.paymentMethodType)}</div><div className="mt-1 text-sm font-semibold text-brand-green dark:text-brand-gold">{paymentStatusLabel(p.status)}</div><div className="mt-1 text-xs text-gray-500">{date}</div></div><div className="font-bold text-brand-green dark:text-brand-gold"><Money minor={p.amountMinor} currency={p.currency}/></div></div></article>;})}</div>{loadMoreError?<div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>Daha eski ödeme hareketleri yüklenemedi. Mevcut kayıtlar korunuyor.</p><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="mt-2 min-h-11 rounded-xl border px-4 font-semibold">Tekrar dene</button></div>:null}{hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50">{loadingMore?'Yükleniyor…':'Daha fazla işlem göster'}</button></div>:null}</>}
  </section>
  <PaymentMethodEnrollmentDialog open={enrollmentOpen} readiness={readiness} onClose={()=>setEnrollmentOpen(false)} onSaved={async method=>{await refreshMethods();setMethodStatus(`${method.nickname||method.brand} kartınız güvenli şekilde kaydedildi.`);}}/>
  {editing?<div className="fixed inset-0 z-[90] overflow-y-auto bg-black/65 p-4"><form ref={editDialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-card-title" aria-describedby="edit-card-description" tabIndex={-1} onSubmit={saveMetadata} className="mx-auto mt-8 w-full max-w-lg rounded-2xl bg-white p-5 text-brand-text shadow-2xl outline-none dark:bg-gray-900"><h2 id="edit-card-title" className="text-xl font-bold">Kayıtlı kartı düzenle</h2><p id="edit-card-description" className="mt-1 text-sm text-gray-500">{editing.brand} •••• {editing.last4}. Yalnız rumuz ve fatura metadatasını değiştirin.</p>{editError?<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{editError}</div>:null}<div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-sm font-semibold">Kart rumuzu</span><input value={editNickname} onChange={e=>setEditNickname(e.target.value.slice(0,40))} maxLength={40} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label><label className="block sm:col-span-2"><span className="text-sm font-semibold">Kart sahibi / fatura adı</span><input value={editBillingName} onChange={e=>setEditBillingName(e.target.value.slice(0,120))} maxLength={120} autoComplete="cc-name" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label><label className="block"><span className="text-sm font-semibold">Fatura ülke kodu</span><input value={editCountry} onChange={e=>setEditCountry(e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,2))} maxLength={2} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label><label className="block"><span className="text-sm font-semibold">Fatura posta kodu</span><input value={editPostal} onChange={e=>setEditPostal(e.target.value.slice(0,30))} maxLength={30} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label></div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>setEditing(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50">Vazgeç</button><button disabled={Boolean(methodBusyId)} className="min-h-11 rounded-xl bg-brand-green font-bold text-white disabled:opacity-50">{methodBusyId?'Kaydediliyor…':'Kaydet'}</button></div></form></div>:null}
  {removeCandidate?<div className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4"><div ref={removeDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="remove-card-title" aria-describedby="remove-card-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-2xl outline-none dark:bg-gray-900"><h2 id="remove-card-title" className="text-lg font-bold">Kayıtlı kart kaldırılsın mı?</h2><p id="remove-card-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{paymentMethodLabel(removeCandidate)} iyzico ve Golden Oremar hesabınızdan kaldırılacak. Geçmiş ödeme kayıtları silinmez.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>setRemoveCandidate(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50">Vazgeç</button><button type="button" disabled={Boolean(methodBusyId)} onClick={()=>void removeMethod()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50">{methodBusyId?'Kaldırılıyor…':'Kartı Kaldır'}</button></div></div></div>:null}
 </Panel>;
}
