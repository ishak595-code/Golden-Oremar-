import React,{useEffect,useMemo,useState}from'react';
import{CreditCard,ShieldCheck,X}from'lucide-react';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';

const IYZICO_HOSTS=new Set(['cpp.iyzipay.com','sandbox-cpp.iyzipay.com','api.iyzipay.com','sandbox-api.iyzipay.com']);

function iframeUrl(value:string){
 const raw=value.trim();
 if(!raw)throw new Error('iyzico ödeme ekranı bulunamadı.');
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||!IYZICO_HOSTS.has(url.hostname.toLowerCase()))throw new Error('iyzico ödeme ekranı doğrulanamadı.');
 url.searchParams.set('iframe','true');
 return url.toString();
}

type Props={
 open:boolean;
 paymentPageUrl:string|null;
 title?:string;
 description?:string;
 statusText?:string;
 onClose:()=>void;
};

export default function HostedPaymentDialog({open,paymentPageUrl,title='Güvenli Ödeme',description='Ödemenizi Golden Oremar uygulamasından ayrılmadan iyzico güvenli ödeme ekranında tamamlayın.',statusText,onClose}:Props){
 const[loaded,setLoaded]=useState(false);
 const[frameError,setFrameError]=useState('');
 const dialogRef=useAccessibleDialog<HTMLDivElement>(open,()=>onClose());
 const src=useMemo(()=>{
  if(!open||!paymentPageUrl)return'';
  try{return iframeUrl(paymentPageUrl);}catch{return'';}
 },[open,paymentPageUrl]);
 useEffect(()=>{if(open){setLoaded(false);setFrameError(src?'':'Ödeme ekranı güvenlik kontrolünden geçemedi.');}},[open,src]);
 if(!open)return null;
 return<div className="fixed inset-0 z-[130] bg-black/75 p-0 sm:p-4">
  <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hosted-payment-title" aria-describedby="hosted-payment-description" tabIndex={-1} className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white text-brand-text shadow-2xl outline-none dark:bg-gray-950 sm:h-[calc(100dvh-2rem)] sm:rounded-3xl">
   <header className="border-b bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-brand-green dark:text-brand-gold"><CreditCard aria-hidden="true" className="h-5 w-5"/><span className="text-xs font-bold uppercase tracking-[0.14em]">iyzico</span></div><h2 id="hosted-payment-title" className="mt-1 text-xl font-bold">{title}</h2><p id="hosted-payment-description" className="mt-1 text-sm text-gray-500">{description}</p></div><button type="button" onClick={onClose} aria-label="Ödeme penceresini kapat" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5"/></button></div>
    <div className="mt-3 flex gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/><p>Kart verileri Golden Oremar sunucusunda tutulmaz. Ödeme sonucu yalnız sunucu doğrulamasından sonra başarılı sayılır.</p></div>
    {statusText?<div role="status" aria-live="polite" className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">{statusText}</div>:null}
   </header>
   <div className="relative min-h-0 flex-1 bg-gray-50 dark:bg-black">
    {!loaded&&!frameError?<div role="status" className="absolute inset-0 z-10 grid place-items-center p-5 text-center text-sm text-gray-500">Güvenli ödeme ekranı hazırlanıyor…</div>:null}
    {frameError?<div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{frameError}<button type="button" onClick={onClose} className="mt-3 block min-h-11 rounded-xl border px-4 font-semibold">Kapat</button></div>:null}
    {src?<iframe src={src} title="iyzico güvenli ödeme formu" referrerPolicy="no-referrer" allow="payment *" onLoad={()=>setLoaded(true)} className="h-full w-full border-0 bg-white"/>:null}
   </div>
  </div>
 </div>;
}
