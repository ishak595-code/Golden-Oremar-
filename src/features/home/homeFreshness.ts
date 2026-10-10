import{Capacitor}from'@capacitor/core';

/**
 * Home freshness (see api/home-version.js, api/home.js and the migration
 * 20261010100000_home_content_version_v1): the database keeps one version
 * number that every change to what the home page shows moves forward. The
 * page asks only for that number (a few bytes, one second at the edge) and
 * downloads the home page again only when it changed. No time-based staleness.
 */
const SITE_ORIGIN='https://golden-oremar.vercel.app';
/** Version look-up while the home page is visible and in use. */
export const HOME_VERSION_POLL_MS=5_000;
/** No touch, key or scroll for this long: stop looking until the visitor is back. */
export const HOME_VERSION_IDLE_MS=3*60_000;

function apiBase(){
 try{if(Capacitor.isNativePlatform())return SITE_ORIGIN;}catch{/* not native */}
 if(typeof window==='undefined')return SITE_ORIGIN;
 const{hostname,origin}=window.location;
 // The edge endpoints live on the deployed site; local dev talks to it too.
 return /^(localhost|127\.0\.0\.1)$/.test(hostname)?SITE_ORIGIN:origin;
}

async function getJson(path:string,timeoutMs:number){
 const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetch(`${apiBase()}${path}`,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`home api ${response.status}`);return await response.json();}
 finally{window.clearTimeout(timer);}
}

export async function fetchHomeContentVersion():Promise<number>{
 const data=await getJson('/api/home-version',2500);const version=Number(data?.version);
 if(!Number.isSafeInteger(version)||version<1)throw new Error('home version invalid');
 return version;
}

export type HomeBundle={version:number;experience:unknown;sections:Record<string,unknown>};
export async function fetchHomeBundle(version:number,locale:string):Promise<HomeBundle>{
 const data=await getJson(`/api/home?v=${encodeURIComponent(String(version))}&locale=${encodeURIComponent(locale)}`,6000);
 if(!data||typeof data!=='object'||!data.experience||typeof data.sections!=='object')throw new Error('home bundle invalid');
 return{version:Number(data.version)||version,experience:data.experience,sections:data.sections||{}};
}
