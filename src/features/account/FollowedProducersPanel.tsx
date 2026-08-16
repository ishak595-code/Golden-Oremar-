import React, { useEffect, useState } from 'react';
import { catalogPublicUrl, listFollowedProducers, toggleProducerFollow } from './api';
import { EmptyState, ErrorState, LoadingState, Panel } from './ui';

export default function FollowedProducersPanel({ onOpenProducer }: { onOpenProducer?: (slug: string) => void }) {
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [busyId,setBusyId]=useState<string|null>(null);

  async function load(silent=false){
    try{
      if(!silent)setLoading(true);
      setError('');
      setItems(await listFollowedProducers());
    }catch(e:any){setError(e?.message||'Takip edilen üreticiler yüklenemedi.');}
    finally{if(!silent)setLoading(false);}
  }
  useEffect(()=>{void load();},[]);

  async function unfollow(producer:any){
    const id=String(producer.id||'');
    if(!id||busyId)return;
    try{
      setBusyId(id);setError('');setStatus('');
      await toggleProducerFollow(id);
      setItems(current=>current.filter(row=>String(row.id)!==id));
      setStatus(`${producer.displayName||'Üretici'} artık takip edilmiyor.`);
      await load(true);
    }catch(e:any){setError(e?.message||'Üretici takibi bırakılamadı.');}
    finally{setBusyId(null);}
  }

  if(loading)return <LoadingState label="Takip edilen üreticiler yükleniyor"/>;
  return <Panel title="Takip Ettiğim Satıcılar" description="Takip ettiğiniz üreticileri, doğrulama sinyallerini ve mağaza bağlantılarını tek yerde yönetin.">
    {error?<ErrorState message={error} onRetry={()=>void load()}/>:null}
    {status?<div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div>:null}
    {!items.length?<EmptyState title="Takip edilen üretici yok" body="Üretici profilindeki Takip Et düğmesiyle mağazaları buraya ekleyebilirsiniz."/>:
    <div className="space-y-3">{items.map(p=>{
      const id=String(p.id);const busy=busyId===id;
      return <article key={id} aria-busy={busy} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-3">
          {p.logoPath?<img src={catalogPublicUrl(p.logoPath)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover"/>:<div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-green/10 font-bold text-brand-green">{String(p.displayName||'?').charAt(0).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><div className="font-bold">{p.displayName}</div><div className="mt-1 text-sm text-gray-500">{p.locationLabel || 'Konum bilgisi yayınlanmadı'} • {p.productCount} ürün</div>
          {(p.verified||p.originVerified)?<div className="mt-1 text-xs font-semibold text-brand-green">{p.verified?'Üretici doğrulandı':''}{p.verified&&p.originVerified?' • ':''}{p.originVerified?'Menşe doğrulandı':''}</div>:null}</div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={()=>onOpenProducer?.(p.slug)} className="min-h-11 rounded-xl bg-brand-green px-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Mağazayı aç</button>
          <button type="button" disabled={busy} onClick={()=>void unfollow(p)} aria-label={`${p.displayName} üreticisini takip etmeyi bırak`} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{busy?'Bırakılıyor…':'Takibi bırak'}</button>
        </div>
      </article>;
    })}</div>}
  </Panel>;
}
