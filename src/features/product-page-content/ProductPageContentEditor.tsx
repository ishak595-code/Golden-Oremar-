import React,{useEffect,useId,useMemo,useState}from'react';
import'./productPageContent.css';
import{Loader2,Save,X}from'lucide-react';
import{getProductPageContent,pageContentError,saveProductPageContent,validatePageContent,PAGE_CONTENT_LIMITS,type PageTextKey,type ProductPageContent,type ProductPageContentRecord,type ShippingMode}from'./api';

/**
 * "Ürün sayfası içeriği": every per-product text the product page shows that
 * is not edited in the product steps (name, story, description, features,
 * price and old price, photos, health and usage live there). One field per
 * line on the page, in page order, each with a short example; a cleared
 * optional field hides its line on the page. Used by the super admin
 * (Resmi Mağaza Ürünleri) and by sellers for their own products (Hesabım >
 * Ürünlerim); the server decides who may save.
 */
type Props={productId:string;productName:string;onClose:()=>void;onSaved?:(next:ProductPageContentRecord)=>void};

const HELP:Record<PageTextKey,{label:string;help:string;rows?:number}>={
 prestige:{label:'Fotoğraf altı satırı',help:'Örn: Yüksekova · Odun isiyle geleneksel kurutma · Sınırlı hasat. Yer · üretim · bir özellik; en fazla üç parça, · ile ayırın. Boş bırakılırsa satır gizlenir.'},
 shippingNote:{label:'Kargo satırı (isteğe bağlı)',help:'Boş bırakın: kargo ayarından otomatik yazılır ("Kargo bizden" ya da "Kargo ücreti 49 TL"). Kendi cümlenizi yazarsanız o görünür; örn: Kargo bizden, aynı gün paketlenir.'},
 pack:{label:'Paket satırı',help:'Fiyatın altında görünür. Örn: 1 kg • Özel bez kese. Boş bırakılırsa paket seçeneğinin adı gösterilir.'},
 origin:{label:'Kökeni',help:'Örn: Yüksekova / Oremar. Boş bırakılırsa satır gizlenir.'},
 production:{label:'Üretim',help:'Örn: Odun isiyle geleneksel kurutma. Fotoğraf altı satırı aynı şeyi söylüyorsa sayfada tekrar edilmez. Boş bırakılırsa satır gizlenir.'},
 packaging:{label:'Ambalaj',help:'Örn: Cam kavanoz, özel bez kese. Boş bırakılırsa satır gizlenir.'},
 returnText:{label:'İade',help:'Örn: 14 gün içinde, paket açılmamışsa ücretsiz iade. Çabuk bozulan ürünlerde: Cayma hakkı yok; hasarlı veya hatalı üründe iade hakkınız saklıdır. Boş bırakılırsa satır gizlenir.'},
 dispatchText:{label:'Teslimat (kargoya veriliş)',help:'Örn: 2-4 iş günü içinde kargoya verilir. Ön siparişte: Yeni sezon hasadıyla gönderilir (Haziran-Temmuz). Boş bırakılırsa bu cümle gizlenir.'},
 about:{label:'Ürün bilgileri',help:'"Ürün bilgileri ve özellikleri" bölümünün ilk paragrafı: ürün nedir, nasıl yapılır. Hikâyede geçen cümleler sayfada tekrar edilmez. Sağlık beyanı yazmayın.',rows:6},
};

function tl(minor:number){const digits=minor%100===0?0:2;return`${(minor/100).toLocaleString('tr-TR',{minimumFractionDigits:digits,maximumFractionDigits:digits})} TL`;}
function feeText(minor:number|null){return minor===null?'':String(minor%100===0?minor/100:(minor/100).toFixed(2)).replace('.',',');}
function parseFee(value:string){const raw=value.trim().replace(/\s/g,'').replace(',','.');if(!raw)return null;if(!/^\d{1,5}(\.\d{1,2})?$/.test(raw))return NaN;return Math.round(Number(raw)*100);}

