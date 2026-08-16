import React,{useEffect,useState}from'react';
import{cancelAccountClosure,changeMyPassword,getMyNewsletterStatus,getNotificationPreferences,requestAccountClosure,signOutAllDevices,signOutCurrentDevice,signOutOtherDevices,subscribeNewsletter,unsubscribeMyNewsletter,updateNotificationPreferences}from'./api';
import{ErrorState,Panel}from'./ui';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import PremiumPreferencesPanel from'./PremiumPreferencesPanel';
import type{AppTheme}from'../appearance/theme';

const keys=[
 ['orderPush','Sipariş durumları'],['paymentPush','Ödeme durumları'],['shipmentPush','Kargo ve teslimat'],
 ['returnPush','İade ve geri ödeme'],['messagePush','Mesajlar'],['reviewPush','Yorumlar'],
 ['producerPush','Satıcı/üretici işlemleri'],['systemPush','Sistem ve güvenlik'],['campaignPush','Kampanyalar']
] as const;

type SessionAction='current'|'others'|'all'|null;

export default function SettingsPanel({closure,onChanged,profile,theme='light',onThemeChange}:{closure:any;onChanged:()=>Promise<void>|void;profile?:any;theme?:AppTheme;onThemeChange?:(theme:AppTheme)=>void}){
 const[prefs,setPrefs]=useState<any>(null);const[prefsLoading,setPrefsLoading]=useState(true);const[prefsBusy,setPrefsBusy]=useState(false);const[prefsError,setPrefsError]=useState('');const[prefsMessage,setPrefsMessage]=useState('');
 const[currentPassword,setCurrentPassword]=useState('');const[newPassword,setNewPassword]=useState('');const[confirmPassword,setConfirmPassword]=useState('');const[passwordBusy,setPasswordBusy]=useState(false);const[passwordError,setPasswordError]=useState('');const[passwordMessage,setPasswordMessage]=useState('');
 const[newsletter,setNewsletter]=useState<any>(null);const[newsletterLoading,setNewsletterLoading]=useState(true);const[newsletterBusy,setNewsletterBusy]=useState(false);const[newsletterError,setNewsletterError]=useState('');const[newsletterMessage,setNewsletterMessage]=useState('');
 const[sessionBusy,setSessionBusy]=useState<SessionAction>(null);const[sessionError,setSessionError]=useState('');const[sessionMessage,setSessionMessage]=useState('');
 const[reason,setReason]=useState('');const[closureBusy,setClosureBusy]=useState(false);const[closureError,setClosureError]=useState('');const[closureMessage,setClosureMessage]=useState('');const[closureConfirmOpen,setClosureConfirmOpen]=useState(false);
 const closureDialogRef=useAccessibleDialog<HTMLDivElement>(closureConfirmOpen,()=>{if(!closureBusy)setClosureConfirmOpen(false);});
 const passwordMismatch=confirmPassword.length>0&&newPassword!==confirmPassword;

 async function loadPrefs(){
  try{setPrefsLoading(true);setPrefsError('');setPrefs(await getNotificationPreferences());}
  catch(e:any){setPrefsError(e?.message||'Bildirim ayarları yüklenemedi.');}
  finally{setPrefsLoading(false);}
 }
 async function loadNewsletter(){
  try{setNewsletterLoading(true);setNewsletterError('');setNewsletter(await getMyNewsletterStatus());}
  catch{setNewsletter({status:'none',email:profile?.email||null});setNewsletterError('E-bülten durumu şu anda alınamadı.');}
  finally{setNewsletterLoading(false);}
 }
 useEffect(()=>{void loadPrefs();void loadNewsletter();},[]);

 async function savePrefs(){
  if(!prefs||prefsBusy)return;
  try{setPrefsBusy(true);setPrefsError('');setPrefsMessage('');setPrefs(await updateNotificationPreferences(prefs));setPrefsMessage('Bildirim tercihleriniz kaydedildi.');}
  catch(e:any){setPrefsError(e?.message||'Bildirim tercihleri kaydedilemedi.');}
  finally{setPrefsBusy(false);}
 }

 async function savePassword(e:React.FormEvent){
  e.preventDefault();if(passwordBusy)return;setPasswordMessage('');setPasswordError('');
  if(newPassword!==confirmPassword){setPasswordError('Yeni şifreler eşleşmiyor.');return;}
  try{setPasswordBusy(true);await changeMyPassword(currentPassword,newPassword);setCurrentPassword('');setNewPassword('');setConfirmPassword('');setPasswordMessage('Şifreniz güncellendi.');}
  catch(e:any){setPasswordError(e?.message||'Şifre güncellenemedi.');}
  finally{setPasswordBusy(false);}
 }

 async function startNewsletter(){
  if(newsletterBusy)return;
  try{setNewsletterBusy(true);setNewsletterMessage('');setNewsletterError('');const result=await subscribeNewsletter(profile?.email||newsletter?.email||'',profile?.locale||'tr');setNewsletter(await getMyNewsletterStatus());setNewsletterMessage(result?.status==='active'?'E-bülten aboneliğiniz zaten aktif.':'Onay bağlantısı e-posta adresinize gönderilmek üzere oluşturuldu. Abonelik onaydan sonra aktif olur.');}
  catch(e:any){setNewsletterError(e?.message?.includes('invalid_email')?'E-bülten için geçerli hesap e-postası bulunamadı.':e?.message||'E-bülten aboneliği başlatılamadı.');}
  finally{setNewsletterBusy(false);}
 }
 async function stopNewsletter(){
  if(newsletterBusy)return;
  try{setNewsletterBusy(true);setNewsletterMessage('');setNewsletterError('');await unsubscribeMyNewsletter();setNewsletter(await getMyNewsletterStatus());setNewsletterMessage('E-bülten aboneliğiniz kapatıldı; kampanya pazarlama izni de devre dışı bırakıldı.');await onChanged();}
  catch(e:any){setNewsletterError(e?.message||'E-bülten aboneliği kapatılamadı.');}
  finally{setNewsletterBusy(false);}
 }

 async function runSession(action:Exclude<SessionAction,null>){
  if(sessionBusy)return;
  setSessionError('');setSessionMessage('');setSessionBusy(action);
  try{
   if(action==='current')await signOutCurrentDevice();
   else if(action==='others'){await signOutOtherDevices();setSessionMessage('Diğer cihazlardaki oturumlar kapatıldı.');}
   else await signOutAllDevices();
  }catch(e:any){setSessionError(e?.message||'Oturum işlemi tamamlanamadı.');}
  finally{setSessionBusy(null);}
 }

 async function confirmCloseAccount(){
  if(closureBusy)return;
  try{setClosureBusy(true);setClosureError('');setClosureMessage('');await requestAccountClosure(reason.trim());setReason('');setClosureConfirmOpen(false);await onChanged();setClosureMessage('Hesap kapatma talebiniz oluşturuldu.');}
  catch(e:any){setClosureConfirmOpen(false);setClosureError(e?.message||'Hesap kapatma talebi oluşturulamadı.');}
  finally{setClosureBusy(false);}
 }
 async function cancelClose(){
  if(closureBusy)return;
  try{setClosureBusy(true);setClosureError('');setClosureMessage('');await cancelAccountClosure();await onChanged();setClosureMessage('Hesap kapatma talebiniz iptal edildi.');}
  catch(e:any){setClosureError(e?.message||'Talep iptal edilemedi.');}
  finally{setClosureBusy(false);}
 }

 return<div className="space-y-5">
  <PremiumPreferencesPanel theme={theme} onThemeChange={onThemeChange}/>

  <Panel title="Şifre Değiştir" description="Parola tabanlı hesaplarda mevcut şifre yeniden doğrulanır; şifre düz metin olarak saklanmaz.">
    {passwordError?<ErrorState message={passwordError}/>:null}
    {passwordMessage?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{passwordMessage}</div>:null}
    <form onSubmit={savePassword} className="space-y-3" aria-busy={passwordBusy}>
      <label className="block"><span className="text-sm font-semibold">Mevcut şifre</span><input required disabled={passwordBusy} type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60"/></label>
      <label className="block"><span className="text-sm font-semibold">Yeni şifre</span><input required minLength={8} maxLength={72} disabled={passwordBusy} type="password" autoComplete="new-password" aria-describedby="new-password-rules" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60"/><span id="new-password-rules" className="mt-1 block text-xs text-gray-500">8-72 karakter kullanın.</span></label>
      <label className="block"><span className="text-sm font-semibold">Yeni şifre tekrar</span><input required disabled={passwordBusy} type="password" autoComplete="new-password" aria-invalid={passwordMismatch||undefined} aria-describedby={passwordMismatch?'password-match-error':undefined} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60"/>{passwordMismatch?<span id="password-match-error" className="mt-1 block text-xs font-semibold text-red-700 dark:text-red-300">Yeni şifreler eşleşmiyor.</span>:null}</label>
      <button disabled={passwordBusy||!currentPassword||newPassword.length<8||passwordMismatch||!confirmPassword} className="min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{passwordBusy?'Şifre güncelleniyor…':'Şifreyi Güncelle'}</button>
    </form>
  </Panel>

  <Panel title="E-bülten" description="Yeni ürün ve kampanya e-postaları için çift onaylı abonelik kullanılır. Tek tıkla aktif edilmez.">
    {newsletterError?<ErrorState message={newsletterError} onRetry={()=>void loadNewsletter()}/>:null}
    {newsletterMessage?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{newsletterMessage}</div>:null}
    {newsletterLoading?<div role="status" className="text-sm text-gray-500">E-bülten durumu yükleniyor…</div>:<div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700" aria-busy={newsletterBusy}>
      <div className="text-sm text-gray-500">E-posta</div>
      <div className="mt-1 break-all font-semibold">{profile?.email||newsletter?.email||'Hesap e-postası bulunamadı'}</div>
      <div className="mt-3 text-sm">Durum: <strong>{newsletter?.status==='active'?'Aktif':newsletter?.status==='pending'?'E-posta onayı bekleniyor':newsletter?.status==='unsubscribed'?'Abonelik kapalı':'Abone değil'}</strong></div>
      {newsletter?.status==='active'||newsletter?.status==='pending'?<button type="button" disabled={newsletterBusy} onClick={()=>void stopNewsletter()} className="mt-4 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">{newsletterBusy?'İşleniyor…':'E-bülten aboneliğini kapat'}</button>:<button type="button" disabled={newsletterBusy||!profile?.email} onClick={()=>void startNewsletter()} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{newsletterBusy?'İşleniyor…':'E-bültene abone ol'}</button>}
    </div>}
  </Panel>

  <Panel title="Bildirim Ayarları" description="İşlemsel bildirimleri ve kampanya bildirimlerini ayrı ayrı yönetin.">
   {prefsError?<ErrorState message={prefsError} onRetry={()=>void loadPrefs()}/>:null}
   {prefsMessage?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{prefsMessage}</div>:null}
   {prefsLoading?<div role="status" className="text-sm text-gray-500">Bildirim ayarları yükleniyor…</div>:prefs?<div className="space-y-2" aria-busy={prefsBusy}>
    <label className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><span className="font-bold">Push bildirimleri</span><input disabled={prefsBusy} type="checkbox" className="h-5 w-5 shrink-0" checked={!!prefs.pushEnabled} onChange={e=>setPrefs({...prefs,pushEnabled:e.target.checked})}/></label>
    {keys.map(([key,label])=><label key={key} className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><span>{label}</span><input disabled={prefsBusy} type="checkbox" className="h-5 w-5 shrink-0" checked={!!prefs[key]} onChange={e=>setPrefs({...prefs,[key]:e.target.checked})}/></label>)}
    <button type="button" disabled={prefsBusy} onClick={()=>void savePrefs()} className="min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{prefsBusy?'Kaydediliyor…':'Bildirim tercihlerini kaydet'}</button>
   </div>:null}
  </Panel>

  <Panel title="Oturum ve Güvenlik" description="Oturumunuzu yalnız bu cihazda, diğer cihazlarda veya tüm cihazlarda sonlandırabilirsiniz.">
    {sessionError?<ErrorState message={sessionError}/>:null}
    {sessionMessage?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{sessionMessage}</div>:null}
    <div className="space-y-2" aria-busy={!!sessionBusy}>
      <button type="button" disabled={!!sessionBusy} onClick={()=>void runSession('current')} className="min-h-11 w-full rounded-xl border border-gray-200 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{sessionBusy==='current'?'Çıkış yapılıyor…':'Bu cihazdan çıkış yap'}</button>
      <button type="button" disabled={!!sessionBusy} onClick={()=>void runSession('others')} className="min-h-11 w-full rounded-xl border border-gray-200 font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700">{sessionBusy==='others'?'Oturumlar kapatılıyor…':'Diğer cihazlardaki oturumları kapat'}</button>
      <button type="button" disabled={!!sessionBusy} onClick={()=>void runSession('all')} className="min-h-11 w-full rounded-xl border border-red-300 font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">{sessionBusy==='all'?'Tüm oturumlar kapatılıyor…':'Tüm cihazlardan çıkış yap'}</button>
    </div>
  </Panel>

  <Panel title="Hesap Kapatma" description="Sipariş ve yasal işlem kayıtları muhasebe bütünlüğü için korunabilir; aktif sipariş/iade varken kapatma engellenir.">
   {closureError?<ErrorState message={closureError}/>:null}
   {closureMessage?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{closureMessage}</div>:null}
   {closure&&!['cancelled','completed','rejected'].includes(closure.status)?<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" aria-busy={closureBusy}>
     Aktif hesap kapatma talebiniz var: <strong>{closure.status}</strong>.
     <button type="button" disabled={closureBusy} onClick={()=>void cancelClose()} className="mt-3 min-h-11 w-full rounded-lg border border-amber-500 font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">{closureBusy?'İptal ediliyor…':'Talebi iptal et'}</button>
   </div>:<div>
     <label className="block"><span className="text-sm font-semibold">Kapatma nedeni</span><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} minLength={10} maxLength={1000} aria-describedby="closure-reason-help" className="mt-1 w-full rounded-xl border bg-transparent p-3" placeholder="Neden hesabınızı kapatmak istediğinizi kısaca yazın."/><span id="closure-reason-help" className="mt-1 block text-xs text-gray-500">En az 10 karakter yazın. Talep oluşturulmadan önce ayrıca onay istenir.</span></label>
     <button type="button" onClick={()=>{setClosureError('');setClosureMessage('');setClosureConfirmOpen(true);}} disabled={closureBusy||reason.trim().length<10} className="mt-3 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Hesap kapatma talebi oluştur</button>
   </div>}
  </Panel>

  {closureConfirmOpen?<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
    <div ref={closureDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="closure-confirm-title" aria-describedby="closure-confirm-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900">
      <h3 id="closure-confirm-title" className="text-lg font-bold">Hesap kapatma talebi oluşturulsun mu?</h3>
      <p id="closure-confirm-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Bu işlem hesabınızı anında silmez. Talep güvenli backend kontrollerine gönderilir; aktif sipariş veya iade gibi engeller varsa talep reddedilebilir. Daha sonra uygun durumdayken talebi iptal edebilirsiniz.</p>
      <div aria-live="polite" className="sr-only">{closureBusy?'Hesap kapatma talebi oluşturuluyor.':''}</div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" disabled={closureBusy} onClick={()=>setClosureConfirmOpen(false)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button>
        <button type="button" disabled={closureBusy} onClick={()=>void confirmCloseAccount()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{closureBusy?'Oluşturuluyor…':'Talebi Onayla'}</button>
      </div>
    </div>
  </div>:null}
 </div>;
}
