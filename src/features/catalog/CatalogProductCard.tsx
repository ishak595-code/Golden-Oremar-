import React,{useState}from'react';
import{CheckCircle2,Gift,Heart,Share2,ShoppingCart,Star,ThumbsUp}from'lucide-react';
import{buildProductUrl,shareOrCopy}from'../navigation/appUrl';
import{optionalProductHandlingProfile,productHandlingLabel}from'./productHandlingApi';

type Props={product:any;onClick:()=>void;onAddToCart:(product:any,quantity:number)=>Promise<void>|void;onToggleFavorite?:(product:any)=>Promise<void>|void;isFavorite?:boolean;onShare?:(product:any)=>Promise<void>|void;onGift?:(product:any)=>Promise<void>|void;onLike?:(product:any)=>Promise<void>|void;isLiked?:boolean;compact?:boolean;};
type Action='cart'|'favorite'|'share'|'gift'|'like'|null;

function safeText(value:unknown,max=300){return typeof value==='string'?value.trim().slice(0,max):'';}
function safePrice(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
function safeRating(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=5?value:null;}
function safeCurrency(value:unknown){const currency=safeText(value,3).toUpperCase();return/^[A-Z]{3}$/.test(currency)?currency:null;}
function safeReference(value:unknown){const ref=safeText(value,220);return ref||null;}
function safeHandling(value:unknown){try{return optionalProductHandlingProfile(value);}catch{return null;}}
function money(value:number,currency:string){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency}).format(value);}catch{return`${value.toLocaleString('tr-TR')} ${currency}`;}}
function messageOf(error:unknown,fallback:string){return error instanceof Error&&error.message.trim()?error.message:fallback;}

