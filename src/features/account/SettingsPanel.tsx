
import React,{useEffect,useState}from'react';
import{cancelAccountClosure,changeMyPassword,getMyNewsletterStatus,getNotificationPreferences,requestAccountClosure,signOutAllDevices,signOutCurrentDevice,signOutOtherDevices,subscribeNewsletter,unsubscribeMyNewsletter,updateNotificationPreferences}from'./api';
import{ErrorState,Panel}from'./ui';

const keys=[
 ['orderPush','Sipariş durumları'],['paymentPush','Ödeme durumları'],['shipmentPush','Kargo ve teslimat'],
 ['returnPush','İade ve geri ödeme'],['messagePush','Mesajlar'],['reviewPush','Yorumlar'],
 ['producerPush','Satıcı/üretici işlemleri'],['systemPush','Sistem ve güvenlik'],['campaignPush','Kampanyalar']
] as const;

export default function SettingsPanel({closure,onChanged,profile,theme='light',onThemeChange}:{closure:any;onChanged:()=>Promise<void>|void;profile?:any;theme?:string;onThemeChange?:(theme:'light'|'dark')=>void}){
 const[prefs,setPrefs]=useState<any>(null);const[error,setError]=useState('');const[reason,setReason]=useState('');
 const[currentPassword,setCurrentPassword]=useState('');const[newPassword,setNewPassword]=useState('');const[confirmPassword,setConfirmPassword]=useState('');const[passwordBusy,setPasswordBusy]=useState(false);const[passwordMessage,setPasswordMessage]=useState('');
 const[newsletter,setNewsletter]=useState<any>(null);const[newsletterBusy,setNewsletterBusy]=useState(false);const[newsletterMessage,setNewsletterMessage]=useState('');
 useEffect(()=>{getNotificationPreferences().then(setPrefs).catch((e:any)=>setError(e?.message||'Ayarlar yüklenemedi.'));getMyNewsletterStatus().then(setNewsletter).catch(()=>setNewsletter({status:'none',email:profile?.email||null}));},[]);
 async function save(){if(!prefs)return;try{setPrefs(await updateNotificationPreferences(prefs));}catch(e:any){setError(e?.message||'Bildirim tercihleri kaydedilemedi.');}}
 async function closeAccount(){try{await requestAccountClosure(reason);setReason('');await onChanged();}catch(e:any){setError(e?.message||'Hesap kapatma talebi oluşturulamadı.');}}
 async function cancelClose(){try{await cancelAccountClosure();await onChanged();}catch(e:any){setError(e?.message||'Talep iptal edilemedi.');}}
 async function savePassword(e:React.FormEvent){
  e.preventDefault();setPasswordMessage('');setError('');
  if(newPassword!==confirmPassword){setError('Yeni şifreler eşleşmiyor.');return;}
  try{setPasswordBusy(true);await changeMyPassword(currentPassword,newPassword);setCurrentPassword('');setNewPassword('');setConfirmPassword('');setPasswordMessage('Şifreniz güncellendi.');}
  catch(e:any){setError(e?.message||'Şifre güncellenemedi.');}
  finally{setPasswordBusy(false);}
 }
 async function startNewsletter(){
  try{setNewsletterBusy(true);setNewsletterMessage('');setError('');const result=await subscribeNewsletter(profile?.email||newsletter?.email||'',profile?.locale||'tr');setNewsletter(await getMyNewsletterStatus());setNewsletterMessage(result?.status==='active'?'E-bülten aboneliğiniz zaten aktif.':'Onay bağlantısı e-posta adresinize gönderilmek üzere oluşturuldu. Abonelik onaydan sonra aktif olur.');}
  catch(e:any){setError(e?.message?.includes('invalid_email')?'E-bülten için geçerli hesap e-postası bulunamadı.':e?.message||'E-bülten aboneliği başlatılamadı.');}
  finally{setNewsletterBusy(false);}
 }
 async function stopNewsletter(){
  try{setNewsletterBusy(true);setNewsletterMessage('');setError('');await unsubscribeMyNewsletter();setNewsletter(await getMyNewsletterStatus());setNewsletterMessage('E-bülten aboneliğiniz kapatıldı; kampanya pazarlama izni de devre dışı bırakıldı.');await onChanged();}
  catch(e:any){setError(e?.message||'E-bülten aboneliği kapatılamadı.');}
  finally{setNewsletterBusy(false);}
 }
 return<div className="space-y-5">
  <Panel title="Görünüm" description="Uygulamanın aydınlık veya karanlık görünümünü seçin.">
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Görünüm seçimi">
      <button type="button" role="radio" aria-checked={theme==='light'} onClick={()=>onThemeChange?.('light')} className={`min-h-12 rounded-xl border px-4 font-bold ${theme==='light'?'border-brand-gold bg-brand-gold/10 text-brand-gold':''}`}>Aydınlık</button>
      <button type="button" role="radio" aria-checked={theme==='dark'} onClick={()=>onThemeChange?.('dark')} className={`min-h-12 rounded-xl border px-4 font-bold ${theme==='dark'?'border-brand-gold bg-brand-gold/10 text-brand-gold':''}`}>Karanlık</button>
    </div>
  </Panel>

  <Panel title="Şifre Değiştir" description="Parola tabanlı hesaplarda mevcut şifre yeniden doğrulanır; şifre düz metin olarak saklanmaz.">
    {passwordMessage?<div role="status" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{passwordMessage}</div>:null}
    <form onSubmit={savePassword} className="space-y-3">
      <label className="block"><span className="text-sm font-semibold">Mevcut şifre</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label className="block"><span className="text-sm font-semibold">Yeni şifre</span><input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label className="block"><span className="text-sm font-semibold">Yeni şifre tekrar</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <button disabled={passwordBusy||!currentPassword||newPassword.length<8} className="min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50">{passwordBusy?'Şifre güncelleniyor…':'Şifreyi Güncelle'}</button>
    </form>
  </Panel>


  <Panel title="E-bülten" description="Yeni ürün ve kampanya e-postaları için çift onaylı abonelik kullanılır. Tek tıkla aktif edilmez.">
    {newsletterMessage?<div role="status" aria-live="polite" className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">{newsletterMessage}</div>:null}
    <div className="rounded-xl border p-4">
      <div className="text-sm text-gray-500">E-posta</div>
      <div className="mt-1 font-semibold">{profile?.email||newsletter?.email||'Hesap e-postası bulunamadı'}</div>
      <div className="mt-3 text-sm">Durum: <strong>{newsletter?.status==='active'?'Aktif':newsletter?.status==='pending'?'E-posta onayı bekleniyor':newsletter?.status==='unsubscribed'?'Abonelik kapalı':'Abone değil'}</strong></div>
      {newsletter?.status==='active'||newsletter?.status==='pending'?<button disabled={newsletterBusy} onClick={stopNewsletter} className="mt-4 min-h-11 w-full rounded-xl border border-red-200 font-bold text-red-700 disabled:opacity-50">{newsletterBusy?'İşleniyor…':'E-bülten aboneliğini kapat'}</button>:<button disabled={newsletterBusy||!profile?.email} onClick={startNewsletter} className="mt-4 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white disabled:opacity-50">{newsletterBusy?'İşleniyor…':'E-bültene abone ol'}</button>}
    </div>
  </Panel>

  <Panel title="Bildirim Ayarları" description="İşlemsel bildirimleri ve kampanya bildirimlerini ayrı ayrı yönetin.">
   {error?<ErrorState message={error}/>:null}
   {prefs?<div className="space-y-2">
    <label className="flex min-h-11 items-center justify-between rounded-xl border p-3"><span className="font-bold">Push bildirimleri</span><input type="checkbox" className="h-5 w-5" checked={!!prefs.pushEnabled} onChange={e=>setPrefs({...prefs,pushEnabled:e.target.checked})}/></label>
    {keys.map(([key,label])=><label key={key} className="flex min-h-11 items-center justify-between rounded-xl border p-3"><span>{label}</span><input type="checkbox" className="h-5 w-5" checked={!!prefs[key]} onChange={e=>setPrefs({...prefs,[key]:e.target.checked})}/></label>)}
    <button onClick={save} className="min-h-11 w-full rounded-xl bg-brand-green font-bold text-white">Bildirim tercihlerini kaydet</button>
   </div>:<p className="text-sm text-gray-500">Bildirim ayarları yükleniyor…</p>}
  </Panel>


  <Panel title="Oturum ve Güvenlik" description="Oturumunuzu yalnız bu cihazda, diğer cihazlarda veya tüm cihazlarda sonlandırabilirsiniz.">
    <div className="space-y-2">
      <button onClick={()=>signOutCurrentDevice()} className="min-h-11 w-full rounded-xl border font-semibold">Bu cihazdan çıkış yap</button>
      <button onClick={()=>signOutOtherDevices()} className="min-h-11 w-full rounded-xl border font-semibold">Diğer cihazlardaki oturumları kapat</button>
      <button onClick={()=>signOutAllDevices()} className="min-h-11 w-full rounded-xl border border-red-300 font-semibold text-red-700">Tüm cihazlardan çıkış yap</button>
    </div>
  </Panel>

  <Panel title="Hesap Kapatma" description="Sipariş ve yasal işlem kayıtları muhasebe bütünlüğü için korunabilir; aktif sipariş/iade varken kapatma engellenir.">
   {closure && !['cancelled','completed','rejected'].includes(closure.status)?<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
     Aktif hesap kapatma talebiniz var: <strong>{closure.status}</strong>.
     <button onClick={cancelClose} className="mt-3 min-h-11 w-full rounded-lg border border-amber-400 font-bold">Talebi iptal et</button>
   </div>:<div>
     <label className="block"><span className="text-sm font-semibold">Kapatma nedeni</span><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3" placeholder="Neden hesabınızı kapatmak istediğinizi kısaca yazın."/></label>
     <button onClick={closeAccount} disabled={reason.trim().length<10} className="mt-3 min-h-11 w-full rounded-xl border border-red-300 font-bold text-red-700 disabled:opacity-50">Hesap kapatma talebi oluştur</button>
   </div>}
  </Panel>
 </div>;
}
