import React,{useEffect,useId,useMemo,useRef,useState}from'react';
import{Building2,Check,CircleCheck,Copy,Loader2,MessageCircle,ShieldCheck,X}from'lucide-react';
import{useAccessibleDialog}from'../accessibility/useAccessibleDialog';
import{formatMoney}from'../cart/checkoutHelpers';
import{getOfflineOrderingConfig,newOrderRequestKey,offlineOrderErrorMessage,submitOfflineOrder,validateOfflineCustomer,whatsappOrderUrl,type OfflineOrderCustomer,type OfflineOrderLineInput,type OfflineOrderMethod,type OfflineOrderReceipt,type OfflineOrderingConfig}from'./offlineOrderApi';
import'./offlineOrder.css';

export type OfflineOrderSummaryLine={key:string;productName:string;variantName:string;quantity:number;priceMinor:number;currency:string};
type Props={
 open:boolean;
 onClose:()=>void;
 source:'product'|'cart';
 lines:OfflineOrderSummaryLine[];
 items:OfflineOrderLineInput[];
 prefill?:Partial<OfflineOrderCustomer>;
 /** Called once the order is recorded (e.g. to empty the cart). */
 onSubmitted?:(receipt:OfflineOrderReceipt)=>void;
};

const CONTACT_KEY='golden-oremar:order-contact:v1';
const EMPTY:OfflineOrderCustomer={name:'',phone:'',email:'',province:'',district:'',addressLine:'',note:''};

function readSavedContact():Partial<OfflineOrderCustomer>{try{const raw=window.localStorage.getItem(CONTACT_KEY);if(!raw)return{};const value=JSON.parse(raw);if(!value||typeof value!=='object')return{};const pick=(key:keyof OfflineOrderCustomer,max:number)=>typeof value[key]==='string'?String(value[key]).slice(0,max):'';return{name:pick('name',120),phone:pick('phone',40),email:pick('email',254),province:pick('province',80),district:pick('district',80),addressLine:pick('addressLine',500)};}catch{return{};}}
function saveContact(customer:OfflineOrderCustomer,remember:boolean){try{if(!remember){window.localStorage.removeItem(CONTACT_KEY);return;}const{note:_note,...rest}=customer;window.localStorage.setItem(CONTACT_KEY,JSON.stringify(rest));}catch{/* storage may be blocked */}}

async function copyText(value:string){try{await navigator.clipboard.writeText(value);return true;}catch{return false;}}

/**
 * Order without online payment, for guests and members alike. One sheet:
 * choose WhatsApp or bank transfer, give delivery details, confirm the
 * pre-contract information, get an order code. WhatsApp continues in the
 * chat with a prefilled message; bank transfer shows the IBAN to pay to.
 */
