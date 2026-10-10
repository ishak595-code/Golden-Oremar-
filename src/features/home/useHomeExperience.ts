import{isSnapshotMode}from'../../lib/offlineCatalog';
import{useCallback,useEffect,useRef,useState}from'react';
import{NETWORK_RESTORED_EVENT}from'../resilience/useConnectivity';
import{browserHomeLocale,getPublicHomeExperience,getPublicHomeSection,normalizeHomeExperience,normalizeHomeSection,type HomeExperience,type HomeLocale,type HomeSectionModel,loadCatalogFallbackExperience}from'./homeExperienceApi';
import{fetchHomeBundle,fetchHomeContentVersion,HOME_VERSION_IDLE_MS,HOME_VERSION_POLL_MS}from'./homeFreshness';

type CacheEntry={value:HomeExperience;expiresAt:number;staleUntil:number;contentVersion?:number};
type SectionCacheEntry={value:HomeSectionModel;expiresAt:number;staleUntil:number;contentVersion?:number};

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
 const stored=readStorage<{value:HomeExperience;cachedAt:number;expiresAt?:number;staleUntil?:number;contentVersion?:number}>(`${HOME_CACHE_PREFIX}${locale}`);
 if(!stored?.value)return null;
 const cachedAt=Number(stored.cachedAt)||0;
 if(!cachedAt||now-cachedAt>CLIENT_STALE_MS){removeStorage(`${HOME_CACHE_PREFIX}${locale}`);return null;}
 const entry:CacheEntry={value:stored.value,expiresAt:Number(stored.expiresAt)||cachedAt+CLIENT_FRESH_FALLBACK_MS,staleUntil:Number(stored.staleUntil)||cachedAt+CLIENT_STALE_MS,contentVersion:Number(stored.contentVersion)||undefined};
 if(entry.staleUntil<=now)return null;
 experienceCache.set(locale,entry);return entry;
}

function persistExperience(locale:HomeLocale,value:HomeExperience,expiresAt:number,contentVersion?:number){
 const cachedAt=Date.now();
 const entry:CacheEntry={value,expiresAt,staleUntil:cachedAt+CLIENT_STALE_MS,contentVersion};
 experienceCache.set(locale,entry);
 writeStorage(`${HOME_CACHE_PREFIX}${locale}`,{value,cachedAt,expiresAt,staleUntil:entry.staleUntil,contentVersion});
 return entry;
}

function hydrateSection(locale:HomeLocale,key:string):SectionCacheEntry|null{
 const cacheKey=`${locale}:${key}`;const now=Date.now();
 const memory=sectionCache.get(cacheKey);if(memory&&memory.staleUntil>now)return memory;
 const stored=readStorage<{value:HomeSectionModel;cachedAt:number;expiresAt?:number;staleUntil?:number;contentVersion?:number}>(`${SECTION_CACHE_PREFIX}${cacheKey}`);
 if(!stored?.value)return null;
 const cachedAt=Number(stored.cachedAt)||0;
 if(!cachedAt||now-cachedAt>CLIENT_STALE_MS){removeStorage(`${SECTION_CACHE_PREFIX}${cacheKey}`);return null;}
 const entry:SectionCacheEntry={value:stored.value,expiresAt:Number(stored.expiresAt)||cachedAt+CLIENT_FRESH_FALLBACK_MS,staleUntil:Number(stored.staleUntil)||cachedAt+CLIENT_STALE_MS,contentVersion:Number(stored.contentVersion)||undefined};
 if(entry.staleUntil<=now)return null;
 sectionCache.set(cacheKey,entry);return entry;
}

function persistSection(locale:HomeLocale,key:string,value:HomeSectionModel,expiresAt:number,contentVersion?:number){
 const cachedAt=Date.now();const cacheKey=`${locale}:${key}`;const entry:SectionCacheEntry={value,expiresAt,staleUntil:cachedAt+CLIENT_STALE_MS,contentVersion};
 sectionCache.set(cacheKey,entry);writeStorage(`${SECTION_CACHE_PREFIX}${cacheKey}`,{value,cachedAt,expiresAt,staleUntil:entry.staleUntil,contentVersion});return entry;
}

/** Last content version seen from the server (null while unknown or unreachable). */
let knownContentVersion:number|null=null;
/** A version-keyed entry stays valid until the version moves, never by the clock. */
const VERSIONED_MS=CLIENT_STALE_MS;

/**
 * The version-aware path: one tiny version request; when the stored home has
 * that version nothing else is downloaded, otherwise the whole home (all
 * showcases included) comes in one edge-cached answer. Null when the edge
 * path is unavailable (then the direct path below is used).
 */
