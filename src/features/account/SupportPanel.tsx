import React,{useEffect,useRef,useState}from'react';
import{ChevronRight,FileText,Info,Mail,MessageCircle,Shield,Undo2}from'lucide-react';
import{getAccountHelpContent}from'./api';
import{ErrorState,LoadingState,Panel}from'./ui';
import FaqPanel from'./FaqPanel';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';

type Key='about'|'returns'|'privacy'|'terms';
const meta:Record<Key,{label:string;description:string;Icon:any}>={
 about:{label:'Hakkımızda',description:'Golden Oremar yaklaşımı, üretici güveni ve platform bilgileri',Icon:Info},
 returns:{label:'İade ve İptal',description:'İade, sorun bildirimi, iptal ve geri ödeme süreçleri',Icon:Undo2},
 privacy:{label:'Gizlilik ve Veri İşleme',description:'Hesap, sipariş ve uygulama verilerinin işlenmesine ilişkin bilgiler',Icon:Shield},
 terms:{label:'Kullanım Koşulları',description:'Uygulamanın kullanımına ilişkin yayınlanmış koşullar',Icon:FileText},
};

function isRecord(value:unknown):value is Record<string,any>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function text(value:unknown,max=4000){return typeof value==='string'?value.trim().slice(0,max):'';}
function publishedItem(value:unknown){
 if(!isRecord(value))return null;
 const sanitizedHtml=text(value.sanitizedHtml,100000);
 const markdown=text(value.markdown,100000);
 if(!sanitizedHtml&&!markdown)return null;
 return{...value,title:text(value.title,240),summary:text(value.summary,1200),sanitizedHtml,markdown};
}

export default function SupportPanel({locale='tr',onOpenMessages,onOpenContact}:{locale?:string;onOpenMessages?:()=>void;onOpenContact?:()=>void}){
 const[data,setData]=useState<Record<string,any>|null>(null);const[selected,setSelected]=useState<Key|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const documentRef=useRef<HTMLDivElement|null>(null);
 async function load(silent=false){
  try{
   if(!silent)setLoading(true);setError('');
   const next=await getAccountHelpContent(locale);
   if(!isRecord(next))throw new Error('Yardım içerikleri sunucudan doğrulanamadı.');
   setData(next);
  }catch(e:any){setError(e?.message||'Yardım içerikleri yüklenemedi.');if(!silent)setData(null);}finally{if(!silent)setLoading(false);}
 }
 useEffect(()=>{void load();},[locale]);
 useEffect(()=>{const restore=()=>void load(true);window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[locale]);
 useEffect(()=>{if(!selected)return;const frame=window.requestAnimationFrame(()=>documentRef.current?.focus({preventScroll:false}));return()=>window.cancelAnimationFrame(frame);},[selected]);
 if(loading)return<LoadingState label="Yardım merkezi yükleniyor"/>;
 if(selected){
   const item=publishedItem(data?.[selected]);
   if(item){
    return<div ref={documentRef} tabIndex={-1} role="region" aria-label={`${item.title||meta[selected].label} belgesi`} className="outline-none"><Panel title={item.title||meta[selected].label} description={item.summary||meta[selected].description}>
      <button type="button" onClick={()=>setSelected(null)} className="mb-5 min-h-11 rounded-xl border border-gray-200 px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">Yardım merkezine dön</button>
      {item.sanitizedHtml
        ? <div className="prose max-w-none break-words dark:prose-invert" dangerouslySetInnerHTML={{__html:item.sanitizedHtml}}/>
        : <div className="whitespace-pre-wrap break-words leading-7">{item.markdown}</div>}
    </Panel></div>;
   }
   setSelected(null);
 }
 const publishedCount=(Object.keys(meta)as Key[]).filter(key=>Boolean(publishedItem(data?.[key]))).length;
 return<Panel title="Yardım & Destek" description="SSS, destek kanalları, iade bilgileri, gizlilik, kullanım koşulları ve Golden Oremar bilgilendirmeleri tek merkezde.">
   {error?<div className="mb-4"><ErrorState message={error} onRetry={()=>void load()}/></div>:null}
   <div className="space-y-6">
     <section aria-labelledby="support-channels-title">
       <div className="mb-3"><h2 id="support-channels-title" className="text-lg font-bold">Destek kanalları</h2><p className="mt-1 text-sm text-gray-500">Sorununuza göre güvenli mesajlaşmayı veya iletişim formunu kullanabilirsiniz.</p></div>
       <div className="grid gap-3 sm:grid-cols-2">
         {onOpenMessages?<button type="button" onClick={onOpenMessages} className="min-h-20 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><span className="flex items-center gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><MessageCircle className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-bold">Destek konuşmalarım</span><span className="mt-1 block text-sm text-gray-500">Açık ve geçmiş destek konuşmalarınızı görüntüleyin.</span></span><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></span></button>:null}
         {onOpenContact?<button type="button" onClick={onOpenContact} className="min-h-20 rounded-2xl border border-gray-200 bg-white p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 dark:bg-gray-900"><span className="flex items-center gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Mail className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-bold">İletişim formu</span><span className="mt-1 block text-sm text-gray-500">Genel iletişim veya destek talebinizi uygulama içinden gönderin.</span></span><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></span></button>:null}
       </div>
     </section>

     <FaqPanel locale={locale}/>

     <section aria-labelledby="help-policies-title" className="space-y-3">
       <div><h2 id="help-policies-title" className="text-lg font-bold">Yasal & Bilgilendirme</h2><p className="mt-1 text-sm text-gray-500">{publishedCount}/4 doğrulanmış yayın kaydı kullanılabilir. Yayınlanmamış metinler uydurulmaz.</p></div>
       {(Object.keys(meta) as Key[]).map(key=>{
         const config=meta[key];const item=publishedItem(data?.[key]);const Icon=config.Icon;
         if(!item)return<div key={key} className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"><span className="flex items-start gap-3"><span aria-hidden="true" className="rounded-xl bg-gray-100 p-2 text-gray-500 dark:bg-gray-800"><Icon className="h-5 w-5"/></span><span><span className="block font-bold">{config.label}</span><span className="mt-1 block text-sm text-gray-500">Doğrulanmış yayın kaydı henüz yok. Uydurma metin gösterilmiyor.</span></span></span></div>;
         return<button type="button" key={key} onClick={()=>setSelected(key)} className="min-h-20 w-full rounded-2xl border border-gray-200 bg-white p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 dark:bg-gray-900">
           <span className="flex items-start gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-bold">{item.title||config.label}</span><span className="mt-1 block text-sm text-gray-500">{item.summary||config.description}</span><span className="mt-2 block text-xs font-semibold text-brand-green dark:text-brand-gold">Yayınlanmış belgeyi aç</span></span><ChevronRight aria-hidden="true" className="mt-2 h-5 w-5 text-gray-400"/></span>
         </button>;
       })}
     </section>
   </div>
 </Panel>;
}
