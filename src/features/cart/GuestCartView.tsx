import React,{useEffect,useState}from'react';
import{ArrowLeft,LogIn,MessageCircle,Minus,Plus,ShieldCheck,ShoppingCart,Trash2}from'lucide-react';
import{publicCatalogUrl}from'./api';
import{formatMoney}from'./checkoutHelpers';
import{clearGuestCart,removeGuestCartLines,setGuestCartQuantity,useGuestCart}from'./guestCart';
import OfflineOrderSheet from'../orders/OfflineOrderSheet';
import ProductArtwork,{isBrandFallbackImage,shippedProductPhoto}from'../catalog/ProductArtwork';
import{getOfflineOrderingConfig,offlineOrderingAvailable}from'../orders/offlineOrderApi';
import'./cart.css';

/**
 * The cart of a visitor who has not signed in. While card payment is off the
 * visitor can finish the order right here (WhatsApp or bank transfer, no
 * account needed); otherwise the account is asked for at "Siparişi tamamla",
 * and the choices move into the account cart as soon as the visitor signs in.
 * Prices shown here are the ones seen when the item was added; the account
 * cart re-reads them from the server.
 */
export default function GuestCartView({onBack,onOpenProduct,authSlot}:{onBack?:()=>void;onOpenProduct?:(slug:string)=>void;authSlot:React.ReactNode}){
 const lines=useGuestCart();
 const[signIn,setSignIn]=useState(false);
 const[offlineReady,setOfflineReady]=useState(false);
 const[offlineOpen,setOfflineOpen]=useState(false);
 // The cart empties when the receipt is closed, not at submit, so the order
 // code and IBAN stay on screen until the customer is done with them.
 const[orderPlaced,setOrderPlaced]=useState(false);
 useEffect(()=>{let active=true;void getOfflineOrderingConfig().then(config=>{if(active)setOfflineReady(offlineOrderingAvailable(config));}).catch(()=>{});return()=>{active=false;};},[]);
 const currency=lines[0]?.currency||'TRY';
 const count=lines.reduce((total,line)=>total+line.quantity,0);
 const subtotal=lines.reduce((total,line)=>total+line.priceMinor*line.quantity,0);
 const mixedCurrency=lines.some(line=>line.currency!==currency);
 // Only pre-order items: the action reads like the product page ("Ön Sipariş Ver").
 const preorderOnly=lines.length>0&&lines.every(line=>line.preorder===true);
 const checkoutLabel=preorderOnly?'Ön Sipariş Ver':'Siparişi tamamla';

 if(signIn)return<div className="mx-auto max-w-xl">
  <div className="px-4 pt-4"><button type="button" onClick={()=>setSignIn(false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 font-semibold"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>Sepete dön</button></div>
  {authSlot}
 </div>;

 if(!lines.length)return<section className="mx-auto max-w-xl p-6 text-center"><div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700"><ShoppingCart aria-hidden="true" className="h-10 w-10 text-gray-400"/></div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sepetiniz boş</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Doğal köy ürünlerini keşfedin ve sepete ekleyin. Giriş yapmadan da sepet oluşturabilirsiniz.</p><div className="mt-6 flex flex-col items-center gap-3"><button type="button" onClick={onBack} className="min-h-12 rounded-xl bg-brand-green px-6 font-bold text-brand-on-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünleri keşfet</button><button type="button" onClick={()=>setSignIn(true)} className="min-h-11 rounded-xl border px-5 font-semibold">Hesabıma giriş yap</button></div></section>;

 return<div className="go-cart mx-auto max-w-5xl space-y-6 p-4 sm:p-6" role="region" aria-labelledby="guest-cart-title">
  <header className="rounded-3xl bg-brand-green p-5 text-brand-on-green sm:p-6"><div className="flex items-center gap-3">{onBack?<button type="button" onClick={onBack} aria-label="Alışverişe dön" className="min-h-11 min-w-11 shrink-0 rounded-xl border border-white/30 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ArrowLeft className="mx-auto h-5 w-5" aria-hidden="true"/></button>:null}<div className="min-w-0"><h1 id="guest-cart-title" className="text-2xl font-bold">Sepetim</h1><p className="mt-1 text-sm font-semibold">{count} ürün{mixedCurrency?'':` · ${formatMoney(subtotal,currency)}`}</p></div></div></header>

  <section className="rounded-3xl border bg-white p-5 dark:bg-gray-900 sm:p-6" aria-labelledby="guest-cart-items"><h2 id="guest-cart-items" className="text-lg font-bold">Sepetteki ürünler</h2><div className="mt-5 space-y-5">{lines.map(line=>{const image=line.imagePath&&!isBrandFallbackImage(line.imagePath)?publicCatalogUrl(line.imagePath):(shippedProductPhoto(line.productSlug,'small')||'');return<article key={line.key} className="go-cart-item flex gap-4 border-b pb-5 last:border-0">
   <button type="button" onClick={()=>onOpenProduct?.(line.productSlug)} aria-label={`${line.productName} ürün sayfasını aç`} className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{image?<img src={image} alt="" loading="lazy" className="h-24 w-24 rounded-2xl object-cover"/>:<span className="block h-24 w-24 overflow-hidden rounded-2xl"><ProductArtwork name={line.productName} slug={line.productSlug} variant="tile"/></span>}</button>
   <div className="min-w-0 flex-1">
    <h3 className="font-bold leading-snug"><button type="button" onClick={()=>onOpenProduct?.(line.productSlug)} className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{line.productName}</button></h3>
    <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">{[line.variantName,line.producerName].filter(Boolean).join(' · ')}</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center rounded-xl border"><button type="button" onClick={()=>setGuestCartQuantity(line.key,line.quantity-1)} aria-label={line.quantity<=1?`${line.productName} ürününü çıkar`:`${line.productName} adet azalt`} className="min-h-11 min-w-11"><Minus className="mx-auto h-4 w-4" aria-hidden="true"/></button><span className="min-w-10 text-center font-bold" aria-label={`Adet: ${line.quantity}`}>{line.quantity}</span><button type="button" disabled={line.quantity>=99} onClick={()=>setGuestCartQuantity(line.key,line.quantity+1)} aria-label={`${line.productName} adet artır`} className="min-h-11 min-w-11"><Plus className="mx-auto h-4 w-4" aria-hidden="true"/></button></div><div className="flex items-center gap-3"><strong>{formatMoney(line.priceMinor*line.quantity,line.currency)}</strong><button type="button" onClick={()=>removeGuestCartLines([line.key])} aria-label={`${line.productName} ürününü sepetten çıkar`} className="min-h-11 min-w-11 rounded-xl border border-red-200 text-red-700"><Trash2 className="mx-auto h-4 w-4" aria-hidden="true"/></button></div></div>
   </div>
  </article>;})}</div></section>

  <section className="rounded-3xl border-2 border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-6" aria-labelledby="guest-cart-summary"><h2 id="guest-cart-summary" className="text-lg font-bold">Sipariş özeti</h2>
   {mixedCurrency?null:<div className="mt-5 flex justify-between text-lg"><span className="font-bold">Ara toplam</span><strong className="font-black">{formatMoney(subtotal,currency)}</strong></div>}
   <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">"Kargo bizden" yazan ürünlerde kargo ücreti alınmaz. Kesin tutar, sipariş kodunuzla birlikte gösterilir.</p>
   {offlineReady&&!mixedCurrency?<>
    <div className="mt-5 flex gap-3 rounded-2xl border-2 border-brand-green/20 bg-brand-green/5 p-4 text-sm font-semibold leading-relaxed dark:border-brand-green/30"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-green" aria-hidden="true"/><p>Üye olmadan sipariş verebilirsiniz: WhatsApp veya Havale/EFT ile. Sipariş kodunuz anında oluşur; tutar ve kargo kesinleşmiş olarak gösterilir.</p></div>
    <button type="button" onClick={()=>setOfflineOpen(true)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><MessageCircle className="h-5 w-5" aria-hidden="true"/>{checkoutLabel}</button>
    <button type="button" onClick={()=>setSignIn(true)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 font-semibold"><LogIn className="h-4 w-4" aria-hidden="true"/>Hesabıma giriş yap</button>
   </>:<>
    <div className="mt-5 flex gap-3 rounded-2xl border-2 border-brand-green/20 bg-brand-green/5 p-4 text-sm font-semibold leading-relaxed dark:border-brand-green/30"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-green" aria-hidden="true"/><p>Siparişi tamamlamak için giriş yapın veya ücretsiz hesap oluşturun. Sepetinizdeki ürünler hesabınıza otomatik aktarılır.</p></div>
    <button type="button" onClick={()=>setSignIn(true)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 font-bold text-brand-on-green shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><LogIn className="h-5 w-5" aria-hidden="true"/>{checkoutLabel}</button>
   </>}
  </section>
  <OfflineOrderSheet preorder={preorderOnly} open={offlineOpen} onClose={()=>{setOfflineOpen(false);if(orderPlaced){setOrderPlaced(false);clearGuestCart();}}} authenticated={false} onLoginRequired={()=>setSignIn(true)} source="cart"
   lines={lines.map(line=>({key:line.key,productName:line.productName,variantName:line.variantName,quantity:line.quantity,priceMinor:line.priceMinor,currency:line.currency}))}
   items={lines.map(line=>({variantId:line.variantId,quantity:line.quantity,selectedOptions:line.selectedOptions}))}
   onSubmitted={()=>setOrderPlaced(true)}/>
 </div>;
}
