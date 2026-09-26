import{useCallback,useEffect,useRef,useState}from'react';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';
import{browserHomeLocale,getPublicHomeExperience,getPublicHomeSection,type HomeExperience,type HomeLocale,type HomeSectionModel,loadCatalogFallbackExperience}from'./homeExperienceApi';

type CacheEntry={value:HomeExperience;expiresAt:number;staleUntil:number};
type SectionCacheEntry={value:HomeSectionModel;expiresAt:number;staleUntil:number};

const experienceCache=new Map<HomeLocale,CacheEntry>();
const sectionCache=new Map<string,SectionCacheEntry>();
const sectionRequests=new Map<string,Promise<HomeSectionModel|null>>();
const HOME_CACHE_PREFIX='golden-oremar:home-experience:v4:';
const SECTION_CACHE_PREFIX='golden-oremar:home-section:v4:';
const CLIENT_FRESH_FALLBACK_MS=5*60*1000;
const CLIENT_STALE_MS=7*24*60*60*1000;

function friendlyHomeError(error:unknown){
 const message=String((error as any)?.message||error||'').toLowerCase();
 if(message.includes('exceed_cached_egress_quota')||message.includes('service for this project is restricted')||message.includes('quota')||message.includes('spend cap'))return'Ana sayfa verileri şu anda yenilenemiyor. Kaydedilmiş içerikler varsa onları göstermeye devam ediyoruz.';
 if(message.includes('failed to fetch')||message.includes('network')||message.includes('fetch'))return'Bağlantı geçici olarak kullanılamıyor. Son kaydedilen vitrin gösteriliyor.';
 return'Ana sayfa verileri şu anda yenilenemiyor. Lütfen biraz sonra tekrar deneyin.';
}

function readStorage<T>(key:string):T|null{
 if(typeof window==='undefined')return null;
 try{const raw=window.localStorage.getItem(key);return raw?JSON.parse(raw) as T:null;}catch{return null;}
}
function writeStorage(key:string,value:unknown){
 if(typeof window==='undefined')return;
 try{window.localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage may be unavailable or full. */}
}
function removeStorage(key:string){
 if(typeof window==='undefined')return;
 try{window.localStorage.removeItem(key);}catch{/* Ignore storage failures. */}
}

function hydrateExperience(locale:HomeLocale):CacheEntry|null{
 const now=Date.now();
 const memory=experienceCache.get(locale);
 if(memory&&memory.staleUntil>now)return memory;
 const stored=readStorage<{value:HomeExperience;cachedAt:number;expiresAt?:number;staleUntil?:number}>(`${HOME_CACHE_PREFIX}${locale}`);
 if(!stored?.value)return null;
 const cachedAt=Number(stored.cachedAt)||0;
 if(!cachedAt||now-cachedAt>CLIENT_STALE_MS){removeStorage(`${HOME_CACHE_PREFIX}${locale}`);return null;}
 const entry:CacheEntry={value:stored.value,expiresAt:Number(stored.expiresAt)||cachedAt+CLIENT_FRESH_FALLBACK_MS,staleUntil:Number(stored.staleUntil)||cachedAt+CLIENT_STALE_MS};
 if(entry.staleUntil<=now)return null;
 experienceCache.set(locale,entry);return entry;
}

function persistExperience(locale:HomeLocale,value:HomeExperience,expiresAt:number){
 const cachedAt=Date.now();
 const entry:CacheEntry={value,expiresAt,staleUntil:cachedAt+CLIENT_STALE_MS};
 experienceCache.set(locale,entry);
 writeStorage(`${HOME_CACHE_PREFIX}${locale}`,{value,cachedAt,expiresAt,staleUntil:entry.staleUntil});
 return entry;
}

