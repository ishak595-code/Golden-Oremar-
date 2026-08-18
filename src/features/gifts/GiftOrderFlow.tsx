import React,{useEffect,useMemo,useRef,useState}from'react';
import{Gift,ShieldCheck,X}from'lucide-react';
import{createGiftOrder,getGiftAccountOverview,getGiftProduct,publicCatalogUrl}from'./api';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';

type Props={
 productReference:string;
 onClose:()=>void;
 onCreated?:(order:any)=>void;
};

type GiftAddress={
 country_code:string;
 administrative_area:string;
 city:string;
 locality:string;
 address_line1:string;
 address_line2:string;
 postal_code:string;
 delivery_notes:string;
};

const blankAddress:GiftAddress={
 country_code:'',
 administrative_area:'',
 city:'',
 locality:'',
 address_line1:'',
 address_line2:'',
 postal_code:'',
 delivery_notes:'',
};

function safeText(value:unknown,max=300){return typeof value==='string'?value.trim().slice(0,max):'';}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
function safeCurrency(value:unknown){const currency=safeText(value,3).toUpperCase();return/^[A-Z]{3}$/.test(currency)?currency:null;}
function validPhone(value:string){const normalized=value.trim();if(!normalized||normalized.length>40||/[\u0000-\u001F\u007F]/.test(normalized))return false;const digits=normalized.replace(/\D/g,'').length;return digits>=7&&digits<=20;}
function validEmail(value:string){const normalized=value.trim();return!normalized||(normalized.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized));}
function money(minor:unknown,currency:unknown){const amount=safeInteger(minor);const code=safeCurrency(currency);if(amount===null||!code)return'Fiyat doğrulanamadı';try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency:code}).format(amount/100);}catch{return'Fiyat doğrulanamadı';}}

