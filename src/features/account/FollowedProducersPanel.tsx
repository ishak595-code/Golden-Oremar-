
import React, { useEffect, useState } from 'react';
import { catalogPublicUrl, listFollowedProducers, toggleProducerFollow } from './api';
import { EmptyState, ErrorState, LoadingState, Panel } from './ui';

export default function FollowedProducersPanel({ onOpenProducer }: { onOpenProducer?: (slug: string) => void }) {
  const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  async function load(){try{setLoading(true);setItems(await listFollowedProducers());}catch(e:any){setError(e?.message||'Takip edilen üreticiler yüklenemedi.');}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  if(loading)return <LoadingState/>;
  return <Panel title="Takip Ettiğim Satıcılar" description="Doğrulanmış üreticileri tek yerde takip edin.">
    {error?<ErrorState message={error} onRetry={load}/>:null}
    {!items.length?<EmptyState title="Takip edilen üretici yok" body="Üretici profilindeki Takip Et düğmesiyle mağazaları buraya ekleyebilirsiniz."/>:
    <div className="space-y-3">{items.map(p=><article key={p.id} className="rounded-xl border p-4">
      <div className="flex gap-3">
        {p.logoPath?<img src={catalogPublicUrl(p.logoPath)} alt="" className="h-14 w-14 rounded-full object-cover"/>:<div className="h-14 w-14 rounded-full bg-gray-100"/>}
        <div className="min-w-0 flex-1"><div className="font-bold">{p.displayName}</div><div className="text-sm text-gray-500">{p.locationLabel || 'Türkiye'} • {p.productCount} ürün</div>
        <div className="mt-1 text-xs font-semibold text-brand-green">{p.verified?'Üretici doğrulandı':''}{p.originVerified?' • Menşe doğrulandı':''}</div></div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={()=>onOpenProducer?.(p.slug)} className="min-h-11 flex-1 rounded-lg bg-brand-green px-3 font-bold text-white">Mağazayı aç</button>
        <button onClick={async()=>{await toggleProducerFollow(p.id);await load();}} className="min-h-11 rounded-lg border px-3 font-semibold">Takibi bırak</button>
      </div>
    </article>)}</div>}
  </Panel>;
}
