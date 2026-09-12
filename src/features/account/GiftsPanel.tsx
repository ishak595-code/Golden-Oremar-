import React, { useEffect, useState } from 'react';
import { Gift, RefreshCw } from 'lucide-react';
import { catalogPublicUrl, listGiftOrders } from './api';
import type { GiftOrder } from './types';
import { Money, Panel } from './ui';
import { formatAccountDate, orderStatusLabel } from './presentation';

export default function GiftsPanel({ onStartGift }: { onStartGift?: () => void }) {
  const [items,setItems]=useState<GiftOrder[]|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    try{
      setLoading(true);
      setError('');
      setItems(await listGiftOrders());
    }catch(e:unknown){setError(e instanceof Error&&e.message?e.message:'Hediye siparişleri yüklenemedi.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  if(loading)return <Panel title="Hediye Ettiklerim" description="Hediye olarak verdiğiniz gerçek siparişleri, alıcı, ürün ve sipariş durumuyla birlikte izleyin."><div className="flex min-h-60 flex-col items-center justify-center gap-4 py-10"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40"><Gift aria-hidden="true" className="h-12 w-12 text-amber-600 dark:text-amber-400"/></div><div className="text-center"><div className="text-lg font-bold text-brand-text">Hediye siparişleri yükleniyor</div><div className="mt-1 text-sm text-brand-muted">Gönderdiğiniz hediyeler hazırlanıyor…</div></div></div></Panel>;
  if(!items)return <Panel title="Hediye Ettiklerim" description="Hediye olarak verdiğiniz gerçek siparişleri, alıcı, ürün ve sipariş durumuyla birlikte izleyin."><div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p className="font-semibold">{error||'Hediye sipariş listesi doğrulanamadı.'}</p><button type="button" onClick={()=>void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-red-300 bg-white px-4 font-bold dark:bg-red-950/20"><RefreshCw aria-hidden="true" className="h-4 w-4"/>Yeniden dene</button></div></Panel>;
  return <Panel title="Hediye Ettiklerim" description="Hediye olarak verdiğiniz gerçek siparişleri, alıcı, ürün ve sipariş durumuyla birlikte izleyin.">
    {error?<div className="mb-5 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p className="font-semibold">{error}</p><button type="button" onClick={()=>void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-red-300 bg-white px-4 font-bold dark:bg-red-950/20"><RefreshCw aria-hidden="true" className="h-4 w-4"/>Yeniden dene</button></div>:null}
    {!items.length?<div className="flex min-h-60 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 py-10 dark:border-gray-800"><div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"><Gift aria-hidden="true" className="h-10 w-10 text-gray-400"/></div><div className="text-center"><div className="text-lg font-bold text-brand-text">Henüz hediye siparişiniz yok</div>{onStartGift?<div className="mt-2 max-w-sm px-4 text-sm leading-6 text-brand-muted">Ürün veya sepet ekranından Hediye Et seçeneğiyle başlayabilirsiniz.</div>:null}</div>{onStartGift?<button type="button" onClick={onStartGift} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-gold bg-brand-gold px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"><Gift aria-hidden="true" className="h-4 w-4"/>Hediye seç</button>:null}</div>:
    <div className="space-y-4">{items.map(g=>{
      const date=formatAccountDate(g.placedAt||g.createdAt);
      return <article key={g.orderId} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><div className="font-bold">Alıcı: {g.recipientName}</div><div className="mt-1 text-sm text-gray-500">{g.orderNumber} • {orderStatusLabel(g.status)}</div><div className="mt-1 text-xs text-gray-500">{date}</div></div>
          <div className="font-bold text-brand-green dark:text-brand-gold"><Money minor={g.totalMinor} currency={g.currency}/></div>
        </div>
        {g.items.length?<div className="mt-4 space-y-2" aria-label="Hediye ürünleri">{g.items.map((item,itemIndex)=><div key={`${g.orderId}:${itemIndex}`} className="flex items-center gap-3 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800">
          {item.imagePath?<img src={catalogPublicUrl(item.imagePath)} alt={`${item.productName} ürün görseli`} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-lg object-cover"/>:<div role="img" aria-label={`${item.productName} için görsel henüz eklenmedi`} className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gray-200 text-[10px] text-gray-500 dark:bg-gray-700"><span aria-hidden="true">Görsel yok</span></div>}
          <div className="min-w-0 flex-1"><div className="line-clamp-1 font-semibold">{item.productName}</div><div className="mt-0.5 text-xs text-gray-500">{item.variantName?`${item.variantName} • `:''}{item.quantity} adet</div></div>
        </div>)}</div>:<div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-700">Bu hediye siparişinde ürün satırı bulunmuyor.</div>}
        {g.message?<p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm italic text-gray-700 dark:bg-gray-800 dark:text-gray-200">“{g.message}”</p>:null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {g.senderName?<span>Gönderen adı: {g.senderName}</span>:null}
          {g.recipientEmail?<span>Alıcı e-posta: {g.recipientEmail}</span>:null}
          {g.recipientPhone?<span>Alıcı telefon: {g.recipientPhone}</span>:null}
        </div>
      </article>;
    })}</div>}
  </Panel>;
}