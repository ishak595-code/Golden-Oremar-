import React,{useState}from'react';
import{ArrowLeft,LogIn,Minus,Plus,ShieldCheck,ShoppingCart,Trash2}from'lucide-react';
import{publicCatalogUrl}from'./api';
import{formatMoney}from'./checkoutHelpers';
import{removeGuestCartLines,setGuestCartQuantity,useGuestCart}from'./guestCart';
import'./cart.css';

/**
 * The cart of a visitor who has not signed in. Everything can be done here
 * except paying: the account is asked for only at "Siparişi tamamla", and
 * the choices move into the account cart as soon as the visitor signs in.
 * Prices shown here are the ones seen when the item was added; the account
 * cart re-reads them from the server.
 */
export default function GuestCartView({onBack,onOpenProduct,authSlot}:{onBack?:()=>void;onOpenProduct?:(slug:string)=>void;authSlot:React.ReactNode}){
 const lines=useGuestCart();
 const[signIn,setSignIn]=useState(false);
 const currency=lines[0]?.currency||'TRY';
 const count=lines.reduce((total,line)=>total+line.quantity,0);
 const subtotal=lines.reduce((total,line)=>total+line.priceMinor*line.quantity,0);
 const mixedCurrency=lines.some(line=>line.currency!==currency);

 if(signIn)return<div className="mx-auto max-w-xl">
  <div className="px-4 pt-4"><button type="button" onClick={()=>setSignIn(false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 font-semibold"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Sepete dön</button></div>
  {authSlot}
 </div>;

 if(!lines.length)return<section className="mx-auto max-w-xl p-6 text-center"><div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"><ShoppingCart aria-hidden="true" className="h-10 w-10 text-gray-400"/></div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sepetiniz boş</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Organik köy ürünlerini keşfedin ve sepete ekleyin. Giriş yapmadan da sepet oluşturabilirsiniz.</p><div className="mt-6 flex flex-col items-center gap-3"><button type="button" onClick={onBack} className="min-h-12 rounded-xl bg-brand-green px-6 font-bold text-brand-on-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünleri keşfet</button><button type="button" onClick={()=>setSignIn(true)} className="min-h-11 rounded-xl border px-5 font-semibold">Hesabıma giriş yap</button></div></section>;

 return<div className="go-cart mx-auto max-w-5xl space-y-6 p-4 sm:p-6" role="region" aria-labelledby="guest-cart-title">
  <header className="rounded-3xl bg-brand-green p-5 text-brand-on-green sm:p-6"><div className="flex items-center gap-3">{onBack?<button type="button" onClick={onBack} aria-label="Alışverişe dön" className="min-h-11 min-w-11 shrink-0 rounded-xl border border-white/30 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ArrowLeft className="mx-auto h-5 w-5" aria-hidden="true"/></button>:null}<div className="min-w-0"><h1 id="guest-cart-title" className="text-2xl font-bold">Sepetim</h1><p className="mt-1 text-sm font-semibold">{count} ürün{mixedCurrency?'':` · ${formatMoney(subtotal,currency)}`}</p></div></div></header>

  <section className="rounded-3xl border bg-white p-5 dark:bg-gray-900 sm:p-6" aria-labelledby="guest-cart-items"><h2 id="guest-cart-items" className="text-lg font-bold">Sepetteki ürünler</h2><div className="mt-5 space-y-5">{lines.map(line=>{const image=line.imagePath?publicCatalogUrl(line.imagePath):'';return<article key={line.key} className="go-cart-item flex gap-4 border-b pb-5 last:border-0">
   <button type="button" onClick={()=>onOpenProduct?.(line.productSlug)} aria-label={`${line.productName} ürün sayfasını aç`} className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{image?<img src={image} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover"/>:<span className="grid h-24 w-24 place-items-center rounded-2xl bg-gray-100 text-xs text-gray-600 dark:text-gray-300 dark:bg-gray-800">Görsel yok</span>}</button>
   <div className="min-w-0 flex-1">
    <h3 className="font-bold leading-snug"><button type="button" onClick={()=>onOpenProduct?.(line.productSlug)} className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{line.productName}</button></h3>
    <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{[line.variantName,line.producerName].filter(Boolean).join(' · ')}</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center rounded-xl border"><button type="button" onClick={()=>setGuestCartQuantity(line.key,line.quantity-1)} aria-label={line.quantity<=1?`${line.productName} ürününü çıkar`:`${line.productName} adet azalt`} className="min-h-11 min-w-11"><Minus className="mx-auto h-4 w-4" aria-hidden="true"/></button><span className="min-w-10 text-center font-bold" aria-label={`Adet: ${line.quantity}`}>{line.quantity}</span><button type="button" disabled={line.quantity>=99} onClick={()=>setGuestCartQuantity(line.key,line.quantity+1)} aria-label={`${line.productName} adet artır`} className="min-h-11 min-w-11"><Plus className="mx-auto h-4 w-4" aria-hidden="true"/></button></div><div className="flex items-center gap-3"><strong>{formatMoney(line.priceMinor*line.quantity,line.currency)}</strong><button type="button" onClick={()=>removeGuestCartLines([line.key])} aria-label={`${line.productName} ürününü sepetten çıkar`} className="min-h-11 min-w-11 rounded-xl border border-red-200 text-red-700"><Trash2 className="mx-auto h-4 w-4" aria-hidden="true"/></button></div></div>
   </div>
  </article>;})}</div></section>

  <section className="rounded-3xl border-2 border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-6" aria-labelledby="guest-cart-summary"><h2 id="guest-cart-summary" className="text-lg font-bold">Sipariş özeti</h2>
   {mixedCurrency?null:<div className="mt-5 flex justify-between text-lg"><span className="font-bold">Ara toplam</span><strong className="font-black">{formatMoney(subtotal,currency)}</strong></div>}
   <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Kargo, kupon ve güncel fiyatlar bir sonraki adımda hesaplanır.</p>
   <div className="mt-5 flex gap-3 rounded-2xl border-2 border-brand-green/20 bg-brand-green/5 p-4 text-sm font-semibold leading-relaxed dark:border-brand-green/30"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-green" aria-hidden="true"/><p>Siparişi tamamlamak için giriş yapın veya ücretsiz hesap oluşturun. Sepetinizdeki ürünler hesabınıza otomatik aktarılır.</p></div>
   <button type="button" onClick={()=>setSignIn(true)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><LogIn className="h-5 w-5" aria-hidden="true"/>Siparişi tamamla</button>
  </section>
 </div>;
}