async function loadVersioned(locale:HomeLocale,cached:CacheEntry|null):Promise<{value:HomeExperience;changed:boolean}|null>{
 let version:number;
 try{version=await fetchHomeContentVersion();}catch{return null;}
 knownContentVersion=version;
 if(cached&&cached.contentVersion===version)return{value:cached.value,changed:false};
 try{
  const bundle=await fetchHomeBundle(version,locale);
  const value=normalizeHomeExperience(bundle.experience);
  const contentVersion=bundle.version||version;knownContentVersion=Math.max(version,contentVersion);
  const until=Date.now()+VERSIONED_MS;
  for(const[key,raw]of Object.entries(bundle.sections)){
   if(raw==null)continue;
   try{const section=normalizeHomeSection({...(raw as object),deferred:false},0);if(section.key===key)persistSection(locale,key,section,until,knownContentVersion);}catch{/* a bad showcase is loaded on its own later */}
  }
  persistExperience(locale,value,until,knownContentVersion);
  return{value,changed:true};
 }catch{return null;}
}

export function useHomeExperience(locale:HomeLocale=browserHomeLocale()){
 const initialCache=useRef(hydrateExperience(locale)).current;
 const[data,setData]=useState<HomeExperience|null>(()=>initialCache?.value||null);
 const[loading,setLoading]=useState(!initialCache);
 const[error,setError]=useState('');
 const sequence=useRef(0);

 const load=useCallback(async(force=false)=>{
  const request=++sequence.current;const cached=hydrateExperience(locale);
  if(cached){setData(cached.value);setLoading(false);setError('');}else setLoading(true);
  try{
   // 1. Version check: fresh within seconds of an admin edit, no clock-based staleness.
   const versioned=await loadVersioned(locale,cached);
   if(versioned){if(request===sequence.current&&(versioned.changed||!cached)){setData(versioned.value);setError('');}return versioned.value;}
   // 2. Edge path unavailable: the direct database call (with the shipped copy behind it).
   if(!force&&cached&&cached.expiresAt>Date.now()&&cached.contentVersion===undefined)return cached.value;
   const value=await getPublicHomeExperience(locale);if(request!==sequence.current)return value;
   const serverAge=Math.max(1,Number(value.cachePolicy?.compositionMaxAgeSeconds)||0)*1000;
   // A copy shipped with the app (backend down or stalling) is shown, never kept as if it were live.
   if(!isSnapshotMode())persistExperience(locale,value,Date.now()+Math.max(CLIENT_FRESH_FALLBACK_MS,serverAge));
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

 /* While the page is open, visible and in use, look at the version every
    5 s and whenever the visitor comes back to it; an unchanged version costs
    a few bytes and changes nothing on screen. */
 useEffect(()=>{
  let busy=false;let lastActive=Date.now();
  // Backend unreachable: wait longer each time (10 s, 20 s ... 2 min) instead of asking every few seconds.
  let failures=0,retryAt=0;
  const active=()=>{lastActive=Date.now();};
  const check=async(fromReturn=false)=>{
   if(busy||document.hidden)return;
   if(!fromReturn&&Date.now()-lastActive>HOME_VERSION_IDLE_MS)return;
   if(Date.now()<retryAt)return;
   busy=true;
   try{const version=await fetchHomeContentVersion();failures=0;retryAt=0;const cached=experienceCache.get(locale);if(!cached||cached.contentVersion!==version)await load(true);}
   catch{failures+=1;retryAt=Date.now()+Math.min(120_000,5_000*2**failures);/* keep what is shown */}
   finally{busy=false;}
  };
  const timer=window.setInterval(()=>void check(),HOME_VERSION_POLL_MS);
  const onVisible=()=>{if(!document.hidden){active();void check(true);}};
  const activity=['pointerdown','keydown','scroll','touchstart'] as const;
  activity.forEach(name=>window.addEventListener(name,active,{passive:true}));
  document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',onVisible);
  return()=>{window.clearInterval(timer);activity.forEach(name=>window.removeEventListener(name,active));document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible);};
 },[load,locale]);

 const loadSection=useCallback(async(key:string)=>{
  if(!data)return null;
  const cacheKey=`${locale}:${key}`;
  const cached=hydrateSection(locale,key);
  // Saved with the current content version: exact, nothing to ask.
  if(cached&&cached.contentVersion!==undefined&&cached.contentVersion===knownContentVersion)return cached.value;
  if(cached&&cached.contentVersion===undefined&&cached.expiresAt>Date.now())return cached.value;
  if(cached){
   void getPublicHomeSection(key,locale).then(value=>{if(value&&!isSnapshotMode())persistSection(locale,key,value,Date.now()+CLIENT_FRESH_FALLBACK_MS);}).catch(()=>undefined);
   return cached.value;
  }
  const pending=sectionRequests.get(cacheKey);
  if(pending)return pending;
  const request=getPublicHomeSection(key,locale).then(value=>{if(value&&!isSnapshotMode())persistSection(locale,key,value,Date.now()+CLIENT_FRESH_FALLBACK_MS);return value;}).catch(error=>{const fallback=hydrateSection(locale,key);if(fallback)return fallback.value;throw error;}).finally(()=>sectionRequests.delete(cacheKey));
  sectionRequests.set(cacheKey,request);
  return request;
 },[data,locale]);

 const contentVersion=experienceCache.get(locale)?.contentVersion??0;
 return{experience:data,loading,error,retry:()=>load(true),loadSection,contentVersion};
}
