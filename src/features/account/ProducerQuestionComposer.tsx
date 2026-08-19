import React,{useEffect,useRef,useState}from'react';
import{Send,X}from'lucide-react';
import{startProducerOrderConversation,startProducerProductConversation,type StartedProducerConversation}from'./messagesApi';

type ProductContext={kind:'product';producerId:string;productId:string;productName:string};
type OrderContext={kind:'order';producerId:string;orderId:string;orderNumber:string;productName?:string|null};
type Props={context:ProductContext|OrderContext;onCancel:()=>void;onStarted:(result:StartedProducerConversation)=>void;className?:string};

export default function ProducerQuestionComposer({context,onCancel,onStarted,className=''}:Props){
 const[question,setQuestion]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');const inputRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{window.setTimeout(()=>inputRef.current?.focus(),30);},[context.kind,context.producerId,context.kind==='product'?context.productId:context.orderId]);
 const title=context.kind==='product'?`${context.productName} hakkında soru sor`:`${context.orderNumber} siparişi hakkında soru sor`;
 const description=context.kind==='product'?'Sorunuz bu ürüne ve doğrulanmış üreticiye bağlanır. Yanıt Hesabım > Mesajlarım bölümüne düşer.':`Sorunuz bu siparişteki ilgili üreticiye bağlanır${context.productName?` - ${context.productName}`:''}. Yanıt Hesabım > Mesajlarım bölümüne düşer.`;
 async function submit(){const message=question.trim();if(!message){setError('Sorunuzu yazın.');return;}if(message.length>5000){setError('Soru en fazla 5000 karakter olabilir.');return;}try{setBusy(true);setError('');const result=context.kind==='product'?await startProducerProductConversation({producerId:context.producerId,productId:context.productId,productName:context.productName,message}):await startProducerOrderConversation({producerId:context.producerId,orderId:context.orderId,orderNumber:context.orderNumber,message});setQuestion('');onStarted(result);}catch(e:unknown){setError(e instanceof Error?e.message:'Soru gönderilemedi.');}finally{setBusy(false);}}
 return<section aria-labelledby="producer-question-title" className={`rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 ${className}`}>
  <div className="flex items-start justify-between gap-3"><div><h3 id="producer-question-title" className="font-bold">{title}</h3><p className="mt-1 text-sm text-gray-500">{description}</p></div><button type="button" onClick={onCancel} disabled={busy} aria-label="Soru formunu kapat" className="min-h-11 rounded-lg border px-3 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-4 w-4"/></button></div>
  {error?<div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
  <label className="mt-3 block"><span className="text-sm font-semibold">Sorunuz</span><textarea ref={inputRef} value={question} onChange={event=>setQuestion(event.target.value)} maxLength={5000} rows={4} disabled={busy} className="mt-1 w-full rounded-xl border bg-white p-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:bg-gray-900" placeholder="Sorunuzu açık ve kısa şekilde yazın."/><span className="mt-1 block text-xs text-gray-500">{question.length}/5000</span></label>
  <button type="button" onClick={()=>void submit()} disabled={busy||!question.trim()} className="mt-3 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Send aria-hidden="true" className="mr-2 inline h-4 w-4"/>{busy?'Gönderiliyor…':'Soruyu gönder'}</button>
 </section>;
}