/** The line the page will show, from the same rule as the product page. */
export function shippingLinePreview(content:Pick<ProductPageContent,'shippingMode'|'shippingFeeMinor'|'shippingNote'>,defaultFeeMinor:number|null){
 const note=content.shippingNote.trim();if(note)return note;
 const fee=content.shippingMode==='free'?0:content.shippingMode==='paid'?content.shippingFeeMinor:defaultFeeMinor;
 return fee&&fee>0?`Kargo ücreti ${tl(fee)}`:'Kargo bizden';
}

export default function ProductPageContentEditor({productId,productName,onClose,onSaved}:Props){
 const uid=useId();
 const[record,setRecord]=useState<ProductPageContentRecord|null>(null),[draft,setDraft]=useState<ProductPageContent|null>(null),[feeInput,setFeeInput]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');setNotice('');getProductPageContent(productId).then(next=>{if(!active)return;setRecord(next);setDraft(next.content);setFeeInput(feeText(next.content.shippingFeeMinor));}).catch(next=>{if(active)setError(pageContentError(next));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[productId]);
 const dirty=useMemo(()=>Boolean(record&&draft&&JSON.stringify(record.content)!==JSON.stringify(draft)),[record,draft]);
 function set<K extends keyof ProductPageContent>(key:K,value:ProductPageContent[K]){setDraft(current=>current?{...current,[key]:value}:current);setNotice('');}
 async function save(){if(!draft||!record||saving)return;const fee=parseFee(feeInput);const next={...draft,shippingFeeMinor:draft.shippingMode==='paid'?(Number.isNaN(fee as number)?-1:fee):null};if(draft.shippingMode==='paid'&&(fee===null||Number.isNaN(fee as number))){setError('Ücretli kargo için kargo ücretini TL olarak yazın (örn: 49).');return;}const issue=validatePageContent(next as ProductPageContent);if(issue){setError(issue);return;}try{setSaving(true);setError('');setNotice('');const saved=await saveProductPageContent(productId,next as ProductPageContent,record.updatedAt);setRecord(saved);setDraft(saved.content);setFeeInput(feeText(saved.content.shippingFeeMinor));setNotice('Kaydedildi. Ürün sayfası güncellendi.');onSaved?.(saved);}catch(next){setError(pageContentError(next));}finally{setSaving(false);}}

 const field=(key:PageTextKey)=>{if(!draft)return null;const meta=HELP[key],max=PAGE_CONTENT_LIMITS[key],value=draft[key],id=`${uid}-${key}`,helpId=`${id}-help`,over=value.trim().length>max;return<div key={key} className="go-pce__field">
  <div className="go-pce__label-row"><label htmlFor={id} className="go-pce__label">{meta.label}</label><span className={`go-pce__count${over?' is-over':''}`} aria-hidden="true">{value.trim().length}/{max}</span>{value?<button type="button" onClick={()=>set(key,'')} className="go-pce__clear" aria-label={`${meta.label} alanını temizle`}>Temizle</button>:null}</div>
  {meta.rows?<textarea id={id} rows={meta.rows} value={value} maxLength={max+200} onChange={event=>set(key,event.target.value)} aria-describedby={helpId} aria-invalid={over||undefined} className="go-pce__input"/>:<input id={id} value={value} maxLength={max+40} onChange={event=>set(key,event.target.value)} aria-describedby={helpId} aria-invalid={over||undefined} className="go-pce__input"/>}
  <p id={helpId} className="go-pce__help">{meta.help}{over?<strong> En fazla {max} karakter.</strong>:null}</p>
 </div>;};

 const modes:Array<{value:ShippingMode;label:string;hint:string}>=[
  {value:'default',label:'Genel kargo ayarı',hint:record?.defaultShippingFeeMinor?`Şu an ${tl(record.defaultShippingFeeMinor)}`:'Şu an ücretsiz: sayfada "Kargo bizden"'},
  {value:'free',label:'Ücretsiz kargo',hint:'Sayfada "Kargo bizden"; sepette kargo 0 TL'},
  {value:'paid',label:'Ücretli kargo',hint:'Sayfada "Kargo ücreti … TL"; sepette bu ücret alınır'},
 ];
 const previewFee=parseFee(feeInput);
 const preview=draft?shippingLinePreview({...draft,shippingFeeMinor:draft.shippingMode==='paid'&&typeof previewFee==='number'&&!Number.isNaN(previewFee)?previewFee:null},record?.defaultShippingFeeMinor??null):'';

 return<section className="go-pce" aria-labelledby={`${uid}-title`} data-product-page-content-editor="true">
  <div className="go-pce__head"><div><h2 id={`${uid}-title`} className="go-pce__title">Ürün sayfası içeriği</h2><p className="go-pce__sub">{productName}</p></div><button type="button" onClick={onClose} className="go-pce__close" aria-label="Ürün sayfası içeriğini kapat"><X aria-hidden="true"/></button></div>
  {loading?<p role="status" className="go-pce__status"><Loader2 aria-hidden="true" className="animate-spin"/>Ürün sayfası içeriği yükleniyor…</p>:null}
  {error?<p role="alert" className="go-pce__error">{error}</p>:null}
  {draft&&record?<form onSubmit={event=>{event.preventDefault();void save();}} noValidate>
   <fieldset className="go-pce__group"><legend>Fotoğrafın altı</legend>{field('prestige')}</fieldset>
   <fieldset className="go-pce__group"><legend>Kargo</legend>
    <div className="go-pce__radios" role="radiogroup" aria-label="Bu ürünün kargo ücreti">{modes.map(mode=><label key={mode.value} className={`go-pce__radio${draft.shippingMode===mode.value?' is-on':''}`}><input type="radio" name={`${uid}-ship`} value={mode.value} checked={draft.shippingMode===mode.value} onChange={()=>set('shippingMode',mode.value)}/><span><strong>{mode.label}</strong><small>{mode.hint}</small></span></label>)}</div>
    {draft.shippingMode==='paid'?<div className="go-pce__field"><label htmlFor={`${uid}-fee`} className="go-pce__label">Kargo ücreti (TL)</label><input id={`${uid}-fee`} inputMode="decimal" value={feeInput} onChange={event=>{setFeeInput(event.target.value);setNotice('');}} aria-describedby={`${uid}-fee-help`} className="go-pce__input go-pce__input--fee" placeholder="49"/><p id={`${uid}-fee-help`} className="go-pce__help">Örn: 49. Türkiye içi, sipariş başına bir kez alınır; sepette birden çok ücretli ürün varsa en yüksek ücret uygulanır. Yurt dışı gönderimde genel kargo kuralı geçerlidir.</p></div>:null}
    {field('shippingNote')}
    <p className="go-pce__preview" aria-live="polite">Sayfada görünecek: <strong>{preview}</strong></p>
   </fieldset>
   <fieldset className="go-pce__group"><legend>Fiyatın altı</legend>{field('pack')}</fieldset>
   <fieldset className="go-pce__group"><legend>Kısa bilgiler tablosu</legend>{field('origin')}{field('production')}{field('packaging')}{field('returnText')}{field('dispatchText')}
    <label className="go-pce__check"><input type="checkbox" checked={draft.coldChain} onChange={event=>set('coldChain',event.target.checked)}/><span>Teslimat satırında "Soğuk zincirle gönderilir" yazsın</span></label>
    <p className="go-pce__help">Stok satırı (Stokta / Son 3 adet / Tükendi) stok miktarından otomatik gelir.</p>
   </fieldset>
   <fieldset className="go-pce__group"><legend>Ürün bilgileri ve özellikleri</legend>{field('about')}</fieldset>
   <p className="go-pce__note">Ürün adı, hikâye (en fazla 1500 karakter), açıklama, özellikler, fiyat ve eski fiyat (indirim), fotoğraflar, sağlık bilgileri ve nasıl tüketilir ürünün düzenleme adımlarında değiştirilir.</p>
   {notice?<p role="status" className="go-pce__ok">{notice}</p>:null}
   <div className="go-pce__actions"><button type="submit" disabled={saving||!dirty} className="go-pce__save">{saving?<Loader2 aria-hidden="true" className="animate-spin"/>:<Save aria-hidden="true"/>}{saving?'Kaydediliyor…':'Kaydet'}</button><button type="button" onClick={onClose} className="go-pce__cancel">{dirty?'Vazgeç':'Kapat'}</button></div>
  </form>:null}
 </section>;
}
