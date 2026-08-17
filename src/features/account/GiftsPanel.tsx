import React, { useEffect, useState } from 'react';
import { catalogPublicUrl, listGiftOrders } from './api';
import { EmptyState, ErrorState, LoadingState, Money, Panel } from './ui';
import { formatAccountDate, orderStatusLabel } from './presentation';

function verifiedPositiveCount(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function giftKey(gift: any, index: number) {
  const id = String(gift?.orderId || '').trim();
  if (id) return `id:${id}`;
  return `fallback:${String(gift?.orderNumber || '')}|${String(gift?.createdAt || gift?.placedAt || gift?.orderCreatedAt || '')}|${index}`;
}

export default function GiftsPanel({ onStartGift }: { onStartGift?: () => void }) {
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    try{
      setLoading(true);
      setError('');
      const next=await listGiftOrders();
      setItems(Array.isArray(next)?next:[]);
    }catch(e:any){setError(e?.message||'Hediye siparişleri yüklenemedi.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  if(loading)return <LoadingState label="Hediye siparişleri yükleniyor"/>;
  return <Panel title="Hediye Ettiklerim" description="Hediye olarak verdiğiniz gerçek siparişleri, alıcı, ürün ve sipariş durumuyla birlikte izleyin.">
    {error?<ErrorState message={error} onRetry={()=>void load()}/>:null}
    {!items.length?<EmptyState title="Henüz hediye siparişiniz yok" body="Ürün veya sepet ekranından Hediye Et seçeneğiyle başlayabilirsiniz."
      action={onStartGift?<button type="button" onClick={onStartGift} className="min-h-11 rounded-xl bg-brand-gold px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">Hediye seç</button>:undefined}/>:
    <div className="space-y-4">{items.map((g,index)=>{
      const date=formatAccountDate(g?.createdAt||g?.placedAt||g?.orderCreatedAt);
      const giftItems=Array.isArray(g?.items)?g.items:[];
      const recipientName=String(g?.recipientName||'').trim()||'Alıcı bilgisi doğrulanamadı';
      const orderNumber=String(g?.orderNumber||'').trim()||'Sipariş numarası doğrulanamadı';
      return <article key={giftKey(g,index)} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><div className="font-bold">Alıcı: {recipientName}</div><div className="mt-1 text-sm text-gray-500">{orderNumber} • {orderStatusLabel(g?.status)}</div><div className="mt-1 text-xs text-gray-500">{date||'Sipariş tarihi doğrulanamadı'}</div></div>
          <div className="font-bold text-brand-green dark:text-brand-gold"><Money minor={g?.totalMinor} currency={g?.currency}/></div>
        </div>
        {giftItems.length?<div className="mt-4 space-y-2" aria-label="Hediye ürünleri">{giftItems.map((item:any,itemIndex:number)=>{
          const productName=String(item?.productName||'').trim()||'Ürün bilgisi doğrulanamadı';
          const quantity=verifiedPositiveCount(item?.quantity);
          return <div key={`${String(item?.id||'').trim()||productName}-${String(item?.variantName||'')}-${itemIndex}`} className="flex items-center gap-3 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800">
          {item?.imagePath?<img src={catalogPublicUrl(item.imagePath)} alt={`${productName} ürün görseli`} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-lg object-cover"/>:<div role="img" aria-label={`${productName} için görsel henüz eklenmedi`} className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gray-200 text-[10px] text-gray-500 dark:bg-gray-700"><span aria-hidden="true">Görsel yok</span></div>}
          <div className="min-w-0 flex-1"><div className="line-clamp-1 font-semibold">{productName}</div><div className="mt-0.5 text-xs text-gray-500">{String(item?.variantName||'').trim()||'Standart'} • {quantity===null?'Adet doğrulanamadı':`${quantity} adet`}</div></div>
        </div>;})}</div>:<div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-700">Bu hediye siparişinin ürün satırları doğrulanamadı veya henüz yayınlanmadı.</div>}
        {g?.message?<p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm italic text-gray-700 dark:bg-gray-800 dark:text-gray-200">“{g.message}”</p>:null}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {g?.senderName?<span>Gönderen adı: {g.senderName}</span>:null}
          {g?.recipientEmail?<span>Alıcı e-posta: {g.recipientEmail}</span>:null}
          {g?.recipientPhone?<span>Alıcı telefon: {g.recipientPhone}</span>:null}
        </div>
      </article>;
    })}</div>}
  </Panel>;
}
