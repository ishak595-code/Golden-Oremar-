import React from'react';
import{Check,PackageCheck,Sparkles}from'lucide-react';
import type{OrderOptionDefinition,SelectedOrderOptions}from'./productExperience';
import{selectOrderOption,visibleOrderOptions}from'./productExperience';

type Props={
 lead:string;
 schema:OrderOptionDefinition[];
 selected:SelectedOrderOptions;
 onChange:(next:SelectedOrderOptions)=>void;
 disabled?:boolean;
};

export default function PremiumOrderConfigurator({lead,schema,selected,onChange,disabled=false}:Props){
 const visible=visibleOrderOptions(schema,selected);
 if(!visible.length)return null;
 return<section aria-labelledby="premium-order-configurator-title" className="mt-5 overflow-hidden rounded-3xl border border-brand-gold/35 bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-card shadow-sm">
  <div className="border-b border-brand-gold/20 p-4 sm:p-5">
   <div className="flex items-start gap-3">
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold"><Sparkles className="h-5 w-5"/></span>
    <div className="min-w-0"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-gold">Sana göre hazırlansın</div><h2 id="premium-order-configurator-title" className="mt-1 text-lg font-black text-brand-green dark:text-brand-gold">Siparişini nasıl hazırlayalım?</h2>{lead?<p className="mt-1 text-sm leading-6 text-brand-muted">{lead}</p>:null}</div>
   </div>
  </div>
  <div className="space-y-5 p-4 sm:p-5">{visible.map(option=><OptionGroup key={option.key} option={option} value={selected[option.key]||''} disabled={disabled} onSelect={value=>onChange(selectOrderOption(schema,selected,option.key,value))}/>)}</div>
  <div className="flex items-center gap-2 border-t border-brand-gold/20 bg-brand-card/70 px-4 py-3 text-xs font-semibold leading-5 text-brand-muted sm:px-5"><PackageCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-green"/><span>Seçimlerin sipariş kaydına eklenir ve hazırlık sırasında üreticiye iletilir.</span></div>
 </section>;
}

function OptionGroup({option,value,disabled,onSelect}:{option:OrderOptionDefinition;value:string;disabled:boolean;onSelect:(value:string)=>void}){
 return<fieldset disabled={disabled}>
  <legend className="text-sm font-black text-brand-text">{option.label}{option.required?<span className="sr-only"> zorunlu</span>:null}</legend>
  {option.help?<p className="mt-1 text-xs leading-5 text-brand-muted">{option.help}</p>:null}
  <div className="mt-2 grid gap-2 sm:grid-cols-2">{option.choices.map(choice=>{const active=value===choice.value;return<button type="button" key={choice.value} onClick={()=>onSelect(choice.value)} aria-pressed={active} disabled={disabled} className={`min-h-12 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-50 ${active?'border-brand-gold bg-brand-gold/10 shadow-sm':'border-brand-border bg-brand-card hover:border-brand-gold/50'}`}><span className="flex items-start gap-2"><span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active?'border-brand-gold bg-brand-gold text-white':'border-brand-border'}`}>{active?<Check className="h-3.5 w-3.5"/>:null}</span><span className="min-w-0"><span className="block text-sm font-black text-brand-text">{choice.label}</span>{choice.description?<span className="mt-0.5 block text-xs leading-5 text-brand-muted">{choice.description}</span>:null}</span></span></button>;})}</div>
 </fieldset>;
}
