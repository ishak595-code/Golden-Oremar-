import React,{useEffect,useState}from'react';
import{listPaymentActivity}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';
import{formatAccountDate,paymentMethodLabel,paymentStatusLabel,providerLabel}from'./presentation';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';

const PAGE_SIZE=20;
function safeNonNegativeInt(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?Math.floor(parsed):0;}
function safeMinor(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)?Math.trunc(parsed):0;}
function safeCurrency(value:unknown){const normalized=String(value||'TRY').trim().toUpperCase();return /^[A-Z]{3}$/.test(normalized)?normalized:'TRY';}

export default function PaymentsPanel(){
 const[page,setPage]=useState<any>(null);const[loading,setLoading]=useState(true);const[loadingMore,setLoadingMore]=useState(false);const[error,setError]=useState('');const[loadMoreError,setLoadMoreError]=useState('');
 async function load(reset=true){
  const offset=reset?0:safeNonNegativeInt(page?.items?.length);
  try{
   if(reset)setLoading(true);else setLoadingMore(true);
   if(reset)setError('');else setLoadMoreError('');
   const next=await listPaymentActivity(PAGE_SIZE,offset);
   setPage((previous:any)=>{
    if(reset||!previous)return next;
    const unique=new Map<string,any>();
    [...(previous.items||[]),...(next.items||[])].forEach(item=>{const id=String(item?.id||'');if(id)unique.set(id,item);});
    return {...next,offset:0,items:Array.from(unique.values())};
   });
  }catch(e:any){
   const message=e?.message||'Ödeme hareketleri yüklenemedi.';
   if(reset)setError(message);else setLoadMoreError(message);
  }
  finally{if(reset)setLoading(false);else setLoadingMore(false);}
 }
 useEffect(()=>{void load(true);},[]);
 useEffect(()=>{const restore=()=>{setLoadMoreError('');void load(true);};window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[]);
 if(loading)return<LoadingState label="Ödeme hareketleri yükleniyor"/>;
 const shown=safeNonNegativeInt(page?.items?.length);const rawTotal=Number(page?.total);const totalKnown=Number.isFinite(rawTotal)&&rawTotal>=0;const total=totalKnown?Math.floor(rawTotal):null;const hasMore=total!==null&&shown<total;
 return<Panel title="Ödeme ve İşlem Geçmişi" description="Golden Oremar kart numarası veya CVV saklamaz. Gerçek bir ödeme sağlayıcısı bağlandığında kayıtlı ödeme yöntemleri sağlayıcının güvenli kasası üzerinden yönetilecektir.">
  {error?<ErrorState message={error} onRetry={()=>void load(true)}/>:null}
  <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">Şu anda yalnız backend tarafından doğrulanan ödeme hareketleri gösterilir. Sahte kayıtlı kart veya ödeme yöntemi oluşturulmaz.</div>
  <div className="sr-only" aria-live="polite">{loadingMore?'Daha fazla ödeme hareketi yükleniyor.':loadMoreError||''}</div>
  {!shown?<EmptyState title="Ödeme hareketi yok" body="Ödeme sağlayıcısı üzerinden doğrulanan işlemler burada görünecek."/>:<>
  <div className="mb-3 text-sm text-gray-500" aria-live="polite">{shown}{total!==null?` / ${total}`:''} işlem gösteriliyor</div>
  <div className="space-y-3">{page.items.map((p:any)=>{
    const id=String(p?.id||'');const date=formatAccountDate(p?.processedAt||p?.createdAt||p?.updatedAt);const currency=safeCurrency(p?.currency);const amount=safeMinor(p?.amountMinor);
    return <article key={id||`${p?.orderNumber||'payment'}-${date||'undated'}`} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="font-bold">{p?.orderNumber||'Sipariş numarası bekleniyor'}</div><div className="mt-1 text-sm text-gray-500">{providerLabel(p?.provider)} • {paymentMethodLabel(p?.paymentMethodType)}</div><div className="mt-1 text-sm font-semibold text-brand-green dark:text-brand-gold">{paymentStatusLabel(p?.status)}</div>{date?<div className="mt-1 text-xs text-gray-500">{date}</div>:null}</div>
        <div className="font-bold text-brand-green dark:text-brand-gold"><Money minor={amount} currency={currency}/></div>
      </div>
    </article>;
  })}</div>
  {loadMoreError?<div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><p>Daha eski ödeme hareketleri yüklenemedi. Mevcut kayıtlar korunuyor.</p><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="mt-2 min-h-11 rounded-xl border border-amber-300 px-4 font-semibold disabled:opacity-50 dark:border-amber-800">Tekrar dene</button></div>:null}
  {hasMore?<div className="mt-5 flex justify-center"><button type="button" disabled={loadingMore} onClick={()=>void load(false)} className="min-h-11 rounded-xl border border-brand-green px-5 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">{loadingMore?'Yükleniyor…':'Daha fazla işlem göster'}</button></div>:null}
  </>}
 </Panel>;
}
