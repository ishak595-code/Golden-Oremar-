import React,{useEffect,useId,useRef,useState}from'react';
import{Loader2,PackageCheck,Star}from'lucide-react';
import{listReviewableOrderItems,submitVerifiedReview,type ReviewableOrderItem}from'../account/reviewsApi';
import{userFacingError}from'../../lib/userFacingError';

/**
 * Writing a review from the product page.
 *
 * Only real, delivered orders can be reviewed (list_my_reviewable_order_items_v1
 * decides; the server checks again on submit_verified_review_v1). The form
 * opens in place under "Değerlendirme yaz" instead of sending the customer to
 * the account screen. Every state says what is going on in plain Turkish:
 * checking orders, nothing to review yet, the service being unreachable, or
 * the review waiting for moderation.
 */

type Phase={kind:'loading'}|{kind:'unavailable';message:string}|{kind:'not-eligible'}|{kind:'form';item:ReviewableOrderItem}|{kind:'sent'};

const RATING_WORDS=['','Hiç beğenmedim','Beğenmedim','İdare eder','Beğendim','Çok beğendim'];

export default function ProductReviewComposer({productId,productName,onClose}:{productId:string;productName:string;onClose:()=>void}){
 const[phase,setPhase]=useState<Phase>({kind:'loading'});
 const[rating,setRating]=useState(0);
 const[title,setTitle]=useState('');
 const[body,setBody]=useState('');
 const[busy,setBusy]=useState(false);
 const[formError,setFormError]=useState('');
 const rootRef=useRef<HTMLDivElement>(null);
 const ids=useId().replace(/:/g,'');
 const active=useRef(true);

 async function check(){
  setPhase({kind:'loading'});setFormError('');
  try{
   const items=await listReviewableOrderItems();
   if(!active.current)return;
   const item=items.find(entry=>entry.productId===productId);
   setPhase(item?{kind:'form',item}:{kind:'not-eligible'});
  }catch(error:unknown){
   if(active.current)setPhase({kind:'unavailable',message:userFacingError(error,'Yorum formu şu anda açılamadı. Lütfen biraz sonra tekrar deneyin.')});
  }
 }
 useEffect(()=>{active.current=true;void check();return()=>{active.current=false;};},[productId]);
 useEffect(()=>{rootRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[phase.kind]);

 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(phase.kind!=='form'||busy)return;
  const text=body.trim(),heading=title.trim();
  if(rating<1||rating>5){setFormError('Lütfen 1 ile 5 arasında bir puan seçin.');return;}
  if(text.length<10){setFormError('Yorumunuz en az 10 karakter olmalı.');return;}
  if(text.length>3000){setFormError('Yorumunuz en fazla 3000 karakter olabilir.');return;}
  if(heading.length>120){setFormError('Başlık en fazla 120 karakter olabilir.');return;}
  try{
   setBusy(true);setFormError('');
   await submitVerifiedReview({orderItemId:phase.item.orderItemId,rating,title:heading||null,body:text,mediaPaths:[]});
   if(active.current)setPhase({kind:'sent'});
  }catch(error:unknown){
   if(active.current)setFormError(userFacingError(error,'Yorumunuz gönderilemedi. Lütfen tekrar deneyin.'));
  }finally{if(active.current)setBusy(false);}
 }

 return<div ref={rootRef} className="go-review-composer" aria-live="polite">
  {phase.kind==='loading'?<p className="go-review-composer__note"><Loader2 aria-hidden="true" className="go-review-composer__spin"/>Siparişleriniz kontrol ediliyor…</p>:null}
  {phase.kind==='unavailable'?<div role="alert" className="go-review-composer__notice go-review-composer__notice--warn">
   <strong>Yorum şu anda gönderilemiyor</strong>
   <p>{phase.message}</p>
   <div className="go-review-composer__actions"><button type="button" onClick={()=>void check()} className="go-review-composer__primary">Tekrar dene</button><button type="button" onClick={onClose} className="go-review-composer__secondary">Kapat</button></div>
  </div>:null}
  {phase.kind==='not-eligible'?<div className="go-review-composer__notice">
   <strong><PackageCheck aria-hidden="true"/>Teslim aldıktan sonra yorum yazabilirsiniz</strong>
   <p>Yorumlar yalnız bu ürünü satın alıp teslim alan müşterilerimizden gelir. Siparişiniz teslim edildiğinde puanınızı ve yorumunuzu buradan paylaşabilirsiniz.</p>
   <div className="go-review-composer__actions"><button type="button" onClick={onClose} className="go-review-composer__secondary">Tamam</button></div>
  </div>:null}
  {phase.kind==='sent'?<div role="status" className="go-review-composer__notice go-review-composer__notice--ok">
   <strong>Teşekkürler, yorumunuz alındı</strong>
   <p>Yorumunuz incelemeye gönderildi; onaylandığında bu sayfada yayınlanır. Durumunu Hesabım &gt; Yorumlarım bölümünden takip edebilirsiniz.</p>
   <div className="go-review-composer__actions"><button type="button" onClick={onClose} className="go-review-composer__secondary">Kapat</button></div>
  </div>:null}
  {phase.kind==='form'?<form onSubmit={event=>void submit(event)} className="go-review-composer__form" aria-labelledby={`${ids}-title`} noValidate>
   <strong id={`${ids}-title`} className="go-review-composer__heading">Değerlendirmeniz</strong>
   <p className="go-review-composer__meta">{productName} · Sipariş {phase.item.orderNumber}</p>
   <fieldset className="go-review-composer__stars">
    <legend>Puanınız <span aria-hidden="true">*</span></legend>
    <div role="radiogroup" aria-label="Puanınız">{[1,2,3,4,5].map(value=><button key={value} type="button" role="radio" aria-checked={rating===value} aria-label={`${value} yıldız, ${RATING_WORDS[value]}`} onClick={()=>setRating(value)} className={`go-review-composer__star${value<=rating?' is-on':''}`}><Star aria-hidden="true"/></button>)}</div>
    <span className="go-review-composer__rating-word" aria-hidden="true">{rating?RATING_WORDS[rating]:'Bir puan seçin'}</span>
   </fieldset>
   <label className="go-review-composer__field"><span>Başlık <small>(isteğe bağlı)</small></span><input value={title} onChange={event=>setTitle(event.target.value)} maxLength={120} className="input" autoComplete="off"/></label>
   <label className="go-review-composer__field"><span>Yorumunuz <span aria-hidden="true">*</span></span><textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={3000} rows={4} className="input" aria-describedby={`${ids}-count`} placeholder="Tadı, kokusu, paketlemesi… Deneyiminizi anlatın."/><small id={`${ids}-count`} className="go-review-composer__count">{body.trim().length<10?`En az 10 karakter (${body.trim().length}/10)`:`${body.trim().length}/3000`}</small></label>
   {formError?<p role="alert" className="go-review-composer__error">{formError}</p>:null}
   <div className="go-review-composer__actions"><button type="submit" disabled={busy} className="go-review-composer__primary">{busy?'Gönderiliyor…':'Yorumu gönder'}</button><button type="button" onClick={onClose} disabled={busy} className="go-review-composer__secondary">Vazgeç</button></div>
  </form>:null}
 </div>;
}
