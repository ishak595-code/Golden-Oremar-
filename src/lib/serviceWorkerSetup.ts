/**
 * The website keeps its service worker (offline catalogue, quick repeat
 * visits). The Android/iOS app must not have one: its files are inside the
 * app, and a cached worker from an older version kept showing the old
 * screens after an update. In the app, any worker and cache still there is
 * removed and the screen reloads once from the installed files.
 */
const RELOADED_KEY='golden-oremar:sw-retired-reload';

export function setupServiceWorker(){
 if(typeof window==='undefined'||!('serviceWorker' in navigator))return;
 const native=Boolean((window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean}}).Capacitor?.isNativePlatform?.());
 if(!native){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>undefined);});
  return;
 }
 void (async()=>{
  try{
   const registrations=await navigator.serviceWorker.getRegistrations();
   const controlled=Boolean(navigator.serviceWorker.controller);
   await Promise.all(registrations.map(registration=>registration.unregister()));
   if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(key=>caches.delete(key)));}
   // This page itself came from the old worker: load it again, once.
   if(controlled&&sessionStorage.getItem(RELOADED_KEY)!=='1'){sessionStorage.setItem(RELOADED_KEY,'1');window.location.reload();}
  }catch{/* best effort: the worker script retires itself as well */}
 })();
}
