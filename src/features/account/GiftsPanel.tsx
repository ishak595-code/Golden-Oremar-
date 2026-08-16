
import React, { useEffect, useState } from 'react';
import { listGiftOrders } from './api';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from './ui';

export default function GiftsPanel({ onStartGift }: { onStartGift?: () => void }) {
  const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  async function load(){try{setLoading(true);setItems(await listGiftOrders());}catch(e:any){setError(e?.message||'Hediyeler yüklenemedi.');}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  if(loading)return <LoadingState/>;
  return <Panel title="Hediye Ettiklerim" description="Hediye olarak verdiğiniz gerçek siparişler burada görünür.">
    {error?<ErrorState message={error} onRetry={load}/>:null}
    {!items.length?<EmptyState title="Henüz hediye siparişiniz yok" body="Ürün veya sepet ekranından Hediye Et seçeneğiyle başlayabilirsiniz."
      action={<button onClick={onStartGift} className="min-h-11 rounded-xl bg-brand-gold px-4 font-bold text-white">Hediye seç</button>}/>:
    <div className="space-y-3">{items.map(g=><article key={g.orderId} className="rounded-xl border p-4">
      <div className="flex justify-between gap-3"><div><div className="font-bold">Alıcı: {g.recipientName}</div><div className="text-sm text-gray-500">{g.orderNumber} • {g.status}</div></div>
      <div className="font-bold"><Money minor={g.totalMinor} currency={g.currency}/></div></div>
      {g.message?<p className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm italic">“{g.message}”</p>:null}
    </article>)}</div>}
  </Panel>;
}
