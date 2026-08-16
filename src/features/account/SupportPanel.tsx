
import React,{useEffect,useState}from'react';
import{FileText,Info,Shield,Undo2}from'lucide-react';
import{getAccountHelpContent}from'./api';
import{ErrorState,LoadingState,Panel}from'./ui';

type Key='about'|'returns'|'privacy'|'terms';
const meta:Record<Key,{label:string;Icon:any}>={
 about:{label:'Hakkımızda',Icon:Info},
 returns:{label:'İade ve İptal',Icon:Undo2},
 privacy:{label:'Gizlilik ve Veri İşleme',Icon:Shield},
 terms:{label:'Kullanım Koşulları',Icon:FileText},
};

export default function SupportPanel({locale='tr',onOpenMessages}:{locale?:string;onOpenMessages?:()=>void}){
 const[data,setData]=useState<any>(null);const[selected,setSelected]=useState<Key|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 async function load(){try{setLoading(true);setData(await getAccountHelpContent(locale));}catch(e:any){setError(e?.message||'Yardım içerikleri yüklenemedi.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[locale]);
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
 return<Panel title="Yardım & Destek" description="Yayınlanmış bilgilendirme metinleri ve destek kanalına buradan ulaşabilirsiniz.">
   {error?<ErrorState message={error} onRetry={load}/>:null}
   <div className="space-y-3">
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
   </div>
 </Panel>;
}
