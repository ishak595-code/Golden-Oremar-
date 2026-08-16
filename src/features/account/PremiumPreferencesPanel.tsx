import React,{useEffect,useState}from'react';
import{BellRing,Check,Volume2,VolumeX}from'lucide-react';
import{APP_THEME_OPTIONS,type AppTheme}from'../appearance/theme';
import{NOTIFICATION_SOUND_OPTIONS,getNotificationSound,getNotificationSoundEnabled,playNotificationSound,setNotificationSound,setNotificationSoundEnabled,subscribeNotificationSoundPreference,type NotificationSoundId}from'../notifications/premiumSounds';
import{Panel}from'./ui';

export default function PremiumPreferencesPanel({theme,onThemeChange}:{theme:AppTheme;onThemeChange?:(theme:AppTheme)=>void}){
 const[sound,setSound]=useState<NotificationSoundId>(()=>getNotificationSound());
 const[enabled,setEnabled]=useState(()=>getNotificationSoundEnabled());
 const[previewing,setPreviewing]=useState<NotificationSoundId|null>(null);
 const[status,setStatus]=useState('');

 useEffect(()=>subscribeNotificationSoundPreference(()=>{
  setSound(getNotificationSound());
  setEnabled(getNotificationSoundEnabled());
 }),[]);

 function chooseTheme(next:AppTheme){
  onThemeChange?.(next);
  setStatus(`${APP_THEME_OPTIONS.find(item=>item.id===next)?.label||'Tema'} etkinleştirildi.`);
 }

 function chooseSound(next:NotificationSoundId){
  setNotificationSound(next);
  setSound(next);
  setStatus(`${NOTIFICATION_SOUND_OPTIONS.find(item=>item.id===next)?.label||'Bildirim sesi'} seçildi.`);
  void preview(next);
 }

 async function preview(next:NotificationSoundId){
  if(previewing)return;
  try{
   setPreviewing(next);
   const played=await playNotificationSound(next,{force:true});
   if(!played)setStatus('Ses önizlemesi tarayıcı veya cihaz tarafından engellendi. Ses açıkken tekrar deneyin.');
  }finally{
   window.setTimeout(()=>setPreviewing(null),900);
  }
 }

 function toggleEnabled(next:boolean){
  setNotificationSoundEnabled(next);
  setEnabled(next);
  setStatus(next?'Bildirim sesleri açıldı.':'Bildirim sesleri sessize alındı.');
  if(next)void preview(sound);
 }

 return<div className="space-y-5">
  <Panel title="Premium Görünüm" description="Tema yalnız bu cihazda saklanır. Ürün ve güven durumları değişmez; yalnız görsel karakter değişir.">
   <div role="radiogroup" aria-label="Premium tema seçimi" className="grid gap-3 sm:grid-cols-2">
    {APP_THEME_OPTIONS.map(option=>{
     const selected=theme===option.id;
     return<button key={option.id} type="button" role="radio" aria-checked={selected} onClick={()=>chooseTheme(option.id)} className={`min-h-24 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${selected?'border-brand-gold ring-1 ring-brand-gold/40':'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-3">
       <div aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 overflow-hidden rounded-full border shadow-sm" style={{background:option.surface,borderColor:option.accent}}>
        <span className="h-full w-1/2" style={{background:option.accent}}/>
        <span className="h-full w-1/2" style={{background:option.text}}/>
       </div>
       <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-bold">{option.label}</span>{selected?<Check aria-hidden="true" className="h-4 w-4 text-brand-gold"/>:null}</div><p className="mt-1 text-sm text-gray-500">{option.description}</p></div>
      </div>
     </button>;
    })}
   </div>
  </Panel>

  <Panel title="Premium Bildirim Sesi" description="Varsayılan Oremar Damlası’dır. Uygulama açıkken yeni bir bildirim geldiğinde seçtiğiniz kısa imza çalar.">
   <label className="mb-4 flex min-h-12 items-center justify-between gap-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
    <span className="flex items-center gap-3"><span aria-hidden="true" className="rounded-xl bg-brand-green/10 p-2 text-brand-green">{enabled?<Volume2 className="h-5 w-5"/>:<VolumeX className="h-5 w-5"/>}</span><span><span className="block font-bold">Bildirim sesleri</span><span className="block text-sm text-gray-500">İsterseniz bütün uygulama içi bildirim seslerini kapatın.</span></span></span>
    <input type="checkbox" className="h-5 w-5 shrink-0" checked={enabled} onChange={e=>toggleEnabled(e.target.checked)} aria-label="Bildirim seslerini aç veya kapat"/>
   </label>

   <div role="radiogroup" aria-label="Bildirim sesi seçimi" className="space-y-2">
    {NOTIFICATION_SOUND_OPTIONS.map(option=>{
     const selected=sound===option.id;
     return<div key={option.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selected?'border-brand-gold bg-brand-gold/5':'border-gray-200 dark:border-gray-700'}`}>
      <button type="button" role="radio" aria-checked={selected} onClick={()=>chooseSound(option.id)} className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
       <span className="flex items-center gap-2 font-bold"><BellRing aria-hidden="true" className="h-4 w-4 text-brand-green"/>{option.label}{selected?<Check aria-hidden="true" className="h-4 w-4 text-brand-gold"/>:null}</span>
       <span className="mt-1 block text-sm text-gray-500">{option.description}</span>
      </button>
      <button type="button" disabled={previewing!==null} onClick={()=>void preview(option.id)} className="min-h-11 shrink-0 rounded-xl border px-3 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label={`${option.label} sesini dinle`}>{previewing===option.id?'Çalıyor…':'Dinle'}</button>
     </div>;
    })}
   </div>
   <p className="mt-3 text-xs text-gray-500">Arka plandaki işletim sistemi push sesi cihaz ve bildirim kanalı kurallarına bağlıdır. Bu seçim Golden Oremar uygulaması açıkken gelen bildirim imzasını yönetir.</p>
  </Panel>

  {status?<div role="status" aria-live="polite" className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-3 text-sm font-semibold text-brand-green">{status}</div>:null}
 </div>;
}
