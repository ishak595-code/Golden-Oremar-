import React,{useEffect,useState}from'react';
import{Bell,BellOff,Check,ChevronDown,Loader2,PackageCheck,Sparkles}from'lucide-react';
import type{OrderOptionDefinition,SelectedOrderOptions}from'./productExperience';
import{selectOrderOption,visibleOrderOptions}from'./productExperience';
import{currentProductReference,getProductAvailabilityState,setProductAvailabilitySubscription}from'./productAvailabilityApi';

type Props={lead:string;schema:OrderOptionDefinition[];selected:SelectedOrderOptions;onChange:(next:SelectedOrderOptions)=>void;disabled?:boolean;};

export default function PremiumOrderConfigurator({lead,schema,selected,onChange,disabled=false}:Props){
 const visible=visibleOrderOptions(schema,selected);
 // Closed by default when every choice already has a value: the customer
 // sees a one-line summary and opens it only to change something. A missing
 // required choice keeps it open, so nothing blocks the purchase unseen.
 const missing=visible.some(option=>option.required&&!selected[option.key]);
 const[open,setOpen]=useState(missing);
 useEffect(()=>{if(missing)setOpen(true);},[missing]);
 if(!visible.length)return null;
 const summary=visible.map(option=>option.choices.find(choice=>choice.value===selected[option.key])?.label).filter(Boolean).join(' · ');
 return<section aria-labelledby="premium-order-configurator-title" className={`go-order-config mt-5 overflow-hidden rounded-3xl border border-brand-gold/35 bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-card shadow-sm${open?' is-open':''}`}>
  <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="premium-order-configurator-body" className="go-order-config__header flex w-full items-center gap-3 p-4 text-left sm:p-5">
   <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><Sparkles className="h-5 w-5"/></span>
   <span className="min-w-0 flex-1"><span className="block text-[11px] font-black uppercase tracking-[0.16em] text-brand-gold">Sana göre hazırlansın</span><span id="premium-order-configurator-title" className="mt-0.5 block text-base font-black text-brand-text">Hazırlama tercihleri</span><span className="mt-0.5 block text-sm text-brand-muted [overflow-wrap:anywhere]">{summary||'Seçim yapın'}</span></span>
   <span className="go-order-config__change shrink-0 text-xs font-black text-brand-gold">{open?'Kapat':'Değiştir'}</span>
   <ChevronDown aria-hidden="true" className="go-order-config__chevron h-5 w-5 shrink-0 text-brand-gold"/>
  </button>
  <div id="premium-order-configurator-body" hidden={!open}>
   {lead?<p className="border-t border-brand-gold/20 px-4 pt-3 text-sm leading-6 text-brand-muted sm:px-5">{lead}</p>:null}
   <AvailabilityReminder/>
   <div className="space-y-5 p-4 sm:p-5">{visible.map(option=><OptionGroup key={option.key} option={option} value={selected[option.key]||''} disabled={disabled} onSelect={value=>onChange(selectOrderOption(schema,selected,option.key,value))}/>)}</div>
   <div className="flex items-center gap-2 border-t border-brand-gold/20 bg-brand-card/70 px-4 py-3 text-xs font-semibold leading-5 text-brand-muted sm:px-5"><PackageCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-green"/><span>Seçimlerin sipariş kaydına eklenir; sepet, sipariş ve üretici hazırlık ekranında aynı biçimde korunur.</span></div>
  </div>
 </section>;
}

function AvailabilityReminder(){
 const[eligible,setEligible]=useState(false),[authenticated,setAuthenticated]=useState(false),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const reference=currentProductReference();
 useEffect(()=>{let mounted=true;if(!reference)return;void(async()=>{try{const state=await getProductAvailabilityState(reference);if(!mounted)return;const commerce=state.commerce,sales=commerce&&typeof commerce==='object'?commerce.sales:null,seasonality=commerce&&typeof commerce==='object'?commerce.seasonality:null,preorder=commerce&&typeof commerce==='object'?commerce.preorder:null;const salesState=String(sales?.state||''),mode=String(seasonality?.mode||'');const canNotify=Boolean(preorder?.enabled)||mode==='seasonal'||['scheduled','planning','out_of_season'].includes(salesState);setEligible(canNotify);setAuthenticated(state.authenticated);setActive(state.authenticated&&canNotify&&commerce?.availabilitySubscribed===true);}catch{if(mounted){setEligible(false);setActive(false);}}})();return()=>{mounted=false;};},[reference]);
 if(!eligible)return null;
 async function toggle(){if(!authenticated){setMessage('Haber verme isteği için önce hesabınıza giriş yapın.');return;}try{setBusy(true);setMessage('');const result=await setProductAvailabilitySubscription(reference,!active);setActive(result.active);setMessage(result.active?'Sezon veya sipariş dönemi açıldığında size haber vereceğiz.':'Bu ürün için haber verme isteği kapatıldı.');}catch{setMessage('Haber verme tercihi şu anda kaydedilemedi.');}finally{setBusy(false);}}
 return<div className="border-b border-brand-gold/20 bg-brand-card/55 px-4 py-3 sm:px-5"><button type="button" onClick={()=>void toggle()} disabled={busy} aria-pressed={active} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand-gold/35 bg-brand-card px-4 text-sm font-black text-brand-green disabled:opacity-50">{busy?<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/>:active?<BellOff aria-hidden="true" className="h-4 w-4"/>:<Bell aria-hidden="true" className="h-4 w-4"/>}<span>{active?'Hatırlatmayı Kapat':'Sezon Açılınca Haber Ver'}</span></button>{message?<p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-brand-muted">{message}</p>:null}</div>;
}

function OptionGroup({option,value,disabled,onSelect}:{option:OrderOptionDefinition;value:string;disabled:boolean;onSelect:(value:string)=>void}){
 return<fieldset disabled={disabled}><legend className="text-sm font-black text-brand-text">{option.label}{option.required?<span className="sr-only"> zorunlu</span>:null}</legend>{option.help?<p className="mt-1 text-xs leading-5 text-brand-muted">{option.help}</p>:null}<div className="mt-2 grid gap-2 sm:grid-cols-2">{option.choices.map(choice=>{const active=value===choice.value;return<button type="button" key={choice.value} onClick={()=>onSelect(choice.value)} aria-pressed={active} disabled={disabled} className={`min-h-12 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-50 ${active?'border-brand-gold bg-brand-gold/10 shadow-sm':'border-brand-border bg-brand-card hover:border-brand-gold/50'}`}><span className="flex items-start gap-2"><span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active?'border-brand-gold bg-brand-gold text-white':'border-brand-border'}`}>{active?<Check className="h-3.5 w-3.5"/>:null}</span><span className="min-w-0"><span className="block text-sm font-black text-brand-text">{choice.label}</span>{choice.description?<span className="mt-0.5 block text-xs leading-5 text-brand-muted">{choice.description}</span>:null}</span></span></button>;})}</div></fieldset>;
}
