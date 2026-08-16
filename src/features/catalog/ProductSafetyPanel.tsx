import React,{useCallback,useEffect,useMemo,useState}from'react';
import{AlertTriangle,BookOpen,ExternalLink,PackageCheck,ShieldAlert}from'lucide-react';
import{getProductSafety}from'./api';

type Props={reference:string;locale?:string};

type PublicSafetyPayload={
 contentId?:string;
 contentSlug?:string;
 title?:string|null;
 summary?:string|null;
 locale?:string|null;
 updatedAt?:string|null;
 safety?:{
  schemaVersion?:string|null;
  guidanceKind?:string|null;
  safetyClass?:string|null;
  preparation?:{title?:string|null;items?:unknown};
  storage?:{title?:string|null;items?:unknown};
  allergens?:{known?:boolean|null;text?:string|null;verifyLabel?:string|null};
  warnings?:unknown;
  sources?:unknown;
 };
};

function stringItems(value:unknown){return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&item.trim().length>0).map(item=>item.trim()).slice(0,30):[];}
function warningItems(value:unknown){return Array.isArray(value)?value.map(item=>({severity:typeof item?.severity==='string'?item.severity.trim():'',text:typeof item?.text==='string'?item.text.trim():''})).filter(item=>item.text).slice(0,20):[];}
function sourceItems(value:unknown){return Array.isArray(value)?value.map(item=>({authority:typeof item?.authority==='string'?item.authority.trim():'',title:typeof item?.title==='string'?item.title.trim():'',topic:typeof item?.topic==='string'?item.topic.trim():'',url:typeof item?.url==='string'&&/^https:\/\//i.test(item.url)?item.url:'',accessedAt:typeof item?.accessedAt==='string'?item.accessedAt.trim():''})).filter(item=>item.authority||item.title||item.topic||item.url).slice(0,20):[];}

export default function ProductSafetyPanel({reference,locale='tr'}:Props){
 const[data,setData]=useState<PublicSafetyPayload|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 const load=useCallback(async()=>{try{setLoading(true);setError('');setData(await getProductSafety(reference,locale));}catch(err:any){setError(err?.message||'Ürün kullanım ve güvenlik bilgisi yüklenemedi.');setData(null);}finally{setLoading(false);}},[reference,locale]);
 useEffect(()=>{void load();},[load]);
 const safety=data?.safety;
 const preparation=useMemo(()=>stringItems(safety?.preparation?.items),[safety?.preparation?.items]);
 const storage=useMemo(()=>stringItems(safety?.storage?.items),[safety?.storage?.items]);
 const warnings=useMemo(()=>warningItems(safety?.warnings),[safety?.warnings]);
 const sources=useMemo(()=>sourceItems(safety?.sources),[safety?.sources]);
 const allergenText=String(safety?.allergens?.text||'').trim();const verifyLabel=String(safety?.allergens?.verifyLabel||'').trim();
 const hasContent=preparation.length>0||storage.length>0||warnings.length>0||!!allergenText||!!verifyLabel||sources.length>0;
 if(loading)return<section aria-labelledby="product-safety-title" className="mt-5 rounded-2xl border p-5"><h2 id="product-safety-title" className="text-xl font-bold">Kullanım, Saklama & Güvenlik</h2><div role="status" aria-live="polite" className="mt-3 text-sm text-gray-500">Yayınlanmış ürün güvenliği bilgisi yükleniyor…</div></section>;
 if(error)return<section aria-labelledby="product-safety-title" className="mt-5 rounded-2xl border p-5"><h2 id="product-safety-title" className="text-xl font-bold">Kullanım, Saklama & Güvenlik</h2><div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border px-4 font-semibold">Tekrar dene</button></section>;
 if(!data||!hasContent)return null;
 return<section aria-labelledby="product-safety-title" className="mt-5 rounded-2xl border p-5">
  <div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-brand-gold"/><div><h2 id="product-safety-title" className="text-xl font-bold">Kullanım, Saklama & Güvenlik</h2><p className="mt-1 text-sm text-gray-500">Yayınlanmış ürün güvenliği içeriği. Bu alan tanı veya tedavi önerisi değildir.</p>{data.locale&&data.locale!==locale?<p className="mt-1 text-xs text-gray-500">İstenen dilde doğrulanmış içerik olmadığı için mevcut Türkçe kayıt gösteriliyor.</p>:null}</div></div>
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
   {preparation.length?<section aria-labelledby="product-preparation-title" className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><h3 id="product-preparation-title" className="flex items-center gap-2 font-bold"><BookOpen aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safety?.preparation?.title||'Kullanım / Hazırlama'}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700 dark:text-gray-300">{preparation.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul></section>:null}
   {storage.length?<section aria-labelledby="product-storage-title" className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><h3 id="product-storage-title" className="flex items-center gap-2 font-bold"><PackageCheck aria-hidden="true" className="h-4 w-4 text-brand-gold"/>{safety?.storage?.title||'Saklama'}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700 dark:text-gray-300">{storage.map((item,index)=><li key={`${index}:${item}`}>{item}</li>)}</ul></section>:null}
  </div>
  {allergenText||verifyLabel?<section aria-labelledby="product-allergen-title" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><h3 id="product-allergen-title" className="font-bold">Alerjen / Etiket Kontrolü</h3>{allergenText?<p className="mt-2 text-sm leading-6">{allergenText}</p>:null}{verifyLabel?<p className="mt-2 text-sm font-semibold">{verifyLabel}</p>:null}</section>:null}
  {warnings.length?<section aria-labelledby="product-warnings-title" className="mt-4"><h3 id="product-warnings-title" className="flex items-center gap-2 font-bold"><AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600"/>Uyarılar</h3><ul className="mt-2 space-y-2">{warnings.map((warning,index)=><li key={`${index}:${warning.text}`} className="rounded-xl border p-3 text-sm leading-6"><span className="sr-only">Uyarı. </span>{warning.text}</li>)}</ul></section>:null}
  {sources.length?<details className="mt-4 rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-bold">Bilgi kaynakları ({sources.length})</summary><ul className="mt-3 space-y-3">{sources.map((source,index)=><li key={`${index}:${source.url||source.title}`} className="text-sm"><div className="font-semibold">{source.authority||source.title||source.topic||'Kaynak'}</div>{source.authority&&source.title?<div className="text-gray-600 dark:text-gray-300">{source.title}</div>:null}{source.topic?<div className="text-xs text-gray-500">{source.topic}</div>:null}{source.url?<a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-brand-green underline underline-offset-2">Kaynağı aç<ExternalLink aria-hidden="true" className="h-4 w-4"/></a>:null}</li>)}</ul></details>:null}
 </section>;
}
