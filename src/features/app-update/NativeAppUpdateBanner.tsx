import React,{useCallback,useEffect,useMemo,useState}from'react';
import{App as CapApp}from'@capacitor/app';
import{Capacitor}from'@capacitor/core';
import{CheckCircle2,Download,RefreshCw}from'lucide-react';
import{checkForNativeAppUpdate,completeNativeAppUpdate,startNativeAppUpdate,subscribeNativeAppUpdateState,type NativeAppUpdateState}from'../../native';

const ROUTE_EVENT='golden-oremar:route-change';
function messageOf(error:unknown){return error instanceof Error&&error.message.trim()?error.message:'Güncelleme işlemi şu anda tamamlanamadı.';}
function accountIsOpen(){
 try{return(document.documentElement.dataset.appTab||new URL(window.location.href).searchParams.get('tab')||'home')==='account';}
 catch{return false;}
}

export default function NativeAppUpdateBanner(){
 const[state,setState]=useState<NativeAppUpdateState|null>(null);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const[accountTab,setAccountTab]=useState(accountIsOpen);
 const isAndroid=Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';

 useEffect(()=>{
  const sync=()=>setAccountTab(accountIsOpen());
  window.addEventListener(ROUTE_EVENT,sync);
  window.addEventListener('popstate',sync);
  return()=>{window.removeEventListener(ROUTE_EVENT,sync);window.removeEventListener('popstate',sync);};
 },[]);

 const refresh=useCallback(async()=>{
  if(!isAndroid||!accountTab)return;
  const next=await checkForNativeAppUpdate();
  setState(next);
 },[accountTab,isAndroid]);

 useEffect(()=>{
  if(!isAndroid||!accountTab){setState(null);setError('');return;}
  let disposed=false;
  let updateHandle:{remove:()=>Promise<void>}|undefined;
  let appHandle:{remove:()=>Promise<void>}|undefined;
  const safeRefresh=async()=>{if(disposed)return;const next=await checkForNativeAppUpdate();if(!disposed)setState(next);};
  void safeRefresh();
  void subscribeNativeAppUpdateState(partial=>{
   if(disposed)return;
   setState(current=>current?{...current,...partial}:current);
  }).then(handle=>{if(disposed)void handle.remove();else updateHandle=handle;});
  void CapApp.addListener('appStateChange',({isActive})=>{if(isActive)void safeRefresh();}).then(handle=>{if(disposed)void handle.remove();else appHandle=handle;});
  return()=>{disposed=true;if(updateHandle)void updateHandle.remove();if(appHandle)void appHandle.remove();};
 },[accountTab,isAndroid]);

 const progress=useMemo(()=>{
  const total=Number(state?.totalBytes||0),done=Number(state?.bytesDownloaded||0);
  if(!Number.isFinite(total)||!Number.isFinite(done)||total<=0||done<0)return null;
  return Math.max(0,Math.min(100,Math.round((done/total)*100)));
 },[state?.bytesDownloaded,state?.totalBytes]);

 if(!accountTab||!isAndroid||!state?.supported||(!state.available&&!state.inProgress&&!state.downloaded&&!state.downloading))return null;

 const downloaded=state.downloaded||state.installStatus==='downloaded';
 const downloading=state.downloading||state.installStatus==='downloading';
 const label=downloaded?'Güncelleme indirildi':downloading?`Güncelleme indiriliyor${progress===null?'':` · %${progress}`}`:'Yeni sürüm var';
 const description=downloaded?'Yeni sürümü kurup Golden Oremar’ı yeniden başlatabilirsiniz.':downloading?'Uygulamayı kullanmaya devam edebilirsiniz. İndirme tamamlandığında kurulum düğmesi açılacak.':'Golden Oremar’ın daha yeni bir sürümü Google Play üzerinden hazır.';

 async function update(){
  if(busy)return;
  try{
   setBusy(true);setError('');
   if(downloaded){await completeNativeAppUpdate();return;}
   const mode=state.immediateAllowed&&!state.flexibleAllowed?'immediate':'flexible';
   await startNativeAppUpdate(mode);
   window.setTimeout(()=>void refresh(),700);
  }catch(caught){setError(messageOf(caught));}
  finally{setBusy(false);}
 }

 return<section data-native-app-update-banner="true" role="status" aria-live="polite" className="relative z-[50] mx-3 mt-3 rounded-2xl border border-brand-gold/30 bg-brand-green px-4 py-3 text-brand-on-green shadow-md sm:mx-auto sm:max-w-7xl">
  <div className="flex items-center gap-3">
   <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">{downloaded?<CheckCircle2 aria-hidden="true" className="h-5 w-5"/>:<Download aria-hidden="true" className="h-5 w-5"/>}</div>
   <div className="min-w-0 flex-1"><div className="font-black">{label}</div><div className="mt-0.5 text-xs font-medium opacity-90 sm:text-sm">{description}</div>{error?<div role="alert" className="mt-1 text-xs font-bold text-amber-100">{error}</div>:null}</div>
   <button type="button" disabled={busy||downloading} onClick={()=>void update()} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand-gold px-4 text-sm font-black text-brand-on-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60">{busy?<><RefreshCw aria-hidden="true" className="mr-2 h-4 w-4 animate-spin"/>İşleniyor</>:downloaded?'Yükle':downloading?'İndiriliyor':'Güncelle'}</button>
  </div>
 </section>;
}
