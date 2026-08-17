import React, { useEffect, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
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
  return <Panel title="Takip Ettiğim Satıcılar" description="Takip ettiğiniz üreticileri, canlı puanlarını, doğrulama sinyallerini ve mağaza bağlantılarını tek yerde yönetin.">
    {error?<ErrorState message={error} onRetry={()=>void load()}/>:null}
    {status?<div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div>:null}
    {!items.length?<EmptyState title="Takip edilen üretici yok" body="Üretici profilindeki Takip Et düğmesiyle mağazaları buraya ekleyebilirsiniz."/>:
    <div className="grid gap-4 sm:grid-cols-2">{items.map(p=>{
      const id=String(p.id);const busy=busyId===id;const ratingCount=Math.max(0,Number(p.ratingCount||0));const ratingAverage=Number(p.ratingAverage||0);
      return <article key={id} aria-busy={busy} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-3">
          {p.logoPath?<img src={catalogPublicUrl(p.logoPath)} alt="" loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-full object-cover"/>:<div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-green/10 text-xl font-bold text-brand-green">{String(p.displayName||'?').charAt(0).toUpperCase()}</div>}
          <div className="min-w-0 flex-1"><div className="text-lg font-bold">{p.displayName}</div><div className="mt-1 text-sm text-gray-500">{p.locationLabel || 'Konum bilgisi yayınlanmadı'} • {p.productCount} ürün</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            {p.verified?<span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>Üretici doğrulandı</span>:null}
            {p.originVerified?<span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/10 px-2.5 py-1 text-brand-gold"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>Menşe doğrulandı</span>:null}
          </div>
          {ratingCount>0?<div className="mt-2 inline-flex items-center gap-1 text-sm"><Star aria-hidden="true" className="h-4 w-4 fill-brand-gold text-brand-gold"/><strong>{ratingAverage.toFixed(1)}</strong><span className="text-gray-500">({ratingCount} değerlendirme)</span></div>:<div className="mt-2 text-xs text-gray-500">Henüz yayınlanmış mağaza değerlendirmesi yok</div>}</div>
        </div>
        {p.description?<p className="mt-3 line-clamp-2 text-sm leading-5 text-gray-600 dark:text-gray-300">{p.description}</p>:null}
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={()=>onOpenProducer?.(p.slug)} className="min-h-11 rounded-xl bg-brand-green px-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Mağazayı aç</button>
          <button type="button" disabled={busy} onClick={()=>void unfollow(p)} aria-label={`${p.displayName} üreticisini takip etmeyi bırak`} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{busy?'Bırakılıyor…':'Takibi bırak'}</button>
        </div>
      </article>;
    })}</div>}
  </Panel>;
}
