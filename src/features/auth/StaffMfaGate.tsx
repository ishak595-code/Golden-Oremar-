import React,{useEffect,useState}from'react';
import{KeyRound,Loader2,LogOut,ShieldCheck}from'lucide-react';
import{beginStaffTotpEnrollment,cancelStaffTotpEnrollment,listStaffTotpFactors,verifyExistingStaffTotp,verifyStaffTotpEnrollment,type StaffTotpEnrollment,type StaffTotpFactor}from'./mfaApi';

type Props={factorEnrolled:boolean;onVerified:()=>Promise<void>|void;onLogout:()=>Promise<void>|void;};
type GateMode='loading'|'enroll-start'|'enroll'|'challenge';

function safeError(error:unknown){const message=error instanceof Error?error.message:'';if(!message)return'MFA işlemi tamamlanamadı. Lütfen yeniden deneyin.';if(message.length>500)return'MFA işlemi güvenli şekilde tamamlanamadı.';return message;}

export default function StaffMfaGate({factorEnrolled,onVerified,onLogout}:Props){
 const[mode,setMode]=useState<GateMode>('loading');
 const[factors,setFactors]=useState<StaffTotpFactor[]>([]);
 const[selectedFactorId,setSelectedFactorId]=useState('');
 const[enrollment,setEnrollment]=useState<StaffTotpEnrollment|null>(null);
 const[code,setCode]=useState('');
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const[success,setSuccess]=useState(false);

 useEffect(()=>{
  let active=true;
  setError('');setCode('');setEnrollment(null);setSuccess(false);
  if(!factorEnrolled){setFactors([]);setSelectedFactorId('');setMode('enroll-start');return()=>{active=false;};}
  setMode('loading');
  listStaffTotpFactors().then(items=>{
   if(!active)return;
   const verified=items.filter(item=>item.status==='verified');
   if(!verified.length){setMode('enroll-start');return;}
   setFactors(verified);setSelectedFactorId(verified[0].id);setMode('challenge');
  }).catch(next=>{if(active){setError(safeError(next));setMode('challenge');}});
  return()=>{active=false;};
 },[factorEnrolled]);

 async function startEnrollment(){if(busy)return;setBusy(true);setError('');try{const next=await beginStaffTotpEnrollment();setEnrollment(next);setMode('enroll');setCode('');}catch(next){setError(safeError(next));}finally{setBusy(false);}}
 async function cancelEnrollment(){if(!enrollment||busy)return;setBusy(true);setError('');try{await cancelStaffTotpEnrollment(enrollment.factorId);setEnrollment(null);setCode('');setMode('enroll-start');}catch(next){setError(safeError(next));}finally{setBusy(false);}}
 async function verify(){if(busy||!/^[0-9]{6}$/.test(code))return;setBusy(true);setError('');try{if(mode==='enroll'&&enrollment)await verifyStaffTotpEnrollment(enrollment.factorId,code);else await verifyExistingStaffTotp(code,selectedFactorId||undefined);setSuccess(true);await onVerified();}catch(next){setSuccess(false);setError(safeError(next));setCode('');}finally{setBusy(false);}}

 return<div className="min-h-screen bg-brand-main px-4 py-8 text-brand-text sm:px-6">
  <main className="mx-auto max-w-xl rounded-3xl border border-brand-border bg-brand-card p-5 shadow-xl sm:p-7" aria-labelledby="staff-mfa-title">
   <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-green/10 text-brand-green"><ShieldCheck aria-hidden="true" className="h-7 w-7"/></div>
   <h1 id="staff-mfa-title" className="mt-4 text-center text-2xl font-black">Yönetim için iki aşamalı doğrulama</h1>
   <p className="mt-2 text-center text-sm leading-6 text-brand-muted">Yönetim yetkileri yalnız ikinci faktörle doğrulanmış AAL2 oturumunda açılır. Bu kontrol sunucudaki capability katmanında da uygulanır.</p>

   {error?<div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
   {success?<div role="status" className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-200">İkinci faktör doğrulandı. Güvenli yönetim oturumu hazırlanıyor…</div>:null}

   {mode==='loading'?<div role="status" className="mt-6 flex min-h-32 items-center justify-center gap-2 text-sm font-semibold text-brand-muted"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>Authenticator durumu doğrulanıyor…</div>:null}

   {mode==='enroll-start'?<section className="mt-6 space-y-4" aria-label="Authenticator kurulumu"><div className="rounded-2xl border border-brand-border p-4"><h2 className="font-black">Authenticator uygulaması gerekli</h2><p className="mt-2 text-sm leading-6 text-brand-muted">Google Authenticator, 1Password, Authy veya cihazınızdaki uyumlu TOTP uygulaması kullanılabilir. Kurulum tamamlanmadan yönetim paneli açılmaz.</p></div><button type="button" onClick={()=>void startEnrollment()} disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-black text-brand-on-green disabled:opacity-50">{busy?'Kurulum hazırlanıyor…':'Güvenli kurulumu başlat'}</button></section>:null}

   {mode==='enroll'&&enrollment?<section className="mt-6 space-y-4" aria-label="Authenticator QR kurulumu"><div className="rounded-2xl border border-brand-border bg-white p-4 dark:bg-gray-950"><img src={enrollment.qrCode} alt="Golden Oremar yönetim TOTP kurulum QR kodu" className="mx-auto h-auto w-full max-w-[280px]"/></div><div className="rounded-2xl border border-brand-border p-4"><div className="text-xs font-black uppercase tracking-[0.12em] text-brand-muted">Elle kurulum anahtarı</div><code className="mt-2 block break-all rounded-xl bg-black/5 p-3 text-sm font-bold dark:bg-white/5">{enrollment.secret}</code><p className="mt-2 text-xs leading-5 text-brand-muted">Bu anahtarı kimseyle paylaşmayın. Golden Oremar bu değeri uygulama veritabanında ayrıca saklamaz.</p></div><CodeForm code={code} setCode={setCode} busy={busy} onVerify={verify} label="Kurulumu doğrula"/><button type="button" onClick={()=>void cancelEnrollment()} disabled={busy} className="min-h-11 w-full rounded-xl border border-brand-border px-4 font-bold disabled:opacity-50">Kurulumu iptal et</button></section>:null}

   {mode==='challenge'?<section className="mt-6 space-y-4" aria-label="İkinci faktör doğrulama">{factors.length>1?<label className="block"><span className="mb-1 block text-sm font-bold">Authenticator</span><select value={selectedFactorId} onChange={event=>setSelectedFactorId(event.target.value)} disabled={busy} className="min-h-11 w-full rounded-xl border border-brand-border bg-brand-card px-3">{factors.map(factor=><option key={factor.id} value={factor.id}>{factor.friendlyName}</option>)}</select></label>:null}<div className="rounded-2xl border border-brand-border p-4"><div className="flex items-center gap-2 font-black"><KeyRound aria-hidden="true" className="h-5 w-5 text-brand-green"/>Authenticator kodunu girin</div><p className="mt-2 text-sm leading-6 text-brand-muted">Kayıtlı uygulamanızdaki güncel 6 haneli kod doğrulandıktan sonra yönetim capability'leri açılır.</p></div><CodeForm code={code} setCode={setCode} busy={busy} onVerify={verify} label="AAL2 ile doğrula"/></section>:null}

   <button type="button" onClick={()=>void onLogout()} disabled={busy} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-border px-4 font-bold disabled:opacity-50"><LogOut aria-hidden="true" className="h-4 w-4"/>Güvenli çıkış yap</button>
  </main>
 </div>;
}

function CodeForm({code,setCode,busy,onVerify,label}:{code:string;setCode:(value:string)=>void;busy:boolean;onVerify:()=>Promise<void>;label:string}){return<form onSubmit={event=>{event.preventDefault();void onVerify();}} className="space-y-3"><label className="block"><span className="mb-1 block text-sm font-bold">6 haneli doğrulama kodu</span><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy} className="min-h-12 w-full rounded-xl border border-brand-border bg-transparent px-4 text-center text-xl font-black tracking-[0.3em]" aria-label="Authenticator doğrulama kodu"/></label><button type="submit" disabled={busy||!/^[0-9]{6}$/.test(code)} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-black text-brand-on-green disabled:opacity-50">{busy?'Doğrulanıyor…':label}</button></form>;}
