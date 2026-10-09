import React,{useEffect,useRef,useState}from'react';
import{LoaderCircle,Mic,Search,X}from'lucide-react';

type Props={value:string;onChange:(value:string)=>void;onSubmit:(value:string)=>void;onVoice:()=>void;onFocus?:()=>void;onBlur?:()=>void;listening?:boolean;autoFocus?:boolean;};

export default function CatalogSearchInput({value,onChange,onSubmit,onVoice,onFocus,onBlur,listening=false,autoFocus=false}:Props){
 const normalized=value.slice(0,100);const previousListening=useRef(listening);const[processing,setProcessing]=useState(false);
 useEffect(()=>{let timer:number|undefined;if(previousListening.current&&!listening){setProcessing(true);timer=window.setTimeout(()=>setProcessing(false),240);}previousListening.current=listening;return()=>{if(timer)window.clearTimeout(timer);};},[listening]);
 const voiceState=listening?'active':processing?'processing':'ready';
 const voiceStatus=listening?'Sesli arama dinleniyor.':processing?'Sesli arama hazırlanıyor.':'';
 return<form onSubmit={event=>{event.preventDefault();const query=normalized.trim();if(query)onSubmit(query);}} className="go-search-bar" data-has-value={normalized?'true':'false'} data-processing={processing?'true':'false'} data-voice-state={voiceState}>
  <div className="go-search-bar__field"><Search aria-hidden="true"/><input type="search" autoFocus={autoFocus} value={normalized} onChange={event=>onChange(event.target.value.slice(0,100))} onFocus={onFocus} onBlur={onBlur} placeholder="Ürün ara" aria-label="Ürün, üretici veya köy ara" enterKeyHint="search" autoComplete="off"/></div>
  {normalized?<button type="button" onClick={()=>onChange('')} aria-label="Aramayı temizle" className="go-search-bar__clear"><X aria-hidden="true"/></button>:null}
  {/* Screen readers say "Sesli mikrofon". No aria-pressed: TalkBack and
      VoiceOver read a pressed=false toggle as "kapalı", which sounded like
      the microphone was broken. The listening state is announced by the
      live region below instead. */}
  <button type="button" onClick={onVoice} aria-label={listening?'Sesli mikrofonu durdur':'Sesli mikrofon'} aria-busy={processing?true:undefined} disabled={processing} className="go-search-bar__voice" data-listening={listening?'true':'false'}><span className="go-search-bar__voice-core" aria-hidden="true">{processing?<LoaderCircle className="animate-spin"/>:<Mic/>}</span></button>
  <span className="sr-only" role="status" aria-live="polite">{voiceStatus}</span>
 </form>;
}
