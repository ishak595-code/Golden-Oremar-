import React,{useEffect,useRef,useState}from'react';
import{ChevronRight,FileText,Info,Mail,MessageCircle,Shield,Undo2}from'lucide-react';
import{getAccountHelpContent}from'./api';
import type{AccountHelpContent,AccountHelpDocument}from'./types';
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
const HELP_KEYS=Object.keys(meta)as Key[];

function safeHref(value:string){const href=value.trim();if(/^https:\/\//i.test(href)||/^mailto:/i.test(href)||/^tel:/i.test(href))return href;return'';}
function hasPublishedBody(document:AccountHelpDocument|null):document is AccountHelpDocument{return Boolean(document&&(document.sanitizedHtml.trim()||document.markdown.trim()));}
function renderSafeNode(node:ChildNode,key:string):React.ReactNode{
 if(node.nodeType===3)return node.textContent;
 if(node.nodeType!==1)return null;
 const element=node as Element;const tag=element.tagName.toLowerCase();const children=Array.from(element.childNodes).map((child,index)=>renderSafeNode(child,`${key}-${index}`));
 if(tag==='h1'||tag==='h2'||tag==='h3'||tag==='h4')return<h3 key={key} className="mt-6 text-lg font-bold text-brand-green first:mt-0 dark:text-brand-gold">{children}</h3>;
 if(tag==='p')return<p key={key} className="mt-3 leading-7 text-gray-700 dark:text-gray-300">{children}</p>;
 if(tag==='ul')return<ul key={key} className="mt-3 list-disc space-y-2 pl-5 text-gray-700 dark:text-gray-300">{children}</ul>;
 if(tag==='ol')return<ol key={key} className="mt-3 list-decimal space-y-2 pl-5 text-gray-700 dark:text-gray-300">{children}</ol>;
 if(tag==='li')return<li key={key}>{children}</li>;
 if(tag==='strong'||tag==='b')return<strong key={key}>{children}</strong>;
 if(tag==='em'||tag==='i')return<em key={key}>{children}</em>;
 if(tag==='br')return<br key={key}/>;
 if(tag==='a'){const href=safeHref(element.getAttribute('href')||'');return href?<a key={key} href={href} target={href.startsWith('https://')?'_blank':undefined} rel={href.startsWith('https://')?'noopener noreferrer':undefined} className="font-semibold text-brand-green underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-brand-gold">{children}</a>:<React.Fragment key={key}>{children}</React.Fragment>;}
 return<React.Fragment key={key}>{children}</React.Fragment>;
}
function PublishedBody({source}:{source:string}){
 if(typeof DOMParser==='undefined')return<div className="whitespace-pre-wrap break-words leading-7">{source.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}</div>;
 const documentValue=new DOMParser().parseFromString(source,'text/html');
 return<div className="break-words">{Array.from(documentValue.body.childNodes).map((node,index)=>renderSafeNode(node,`help-${index}`))}</div>;
}

export default function SupportPanel({locale='tr',onOpenMessages,onOpenContact}:{locale?:string;onOpenMessages?:()=>void;onOpenContact?:()=>void}){
 const[data,setData]=useState<AccountHelpContent|null>(null);const[selected,setSelected]=useState<Key|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const documentRef=useRef<HTMLDivElement|null>(null);
 async function load(silent=false){try{if(!silent)setLoading(true);setError('');setData(await getAccountHelpContent(locale));}catch(e:unknown){setError(e instanceof Error&&e.message?e.message:'Yardım içerikleri yüklenemedi.');if(!silent)setData(null);}finally{if(!silent)setLoading(false);}}
 useEffect(()=>{void load();},[locale]);
 useEffect(()=>{const restore=()=>void load(true);window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[locale]);
 useEffect(()=>{if(!selected)return;const frame=window.requestAnimationFrame(()=>documentRef.current?.focus({preventScroll:false}));return()=>window.cancelAnimationFrame(frame);},[selected]);
 if(loading)return<LoadingState label="Yardım merkezi yükleniyor"/>;
 if(selected){const item=data?.[selected]??null;if(!hasPublishedBody(item))return<div ref={documentRef} tabIndex={-1} role="region" aria-label={`${meta[selected].label} belgesi`} className="outline-none"><Panel title={meta[selected].label} description={meta[selected].description}><button type="button" onClick={()=>setSelected(null)} className="mb-4 min-h-11 rounded-xl border border-gray-200 px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">Yardım merkezine dön</button><div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Bu belge için doğrulanmış yayın içeriği şu anda kullanılamıyor. Geçici veya uydurma hukuki metin gösterilmiyor.</div></Panel></div>;const source=item.sanitizedHtml.trim()||item.markdown.trim();return<div ref={documentRef} tabIndex={-1} role="region" aria-label={`${item.title} belgesi`} className="outline-none"><Panel title={item.title} description={item.summary||meta[selected].description}><button type="button" onClick={()=>setSelected(null)} className="mb-5 min-h-11 rounded-xl border border-gray-200 px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">Yardım merkezine dön</button><PublishedBody source={source}/></Panel></div>;}
 const publishedCount=HELP_KEYS.filter(key=>hasPublishedBody(data?.[key]??null)).length;
 return<Panel title="Yardım & Destek" description="SSS, destek kanalları, iade bilgileri, gizlilik, kullanım koşulları ve Golden Oremar bilgilendirmeleri tek merkezde.">
   {error?<div className="mb-4"><ErrorState message={error} onRetry={()=>void load()}/></div>:null}
   <div className="space-y-6">
     <section aria-labelledby="support-channels-title"><div className="mb-3"><h2 id="support-channels-title" className="text-lg font-bold">Destek kanalları</h2><p className="mt-1 text-sm text-gray-500">Sorununuza göre güvenli mesajlaşmayı veya iletişim formunu kullanabilirsiniz.</p></div><div className="grid gap-3 sm:grid-cols-2">{onOpenMessages?<button type="button" onClick={onOpenMessages} className="min-h-20 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><span className="flex items-center gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green"><MessageCircle className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-bold">Destek konuşmalarım</span><span className="mt-1 block text-sm text-gray-500">Açık ve geçmiş destek konuşmalarınızı görüntüleyin.</span></span><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></span></button>:null}{onOpenContact?<button type="button" onClick={onOpenContact} className="min-h-20 rounded-2xl border border-gray-200 bg-white p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 dark:bg-gray-900"><span className="flex items-center gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Mail className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-bold">İletişim formu</span><span className="mt-1 block text-sm text-gray-500">Genel iletişim veya destek talebinizi uygulama içinden gönderin.</span></span><ChevronRight aria-hidden="true" className="h-5 w-5 text-gray-400"/></span></button>:null}</div></section>
     <FaqPanel locale={locale}/>
     <section aria-labelledby="help-policies-title" className="space-y-3"><div><h2 id="help-policies-title" className="text-lg font-bold">Yasal & Bilgilendirme</h2><p className="mt-1 text-sm text-gray-500">{publishedCount}/4 doğrulanmış yayın kaydı kullanılabilir. Yayınlanmamış metinler uydurulmaz.</p></div>{HELP_KEYS.map(key=>{const config=meta[key];const item=data?.[key]??null;const Icon=config.Icon;if(!hasPublishedBody(item))return<div key={key} className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"><span className="flex items-start gap-3"><span aria-hidden="true" className="rounded-xl bg-gray-100 p-2 text-gray-500 dark:bg-gray-800"><Icon className="h-5 w-5"/></span><span><span className="block font-bold">{config.label}</span><span className="mt-1 block text-sm text-gray-500">Doğrulanmış yayın kaydı henüz yok. Geçici veya uydurma hukuki metin gösterilmiyor.</span></span></span></div>;return<button type="button" key={key} onClick={()=>setSelected(key)} className="min-h-20 w-full rounded-2xl border border-gray-200 bg-white p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 dark:bg-gray-900"><span className="flex items-start gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-gold/10 p-2 text-brand-gold"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block font-bold">{item.title}</span><span className="mt-1 block text-sm text-gray-500">{item.summary||config.description}</span><span className="mt-2 block text-xs font-semibold text-brand-green dark:text-brand-gold">Yayınlanmış belgeyi aç</span></span><ChevronRight aria-hidden="true" className="mt-2 h-5 w-5 text-gray-400"/></span></button>;})}</section>
   </div>
 </Panel>;
}
