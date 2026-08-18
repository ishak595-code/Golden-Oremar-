import React,{useEffect,useState}from'react';
import{CreditCard,ShieldCheck,X}from'lucide-react';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import{enrollMyPaymentMethod,type PaymentReadiness,type SavedPaymentMethod}from'./api';

type Props={
 open:boolean;
 readiness:PaymentReadiness|null;
 onClose:()=>void;
 onSaved:(method:SavedPaymentMethod)=>void|Promise<void>;
};

function formatCardInput(value:string){const digits=value.replace(/\D/g,'').slice(0,19);return digits.replace(/(.{4})/g,'$1 ').trim();}
function currentYear(){return new Date().getUTCFullYear();}

export default function PaymentMethodEnrollmentDialog({open,readiness,onClose,onSaved}:Props){
 const[cardNumber,setCardNumber]=useState('');
 const[cardHolder,setCardHolder]=useState('');
 const[expMonth,setExpMonth]=useState('');
 const[expYear,setExpYear]=useState('');
 const[nickname,setNickname]=useState('');
 const[country,setCountry]=useState('');
 const[postal,setPostal]=useState('');
 const[makeDefault,setMakeDefault]=useState(false);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const dialogRef=useAccessibleDialog<HTMLFormElement>(open,()=>{if(!busy)onClose();});
 const ready=readiness?.cardEnrollmentEnabled===true&&readiness?.savedPaymentMethodsSupported===true&&Boolean(readiness.provider);

 useEffect(()=>{
  if(!open)return;
  setCardNumber('');setCardHolder('');setExpMonth('');setExpYear('');setNickname('');setCountry('');setPostal('');setMakeDefault(false);setError('');
 },[open]);

 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(busy)return;
  if(!ready){setError('Kart kaydı için gerçek ödeme sağlayıcısı henüz etkinleştirilmedi.');return;}
  const digits=cardNumber.replace(/\D/g,'');const holder=cardHolder.trim();const month=Number(expMonth);const year=Number(expYear);const alias=nickname.trim();const normalizedCountry=country.trim().toUpperCase();const normalizedPostal=postal.trim();
  if(digits.length<12||digits.length>19){setError('Kart numarası 12 ile 19 rakam arasında olmalıdır.');return;}
  if(holder.length<2||holder.length>120){setError('Kart sahibi adı 2 ile 120 karakter arasında olmalıdır.');return;}
  if(!Number.isSafeInteger(month)||month<1||month>12){setError('Son kullanma ayını kontrol edin.');return;}
  if(!Number.isSafeInteger(year)||year<currentYear()||year>2200){setError('Son kullanma yılını kontrol edin.');return;}
  if(alias.length>40){setError('Kart rumuzu en fazla 40 karakter olabilir.');return;}
  if(normalizedCountry&&!/^[A-Z]{2}$/.test(normalizedCountry)){setError('Fatura ülke kodu iki harfli ISO kodu olmalıdır.');return;}
  if(normalizedPostal.length>30){setError('Fatura posta kodu en fazla 30 karakter olabilir.');return;}
  try{
   setBusy(true);setError('');
   const method=await enrollMyPaymentMethod({cardNumber:digits,cardHolderName:holder,expMonth:month,expYear:year,nickname:alias||null,billingCountryCode:normalizedCountry||null,billingPostalCode:normalizedPostal||null,makeDefault});
   await onSaved(method);onClose();
  }catch(e:any){setError(e?.message||'Kart güvenli şekilde kaydedilemedi.');}
  finally{setBusy(false);}
 }

 if(!open)return null;
 return<div className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-enrollment-title" aria-describedby="payment-enrollment-description" tabIndex={-1} onSubmit={submit} className="mx-auto my-8 w-full max-w-lg rounded-3xl bg-white p-5 text-brand-text shadow-2xl outline-none dark:bg-gray-900">
   <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-brand-green dark:text-brand-gold"><CreditCard aria-hidden="true" className="h-5 w-5"/><span className="text-xs font-bold uppercase tracking-[0.14em]">Güvenli kart kasası</span></div><h2 id="payment-enrollment-title" className="mt-1 text-xl font-bold">Yeni kart ekle</h2><p id="payment-enrollment-description" className="mt-1 text-sm text-gray-500">Kart numarası yalnız kart kayıt isteği sırasında ödeme sağlayıcısına iletilir. Golden Oremar veritabanında tam kart numarası veya CVC tutulmaz.</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Kart ekleme penceresini kapat" className="grid min-h-11 min-w-11 place-items-center rounded-xl border disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-5 w-5"/></button></div>
   {error?<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}
   <div className={`mt-4 rounded-xl border p-3 text-sm ${ready?'border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100':'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'}`}>{ready?`${readiness?.provider} kart kasası kayıt almaya hazır.`:'Kart ekleme altyapısı hazır, ancak gerçek merchant sağlayıcısı ve sunucu anahtarları etkinleştirilmeden kart kaydı gönderilemez.'}</div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="block sm:col-span-2" htmlFor="vault-card-number"><span className="text-sm font-semibold">Kart numarası</span><input id="vault-card-number" value={formatCardInput(cardNumber)} onChange={e=>setCardNumber(e.target.value.replace(/\D/g,'').slice(0,19))} inputMode="numeric" autoComplete="cc-number" maxLength={23} required disabled={busy||!ready} placeholder="1234 5678 9012 3456" className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
    <label className="block sm:col-span-2" htmlFor="vault-card-holder"><span className="text-sm font-semibold">Kart üzerindeki ad soyad</span><input id="vault-card-holder" value={cardHolder} onChange={e=>setCardHolder(e.target.value.slice(0,120))} autoComplete="cc-name" maxLength={120} required disabled={busy||!ready} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
    <label className="block" htmlFor="vault-exp-month"><span className="text-sm font-semibold">Son kullanma ayı</span><input id="vault-exp-month" value={expMonth} onChange={e=>setExpMonth(e.target.value.replace(/\D/g,'').slice(0,2))} inputMode="numeric" autoComplete="cc-exp-month" maxLength={2} required disabled={busy||!ready} placeholder="MM" className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
    <label className="block" htmlFor="vault-exp-year"><span className="text-sm font-semibold">Son kullanma yılı</span><input id="vault-exp-year" value={expYear} onChange={e=>setExpYear(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" autoComplete="cc-exp-year" maxLength={4} required disabled={busy||!ready} placeholder="YYYY" className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
    <label className="block sm:col-span-2" htmlFor="vault-nickname"><span className="text-sm font-semibold">Kart rumuzu <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="vault-nickname" value={nickname} onChange={e=>setNickname(e.target.value.slice(0,40))} maxLength={40} autoComplete="off" disabled={busy||!ready} placeholder="Örn. Günlük kartım" className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
    <label className="block" htmlFor="vault-country"><span className="text-sm font-semibold">Fatura ülke kodu</span><input id="vault-country" value={country} onChange={e=>setCountry(e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,2))} maxLength={2} autoComplete="country" disabled={busy||!ready} placeholder="CH" className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
    <label className="block" htmlFor="vault-postal"><span className="text-sm font-semibold">Fatura posta kodu</span><input id="vault-postal" value={postal} onChange={e=>setPostal(e.target.value.slice(0,30))} maxLength={30} autoComplete="postal-code" disabled={busy||!ready} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-55"/></label>
   </div>
   <label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" checked={makeDefault} onChange={e=>setMakeDefault(e.target.checked)} disabled={busy||!ready} className="h-5 w-5"/><span className="text-sm font-semibold">Varsayılan ödeme yöntemim yap</span></label>
   <div className="mt-4 flex gap-2 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green"/><p>CVC/CVV kart saklama işleminde toplanmaz. Ödeme sağlayıcısı bir ödeme sırasında ek doğrulama isterse yalnız o işlem için kullanılır ve kaydedilmez.</p></div>
   <div aria-live="polite" className="sr-only">{busy?'Kart ödeme sağlayıcısında doğrulanıyor.':''}</div>
   <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={busy} onClick={onClose} className="min-h-12 rounded-xl border font-semibold disabled:opacity-50">Vazgeç</button><button type="submit" disabled={busy||!ready} className="min-h-12 rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?'Kart doğrulanıyor…':ready?'Kartı Güvenle Kaydet':'Sağlayıcı yapılandırılmalı'}</button></div>
  </form>
 </div>;
}