export default function GiftOrderFlow({productReference,onClose,onCreated}:Props){
 const[product,setProduct]=useState<any>(null);
 const[account,setAccount]=useState<any>(null);
 const[variantId,setVariantId]=useState('');
 const[quantity,setQuantity]=useState(1);
 const[recipientName,setRecipientName]=useState('');
 const[recipientPhone,setRecipientPhone]=useState('');
 const[recipientEmail,setRecipientEmail]=useState('');
 const[senderName,setSenderName]=useState('');
 const[message,setMessage]=useState('');
 const[hidePrice,setHidePrice]=useState(true);
 const[coupon,setCoupon]=useState('');
 const[address,setAddress]=useState<GiftAddress>(blankAddress);
 const[loading,setLoading]=useState(true);
 const[submitting,setSubmitting]=useState(false);
 const[error,setError]=useState('');
 const[created,setCreated]=useState<any>(null);
 const errorRef=useRef<HTMLDivElement|null>(null);
 const loadingDialogRef=useAccessibleDialog<HTMLDivElement>(loading,onClose);
 const formDialogRef=useAccessibleDialog<HTMLDivElement>(!loading&&!created,()=>{if(!submitting)onClose();});
 const successDialogRef=useAccessibleDialog<HTMLDivElement>(!loading&&!!created,onClose);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    setLoading(true);setError('');setProduct(null);setAccount(null);setCreated(null);setAddress(blankAddress);setRecipientPhone('');setRecipientEmail('');setRecipientName('');setMessage('');setCoupon('');setQuantity(1);
    const [detail,overview]=await Promise.all([getGiftProduct(productReference),getGiftAccountOverview()]);
    if(!active)return;
    setProduct(detail);
    setAccount(overview);
    const variants=Array.isArray(detail?.variants)?detail.variants:[];
    const defaultVariant=variants.find((variant:any)=>variant?.default===true&&variant?.available===true&&variantSelectable(detail,variant))||variants.find((variant:any)=>variant?.available===true&&variantSelectable(detail,variant))||variants.find((variant:any)=>variant?.available===true)||variants[0];
    setVariantId(safeText(defaultVariant?.id,160));
    setSenderName(safeText(overview?.profile?.display_name,120));
   }catch(e:any){
    if(active)setError(e?.message||'Hediye bilgileri yüklenemedi.');
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[productReference]);

 useEffect(()=>{if(error)queueMicrotask(()=>errorRef.current?.focus({preventScroll:true}));},[error]);

 const variant=useMemo(()=>Array.isArray(product?.variants)?product.variants.find((v:any)=>v?.id===variantId)||null:null,[product,variantId]);
 const image=Array.isArray(product?.images)?product.images.find((i:any)=>i?.primary===true)||product.images[0]:null;
 const tracked=product?.stockMode==='tracked'||product?.stockMode==='seasonal';
 const stock=safeInteger(variant?.availableQuantity);
 const stockReady=!tracked||stock!==null;
 const priceReady=safeInteger(variant?.priceMinor)!==null&&safeCurrency(product?.currency)!==null;
 const variantReady=Boolean(safeText(variant?.id,160))&&variant?.available===true;
 const soldOut=variant?.available===false||(tracked&&stock!==null&&stock<=0);
 const purchaseReady=variantReady&&priceReady&&stockReady&&!soldOut;
 const maxQuantity=tracked&&stock!==null?Math.max(1,Math.min(20,stock)):20;

 useEffect(()=>{setQuantity(current=>Math.max(1,Math.min(current,maxQuantity)));},[variantId,maxQuantity]);

 function validate(){
  if(!product||!safeText(product.slug||product.id,220))return'Ürün referansı doğrulanamadı.';
  if(!variant||!safeText(variantId,160))return'Ürün varyantı doğrulanamadı.';
  if(!purchaseReady)return!priceReady?'Ürün fiyatı doğrulanamadığı için hediye siparişi oluşturulamaz.':!stockReady?'Ürün stoğu doğrulanamadığı için hediye siparişi oluşturulamaz.':soldOut?'Seçilen ürün stokta yok.':'Seçilen varyant satışa açık değil.';
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>maxQuantity)return`Hediye adedi 1 ile ${maxQuantity} arasında olmalıdır.`;
  const name=recipientName.trim();
  if(name.length<2||name.length>120||/[\u0000-\u001F\u007F]/.test(name))return'Alıcının adı 2 ile 120 karakter arasında olmalıdır.';
  if(!validPhone(recipientPhone))return'Teslimat için gerçek bir alıcı telefonu yazın. Telefon 7 ile 20 rakam içermelidir.';
  if(!validEmail(recipientEmail))return'Geçerli bir alıcı e-postası yazın.';
  if(senderName.trim().length>120)return'Gönderen adı en fazla 120 karakter olabilir.';
  if(message.length>1000)return'Hediye notu en fazla 1000 karakter olabilir.';
  if(!/^[A-Za-z]{2}$/.test(address.country_code.trim()))return'Ülke kodu iki harfli ISO kodu olmalıdır.';
  if(address.administrative_area.trim().length>160)return'İl veya bölge en fazla 160 karakter olabilir.';
  if(!address.city.trim()||address.city.trim().length>160)return'Şehir veya ilçe bilgisini 1 ile 160 karakter arasında yazın.';
  if(address.locality.trim().length>160)return'Mahalle veya köy en fazla 160 karakter olabilir.';
  if(address.address_line1.trim().length<5||address.address_line1.trim().length>1000)return'Açık teslimat adresi 5 ile 1000 karakter arasında olmalıdır.';
  if(address.address_line2.trim().length>500)return'Adres devamı en fazla 500 karakter olabilir.';
  if(address.postal_code.trim().length>30)return'Posta kodu en fazla 30 karakter olabilir.';
  if(address.delivery_notes.trim().length>500)return'Teslimat notu en fazla 500 karakter olabilir.';
  const normalizedCoupon=coupon.trim().toUpperCase();
  if(normalizedCoupon.length>64||normalizedCoupon&&!/^[A-Z0-9_-]+$/.test(normalizedCoupon))return'Kupon kodu yalnız harf, rakam, tire ve alt çizgi içerebilir.';
  return'';
 }

 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(submitting)return;
  const issue=validate();
  if(issue){setError(issue);return;}
  try{
   setSubmitting(true);setError('');
   const result=await createGiftOrder({
    productReference:safeText(product.slug||product.id,220),
    variantReference:safeText(variantId,160),
    quantity,
    shippingAddress:{
      label:'Hediye Teslimatı',
      recipient_name:recipientName.trim(),
      phone:recipientPhone.trim(),
      country_code:address.country_code.trim().toUpperCase(),
      administrative_area:address.administrative_area.trim()||null,
      city:address.city.trim(),
      locality:address.locality.trim()||null,
      address_line1:address.address_line1.trim(),
      address_line2:address.address_line2.trim()||null,
      postal_code:address.postal_code.trim()||null,
      delivery_notes:address.delivery_notes.trim()||null,
    },
    couponCode:coupon.trim()||null,
    gift:{
      recipientName:recipientName.trim(),
      recipientPhone:recipientPhone.trim(),
      recipientEmail:recipientEmail.trim()||null,
      message:message.trim()||null,
      senderName:senderName.trim()||null,
      hidePrice,
    }
   });
   setCreated(result);
   onCreated?.(result);
  }catch(e:any){
   const raw=String(e?.message||'Hediye siparişi oluşturulamadı.');
   const friendly=
    raw.includes('invalid_shipping_country')?'Teslimat ülkesi açıkça seçilmelidir. Ülke bilgisi varsayılan olarak atanmaz.':
    raw.includes('international_shipping_weight_missing')?'Bu ürünün uluslararası kargo ağırlığı henüz doğrulanmadığı için yurt dışı hediye siparişi açılamıyor.':
    raw.includes('manual_shipping_quote_required')?'Bu ülke için otomatik kargo fiyatı henüz tanımlı değil.':
    raw.includes('shipping_not_available')?'Seçilen ülkeye otomatik gönderim henüz açık değil.':
    raw.includes('insufficient_stock')?'Seçtiğiniz ürün için yeterli stok kalmadı.':
    raw.includes('authentication_required')?'Hediye siparişi oluşturmak için giriş yapmalısınız.':
    raw.includes('invalid_shipping_address')?'Teslimat adresi veya telefonu doğrulanamadı.':
    raw;
   setError(friendly);
  }finally{setSubmitting(false);}
 }

 if(loading)return<div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4"><div ref={loadingDialogRef} role="dialog" aria-modal="true" aria-labelledby="gift-loading-title" tabIndex={-1} className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-brand-text outline-none shadow-2xl dark:bg-gray-900"><h2 id="gift-loading-title" className="font-bold">Hediye ekranı hazırlanıyor</h2><div role="status" aria-live="polite" className="mt-2 text-sm text-gray-500">Ürün, stok ve hesap bilgileri doğrulanıyor…</div><button type="button" onClick={onClose} className="mt-4 min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Kapat</button></div></div>;

 if(created)return<div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div ref={successDialogRef} role="dialog" aria-modal="true" aria-labelledby="gift-success-title" aria-describedby="gift-success-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-6 text-center text-brand-text outline-none shadow-2xl dark:bg-gray-900">
   <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"><Gift aria-hidden="true"/></div>
   <h2 id="gift-success-title" className="mt-4 text-xl font-bold">Hediye siparişi oluşturuldu</h2>
   <p className="mt-2 text-sm text-gray-500">Sipariş no: {safeText(created.orderNumber,120)||'Doğrulanamadı'}</p>
   <p id="gift-success-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Sipariş ödeme doğrulaması bekliyor. Ödeme gerçekten onaylanmadan ödendi olarak gösterilmez.</p>
   <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tamam</button>
  </div>
 </div>;

 const productName=safeText(product?.name,300)||'Ürün';const imageUrl=publicCatalogUrl(image?.path);const trustLabels=Array.isArray(product?.trustBadges)?product.trustBadges.filter((badge:any)=>badge?.active===true&&safeText(badge?.label,120)).map((badge:any)=>safeText(badge.label,120)):[];
 return<div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-4" onMouseDown={event=>{if(event.target===event.currentTarget&&!submitting)onClose();}}>
  <div ref={formDialogRef} role="dialog" aria-modal="true" aria-labelledby="gift-title" aria-describedby="gift-description" tabIndex={-1} className="mx-auto my-4 w-full max-w-2xl rounded-3xl bg-white text-brand-text outline-none shadow-2xl dark:bg-gray-900">
   <div className="flex items-start justify-between border-b p-5 dark:border-gray-800">
    <div><h2 id="gift-title" className="text-2xl font-bold">Hediye Et</h2><p id="gift-description" className="mt-1 text-sm text-gray-500">Bu akış normal sepetten ayrıdır. Seçtiğiniz ürünün fiyatı, stoğu ve teslimat uygunluğu sunucuda yeniden doğrulanır.</p></div>
    <button type="button" disabled={submitting} onClick={onClose} aria-label="Hediye ekranını kapat" className="min-h-11 min-w-11 rounded-full border p-2 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="mx-auto h-5 w-5"/></button>
   </div>

   {error?<div ref={errorRef} role="alert" tabIndex={-1} className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}

   {product?<div className="mx-5 mt-5 flex gap-4 rounded-2xl border p-4 dark:border-gray-800">
    {imageUrl?<img src={imageUrl} alt={safeText(image?.alt,300)||`${productName} ürün görseli`} loading="lazy" decoding="async" className="h-24 w-24 rounded-xl object-cover"/>:<div role="img" aria-label={`${productName} için görsel yok`} className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-gray-100 text-xs text-gray-500 dark:bg-gray-800">Görsel yok</div>}
    <div className="min-w-0 flex-1"><h3 className="font-bold">{productName}</h3>{safeText(product?.producer?.name,240)?<p className="mt-1 text-sm text-gray-500">{safeText(product.producer.name,240)}</p>:null}
     {trustLabels.length?<div className="mt-2 text-sm font-semibold text-brand-green">{trustLabels.join(' • ')}</div>:null}
    </div>
   </div>:null}

   <form onSubmit={submit} aria-busy={submitting} className="space-y-5 p-5">
    <fieldset disabled={submitting} className="space-y-3 disabled:opacity-60"><legend className="font-bold">Ürün seçimi</legend>
     <label htmlFor="gift-variant" className="block"><span className="text-sm font-semibold">Varyant</span>
      <select id="gift-variant" value={variantId} onChange={e=>{setVariantId(e.target.value);setError('');}} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
       {Array.isArray(product?.variants)?product.variants.map((v:any)=>{const id=safeText(v?.id,160);if(!id)return null;const variantStock=safeInteger(v?.availableQuantity);const variantTracked=product?.stockMode==='tracked'||product?.stockMode==='seasonal';const stockValid=!variantTracked||variantStock!==null;const unavailable=v?.available!==true||!stockValid||(variantTracked&&variantStock!==null&&variantStock<=0);return<option key={id} value={id} disabled={unavailable}>{safeText(v?.name,240)||'Varyant'} | {money(v?.priceMinor,product?.currency)}{!stockValid?' | stok doğrulanamadı':unavailable?' | satışta değil':''}</option>; }):null}
      </select>
     </label>
     <label htmlFor="gift-quantity" className="block"><span className="text-sm font-semibold">Adet</span><input id="gift-quantity" type="number" min="1" max={maxQuantity} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(maxQuantity,Number(e.target.value)||1)))} disabled={!purchaseReady||submitting} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/>{!purchaseReady?<span className="mt-1 block text-xs font-semibold text-amber-700 dark:text-amber-300">{!priceReady?'Fiyat doğrulanamadı':!stockReady?'Stok doğrulanamadı':soldOut?'Stokta yok':'Varyant satışa açık değil'}</span>:tracked&&stock!==null?<span className="mt-1 block text-xs text-gray-500">En fazla {maxQuantity} adet, mevcut stok {stock}.</span>:null}</label>
    </fieldset>

    <fieldset disabled={submitting} className="space-y-3 disabled:opacity-60"><legend className="font-bold">Hediye alıcısı</legend>
     <label htmlFor="gift-recipient-name" className="block"><span className="text-sm font-semibold">Alıcının adı</span><input id="gift-recipient-name" value={recipientName} onChange={e=>setRecipientName(e.target.value.slice(0,120))} minLength={2} maxLength={120} autoComplete="name" required className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
     <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor="gift-recipient-phone"><span className="text-sm font-semibold">Teslimat telefonu</span><input id="gift-recipient-phone" value={recipientPhone} onChange={e=>setRecipientPhone(e.target.value.slice(0,40))} maxLength={40} autoComplete="tel" inputMode="tel" required aria-describedby="gift-phone-help" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/><span id="gift-phone-help" className="mt-1 block text-xs text-gray-500">Kargo ve teslimat için gerçek ulaşılabilir telefon. Otomatik numara üretilmez.</span></label>
      <label htmlFor="gift-recipient-email"><span className="text-sm font-semibold">E-posta <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-recipient-email" type="email" value={recipientEmail} onChange={e=>setRecipientEmail(e.target.value.slice(0,254))} maxLength={254} autoComplete="email" inputMode="email" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
     </div>
     <label htmlFor="gift-sender-name" className="block"><span className="text-sm font-semibold">Kimden <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-sender-name" value={senderName} onChange={e=>setSenderName(e.target.value.slice(0,120))} maxLength={120} autoComplete="name" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
     <label htmlFor="gift-message" className="block"><span className="text-sm font-semibold">Hediye notu <span className="font-normal text-gray-500">(opsiyonel)</span></span><textarea id="gift-message" value={message} onChange={e=>setMessage(e.target.value.slice(0,1000))} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/><span className="mt-1 block text-xs text-gray-500">{message.length}/1000</span></label>
     <label className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={hidePrice} onChange={e=>setHidePrice(e.target.checked)} className="h-5 w-5"/><span>Pakette fiyatı gösterme</span></label>
    </fieldset>

    <fieldset disabled={submitting} className="space-y-3 disabled:opacity-60"><legend className="font-bold">Teslimat adresi</legend>
     <p className="text-sm text-gray-500">Ülke otomatik seçilmez. Teslimat yapılacak gerçek ülkenin iki harfli ISO kodunu yazın, örneğin Türkiye için TR, İsviçre için CH.</p>
     <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor="gift-country"><span className="text-sm font-semibold">Ülke kodu</span><input id="gift-country" value={address.country_code} minLength={2} maxLength={2} autoCapitalize="characters" autoComplete="country" onChange={e=>setAddress({...address,country_code:e.target.value.replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()})} required className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
      <label htmlFor="gift-region"><span className="text-sm font-semibold">İl/Bölge <span className="font-normal text-gray-500">(gerekiyorsa)</span></span><input id="gift-region" value={address.administrative_area} maxLength={160} autoComplete="address-level1" onChange={e=>setAddress({...address,administrative_area:e.target.value.slice(0,160)})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
      <label htmlFor="gift-city"><span className="text-sm font-semibold">Şehir/İlçe</span><input id="gift-city" value={address.city} maxLength={160} autoComplete="address-level2" onChange={e=>setAddress({...address,city:e.target.value.slice(0,160)})} required className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
      <label htmlFor="gift-locality"><span className="text-sm font-semibold">Mahalle/Köy <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-locality" value={address.locality} maxLength={160} autoComplete="address-level3" onChange={e=>setAddress({...address,locality:e.target.value.slice(0,160)})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
     </div>
     <label htmlFor="gift-address-line1" className="block"><span className="text-sm font-semibold">Açık adres</span><textarea id="gift-address-line1" value={address.address_line1} minLength={5} maxLength={1000} autoComplete="street-address" onChange={e=>setAddress({...address,address_line1:e.target.value.slice(0,1000)})} required rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
     <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor="gift-address-line2"><span className="text-sm font-semibold">Adres devamı <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-address-line2" value={address.address_line2} maxLength={500} onChange={e=>setAddress({...address,address_line2:e.target.value.slice(0,500)})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
      <label htmlFor="gift-postal-code"><span className="text-sm font-semibold">Posta kodu <span className="font-normal text-gray-500">(ülkeye göre)</span></span><input id="gift-postal-code" value={address.postal_code} maxLength={30} autoComplete="postal-code" onChange={e=>setAddress({...address,postal_code:e.target.value.slice(0,30)})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
     </div>
     <label htmlFor="gift-delivery-notes" className="block"><span className="text-sm font-semibold">Teslimat notu <span className="font-normal text-gray-500">(opsiyonel)</span></span><textarea id="gift-delivery-notes" value={address.delivery_notes} maxLength={500} onChange={e=>setAddress({...address,delivery_notes:e.target.value.slice(0,500)})} rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>
    </fieldset>

    <label htmlFor="gift-coupon" className="block"><span className="text-sm font-semibold">Kupon kodu <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-coupon" value={coupon} maxLength={64} autoCapitalize="characters" onChange={e=>setCoupon(e.target.value.slice(0,64).toUpperCase())} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"/></label>

    <div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800">
     <div className="flex gap-2"><ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-green"/><p>Fiyat, stok, ülke ve kargo frontend değerlerine güvenilerek onaylanmaz. Sunucu sipariş oluştururken ürünü, varyantı, fiyatı, stoğu, teslimat ülkesini ve kargo uygunluğunu yeniden doğrular. Eksik gerçek bilgi varsa sipariş reddedilir.</p></div>
    </div>

    <button type="submit" disabled={submitting||!purchaseReady} className="min-h-12 w-full rounded-xl bg-brand-gold px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">{submitting?'Hediye siparişi oluşturuluyor…':purchaseReady?'Hediye Siparişini Oluştur':'Hediye Siparişi Doğrulama Bekliyor'}</button>
   </form>
  </div>
 </div>;
}

function variantSelectable(product:any,variant:any){if(!variant||variant.available!==true||!safeText(variant.id,160)||safeInteger(variant.priceMinor)===null||!safeCurrency(product?.currency))return false;const tracked=product?.stockMode==='tracked'||product?.stockMode==='seasonal';if(!tracked)return true;const stock=safeInteger(variant.availableQuantity);return stock!==null&&stock>0;}