function hydrateSection(locale:HomeLocale,key:string):SectionCacheEntry|null{
 const cacheKey=`${locale}:${key}`;const now=Date.now();
 const memory=sectionCache.get(cacheKey);if(memory&&memory.staleUntil>now)return memory;
 const stored=readStorage<{value:HomeSectionModel;cachedAt:number;expiresAt?:number;staleUntil?:number}>(`${SECTION_CACHE_PREFIX}${cacheKey}`);
 if(!stored?.value)return null;
 const cachedAt=Number(stored.cachedAt)||0;
 if(!cachedAt||now-cachedAt>CLIENT_STALE_MS){removeStorage(`${SECTION_CACHE_PREFIX}${cacheKey}`);return null;}
 const entry:SectionCacheEntry={value:stored.value,expiresAt:Number(stored.expiresAt)||cachedAt+CLIENT_FRESH_FALLBACK_MS,staleUntil:Number(stored.staleUntil)||cachedAt+CLIENT_STALE_MS};
 if(entry.staleUntil<=now)return null;
 sectionCache.set(cacheKey,entry);return entry;
}

function persistSection(locale:HomeLocale,key:string,value:HomeSectionModel,expiresAt:number){
 const cachedAt=Date.now();const cacheKey=`${locale}:${key}`;const entry:SectionCacheEntry={value,expiresAt,staleUntil:cachedAt+CLIENT_STALE_MS};
 sectionCache.set(cacheKey,entry);writeStorage(`${SECTION_CACHE_PREFIX}${cacheKey}`,{value,cachedAt,expiresAt,staleUntil:entry.staleUntil});return entry;
}

export function useHomeExperience(locale:HomeLocale=browserHomeLocale()){
 const initialCache=useRef(hydrateExperience(locale)).current;
 const[data,setData]=useState<HomeExperience|null>(()=>initialCache?.value||null);
 const[loading,setLoading]=useState(!initialCache);
 const[error,setError]=useState('');
 const sequence=useRef(0);

 const load=useCallback(async(force=false)=>{
  const request=++sequence.current;const now=Date.now();const cached=hydrateExperience(locale);
  if(!force&&cached&&cached.expiresAt>now){setData(cached.value);setLoading(false);setError('');return cached.value;}
  if(cached){setData(cached.value);setLoading(false);setError('');}else setLoading(true);
  try{
   const value=await getPublicHomeExperience(locale);if(request!==sequence.current)return value;
   const serverAge=Math.max(1,Number(value.cachePolicy?.compositionMaxAgeSeconds)||0)*1000;
   persistExperience(locale,value,Date.now()+Math.max(CLIENT_FRESH_FALLBACK_MS,serverAge));
   setData(value);setError('');return value;
  }catch(err){
   if(cached){if(request===sequence.current){setError('');setData(cached.value);}return cached.value;}
   // No cached home: a first-time visitor. Before showing an error, try a
   // minimal home built from the public catalogue. It is never persisted, so
   // the real home replaces it on the next successful load.
   try{
    const fallback=await loadCatalogFallbackExperience(locale);
    if(request===sequence.current){setData(fallback);setError('');}
    return fallback;
   }catch{
    if(request===sequence.current)setError(friendlyHomeError(err));
    throw err;
   }
  }finally{if(request===sequence.current)setLoading(false);}
 },[locale]);

 useEffect(()=>{void load(false).catch(()=>undefined);return()=>{sequence.current+=1;};},[load]);
 useEffect(()=>{const restore=()=>void load(true).catch(()=>undefined);window.addEventListener(NETWORK_RESTORED_EVENT,restore);return()=>window.removeEventListener(NETWORK_RESTORED_EVENT,restore);},[load]);

 const loadSection=useCallback(async(key:string)=>{
  if(!data)return null;
  const cacheKey=`${locale}:${key}`;
  const cached=hydrateSection(locale,key);
  if(cached&&cached.expiresAt>Date.now())return cached.value;
  if(cached){
   void getPublicHomeSection(key,locale).then(value=>{if(value)persistSection(locale,key,value,Date.now()+CLIENT_FRESH_FALLBACK_MS);}).catch(()=>undefined);
   return cached.value;
  }
  const pending=sectionRequests.get(cacheKey);
  if(pending)return pending;
  const request=getPublicHomeSection(key,locale).then(value=>{if(value)persistSection(locale,key,value,Date.now()+CLIENT_FRESH_FALLBACK_MS);return value;}).catch(error=>{const fallback=hydrateSection(locale,key);if(fallback)return fallback.value;throw error;}).finally(()=>sectionRequests.delete(cacheKey));
  sectionRequests.set(cacheKey,request);
  return request;
 },[data,locale]);

 return{experience:data,loading,error,retry:()=>load(true),loadSection};
}
