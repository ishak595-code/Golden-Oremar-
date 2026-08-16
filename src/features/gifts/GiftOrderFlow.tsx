
import React,{useEffect,useMemo,useState}from'react';
import{Gift,ShieldCheck,X}from'lucide-react';
import{createGiftOrder,getGiftAccountOverview,getGiftProduct,publicCatalogUrl}from'./api';

type Props={
 productReference:string;
 onClose:()=>void;
 onCreated?:(order:any)=>void;
};

const blankAddress={
 country_code:'TR',
 administrative_area:'',
 city:'',
 locality:'',
 address_line1:'',
 address_line2:'',
 postal_code:'',
 delivery_notes:'',
};

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
 const[address,setAddress]=useState<any>(blankAddress);
 const[loading,setLoading]=useState(true);
 const[submitting,setSubmitting]=useState(false);
 const[error,setError]=useState('');
 const[created,setCreated]=useState<any>(null);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    setLoading(true);setError('');
    const [detail,overview]=await Promise.all([getGiftProduct(productReference),getGiftAccountOverview()]);
    if(!active)return;
    setProduct(detail);
    setAccount(overview);
    const defaultVariant=detail?.variants?.find((v:any)=>v.default)||detail?.variants?.[0];
    setVariantId(defaultVariant?.id||'');
    setSenderName(overview?.profile?.display_name||'');
   }catch(e:any){
    if(active)setError(e?.message||'Hediye bilgileri yüklenemedi.');
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false};
 },[productReference]);

 const variant=useMemo(()=>product?.variants?.find((v:any)=>v.id===variantId)||null,[product,variantId]);
 const image=product?.images?.find((i:any)=>i.primary)||product?.images?.[0];

 function validate(){
  if(!product||!variantId)return'Ürün varyantı bulunamadı.';
  if(recipientName.trim().length<2)return'Alıcının adını yazın.';
  if(recipientPhone.trim()&&recipientPhone.trim().length<7)return'Geçerli bir alıcı telefonu yazın.';
  if(recipientEmail.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()))return'Geçerli bir alıcı e-postası yazın.';
  if(message.length>1000)return'Hediye notu en fazla 1000 karakter olabilir.';
  if(!/^[A-Za-z]{2}$/.test(address.country_code||''))return'Ülke kodu iki harf olmalıdır.';
  if(!address.city?.trim())return'Şehir/ilçe bilgisini yazın.';
  if((address.address_line1||'').trim().length<5)return'Teslimat adresini yazın.';
  return'';
 }

 async function submit(e:React.FormEvent){
  e.preventDefault();
  const issue=validate();
  if(issue){setError(issue);return;}
  try{
   setSubmitting(true);setError('');
   const result=await createGiftOrder({
    productReference:product.slug||product.id,
    variantReference:variantId,
    quantity,
    shippingAddress:{
      label:'Hediye Teslimatı',
      recipient_name:recipientName.trim(),
      phone:recipientPhone.trim()||account?.profile?.phone||'0000000',
      country_code:(address.country_code||'TR').toUpperCase(),
      administrative_area:address.administrative_area?.trim()||null,
      city:address.city.trim(),
      locality:address.locality?.trim()||null,
      address_line1:address.address_line1.trim(),
      address_line2:address.address_line2?.trim()||null,
      postal_code:address.postal_code?.trim()||null,
      delivery_notes:address.delivery_notes?.trim()||null,
    },
    couponCode:coupon,
    gift:{
      recipientName:recipientName.trim(),
      recipientPhone:recipientPhone.trim()||null,
      recipientEmail:recipientEmail.trim()||null,
      message:message.trim()||null,
      senderName:senderName.trim()||null,
      hidePrice,
    }
   });
   setCreated(result);
   onCreated?.(result);
  }catch(e:any){
   const raw=e?.message||'Hediye siparişi oluşturulamadı.';
   const friendly=
    raw.includes('international_shipping_weight_missing')?'Bu ürünün uluslararası kargo ağırlığı henüz doğrulanmadığı için yurt dışı hediye siparişi açılamıyor.':
    raw.includes('manual_shipping_quote_required')?'Bu ülke için otomatik kargo fiyatı henüz tanımlı değil.':
    raw.includes('shipping_not_available')?'Seçilen ülkeye otomatik gönderim henüz açık değil.':
    raw.includes('insufficient_stock')?'Seçtiğiniz ürün için yeterli stok kalmadı.':
    raw.includes('authentication_required')?'Hediye siparişi oluşturmak için giriş yapmalısınız.':
    raw;
   setError(friendly);
  }finally{setSubmitting(false);}
 }

 if(loading)return<div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4"><div role="status" className="rounded-2xl bg-white p-6">Hediye ekranı hazırlanıyor…</div></div>;

 if(created)return<div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4">
  <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 text-center">
   <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-700"><Gift/></div>
   <h2 className="mt-4 text-xl font-bold">Hediye siparişi oluşturuldu</h2>
   <p className="mt-2 text-sm text-gray-500">Sipariş no: {created.orderNumber}</p>
   <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Sipariş ödeme doğrulaması bekliyor. Ödeme gerçekten onaylanmadan “ödendi” olarak gösterilmez.</p>
   <button onClick={onClose} className="mt-5 min-h-11 w-full rounded-xl bg-brand-green font-bold text-white">Tamam</button>
  </div>
 </div>;

 return<div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-4">
  <div role="dialog" aria-modal="true" aria-labelledby="gift-title" className="mx-auto my-4 w-full max-w-2xl rounded-3xl bg-white dark:bg-gray-900 shadow-2xl">
   <div className="flex items-start justify-between border-b p-5">
    <div><h2 id="gift-title" className="text-2xl font-bold">Hediye Et</h2><p className="mt-1 text-sm text-gray-500">Bu akış normal sepetten ayrıdır; yalnız seçtiğiniz ürün hediye siparişine girer.</p></div>
    <button onClick={onClose} aria-label="Hediye ekranını kapat" className="min-h-11 min-w-11 rounded-full border p-2"><X className="mx-auto h-5 w-5"/></button>
   </div>

   {error?<div role="alert" className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>:null}

   {product?<div className="mx-5 mt-5 flex gap-4 rounded-2xl border p-4">
    {image?.path?<img src={publicCatalogUrl(image.path)} alt={image.alt||product.name} className="h-24 w-24 rounded-xl object-cover"/>:null}
    <div className="min-w-0 flex-1"><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-gray-500">{product.producer?.name}</p>
     <div className="mt-2 text-sm font-semibold">{product.trustBadges?.filter((b:any)=>b.active).map((b:any)=>b.label).join(' • ')}</div>
    </div>
   </div>:null}

   <form onSubmit={submit} className="space-y-5 p-5">
    <fieldset className="space-y-3"><legend className="font-bold">Ürün seçimi</legend>
     <label className="block"><span className="text-sm font-semibold">Varyant</span>
      <select value={variantId} onChange={e=>setVariantId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3">
       {product?.variants?.map((v:any)=><option key={v.id} value={v.id}>{v.name} — {(Number(v.priceMinor||0)/100).toLocaleString('tr-TR')} {product.currency}</option>)}
      </select>
     </label>
     <label className="block"><span className="text-sm font-semibold">Adet</span><input type="number" min="1" max="20" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(20,Number(e.target.value)||1)))} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
    </fieldset>

    <fieldset className="space-y-3"><legend className="font-bold">Hediye alıcısı</legend>
     <label className="block"><span className="text-sm font-semibold">Alıcının adı</span><input value={recipientName} onChange={e=>setRecipientName(e.target.value)} autoComplete="name" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
     <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="text-sm font-semibold">Telefon</span><input value={recipientPhone} onChange={e=>setRecipientPhone(e.target.value)} inputMode="tel" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label><span className="text-sm font-semibold">E-posta (opsiyonel)</span><input value={recipientEmail} onChange={e=>setRecipientEmail(e.target.value)} inputMode="email" className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
     </div>
     <label className="block"><span className="text-sm font-semibold">Kimden</span><input value={senderName} onChange={e=>setSenderName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
     <label className="block"><span className="text-sm font-semibold">Hediye notu</span><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3"/></label>
     <label className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={hidePrice} onChange={e=>setHidePrice(e.target.checked)} className="h-5 w-5"/><span>Pakette fiyatı gösterme</span></label>
    </fieldset>

    <fieldset className="space-y-3"><legend className="font-bold">Teslimat adresi</legend>
     <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="text-sm font-semibold">Ülke kodu</span><input value={address.country_code} maxLength={2} onChange={e=>setAddress({...address,country_code:e.target.value.toUpperCase()})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label><span className="text-sm font-semibold">İl/Bölge</span><input value={address.administrative_area} onChange={e=>setAddress({...address,administrative_area:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label><span className="text-sm font-semibold">Şehir/İlçe</span><input value={address.city} onChange={e=>setAddress({...address,city:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label><span className="text-sm font-semibold">Mahalle/Köy</span><input value={address.locality} onChange={e=>setAddress({...address,locality:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
     </div>
     <label className="block"><span className="text-sm font-semibold">Açık adres</span><textarea value={address.address_line1} onChange={e=>setAddress({...address,address_line1:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3"/></label>
     <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="text-sm font-semibold">Adres devamı</span><input value={address.address_line2} onChange={e=>setAddress({...address,address_line2:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
      <label><span className="text-sm font-semibold">Posta kodu</span><input value={address.postal_code} onChange={e=>setAddress({...address,postal_code:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>
     </div>
     <label className="block"><span className="text-sm font-semibold">Teslimat notu</span><textarea value={address.delivery_notes} onChange={e=>setAddress({...address,delivery_notes:e.target.value})} rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3"/></label>
    </fieldset>

    <label className="block"><span className="text-sm font-semibold">Kupon kodu (opsiyonel)</span><input value={coupon} onChange={e=>setCoupon(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3"/></label>

    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 text-sm">
     <div className="flex gap-2"><ShieldCheck className="h-5 w-5 text-brand-green"/><p>Fiyat ve stok frontend’den değil sunucudan doğrulanır. Uluslararası gönderimde ürün ağırlığı veya otomatik kargo tarifesi eksikse sipariş oluşturulmaz.</p></div>
    </div>

    <button disabled={submitting||!variant} className="min-h-12 w-full rounded-xl bg-brand-gold px-4 font-bold text-white disabled:opacity-50">{submitting?'Hediye siparişi oluşturuluyor…':'Hediye Siparişini Oluştur'}</button>
   </form>
  </div>
 </div>;
}
