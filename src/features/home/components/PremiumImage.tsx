import React,{useEffect,useState}from'react';
import{ImageOff}from'lucide-react';

type Props={src?:string|null;alt:string;className?:string;eager?:boolean;aspectClassName?:string};

export default function PremiumImage({src,alt,className='',eager=false,aspectClassName=''}:Props){
 const[loaded,setLoaded]=useState(false);
 const[failed,setFailed]=useState(false);
 useEffect(()=>{setLoaded(false);setFailed(false);},[src]);
 const usable=typeof src==='string'&&src.trim().length>0&&!failed;
 return<div className={`go-premium-image ${aspectClassName} ${className}`.trim()} data-loaded={loaded?'true':'false'} data-failed={!usable?'true':'false'}>
  {!loaded&&usable?<span className="go-premium-image__skeleton" aria-hidden="true"/>:null}
  {usable?<img src={src!} alt={alt} loading={eager?'eager':'lazy'} fetchPriority={eager?'high':'auto'} decoding="async" onLoad={()=>setLoaded(true)} onError={()=>{setFailed(true);setLoaded(false);}}/>:<span className="go-premium-image__fallback" role="img" aria-label={`${alt} görseli kullanılamıyor`}><ImageOff aria-hidden="true"/></span>}
 </div>;
}
