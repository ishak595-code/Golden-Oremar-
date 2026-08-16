import React,{useEffect,useMemo,useState}from'react';
import{CircleHelp,FileText,Info,Search,Shield,Undo2}from'lucide-react';
import{getAccountHelpContent}from'./api';
import{listPublicFaq,type PublicFaqItem,type PublicFaqResponse}from'./faqApi';
import{ErrorState,LoadingState,Panel}from'./ui';

type Key='about'|'returns'|'privacy'|'terms';
const meta:Record<Key,{label:string;Icon:any}>={
 about:{label:'Hakkımızda',Icon:Info},
 returns:{label:'İade ve İptal',Icon:Undo2},
 privacy:{label:'Gizlilik ve Veri İşleme',Icon:Shield},
 terms:{label:'Kullanım Koşulları',Icon:FileText},
};

export default function SupportPanel({locale='tr',onOpenMessages}:{locale?:string;onOpenMessages?:()=>void}){
 const[data,setData]=useState<any>(null);
 const[faq,setFaq]=useState<PublicFaqResponse|null>(null);
 const[selected,setSelected]=useState<Key|null>(null);
 const[query,setQuery]=useState('');
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');
 const[faqError,setFaqError]=useState('');

 async function load(){
  setLoading(true);setError('');setFaqError('');
  const[helpResult,faqResult]=await Promise.allSettled([getAccountHelpContent(locale),listPublicFaq(locale)]);
  if(helpResult.status==='fulfilled')setData(helpResult.value);else setError(helpResult.reason?.message||'Yardım içerikleri yüklenemedi.');
  if(faqResult.status==='fulfilled')setFaq(faqResult.value);else{setFaq(null);setFaqError(faqResult.reason?.message||'Sıkça sorulan sorular yüklenemedi.');}
  setLoading(false);
 }
 useEffect(()=>{setSelected(null);setQuery('');void load();},[locale]);

 const groupedFaq=useMemo(()=>{
  const needle=query.trim().toLocaleLowerCase('tr-TR');
  const filtered=(faq?.items||[]).filter(item=>!needle||`${item.question} ${item.answer} ${item.category} ${(item.tags||[]).join(' ')}`.toLocaleLowerCase('tr-TR').includes(needle));
  return filtered.reduce<Record<string,PublicFaqItem[]>>((groups,item)=>{
    const key=item.category||'Diğer';
    (groups[key]??=[]).push(item);
    return groups;
  },{});
 },[faq,query]);

 if(loading)return<LoadingState label="Yardım merkezi yükleniyor"/>;
 if(selected&&data?.[selected]){
   const item=data[selected];
   return<Panel title={item.title||meta[selected].label}>
     <button onClick={()=>setSelected(null)} className="mb-4 min-h-11 rounded-xl border px-4 font-semibold">Yardım merkezine dön</button>
     {item.summary?<p className="mb-4 text-sm text-gray-500">{item.summary}</p>:null}
     {item.sanitizedHtml
       ? <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{__html:item.sanitizedHtml}}/>
       : <div className="whitespace-pre-wrap leading-7">{item.markdown||'İçerik henüz yayınlanmadı.'}</div>}
   </Panel>;
 }

 const faqGroups=Object.entries(groupedFaq);
 return<Panel title="Yardım & Destek" description="Sıkça sorulan sorular, yayınlanmış bilgilendirme metinleri ve güvenli destek kanalı.">
   {error?<ErrorState message={error} onRetry={load}/>:null}

   <section aria-labelledby="faq-title" className="space-y-4">
     <div>
       <h2 id="faq-title" className="flex items-center gap-2 text-lg font-bold"><CircleHelp className="h-5 w-5 text-brand-gold"/>Sıkça Sorulan Sorular</h2>
       <p className="mt-1 text-sm text-gray-500">Ürün doğrulama, sipariş, teslimat, hesap ve satıcı süreçleri hakkında gerçek uygulama davranışları.</p>
     </div>
     {faq?.fallbackUsed?<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Bu dil için doğrulanmış SSS çevirisi henüz yayınlanmadı; Türkçe içerik gösteriliyor.</div>:null}
     {faqError?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{faqError}</div>:null}
     <label className="relative block">
       <span className="sr-only">Sıkça sorulan sorularda ara</span>
       <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/>
       <input value={query} onChange={event=>setQuery(event.target.value)} type="search" placeholder="Sorularda ara" className="min-h-12 w-full rounded-xl border bg-transparent pl-11 pr-3"/>
     </label>
     <div className="sr-only" aria-live="polite">{faq?`${faqGroups.reduce((count,[,items])=>count+items.length,0)} SSS eşleşmesi`:''}</div>
     {faq&&!faqGroups.length?<div className="rounded-xl border border-dashed p-5 text-center text-sm text-gray-500">Aramanızla eşleşen SSS bulunamadı.</div>:null}
     {faqGroups.map(([category,items])=><section key={category} aria-labelledby={`faq-category-${slugify(category)}`} className="space-y-2">
       <h3 id={`faq-category-${slugify(category)}`} className="text-sm font-bold uppercase tracking-wide text-brand-gold">{category}</h3>
       {items.map(item=><details key={item.id} className="group rounded-xl border bg-white dark:bg-gray-900">
         <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold">{item.question}</summary>
         <div className="border-t px-4 py-4 text-sm leading-7 text-gray-600 dark:text-gray-300">{item.answer}</div>
       </details>)}
     </section>)}
   </section>

   <section aria-labelledby="help-documents-title" className="mt-6 space-y-3">
     <h2 id="help-documents-title" className="text-lg font-bold">Bilgilendirme ve politikalar</h2>
     {(Object.keys(meta) as Key[]).map(key=>{
       const item=data?.[key]; if(!item)return null; const Icon=meta[key].Icon;
       return<button key={key} onClick={()=>setSelected(key)} className="min-h-14 w-full rounded-xl border p-4 text-left">
         <span className="flex items-center gap-3"><Icon className="h-5 w-5 text-brand-gold"/><span className="font-bold">{item.title||meta[key].label}</span></span>
       </button>;
     })}
     {!data?.terms?<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
       Kullanım Koşulları için doğrulanmış yayın kaydı henüz yok. Uydurma hukuk metni gösterilmiyor.
     </div>:null}
     {onOpenMessages?<button onClick={onOpenMessages} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white">Destek konuşmalarımı aç</button>:null}
   </section>
 </Panel>;
}

function slugify(value:string){return value.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi,'-').replace(/^-+|-+$/g,'');}
