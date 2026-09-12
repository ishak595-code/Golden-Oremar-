import React,{useEffect,useState}from'react';
import{BellRing,Check,Loader2,Palette,Volume2,VolumeX}from'lucide-react';
import{APP_THEME_OPTIONS,type AppTheme}from'../appearance/theme';
import{NOTIFICATION_SOUND_OPTIONS,getNotificationSound,getNotificationSoundEnabled,playNotificationSound,setNotificationSound,setNotificationSoundEnabled,subscribeNotificationSoundPreference,type NotificationSoundId}from'../notifications/premiumSounds';
import{updateMyAppPreferences}from'../preferences/api';

type PreferenceMode='all'|'theme'|'sound';
type Props={theme:AppTheme;onThemeChange?:(theme:AppTheme)=>void;mode?:PreferenceMode;onSaved?:()=>void;};

export default function PremiumPreferencesPanel({theme,onThemeChange,mode='all',onSaved}:Props){
 const[sound,setSound]=useState<NotificationSoundId>(()=>getNotificationSound());
 const[enabled,setEnabled]=useState(()=>getNotificationSoundEnabled());
 const[previewing,setPreviewing]=useState<NotificationSoundId|null>(null);
 const[saving,setSaving]=useState<'theme'|'sound'|'enabled'|null>(null);
 const[status,setStatus]=useState('');
 const[error,setError]=useState('');
 useEffect(()=>subscribeNotificationSoundPreference(()=>{setSound(getNotificationSound());setEnabled(getNotificationSoundEnabled());}),[]);

 async function chooseTheme(next:AppTheme){
  if(saving)return;const label=APP_THEME_OPTIONS.find(item=>item.id===next)?.label||'Tema';
  onThemeChange?.(next);setError('');setStatus(`${label} seçildi.`);
  try{setSaving('theme');await updateMyAppPreferences({theme:next});setStatus(`${label} tercihiniz kaydedildi.`);onSaved?.();}
  catch{setError('Tema seçildi ancak tercihiniz şu anda kaydedilemedi. Daha sonra tekrar deneyin.');}
  finally{setSaving(null);}
 }
 async function preview(next:NotificationSoundId){if(previewing)return;try{setPreviewing(next);const played=await playNotificationSound(next,{force:true});if(!played)setStatus('Ses önizlemesi cihazınızın ses ayarları nedeniyle çalınamadı.');}finally{window.setTimeout(()=>setPreviewing(null),900);}}
 async function chooseSound(next:NotificationSoundId){
  if(saving)return;const label=NOTIFICATION_SOUND_OPTIONS.find(item=>item.id===next)?.label||'Bildirim sesi';
  setNotificationSound(next);setSound(next);setError('');setStatus(`${label} seçildi.`);
  try{setSaving('sound');await updateMyAppPreferences({notificationSound:next});setStatus(`${label} tercihiniz kaydedildi.`);void preview(next);onSaved?.();}
  catch{setError('Ses seçildi ancak tercihiniz şu anda kaydedilemedi. Daha sonra tekrar deneyin.');}
  finally{setSaving(null);}
 }
 async function toggleEnabled(next:boolean){
  if(saving)return;setNotificationSoundEnabled(next);setEnabled(next);setError('');setStatus(next?'Bildirim sesleri açıldı.':'Bildirim sesleri kapatıldı.');if(next)void preview(sound);
  try{setSaving('enabled');await updateMyAppPreferences({notificationSoundEnabled:next});}
  catch{setError(`Bildirim sesleri ${next?'açıldı':'kapatıldı'} ancak tercihiniz şu anda kaydedilemedi. Daha sonra tekrar deneyin.`);}
  finally{setSaving(null);}
 }
 const selectedTheme=APP_THEME_OPTIONS.find(item=>item.id===theme)?.label||'Tema';
 const selectedSound=NOTIFICATION_SOUND_OPTIONS.find(item=>item.id===sound)?.label||'Bildirim sesi';

 const themeBody=<div role="radiogroup" aria-label="Tema seçimi" aria-busy={saving==='theme'} className="grid gap-2 sm:grid-cols-2">{APP_THEME_OPTIONS.map(option=>{const selected=theme===option.id;return<button key={option.id} type="button" role="radio" aria-checked={selected} disabled={saving!==null} onClick={()=>void chooseTheme(option.id)} className={`min-h-20 rounded-2xl border-2 p-3 text-left shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-md ${selected?'border-brand-gold bg-brand-gold/5':'border-gray-200 bg-white hover:border-brand-gold/30 hover:bg-brand-gold/5 dark:border-gray-700 dark:bg-gray-900'}`}><div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border-2" style={{background:option.surface,borderColor:option.accent}}><span className="h-full w-1/2" style={{background:option.accent}}/><span className="h-full w-1/2" style={{background:option.text}}/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-black">{option.label}{selected?<Check aria-hidden="true" className="h-4 w-4 text-brand-gold"/>:null}{saving==='theme'&&selected?<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/>:null}</span><span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{option.description}</span></span></div></button>;})}</div>;
 const soundBody=<><label className="mb-3 flex min-h-12 items-center justify-between gap-4 rounded-xl border-2 border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"><span><span className="block font-black">Bildirim seslerini kullan</span><span className="block text-sm leading-relaxed text-gray-500 dark:text-gray-400">Uygulama açıkken gelen bildirimlerde premium Golden Oremar tonu çalsın.</span></span><input type="checkbox" className="h-5 w-5 shrink-0" checked={enabled} disabled={saving!==null} onChange={event=>void toggleEnabled(event.target.checked)} aria-label="Bildirim seslerini aç veya kapat"/></label><div role="radiogroup" aria-label="Bildirim sesi seçimi" aria-busy={saving==='sound'} className="space-y-2">{NOTIFICATION_SOUND_OPTIONS.map(option=>{const selected=sound===option.id;return<div key={option.id} className={`flex items-center gap-2 rounded-xl border-2 bg-white p-3 shadow-sm transition-all dark:bg-gray-900 ${selected?'border-brand-gold bg-brand-gold/5':'border-gray-200 hover:border-brand-gold/30 hover:bg-brand-gold/5 dark:border-gray-700'}`}><button type="button" role="radio" aria-checked={selected} disabled={saving!==null} onClick={()=>void chooseSound(option.id)} className="min-h-11 min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"><span className="flex items-center gap-2 font-black"><BellRing aria-hidden="true" className="h-4 w-4 text-brand-green"/>{option.label}{selected?<Check aria-hidden="true" className="h-4 w-4 text-brand-gold"/>:null}{saving==='sound'&&selected?<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/>:null}</span><span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-gray-400">{option.description}</span></button><button type="button" disabled={previewing!==null||saving!==null} onClick={()=>void preview(option.id)} className="min-h-11 shrink-0 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm font-bold transition-all hover:border-brand-gold/30 hover:bg-brand-gold/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900" aria-label={`${option.label} sesini dinle`}>{previewing===option.id?'Çalıyor…':'Dinle'}</button></div>;})}</div></>;

 return<div className="space-y-3">
  {mode==='theme'?<section aria-labelledby="theme-settings-title"><div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-green/10 text-brand-green"><Palette aria-hidden="true" className="h-5 w-5"/></span><div><h2 id="theme-settings-title" className="font-black">Tema</h2><p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Şu an: {selectedTheme}</p></div></div>{themeBody}</section>:null}
  {mode==='sound'?<section aria-labelledby="sound-settings-title"><div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold">{enabled?<Volume2 aria-hidden="true" className="h-5 w-5"/>:<VolumeX aria-hidden="true" className="h-5 w-5"/>}</span><div><h2 id="sound-settings-title" className="font-black">Bildirim Sesi</h2><p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{enabled?selectedSound:'Sessiz'}</p></div></div>{soundBody}</section>:null}
  {mode==='all'?<><details className="customer-disclosure"><summary><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green"><Palette aria-hidden="true" className="h-5 w-5"/></span><span className="min-w-0"><span className="block font-black">Tema</span><span className="block truncate text-sm font-normal text-gray-500 dark:text-gray-400">{selectedTheme}</span></span></span></summary><div className="customer-disclosure-body">{themeBody}</div></details><details className="customer-disclosure"><summary><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold">{enabled?<Volume2 aria-hidden="true" className="h-5 w-5"/>:<VolumeX aria-hidden="true" className="h-5 w-5"/>}</span><span className="min-w-0"><span className="block font-black">Bildirim sesleri</span><span className="block truncate text-sm font-normal text-gray-500 dark:text-gray-400">{enabled?selectedSound:'Sessiz'}</span></span></span></summary><div className="customer-disclosure-body">{soundBody}</div></details></>:null}
  {error?<div role="alert" aria-live="assertive" className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold leading-relaxed text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">⚠️ {error}</div>:null}
  {status&&!onSaved?<div role="status" aria-live="polite" className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">✓ {status}</div>:null}
 </div>;
}