export default function OfflineOrderSheet({open,onClose,source,lines,items,prefill,onSubmitted}:Props){
 const titleId=useId();
 const[config,setConfig]=useState<OfflineOrderingConfig|null>(null);
 const[configError,setConfigError]=useState(false);
 const[method,setMethod]=useState<OfflineOrderMethod|null>(null);
 const[customer,setCustomer]=useState<OfflineOrderCustomer>(EMPTY);
 const[errors,setErrors]=useState<Partial<Record<keyof OfflineOrderCustomer,string>>>({});
 const[consent,setConsent]=useState(false);
 const[remember,setRemember]=useState(true);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const[receipt,setReceipt]=useState<OfflineOrderReceipt|null>(null);
 const[copied,setCopied]=useState('');
 const keyRef=useRef(newOrderRequestKey());
 const errorRef=useRef<HTMLDivElement>(null);
 const dialogRef=useAccessibleDialog<HTMLDivElement>(open,()=>{if(!busy)onClose();});

 useEffect(()=>{
  if(!open)return;
  setReceipt(null);setError('');setErrors({});setConsent(false);setCopied('');keyRef.current=newOrderRequestKey();
  const saved=readSavedContact();
  setCustomer({...EMPTY,...saved,...Object.fromEntries(Object.entries(prefill||{}).filter(([,value])=>typeof value==='string'&&value.trim()))});
  let active=true;setConfigError(false);
  getOfflineOrderingConfig().then(next=>{if(!active)return;setConfig(next);setMethod(current=>current&&((current==='whatsapp'&&next.whatsapp.enabled)||(current==='bank_transfer'&&next.bankTransfer.enabled))?current:next.whatsapp.enabled?'whatsapp':next.bankTransfer.enabled?'bank_transfer':null);}).catch(()=>{if(active)setConfigError(true);});
  return()=>{active=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[open]);

 const currency=lines[0]?.currency||'TRY';
 const subtotal=useMemo(()=>lines.reduce((sum,line)=>sum+line.priceMinor*line.quantity,0),[lines]);
 const waUrl=receipt?whatsappOrderUrl(receipt):null;

 function update<K extends keyof OfflineOrderCustomer>(key:K,value:string){setCustomer(current=>({...current,[key]:value}));if(errors[key])setErrors(current=>({...current,[key]:undefined}));}

 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy)return;
  if(!method){setError('Bir sipariş yöntemi seçin.');return;}
  const nextErrors=validateOfflineCustomer(customer);setErrors(nextErrors);
  const first=Object.keys(nextErrors)[0];
  if(first){(document.getElementById(`${titleId}-${first}`) as HTMLElement|null)?.focus();return;}
  if(!consent){setError('Devam etmek için ön bilgilendirme onay kutusunu işaretleyin.');queueMicrotask(()=>errorRef.current?.focus());return;}
  try{
   setBusy(true);setError('');
   const result=await submitOfflineOrder({idempotencyKey:keyRef.current,method,source,items,customer,consent});
   saveContact(customer,remember);
   setReceipt(result);onSubmitted?.(result);
  }catch(err){setError(offlineOrderErrorMessage(err));queueMicrotask(()=>errorRef.current?.focus());}
  finally{setBusy(false);}
 }

 async function copy(label:string,value:string){if(await copyText(value)){setCopied(label);window.setTimeout(()=>setCopied(current=>current===label?'':current),2200);}}

 if(!open)return null;
 const field=(key:keyof OfflineOrderCustomer,label:string,props:React.InputHTMLAttributes<HTMLInputElement>={},optional=false)=><div className="go-order-field"><label htmlFor={`${titleId}-${key}`}>{label}{optional?<small> (isteğe bağlı)</small>:null}</label><input id={`${titleId}-${key}`} value={customer[key]} onChange={event=>update(key,event.target.value)} aria-invalid={errors[key]?true:undefined} aria-describedby={errors[key]?`${titleId}-${key}-error`:undefined} {...props}/>{errors[key]?<em id={`${titleId}-${key}-error`}>{errors[key]}</em>:null}</div>;

 return<div className="go-order-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="go-order-sheet">
   <header className="go-order-head">
    <div><p className="go-order-eyebrow">{receipt?'Sipariş kodu':'Güvenli sipariş'}</p><h2 id={titleId}>{receipt?'Siparişiniz alındı':'Siparişi tamamla'}</h2></div>
    <button type="button" onClick={onClose} disabled={busy} aria-label="Kapat" className="go-order-close"><X aria-hidden="true"/></button>
   </header>

   {receipt?<div className="go-order-body">
    <div className="go-order-done"><CircleCheck aria-hidden="true"/><div><p className="go-order-code">{receipt.reference}</p><p>{receipt.method==='whatsapp'?'Siparişiniz kaydedildi. WhatsApp mesajını gönderin, ödeme ve teslimatı hemen onaylayalım.':'Siparişiniz kaydedildi. Ödemeyi aşağıdaki hesaba yapın, açıklamaya sipariş kodunu yazın.'}</p></div><button type="button" className="go-order-copy" onClick={()=>void copy('code',receipt.reference)}>{copied==='code'?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}<span>{copied==='code'?'Kopyalandı':'Kodu kopyala'}</span></button></div>
    <dl className="go-order-totals"><div><dt>Ürünler</dt><dd>{formatMoney(receipt.subtotalMinor,receipt.currency)}</dd></div><div><dt>Kargo</dt><dd>{receipt.shippingMinor===null?'Onayda bildirilir':receipt.shippingMinor===0?'Ücretsiz':formatMoney(receipt.shippingMinor,receipt.currency)}</dd></div><div className="is-total"><dt>Ödenecek tutar</dt><dd>{formatMoney(receipt.totalMinor,receipt.currency)}</dd></div></dl>
    {receipt.method==='bank_transfer'&&receipt.bankTransfer?<section className="go-order-bank" aria-label="Havale ve EFT bilgileri">
     {receipt.bankTransfer.accounts.map(account=><article key={account.iban}><p className="go-order-bank__name"><Building2 aria-hidden="true"/>{account.bankName}{account.branch?<small> · {account.branch}</small>:null}</p><p className="go-order-bank__holder">{account.accountHolder}</p><p className="go-order-bank__iban">{account.iban}</p><button type="button" className="go-order-copy" onClick={()=>void copy(account.iban,account.iban.replace(/\s/g,''))}>{copied===account.iban?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}<span>{copied===account.iban?'Kopyalandı':'IBAN kopyala'}</span></button></article>)}
     <p className="go-order-hint">Açıklama alanına yalnız <strong>{receipt.reference}</strong> yazın. Ödeme {receipt.bankTransfer.paymentWindowHours} saat içinde ulaşmazsa sipariş iptal edilebilir; ürünler ödeme onayından sonra hazırlanır.</p>
    </section>:null}
    <div className="go-order-actions">
     {waUrl?<a href={waUrl} target="_blank" rel="noopener noreferrer" className="go-order-primary"><MessageCircle aria-hidden="true"/>{receipt.method==='whatsapp'?'WhatsApp\'ta gönder':'Dekontu WhatsApp\'tan gönder'}</a>:null}
     <button type="button" onClick={onClose} className="go-order-secondary">Alışverişe dön</button>
    </div>
   </div>

   :<form className="go-order-body" onSubmit={submit} noValidate>
    <p className="go-order-lead">Kartla online ödeme açılana kadar siparişinizi WhatsApp veya Havale/EFT ile alıyoruz. Üyelik gerekmez.</p>
    <ul className="go-order-lines" aria-label="Sipariş özeti">{lines.map(line=><li key={line.key}><span><strong>{line.quantity} x {line.productName}</strong>{line.variantName?<small>{line.variantName}</small>:null}</span><b>{formatMoney(line.priceMinor*line.quantity,line.currency)}</b></li>)}<li className="is-total"><span>Ara toplam</span><b>{formatMoney(subtotal,currency)}</b></li></ul>

    {configError?<div role="alert" className="go-order-alert">Sipariş seçenekleri yüklenemedi. Bağlantınızı kontrol edip yeniden açın.</div>
    :!config?<p role="status" className="go-order-hint"><Loader2 aria-hidden="true" className="go-spin"/> Seçenekler yükleniyor…</p>
    :<fieldset className="go-order-methods"><legend>Sipariş yöntemi</legend>
     {config.whatsapp.enabled?<label className={method==='whatsapp'?'is-selected':''}><input type="radio" name={`${titleId}-method`} checked={method==='whatsapp'} onChange={()=>setMethod('whatsapp')}/><MessageCircle aria-hidden="true"/><span><strong>WhatsApp ile sipariş</strong><small>Sipariş kodunuzla mesaj hazır gelir; ödeme ve teslimatı sohbette onaylarız.</small></span></label>:null}
     {config.bankTransfer.enabled?<label className={method==='bank_transfer'?'is-selected':''}><input type="radio" name={`${titleId}-method`} checked={method==='bank_transfer'} onChange={()=>setMethod('bank_transfer')}/><Building2 aria-hidden="true"/><span><strong>Havale / EFT</strong><small>IBAN bilgisi sipariş kodunuzla birlikte gösterilir; açıklamaya kodu yazarsınız.</small></span></label>:null}
     {!config.whatsapp.enabled&&!config.bankTransfer.enabled?<p className="go-order-hint">Şu anda sipariş kabul edilemiyor. Lütfen daha sonra tekrar deneyin.</p>:null}
    </fieldset>}

    <fieldset className="go-order-grid"><legend>Teslimat ve iletişim</legend>
     {field('name','Ad soyad',{autoComplete:'name',maxLength:120,required:true})}
     {field('phone','Telefon',{autoComplete:'tel',inputMode:'tel',maxLength:20,required:true,placeholder:'05xx xxx xx xx'})}
     {field('email','E-posta',{autoComplete:'email',inputMode:'email',maxLength:254},true)}
     <div className="go-order-pair">{field('province','İl',{autoComplete:'address-level1',maxLength:80,required:true})}{field('district','İlçe',{autoComplete:'address-level2',maxLength:80,required:true})}</div>
     <div className="go-order-field"><label htmlFor={`${titleId}-addressLine`}>Açık adres</label><textarea id={`${titleId}-addressLine`} value={customer.addressLine} onChange={event=>update('addressLine',event.target.value.slice(0,500))} rows={3} autoComplete="street-address" aria-invalid={errors.addressLine?true:undefined} aria-describedby={errors.addressLine?`${titleId}-addressLine-error`:undefined}/>{errors.addressLine?<em id={`${titleId}-addressLine-error`}>{errors.addressLine}</em>:null}</div>
     <div className="go-order-field"><label htmlFor={`${titleId}-note`}>Sipariş notu<small> (isteğe bağlı)</small></label><textarea id={`${titleId}-note`} value={customer.note} onChange={event=>update('note',event.target.value.slice(0,1000))} rows={2} placeholder="Teslimat saati, kapı kodu gibi"/></div>
     <label className="go-order-check"><input type="checkbox" checked={remember} onChange={event=>setRemember(event.target.checked)}/><span>Bilgilerimi bu cihazda hatırla</span></label>
    </fieldset>

    <details className="go-order-info"><summary>Ön bilgilendirme özeti</summary><div>
     <p><strong>Satıcı:</strong> Golden Oremar Resmi Mağazası, Dağlıca - Yeşiltaş Köyü, Yüksekova, Hakkâri.</p>
     <p><strong>Ürün ve fiyat:</strong> Yukarıdaki ürünler, gösterilen satış fiyatlarıyla. Kesin tutar ve kargo bedeli sipariş kodu ile birlikte gösterilir.</p>
     <p><strong>Ödeme:</strong> {method==='bank_transfer'?'Havale/EFT ile, sipariş kodu açıklamaya yazılarak.':'WhatsApp üzerinden onaylanan yöntemle.'} Ödeme onaylanmadan ürün gönderilmez.</p>
     <p><strong>Teslimat:</strong> Yazdığınız adrese anlaşmalı kargo ile. Taze ürünler hasat ve hava durumuna göre hazırlanır.</p>
     <p><strong>Cayma hakkı:</strong> Ambalajı açılmamış dayanıklı ürünlerde teslimden itibaren 14 gün. Çabuk bozulan taze ürünlerde cayma hakkı yoktur; hasarlı veya hatalı ürün her durumda değiştirilir ya da bedeli iade edilir.</p>
    </div></details>
    <label className="go-order-check go-order-consent"><input type="checkbox" checked={consent} onChange={event=>{setConsent(event.target.checked);if(event.target.checked)setError('');}}/><span>Ön bilgilendirme özetini ve <a href="/kullanim-sartlari" target="_blank" rel="noopener noreferrer">Kullanım ve Mesafeli Satış Esasları</a>'nı okudum, onaylıyorum.</span></label>

    {error?<div ref={errorRef} tabIndex={-1} role="alert" className="go-order-alert">{error}</div>:null}
    <div className="go-order-actions go-order-actions--sticky">
     <button type="submit" disabled={busy||!config||!method} className="go-order-primary">{busy?<><Loader2 aria-hidden="true" className="go-spin"/>Kaydediliyor…</>:method==='bank_transfer'?<><Building2 aria-hidden="true"/>Siparişi oluştur ve IBAN'ı gör</>:<><MessageCircle aria-hidden="true"/>Siparişi oluştur</>}</button>
     <p className="go-order-secure"><ShieldCheck aria-hidden="true"/>Bilgileriniz yalnız bu siparişin teslimatı için kullanılır.</p>
    </div>
   </form>}
  </div>
 </div>;
}
