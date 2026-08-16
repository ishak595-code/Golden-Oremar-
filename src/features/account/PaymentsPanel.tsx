
import React,{useEffect,useState}from'react';
import{listPaymentActivity}from'./api';
import{EmptyState,ErrorState,LoadingState,Money,Panel}from'./ui';

export default function PaymentsPanel(){
 const[page,setPage]=useState<any>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 async function load(){try{setLoading(true);setPage(await listPaymentActivity());}catch(e:any){setError(e?.message||'Ödeme hareketleri yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 if(loading)return<LoadingState/>;
 return<Panel title="Ödeme Yöntemlerim" description="Golden Oremar kart numarası veya CVV saklamaz. Kayıtlı kart kasası, gerçek ödeme sağlayıcısı bağlandığında sağlayıcı üzerinden yönetilecektir.">
  {error?<ErrorState message={error} onRetry={load}/>:null}
  <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Şu anda bu ekranda yalnız doğrulanmış ödeme hareketleri gösterilir. Sahte kayıtlı kart oluşturulmaz.</div>
  {!page?.items?.length?<EmptyState title="Ödeme hareketi yok" body="Ödeme sağlayıcısı üzerinden doğrulanan işlemler burada görünecek."/>:
  <div className="space-y-3">{page.items.map((p:any)=><article key={p.id} className="rounded-xl border p-4">
    <div className="flex justify-between gap-3"><div><div className="font-bold">{p.orderNumber}</div><div className="text-sm text-gray-500">{p.provider} • {p.paymentMethodType||'Ödeme'} • {p.status}</div></div>
    <div className="font-bold"><Money minor={p.amountMinor} currency={p.currency}/></div></div>
  </article>)}</div>}
 </Panel>;
}
