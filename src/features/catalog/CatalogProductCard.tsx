import React,{useMemo,useState}from'react';
import{Calendar,Gift,Heart,Minus,Plus,Share2,ShoppingCart,Star,ThumbsUp}from'lucide-react';

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

export default function CatalogProductCard({product,onClick,onAddToCart,onToggleFavorite,isFavorite=false,onShare,onGift,onLike,isLiked=false}:Props){
 const[quantity,setQuantity]=useState(1);const[busy,setBusy]=useState(false);
 const tracked=product?.stockMode==='tracked'||product?.stockMode==='seasonal';
 const numericStock=typeof product?.stock==='number'&&Number.isFinite(product.stock)?Math.max(0,Number(product.stock)):null;
 const soldOut=tracked&&numericStock!==null&&numericStock<=0;
 const maxQuantity=tracked&&numericStock!==null?Math.max(1,Math.min(99,numericStock)):99;
 const preorder=product?.preOrder===true||product?.stockMode==='preorder';
 const price=Number(product?.price||0);const compare=product?.originalPrice!=null?Number(product.originalPrice):null;
 const currency=String(product?.currency||'TRY').toUpperCase();
 const badges=useMemo(()=>{
  const list:Array<{key:string;label:string;className:string}>=[];
  if(preorder)list.push({key:'preorder',label:'Ön Sipariş',className:'bg-brand-green text-white'});
  if(product?.is_featured)list.push({key:'featured',label:'Öne Çıkan',className:'bg-brand-gold text-brand-main'});
  if(tracked&&numericStock!==null&&numericStock>0&&numericStock<=5)list.push({key:'low-stock',label:`Son ${numericStock} adet`,className:'bg-red-600 text-white'});
  if(soldOut)list.push({key:'sold-out',label:'Tükendi',className:'bg-gray-800 text-white'});
  return list;
 },[numericStock,preorder,product?.is_featured,soldOut,tracked]);
 async function add(){if(soldOut||busy)return;try{setBusy(true);await onAddToCart(product,quantity);}finally{setBusy(false);}}
 function decrease(){setQuantity(current=>Math.max(1,current-1));}
 function increase(){setQuantity(current=>Math.min(maxQuantity,current+1));}
 return <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-gold/10 bg-brand-card shadow-sm transition-shadow hover:shadow-lg">
  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
   <button onClick={onClick} className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold" aria-label={`${product?.name||'Ürün'} detayını aç`}>
    {product?.image?<img src={product.image} alt={product?.name||'Ürün görseli'} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 motion-safe:hover:scale-[1.03]"/>:<div className="grid h-full place-items-center text-sm text-gray-500">Görsel henüz eklenmedi</div>}
   </button>
   {badges.length?<div className="pointer-events-none absolute left-3 top-3 flex max-w-[75%] flex-wrap gap-2">{badges.map(badge=><span key={badge.key} className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>)}</div>:null}
   <div className="absolute right-3 top-3 flex gap-2">
    {onToggleFavorite?<button type="button" onClick={event=>{event.stopPropagation();void onToggleFavorite(product);}} aria-label={isFavorite?'Favorilerden çıkar':'Favorilere ekle'} aria-pressed={isFavorite} className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/95 shadow-sm dark:bg-gray-900/95"><Heart className={`h-5 w-5 ${isFavorite?'fill-red-500 text-red-500':'text-gray-700 dark:text-gray-200'}`}/></button>:null}
    {onShare?<button type="button" onClick={event=>{event.stopPropagation();void onShare(product);}} aria-label="Ürünü paylaş" className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/95 shadow-sm dark:bg-gray-900/95"><Share2 className="h-5 w-5"/></button>:null}
   </div>
  </div>

  <div className="flex flex-1 flex-col p-4">
   <div className="text-xs font-bold uppercase tracking-wide text-brand-gold">{product?.category||'Ürün'}</div>
   <button onClick={onClick} className="mt-1 min-h-11 text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><h3 className="line-clamp-2 text-lg font-bold text-brand-text">{product?.name}</h3></button>
   {product?.producerName?<p className="mt-1 text-sm text-gray-500">{product.producerName}</p>:null}
   {product?.origin?<p className="mt-1 line-clamp-1 text-xs text-gray-500">Menşe: {product.origin}</p>:null}
   {Number(product?.reviewCount||0)>0?<div className="mt-2 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-brand-gold text-brand-gold"/><span className="font-semibold">{Number(product.rating||0).toFixed(1)}</span><span className="text-gray-500">({Number(product.reviewCount||0)})</span></div>:<div className="mt-2 text-xs text-gray-500">Henüz yayınlanmış yorum yok</div>}

   <div className="mt-3 flex items-end justify-between gap-3">
    <div><div className="text-xl font-bold text-brand-green dark:text-brand-gold">{formatMoney(price,currency)}</div>{compare!==null&&compare>price?<div className="text-sm text-gray-400 line-through">{formatMoney(compare,currency)}</div>:null}{product?.unit?<div className="mt-0.5 text-xs text-gray-500">{product.unit}</div>:null}</div>
    {tracked&&numericStock!==null?<div className={`text-xs font-semibold ${soldOut?'text-red-700':'text-green-700'}`}>{soldOut?'Stokta yok':`${numericStock} adet stokta`}</div>:preorder?<div className="text-xs font-semibold text-brand-green">Siparişe açık</div>:null}
   </div>

   {!soldOut?<div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-2 dark:bg-gray-800"><span className="text-xs font-semibold text-gray-500">Adet</span><div className="flex items-center gap-1"><button type="button" onClick={decrease} disabled={quantity<=1||busy} aria-label="Miktarı azalt" className="grid min-h-11 min-w-11 place-items-center rounded-lg border disabled:opacity-40"><Minus className="h-4 w-4"/></button><span aria-live="polite" className="min-w-10 text-center font-bold">{quantity}</span><button type="button" onClick={increase} disabled={quantity>=maxQuantity||busy} aria-label="Miktarı artır" className="grid min-h-11 min-w-11 place-items-center rounded-lg border disabled:opacity-40"><Plus className="h-4 w-4"/></button></div></div>:null}

   <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
    <button type="button" onClick={()=>void add()} disabled={soldOut||busy} className="min-h-12 rounded-xl bg-brand-green px-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{preorder?<Calendar className="mr-2 inline h-4 w-4"/>:<ShoppingCart className="mr-2 inline h-4 w-4"/>}{busy?'Ekleniyor…':soldOut?'Tükendi':preorder?'Ön Siparişe Ekle':'Sepete Ekle'}</button>
    {onGift?<button type="button" onClick={()=>void onGift(product)} aria-label="Hediye et" className="grid min-h-12 min-w-12 place-items-center rounded-xl border"><Gift className="h-5 w-5 text-brand-gold"/></button>:null}
    {onLike?<button type="button" onClick={()=>void onLike(product)} aria-label={isLiked?'Beğeniyi kaldır':'Ürünü beğen'} aria-pressed={isLiked} className="grid min-h-12 min-w-12 place-items-center rounded-xl border"><ThumbsUp className={`h-5 w-5 ${isLiked?'fill-brand-gold text-brand-gold':''}`}/></button>:null}
   </div>
  </div>
 </article>;
}

function formatMoney(value:number,currency:string){try{return new Intl.NumberFormat('tr-TR',{style:'currency',currency}).format(Number.isFinite(value)?value:0);}catch{return `${(Number.isFinite(value)?value:0).toFixed(2)} ${currency}`;}}
