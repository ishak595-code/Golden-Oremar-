import{useCallback,useEffect,useRef,useState}from'react';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';
import{browserHomeLocale,getPublicHomeExperience,getPublicHomeSection,type HomeExperience,type HomeLocale,type HomeSectionModel}from'./homeExperienceApi';

type CacheEntry={value:HomeExperience;expiresAt:number};
const experienceCache=new Map<HomeLocale,CacheEntry>();
const sectionCache=new Map<string,Promise<HomeSectionModel|null>>();

export function useHomeExperience(locale:HomeLocale=browserHomeLocale()){
 const[data,setData]=useState<HomeExperience|null>(()=>{const cached=experienceCache.get(locale);return cached&&cached.expiresAt>Date.now()?cached.value:null;});
 const[loading,setLoading]=useState(!data);
 const[error,setError]=useState('');
 const sequence=useRef(0);
 const load=useCallback(async(force=false)=>{
  const request=++sequence.current;
  const cached=experienceCache.get(locale);
  if(!force&&cached&&cached.expiresAt>Date.now()){setData(cached.value);setLoading(false);setError('');return cached.value;}
  setLoading(true);setError('');
  try{const value=await getPublicHomeExperience(locale);if(request!==sequence.current)return value;experienceCache.set(locale,{value,expiresAt:Date.now()+value.cachePolicy.compositionMaxAgeSeconds*1000});setData(value);return value;}catch(err:any){if(request===sequence.current)setError(err?.message||'Ana sayfa şu anda yenilenemiyor.');throw err;}finally{if(request===sequence.current)setLoading(false);}
 },[locale]);
 useEffect(()=>{void load(false).catch(()=>undefined);return()=>{sequence.current+=1;};},[load]);
 useEffect(()=>{const restore=()=>void load(true).catch(()=>undefined);window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[load]);
 const loadSection=useCallback((key:string)=>{if(!data)return Promise.resolve(null);const cacheKey=`${locale}:${data.cacheKey}:${key}`;const existing=sectionCache.get(cacheKey);if(existing)return existing;const promise=getPublicHomeSection(key,locale).catch(error=>{sectionCache.delete(cacheKey);throw error;});sectionCache.set(cacheKey,promise);return promise;},[data,locale]);
 return{experience:data,loading,error,retry:()=>load(true),loadSection};
}