export default function CatalogProductCard({product,onClick,onAddToCart,onToggleFavorite,isFavorite=false,onShare,onGift,onLike,isLiked=false,compact=false}:Props){
 const[action,setAction]=useState<Action>(null);
 const[feedback,setFeedback]=useState('');
 const productName=safeText(product?.name,300)||'Ürün';
 const price=safePrice(product?.price),currency=safeCurrency(product?.currency);
 const tracked=product?.stockMode==='tracked'||product?.stockMode==='seasonal';
 const stock=safeInteger(product?.stock),soldOut=tracked&&stock!==null&&stock<=0;
 const variantReady=Boolean(safeReference(product?.variantId));
 const purchaseReady=price!==null&&currency!==null&&variantReady&&!soldOut&&(!tracked||stock!==null);
 const preorder=product?.preOrder===true||product?.stockMode==='preorder';
 const rating=safeRating(product?.rating),reviewCount=safeInteger(product?.reviewCount);
 const producerName=safeText(product?.producerName,240);
 const origin=safeText(product?.origin,240);
 const handling=safeHandling(product?.handlingProfile);
 const handlingLabel=productHandlingLabel(handling);
 const producerStoreKind=product?.producerStoreKind==='official'?'official':'independent';
 const producerBadgeTone=product?.producerBadgeTone==='ruby'||product?.producerBadgeTone==='blue'?product.producerBadgeTone:producerStoreKind==='official'?'ruby':'blue';
 const producerVerified=product?.producerVerified===true;
 const busy=action!==null;

 async function run(kind:Exclude<Action,null>,fn:()=>Promise<void>|void){
  if(busy)return;
  try{setAction(kind);setFeedback('');await fn();}
  catch(error){setFeedback(messageOf(error,'İşlem şu anda tamamlanamadı.'));}
  finally{setAction(null);}
 }
 async function share(){
  await run('share',async()=>{
   if(onShare){await onShare(product);return;}
   const reference=safeReference(product?.slug)||safeReference(product?.legacyId)||safeReference(product?.id);
   if(!reference)throw new Error('Paylaşım bağlantısı hazırlanamadı.');
   const result=await shareOrCopy({title:productName,text:safeText(product?.shortDescription||product?.description,500),url:buildProductUrl(reference)});
   if(result==='copied')setFeedback('Ürün bağlantısı kopyalandı.');
  });
 }

 if(compact)return<article className="flex min-h-[9.5rem] overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-sm">
  <div className="relative w-28 shrink-0 bg-gray-100 sm:w-32 dark:bg-gray-800">
   <button type="button" onClick={onClick} aria-label={`${productName} detayını aç`} className="block h-full min-h-[9.5rem] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold">
    {product?.image?<img src={product.image} alt={`${productName} ürün görseli`} loading="lazy" decoding="async" className="h-full w-full object-cover"/>:<div className="grid h-full min-h-[9.5rem] place-items-center px-2 text-center text-xs text-brand-muted">Ürün görseli yakında</div>}
   </button>
   {producerVerified?<span className={`absolute bottom-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm ${producerBadgeTone==='ruby'?'bg-rose-700':'bg-blue-700'}`} title={producerStoreKind==='official'?'Golden Oremar':'Doğrulanmış üretici'}><CheckCircle2 aria-hidden="true" className="h-4 w-4"/></span>:null}
   {onToggleFavorite?<button type="button" disabled={busy} onClick={event=>{event.stopPropagation();void run('favorite',()=>onToggleFavorite(product));}} aria-label={isFavorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={isFavorite} className="absolute right-2 top-2 grid min-h-10 min-w-10 place-items-center rounded-full bg-white/95 shadow-sm disabled:opacity-60 dark:bg-gray-900/95"><Heart aria-hidden="true" className={`h-4.5 w-4.5 ${isFavorite?'fill-red-500 text-red-500':'text-brand-text'}`}/></button>:null}
  </div>
  <div className="flex min-w-0 flex-1 flex-col p-3">
   <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-brand-gold">{safeText(product?.category,160)||'Golden Oremar'}</div><button type="button" onClick={onClick} className="mt-1 block min-h-10 w-full text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><h3 className="line-clamp-2 text-base font-black leading-snug text-brand-text">{productName}</h3></button></div>{preorder?<span className="shrink-0 rounded-full bg-brand-green/10 px-2 py-1 text-[10px] font-black text-brand-green">Ön Sipariş</span>:product?.is_featured===true?<span className="shrink-0 rounded-full bg-brand-gold/10 px-2 py-1 text-[10px] font-black text-brand-gold">Seçkin Ürün</span>:null}</div>
   {producerName?<div className="mt-1 truncate text-xs font-semibold text-brand-muted">{producerName}</div>:null}
   {origin?<div className="mt-0.5 truncate text-[11px] text-brand-muted">{origin}</div>:null}
   {handlingLabel?<div className="mt-1 truncate text-[11px] font-semibold text-brand-muted">{handlingLabel}</div>:null}
   <div className="mt-auto flex items-end justify-between gap-2 pt-2"><div className="min-w-0">{price!==null&&currency?<div className="truncate text-lg font-black text-brand-green dark:text-brand-gold">{money(price,currency)}</div>:<div className="text-xs font-bold text-brand-muted">Fiyat yakında</div>}{reviewCount!==null&&reviewCount>0?<div className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-muted"><Star aria-hidden="true" className="h-3 w-3 fill-brand-gold text-brand-gold"/><span className="font-bold text-brand-text">{rating!==null?rating.toFixed(1):'—'}</span><span>({reviewCount})</span></div>:null}</div><button type="button" disabled={busy||!purchaseReady} onClick={()=>void run('cart',()=>onAddToCart(product,1))} aria-label={preorder?`${productName} ön siparişe ekle`:`${productName} sepete ekle`} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full bg-brand-green text-brand-on-green disabled:cursor-not-allowed disabled:opacity-45"><ShoppingCart aria-hidden="true" className="h-4.5 w-4.5"/></button></div>
   {soldOut?<div className="mt-1 text-[11px] font-bold text-brand-muted">Şu anda stokta yok</div>:null}
   {feedback?<div role="status" aria-live="polite" className="mt-1 text-[11px] font-semibold text-brand-muted">{feedback}</div>:null}
  </div>
 </article>;

 return<article className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-border bg-brand-card shadow-sm">
  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
   <button type="button" onClick={onClick} aria-label={`${productName} detayını aç`} className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold">
    {product?.image?<img src={product.image} alt={`${productName} ürün görseli`} loading="lazy" decoding="async" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center px-4 text-center text-sm text-brand-muted">Ürün görseli yakında</div>}
   </button>
   <div className="absolute left-3 top-3 flex max-w-[72%] flex-wrap gap-2">
    {producerVerified?<span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-white ${producerBadgeTone==='ruby'?'bg-rose-700':'bg-blue-700'}`}><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>{producerStoreKind==='official'?'Golden Oremar':'Doğrulanmış üretici'}</span>:null}
    {product?.is_featured===true?<span className="rounded-full bg-brand-gold px-3 py-1 text-xs font-black text-brand-on-gold">Seçkin Ürün</span>:null}
    {preorder?<span className="rounded-full bg-brand-green px-3 py-1 text-xs font-black text-brand-on-green">Ön Sipariş</span>:null}
    {handling?.requiresColdChain?<span className="rounded-full bg-sky-700 px-3 py-1 text-xs font-black text-white">Soğuk Zincir</span>:null}
   </div>
   <div className="absolute right-3 top-3 flex gap-2">
    {onToggleFavorite?<button type="button" disabled={busy} onClick={event=>{event.stopPropagation();void run('favorite',()=>onToggleFavorite(product));}} aria-label={isFavorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={isFavorite} className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/95 shadow-sm disabled:opacity-60 dark:bg-gray-900/95"><Heart aria-hidden="true" className={`h-5 w-5 ${isFavorite?'fill-red-500 text-red-500':'text-brand-text'}`}/></button>:null}
    <button type="button" disabled={busy} onClick={event=>{event.stopPropagation();void share();}} aria-label={`${productName} ürününü paylaş`} className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/95 shadow-sm disabled:opacity-60 dark:bg-gray-900/95"><Share2 aria-hidden="true" className="h-5 w-5"/></button>
   </div>
  </div>

  <div className="flex flex-1 flex-col p-4">
   <div className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-gold">{safeText(product?.category,160)||'Golden Oremar'}</div>
   <button type="button" onClick={onClick} className="mt-1 min-h-11 text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><h3 className="line-clamp-2 text-lg font-black leading-tight text-brand-text">{productName}</h3></button>
   {producerName?<div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-muted"><span className="line-clamp-1">{producerName}</span>{producerVerified?<CheckCircle2 aria-hidden="true" className={`h-4 w-4 shrink-0 ${producerBadgeTone==='ruby'?'text-rose-700':'text-blue-700'}`}/>:null}</div>:null}
   {origin?<div className="mt-1 line-clamp-1 text-xs text-brand-muted">{origin}</div>:null}
   {handlingLabel?<div className="mt-2 text-xs font-semibold text-brand-muted">{handlingLabel}</div>:null}

   <div className="mt-4 flex items-end justify-between gap-3">
    <div>{price!==null&&currency?<div className="text-xl font-black text-brand-green dark:text-brand-gold">{money(price,currency)}</div>:<div className="text-sm font-bold text-brand-muted">Fiyat yakında</div>}{safeText(product?.unit,100)?<div className="text-xs text-brand-muted">{safeText(product.unit,100)}</div>:null}</div>
    {reviewCount!==null&&reviewCount>0?<div className="flex items-center gap-1 text-sm"><Star aria-hidden="true" className="h-4 w-4 fill-brand-gold text-brand-gold"/><span className="font-bold">{rating!==null?rating.toFixed(1):'—'}</span><span className="text-brand-muted">({reviewCount})</span></div>:null}
   </div>

   <div className="mt-auto pt-4">
    {soldOut?<div className="mb-2 rounded-xl bg-gray-100 px-3 py-2 text-center text-sm font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">Şu anda stokta yok</div>:null}
    <div className={`grid gap-2 ${onGift||onLike?'grid-cols-[1fr_auto_auto]':'grid-cols-1'}`}>
     <button type="button" disabled={busy||!purchaseReady} onClick={()=>void run('cart',()=>onAddToCart(product,1))} className="min-h-12 rounded-full bg-brand-green px-4 font-black text-brand-on-green disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart aria-hidden="true" className="mr-2 inline h-4 w-4"/>{action==='cart'?'Ekleniyor…':preorder?'Ön Siparişe Ekle':purchaseReady?'Sepete Ekle':'Şu anda satışta değil'}</button>
     {onGift?<button type="button" disabled={busy||!purchaseReady} onClick={()=>void run('gift',()=>onGift(product))} aria-label={`${productName} ürününü hediye et`} className="grid min-h-12 min-w-12 place-items-center rounded-full border border-brand-border disabled:opacity-50"><Gift aria-hidden="true" className="h-5 w-5 text-brand-gold"/></button>:null}
     {onLike?<button type="button" disabled={busy} onClick={()=>void run('like',()=>onLike(product))} aria-label={isLiked?'Beğeniyi kaldır':'Ürünü beğen'} aria-pressed={isLiked} className="grid min-h-12 min-w-12 place-items-center rounded-full border border-brand-border disabled:opacity-50"><ThumbsUp aria-hidden="true" className={`h-5 w-5 ${isLiked?'fill-brand-gold text-brand-gold':''}`}/></button>:null}
    </div>
    {feedback?<div role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-brand-muted">{feedback}</div>:null}
   </div>
  </div>
 </article>;
}
