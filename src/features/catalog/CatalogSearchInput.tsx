import React from'react';
import{Mic,Search,X}from'lucide-react';

type Props={value:string;onChange:(value:string)=>void;onSubmit:(value:string)=>void;onVoice:()=>void;onFocus?:()=>void;onBlur?:()=>void;listening?:boolean;autoFocus?:boolean;};

export default function CatalogSearchInput({value,onChange,onSubmit,onVoice,onFocus,onBlur,listening=false,autoFocus=false}:Props){
 const normalized=value.slice(0,100);
 return<form role="search" onSubmit={event=>{event.preventDefault();const query=normalized.trim();if(query)onSubmit(query);}} className="relative w-full">
  <label className="block"><span className="sr-only">Ürün, üretici veya köy ara</span><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input type="search" autoFocus={autoFocus} value={normalized} onChange={event=>onChange(event.target.value.slice(0,100))} onFocus={onFocus} onBlur={onBlur} placeholder="Ne arıyorsun? Bal, peynir, tereyağı..." aria-label="Ürün, üretici veya köy ara" enterKeyHint="search" autoComplete="off" className={`min-h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 text-base outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 dark:border-gray-700 dark:bg-gray-900 ${normalized?'pr-[6.25rem]':'pr-14'}`}/></label>
  {normalized?<button type="button" onClick={()=>onChange('')} aria-label="Aramayı temizle" className="absolute right-12 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-xl text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5"/></button>:null}
  <button type="button" onClick={onVoice} aria-label={listening?'Sesli arama dinleniyor':'Sesli ara'} aria-pressed={listening} className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-xl text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-gray-300"><Mic aria-hidden="true" className={`h-5 w-5 ${listening?'animate-pulse text-brand-gold':''}`}/></button>
 </form>;
}
