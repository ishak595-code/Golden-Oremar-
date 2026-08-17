import React,{useMemo,useState}from'react';
import{Calendar,CheckCircle2,Gift,Heart,Minus,Plus,Share2,ShoppingCart,Star,ThumbsUp,Users}from'lucide-react';

type Props={
 product:any;
 onClick:()=>void;
 onAddToCart:(product:any,quantity:number)=>Promise<void>|void;
 onToggleFavorite?:(product:any)=>Promise<void>|void;
 isFavorite?:boolean;
 onShare?:(product:any)=>Promise<void>|void;
 onGift?:(product:any)=>Promise<void>|void;
 onLike?:(product:any)=>Promise<void>|void;
 isLiked?:boolean;
};

type SecondaryAction='favorite'|'share'|'gift'|'like'|null;

export default function CatalogProductCard({product,onClick,onAddToCart,onToggleFavorite,isFavorite=false,onShare,onGift,onLike,isLiked=false}:Props){
 const[quantity,setQuantity]=useState(1);const[busy,setBusy]=useState(false);const[actionBusy,setActionBusy]=useState<SecondaryAction>(null);const[actionFeedback,setActionFeedback]=useState('');
 const tracked=product?.stockMode==='tracked'||product?.stockMode==='seasonal';
 const numericStock=typeof product?.stock==='number'&&Number.isFinite(product.stock)?Math.max(0,Math.floor(Number(product.stock))):null;
 const soldOut=tracked&&numericStock!==null&&numericStock<=0;
 const maxQuantity=tracked&&numericStock!==null?Math.max(1,Math.min(99,numericStock)):99;
 const preorder=product?.preOrder===true||product?.stockMode==='preorder';
 const price=Number(product?.price||0);const compare=product?.originalPrice!=null?Number(product.originalPrice):null;
 const currency=String(product?.currency||'TRY').toUpperCase();
 const description=String(product?.shortDescription||product?.description||'').trim();
 const productName=String(product?.name||'Ürün');
 const followerCount=product?.producerFollowerCount!=null&&Number.isFinite(Number(product.producerFollowerCount))?Math.max(0,Math.floor(Number(product.producerFollowerCount))):null;
 const producerVerified=product?.producerVerified===true;
 const producerOriginVerified=product?.producerOriginVerified===true;
 const cardBusy=busy||actionBusy!==null;
 const focusClass='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';
 const badges=useMemo(()=>{
  const list:Array<{key:string;label:string;className:string}>=[];
  if(preorder)list.push({key:'preorder',label:'Ön Sipariş',className:'bg-brand-green text-white'});
  if(product?.is_featured)list.push({key:'featured',label:'Öne Çıkan',className:'bg-brand-gold text-brand-main'});
  if(tracked&&numericStock!==null&&numericStock>0&&numericStock<=5)list.push({key:'low-stock',label:`Son ${numericStock} adet`,className:'bg-red-600 text-white'});
  if(soldOut)list.push({key:'sold-out',label:'Tükendi',className:'bg-gray-800 text-white'});
  return list;
 },[numericStock,preorder,product?.is_featured,soldOut,tracked]);
 async function add(){if(soldOut||cardBusy)return;try{setBusy(true);await onAddToCart(product,quantity);}finally{setBusy(false);}}
 async function runAction(kind:Exclude<SecondaryAction,null>,action:(product:any)=>Promise<void>|void){if(cardBusy)return;try{setActionBusy(kind);setActionFeedback('');await action(product);}finally{setActionBusy(null);}}
 async function shareProduct(){
  if(cardBusy)return;
  try{
   setActionBusy('share');setActionFeedback('');
   const shareUrl=typeof window!=='undefined'?window.location.href:'';
   if(typeof navigator!=='undefined'&&typeof navigator.share==='function'){
    if(onShare){await onShare(product);}else{await navigator.share({title:productName,text:description||undefined,url:shareUrl||undefined});}
    setActionFeedback('Paylaşım işlemi tamamlandı.');
    return;
   }
   if(!shareUrl)throw new Error('share_url_unavailable');
   await copyText(shareUrl);
   setActionFeedback('Bağlantı panoya kopyalandı.');
  }catch(error:any){
   if(error?.name==='AbortError')setActionFeedback('Paylaşım iptal edildi.');
   else setActionFeedback('Bağlantı paylaşılamadı. Ürün detayını açıp adres çubuğundaki bağlantıyı kopyalayabilirsiniz.');
  }finally{setActionBusy(null);}
 }
 function decrease(){setQuantity(current=>Math.max(1,current-1));}
 function increase(){setQuantity(current=>Math.min(maxQuantity,current+1));}
 return <article aria-busy={cardBusy} className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-gold/10 bg-brand-card shadow-sm transition-shadow hover:shadow-lg">
  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
   <button type="button" onClick={onClick} className={`block h-full w-full ${focusClass} focus-visible:ring-inset focus-visible:ring-offset-0`} aria-label={`${productName} detayını aç`}>
    {product?.image?<img src={product.image} alt={`${productName} ürün görseli`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 motion-safe:hover:scale-[1.03]"/>:<div className="grid h-full place-items-center text-sm text-gray-500">Görsel henüz eklenmedi</div>}
   </button>
   {badges.length?<div className="pointer-events-none absolute left-3 top-3 flex max-w-[75%] flex-wrap gap-2">{badges.map(badge=><span key={badge.key} className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>)}</div>:null}
   <div className="absolute right-3 top-3 flex gap-2">
    {onToggleFavorite?<button type="button" disabled={cardBusy} onClick={event=>{event.stopPropagation();void runAction('favorite',onToggleFavorite);}} aria-label={isFavorite?`${productName} ürününü favorilerden çıkar`:`${productName} ürününü favorilere ekle`} aria-pressed={isFavorite} className={`grid min-h-11 min-w-11 place-items-center rounded-full bg-white/95 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900/95 ${focusClass}`}><Heart aria-hidden="true" className={`h-5 w-5 ${isFavorite?'fill-red-500 text-red-500':'text-gray-700 dark:text-gray-200'}`}/></button>:null}
    <button type="button" disabled={cardBusy} onClick={event=>{event.stopPropagation();void shareProduct();}} aria-label={`${productName} ürününü paylaş`} className={`grid min-h-11 min-w-11 place-items-center rounded-full bg-white/95 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900/95 ${focusClass}`}><Share2 aria-hidden="true" className="h-5 w-5"/></button>
   </div>
  </div>

  <div className="flex flex-1 flex-col p-4">
   <div className="text-xs font-bold uppercase tracking-wide text-brand-gold">{product?.category||'Ürün'}</div>
   <button type="button" onClick={onClick} className={`mt-1 min-h-11 text-left focus-visible:rounded-lg ${focusClass}`}><h3 className="line-clamp-2 text-lg font-bold text-brand-text">{productName}</h3></button>
   {description?<p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-600 dark:text-gray-300">{description}</p>:null}

   {product?.producerName?<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
    <span className="inline-flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-200">{product.producerName}{producerVerified?<><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand-green"/><span className="sr-only">Üretici doğrulandı</span></>:null}</span>
    {followerCount!==null?<span className="inline-flex items-center gap-1" aria-label={`${formatNumber(followerCount)} takipçi`}><Users aria-hidden="true" className="h-4 w-4"/>{formatNumber(followerCount)} takipçi</span>:null}
   </div>:null}
   {product?.origin?<p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-500"><span className="line-clamp-1">Menşe: {product.origin}</span>{producerOriginVerified?<span className="inline-flex items-center gap-1 font-semibold text-brand-green"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5"/>Doğrulandı</span>:null}</p>:null}
   {Number(product?.reviewCount||0)>0?<div className="mt-2 flex items-center gap-1 text-sm"><Star aria-hidden="true" className="h-4 w-4 fill-brand-gold text-brand-gold"/><span className="font-semibold">{Number(product.rating||0).toFixed(1)}</span><span className="text-gray-500">({formatNumber(Number(product.reviewCount||0))} değerlendirme)</span></div>:<div className="mt-2 text-xs text-gray-500">Henüz yayınlanmış değerlendirme yok</div>}

   <div className="mt-3 flex items-end justify-between gap-3">
    <div><div className="text-xl font-bold text-brand-green dark:text-brand-gold">{formatMoney(price,currency)}</div>{compare!==null&&compare>price?<div className="text-sm text-gray-400 line-through">{formatMoney(compare,currency)}</div>:null}{product?.unit?<div className="mt-0.5 text-xs text-gray-500">{product.unit}</div>:null}</div>
    {tracked&&numericStock!==null?<div className={`text-xs font-semibold ${soldOut?'text-red-700':'text-green-700'}`}>{soldOut?'Stokta yok':`${formatNumber(numericStock)} adet stokta`}</div>:preorder?<div className="text-xs font-semibold text-brand-green">Siparişe açık</div>:null}
   </div>

   {!soldOut?<div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-2 dark:bg-gray-800"><span className="text-xs font-semibold text-gray-500">Adet</span><div className="flex items-center gap-1" role="group" aria-label={`${productName} adet seçimi`}><button type="button" onClick={decrease} disabled={quantity<=1||cardBusy} aria-label={`${productName} miktarını azalt`} className={`grid min-h-11 min-w-11 place-items-center rounded-lg border disabled:opacity-40 ${focusClass}`}><Minus aria-hidden="true" className="h-4 w-4"/></button><span aria-live="polite" aria-label={`${quantity} adet`} className="min-w-10 text-center font-bold">{quantity}</span><button type="button" onClick={increase} disabled={quantity>=maxQuantity||cardBusy} aria-label={`${productName} miktarını artır`} className={`grid min-h-11 min-w-11 place-items-center rounded-lg border disabled:opacity-40 ${focusClass}`}><Plus aria-hidden="true" className="h-4 w-4"/></button></div></div>:null}

   <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
    <button type="button" onClick={()=>void add()} disabled={soldOut||cardBusy} aria-label={soldOut?`${productName} stokta yok`:preorder?`${productName} ürününü ${quantity} adet ön siparişe ekle`:`${productName} ürününü ${quantity} adet sepete ekle`} className={`min-h-12 rounded-xl bg-brand-green px-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}>{preorder?<Calendar aria-hidden="true" className="mr-2 inline h-4 w-4"/>:<ShoppingCart aria-hidden="true" className="mr-2 inline h-4 w-4"/>}{busy?'Ekleniyor…':soldOut?'Tükendi':preorder?'Ön Siparişe Ekle':'Sepete Ekle'}</button>
    {onGift?<button type="button" disabled={cardBusy} onClick={()=>void runAction('gift',onGift)} aria-label={`${productName} ürününü hediye et`} className={`grid min-h-12 min-w-12 place-items-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-60 ${focusClass}`}><Gift aria-hidden="true" className="h-5 w-5 text-brand-gold"/></button>:null}
    {onLike?<button type="button" disabled={cardBusy} onClick={()=>void runAction('like',onLike)} aria-label={isLiked?`${productName} beğenisini kaldır`:`${productName} ürününü beğen`} aria-pressed={isLiked} className={`grid min-h-12 min-w-12 place-items-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-60 ${focusClass}`}><ThumbsUp aria-hidden="true" className={`h-5 w-5 ${isLiked?'fill-brand-gold text-brand-gold':''}`}/></button>:null}
   </div>
   {actionFeedback?<div role="status" aria-live="polite" className="mt-2 text-xs text-gray-600 dark:text-gray-300">{actionFeedback}</div>:null}
   <div className="sr-only" aria-live="polite">{actionBusy==='favorite'?'Favori işlemi yapılıyor.':actionBusy==='share'?'Paylaşım hazırlanıyor.':actionBusy==='gift'?'Hediye akışı hazırlanıyor.':actionBusy==='like'?'Beğeni işlemi yapılıyor.':busy?'Sepete ekleniyor.':''}</div>
  </div>
 </article>;
}

async function copyText(value:string){
 if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
 if(typeof document==='undefined')throw new Error('clipboard_unavailable');
 const textarea=document.createElement('textarea');const active=document.activeElement as HTMLElement|null;
 textarea.value=value;textarea.setAttribute('readonly','');textarea.style.position='fixed';textarea.style.opacity='0';textarea.style.pointerEvents='none';textarea.style.left='-9999px';
 document.body.appendChild(textarea);textarea.focus();textarea.select();
 const copied=document.execCommand('copy');document.body.removeChild(textarea);active?.focus?.();
 if(!copied)throw new Error('clipboard_copy_failed');
}
function formatMoney(value:number,currency:string){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency}).format(Number.isFinite(value)?value:0);}catch{return `${(Number.isFinite(value)?value:0).toFixed(2)} ${currency}`;}}
function formatNumber(value:number){try{return new Intl.NumberFormat('tr-TR').format(Number.isFinite(value)?value:0);}catch{return String(Math.max(0,Math.floor(value||0)));}}
