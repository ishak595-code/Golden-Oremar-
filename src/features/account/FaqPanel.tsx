import React,{useEffect,useMemo,useState}from'react';
import{Search}from'lucide-react';
import{listPublicFaq,type PublicFaqItem}from'./faqApi';

export default function FaqPanel({locale='tr'}:{locale?:string}){
 const[data,setData]=useState<{locale:string;fallbackUsed:boolean;items:PublicFaqItem[]}|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[query,setQuery]=useState('');const[category,setCategory]=useState('Tümü');
 async function load(){try{setLoading(true);setError('');const result=await listPublicFaq(locale);setData({locale:result.locale,fallbackUsed:result.fallbackUsed,items:result.items});}catch(e:any){setError(e?.message||'Sık sorulan sorular yüklenemedi.');setData(null);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[locale]);
 const categories=useMemo(()=>['Tümü',...Array.from(new Set((data?.items||[]).map(item=>item.category)))],[data]);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase('tr-TR');return(data?.items||[]).filter(item=>(category==='Tümü'||item.category===category)&&(!q||`${item.question} ${item.answer} ${(item.tags||[]).join(' ')}`.toLocaleLowerCase('tr-TR').includes(q)));},[data,query,category]);
 return<section aria-labelledby="faq-title" className="rounded-2xl border p-5">
  <div><h2 id="faq-title" className="text-xl font-bold">Sık Sorulan Sorular</h2><p className="mt-1 text-sm text-gray-500">Sipariş, güven, ürün güvenliği, hesap ve satıcı süreçleri hakkında yayınlanmış cevaplar.</p>{data?.fallbackUsed?<p className="mt-2 text-xs text-gray-500">İstenen dilde yayınlanmış SSS bulunmadığı için mevcut Türkçe içerik gösteriliyor.</p>:null}</div>
  {loading?<div role="status" aria-live="polite" className="mt-4 text-sm text-gray-500">Sık sorulan sorular yükleniyor…</div>:null}
  {error?<div className="mt-4"><div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</div><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border px-4 font-semibold">Tekrar dene</button></div>:null}
  {!loading&&!error&&data?<>
   <label className="mt-4 block" htmlFor="faq-search"><span className="text-sm font-semibold">SSS içinde ara</span><div className="relative mt-2"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input id="faq-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Örneğin: iade, organik, kargo" className="min-h-11 w-full rounded-xl border bg-transparent pl-10 pr-3"/></div></label>
   <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="SSS kategorileri">{categories.map(item=><button key={item} type="button" aria-pressed={category===item} onClick={()=>setCategory(item)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${category===item?'border-brand-green bg-brand-green text-white':'bg-white dark:bg-gray-900'}`}>{item}</button>)}</div>
   <div role="status" aria-live="polite" className="mt-3 text-sm text-gray-500">{filtered.length} soru gösteriliyor.</div>
   {filtered.length?<div className="mt-3 space-y-2">{filtered.map(item=><details key={item.id} className="rounded-xl border bg-white dark:bg-gray-900"><summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{item.question}</summary><div className="border-t px-4 py-4"><p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">{item.answer}</p><div className="mt-3 text-xs text-gray-500">Kategori: {item.category}</div></div></details>)}</div>:<div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-gray-500">Aramanızla eşleşen yayınlanmış soru bulunamadı.</div>}
  </>:null}
 </section>;
}
