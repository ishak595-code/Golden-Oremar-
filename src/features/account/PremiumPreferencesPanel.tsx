import React,{useEffect,useState}from'react';
import{BellRing,Check,Loader2,Palette,Volume2,VolumeX}from'lucide-react';
import{APP_THEME_OPTIONS,type AppTheme}from'../appearance/theme';
import{NOTIFICATION_SOUND_OPTIONS,getNotificationSound,getNotificationSoundEnabled,playNotificationSound,setNotificationSound,setNotificationSoundEnabled,subscribeNotificationSoundPreference,type NotificationSoundId}from'../notifications/premiumSounds';
import{updateMyAppPreferences}from'../preferences/api';

export default function PremiumPreferencesPanel({theme,onThemeChange}:{theme:AppTheme;onThemeChange?:(theme:AppTheme)=>void}){
 const[sound,setSound]=useState<NotificationSoundId>(()=>getNotificationSound());
 const[enabled,setEnabled]=useState(()=>getNotificationSoundEnabled());
 const[previewing,setPreviewing]=useState<NotificationSoundId|null>(null);
 const[saving,setSaving]=useState<'theme'|'sound'|'enabled'|null>(null);
 const[status,setStatus]=useState('');
 const[error,setError]=useState('');

 useEffect(()=>subscribeNotificationSoundPreference(()=>{setSound(getNotificationSound());setEnabled(getNotificationSoundEnabled());}),[]);

 async function chooseTheme(next:AppTheme){
  if(saving)return;
  const label=APP_THEME_OPTIONS.find(item=>item.id===next)?.label||'Tema';
  onThemeChange?.(next);setError('');setStatus(`${label} seçildi.`);
  try{setSaving('theme');await updateMyAppPreferences({theme:next});setStatus(`${label} tercihiniz kaydedildi.`);}
  catch{setError('Tema seçildi ancak tercihiniz şu anda kaydedilemedi. Daha sonra tekrar deneyin.');}
  finally{setSaving(null);}
 }
 async function preview(next:NotificationSoundId){
  if(previewing)return;
  try{setPreviewing(next);const played=await playNotificationSound(next,{force:true});if(!played)setStatus('Ses önizlemesi cihazınızın ses ayarları nedeniyle çalınamadı.');}
  finally{window.setTimeout(()=>setPreviewing(null),900);}
 }
 async function chooseSound(next:NotificationSoundId){
  if(saving)return;
  const label=NOTIFICATION_SOUND_OPTIONS.find(item=>item.id===next)?.label||'Bildirim sesi';
  setNotificationSound(next);setSound(next);setError('');setStatus(`${label} seçildi.`);void preview(next);
  try{setSaving('sound');await updateMyAppPreferences({notificationSound:next});setStatus(`${label} tercihiniz kaydedildi.`);}
  catch{setError('Ses seçildi ancak tercihiniz şu anda kaydedilemedi. Daha sonra tekrar deneyin.');}
  finally{setSaving(null);}
 }
 async function toggleEnabled(next:boolean){
  if(saving)return;
  setNotificationSoundEnabled(next);setEnabled(next);setError('');setStatus(next?'Bildirim sesleri açıldı.':'Bildirim sesleri kapatıldı.');if(next)void preview(sound);
  try{setSaving('enabled');await updateMyAppPreferences({notificationSoundEnabled:next});}
  catch{setError('Ses tercihiniz şu anda kaydedilemedi. Daha sonra tekrar deneyin.');}
  finally{setSaving(null);}
 }

 const selectedTheme=APP_THEME_OPTIONS.find(item=>item.id===theme)?.label||'Tema';
 const selectedSound=NOTIFICATION_SOUND_OPTIONS.find(item=>item.id===sound)?.label||'Bildirim sesi';
 return<div className="space-y-3">
  <details className="customer-disclosure">
   <summary><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green"><Palette aria-hidden="true" className="h-5 w-5"/></span><span className="min-w-0"><span className="block font-black">Tema</span><span className="block truncate text-sm font-normal text-brand-muted">{selectedTheme}</span></span></span></summary>
   <div className="customer-disclosure-body"><div role="radiogroup" aria-label="Tema seçimi" aria-busy={saving==='theme'} className="grid gap-2 sm:grid-cols-2">{APP_THEME_OPTIONS.map(option=>{const selected=theme===option.id;return<button key={option.id} type="button" role="radio" aria-checked={selected} disabled={saving!==null} onClick={()=>void chooseTheme(option.id)} className={`min-h-20 rounded-2xl border p-3 text-left disabled:opacity-60 ${selected?'border-brand-gold bg-brand-gold/5':'border-brand-border'}`}><div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border" style={{background:option.surface,borderColor:option.accent}}><span className="h-full w-1/2" style={{background:option.accent}}/><span className="h-full w-1/2" style={{background:option.text}}/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-bold">{option.label}{selected?<Check aria-hidden="true" className="h-4 w-4 text-brand-gold"/>:null}{saving==='theme'&&selected?<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/>:null}</span><span className="mt-0.5 line-clamp-2 block text-xs text-brand-muted">{option.description}</span></span></div></button>;})}</div></div>
  </details>

  <details className="customer-disclosure">
   <summary><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gold/10 text-brand-gold">{enabled?<Volume2 aria-hidden="true" className="h-5 w-5"/>:<VolumeX aria-hidden="true" className="h-5 w-5"/>}</span><span className="min-w-0"><span className="block font-black">Bildirim sesleri</span><span className="block truncate text-sm font-normal text-brand-muted">{enabled?selectedSound:'Sessiz'}</span></span></span></summary>
   <div className="customer-disclosure-body"><label className="mb-3 flex min-h-12 items-center justify-between gap-4 rounded-xl border border-brand-border p-3"><span><span className="block font-bold">Bildirim seslerini kullan</span><span className="block text-sm text-brand-muted">Uygulama açıkken gelen bildirimlerde ses çalsın.</span></span><input type="checkbox" className="h-5 w-5 shrink-0" checked={enabled} disabled={saving!==null} onChange={event=>void toggleEnabled(event.target.checked)} aria-label="Bildirim seslerini aç veya kapat"/></label><div role="radiogroup" aria-label="Bildirim sesi seçimi" aria-busy={saving==='sound'} className="space-y-2">{NOTIFICATION_SOUND_OPTIONS.map(option=>{const selected=sound===option.id;return<div key={option.id} className={`flex items-center gap-2 rounded-xl border p-3 ${selected?'border-brand-gold bg-brand-gold/5':'border-brand-border'}`}><button type="button" role="radio" aria-checked={selected} disabled={saving!==null} onClick={()=>void chooseSound(option.id)} className="min-h-11 min-w-0 flex-1 text-left disabled:opacity-60"><span className="flex items-center gap-2 font-bold"><BellRing aria-hidden="true" className="h-4 w-4 text-brand-green"/>{option.label}{selected?<Check aria-hidden="true" className="h-4 w-4 text-brand-gold"/>:null}{saving==='sound'&&selected?<Loader2 aria-hidden="true" className="h-4 w-4 animate-spin"/>:null}</span><span className="mt-1 block text-xs text-brand-muted">{option.description}</span></button><button type="button" disabled={previewing!==null||saving!==null} onClick={()=>void preview(option.id)} className="min-h-11 shrink-0 rounded-xl border border-brand-border px-3 text-sm font-bold disabled:opacity-50" aria-label={`${option.label} sesini dinle`}>{previewing===option.id?'Çalıyor…':'Dinle'}</button></div>;})}</div></div>
  </details>

  {error?<div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
  {status?<div role="status" aria-live="polite" className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-3 text-sm font-semibold text-brand-green">{status}</div>:null}
 </div>;
}
