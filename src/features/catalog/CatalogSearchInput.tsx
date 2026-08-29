import React,{useEffect,useRef,useState}from'react';
import{LoaderCircle,Mic,Search,X}from'lucide-react';

type Props={value:string;onChange:(value:string)=>void;onSubmit:(value:string)=>void;onVoice:()=>void;onFocus?:()=>void;onBlur?:()=>void;listening?:boolean;autoFocus?:boolean;};

export default function CatalogSearchInput({value,onChange,onSubmit,onVoice,onFocus,onBlur,listening=false,autoFocus=false}:Props){
 const normalized=value.slice(0,100);const previousListening=useRef(listening);const[processing,setProcessing]=useState(false);
 useEffect(()=>{let timer:number|undefined;if(previousListening.current&&!listening){setProcessing(true);timer=window.setTimeout(()=>setProcessing(false),240);}previousListening.current=listening;return()=>{if(timer)window.clearTimeout(timer);};},[listening]);
 const voiceState=listening?'active':processing?'processing':'ready';
 return<form onSubmit={event=>{event.preventDefault();const query=normalized.trim();if(query)onSubmit(query);}} className="go-search-bar" data-has-value={normalized?'true':'false'} data-processing={processing?'true':'false'} data-voice-state={voiceState}>
  <div className="go-search-bar__field"><Search aria-hidden="true"/><input type="search" autoFocus={autoFocus} value={normalized} onChange={event=>onChange(event.target.value.slice(0,100))} onFocus={onFocus} onBlur={onBlur} placeholder="Ürün, üretici veya köy ara" aria-label="Ürün, üretici veya köy ara" enterKeyHint="search" autoComplete="off"/></div>
  {normalized?<button type="button" onClick={()=>onChange('')} aria-label="Aramayı temizle" className="go-search-bar__clear"><X aria-hidden="true"/></button>:null}
  <button type="button" onClick={onVoice} aria-label={listening?'Sesli aramayı durdur':processing?'Sesli arama işleniyor':'Sesli aramayı başlat'} aria-pressed={listening} aria-busy={processing} disabled={processing} className="go-search-bar__voice">{processing?<LoaderCircle aria-hidden="true" className="animate-spin"/>:<Mic aria-hidden="true"/>}</button>
  {listening||processing?<span className="sr-only" role="status" aria-live="polite">{listening?'Sesli arama dinleniyor':'Sesli arama işleniyor'}</span>:null}
 </form>;
}
