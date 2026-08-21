import React,{useEffect,useMemo,useState}from'react';
import{CheckCircle2,Eye,Loader2,Palette,RefreshCw,Save,ShieldCheck}from'lucide-react';
import{
  applyBrandAppearance,
  brandAppearanceContrastIssues,
  contrastRatio,
  superAdminGetBrandAppearance,
  superAdminUpdateBrandAppearance,
  type BrandAppearance,
  type BrandAppearanceTokens,
}from'../features/appearance/brandAppearance';
import{APP_THEME_OPTIONS,setPersonalTheme,type AppTheme}from'../features/appearance/theme';

const fields:Array<{key:keyof BrandAppearanceTokens;label:string;help:string}>=[
 {key:'background',label:'Ana arka plan',help:'Sayfa ve uygulama ana zemini'},
 {key:'card',label:'Kart yüzeyi',help:'Kartlar, paneller ve içerik yüzeyi'},
 {key:'text',label:'Ana metin',help:'Birincil okunabilir metin rengi'},
 {key:'muted',label:'İkincil metin',help:'Açıklamalar ve yardımcı metinler'},
 {key:'border',label:'Kenarlık',help:'Kart ve kontrol ayırıcıları'},
 {key:'brandGreen',label:'Marka yeşili',help:'Birincil aksiyon ve marka vurgusu'},
 {key:'onGreen',label:'Yeşil üzeri metin',help:'Yeşil butonların yazı rengi'},
 {key:'brandGold',label:'Marka altını',help:'Premium vurgu ve odak rengi'},
 {key:'onGold',label:'Altın üzeri metin',help:'Altın yüzeylerin yazı rengi'},
 {key:'brandEarth',label:'Toprak tonu',help:'İkincil marka aksanı'},
];

function message(error:unknown){const raw=error instanceof Error?error.message:String(error||'');if(raw.includes('super_admin_required'))return'Bu görünüm yalnız Super Admin tarafından yönetilebilir.';if(raw.includes('insufficient_brand_text_contrast'))return'Ana metin ile arka plan kontrastı en az 4.5:1 olmalıdır.';if(raw.includes('insufficient_brand_green_contrast'))return'Yeşil buton metni kontrastı en az 4.5:1 olmalıdır.';if(raw.includes('insufficient_brand_gold_contrast'))return'Altın buton metni kontrastı en az 4.5:1 olmalıdır.';return raw||'Marka görünümü işlemi tamamlanamadı.';}

export default function AdminAppearance(){
 const[value,setValue]=useState<BrandAppearance|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const issues=useMemo(()=>value?brandAppearanceContrastIssues(value):[],[value]);
 const load=async()=>{try{setLoading(true);setError('');setValue(await superAdminGetBrandAppearance());}catch(err){setError(message(err));}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const patchToken=(key:keyof BrandAppearanceTokens,next:string)=>setValue(current=>current?{...current,tokens:{...current.tokens,[key]:next.toUpperCase().slice(0,7)}}:current);
 async function save(){if(!value||saving)return;const validation=brandAppearanceContrastIssues(value);if(validation.length){setError(validation[0]);return;}try{setSaving(true);setError('');setStatus('');const saved=await superAdminUpdateBrandAppearance(value);setValue(saved);applyBrandAppearance(saved,{applyDefaultWhenUnchosen:false});setStatus('Marka görünümü Supabase’e kaydedildi ve canlı uygulama sözleşmesi doğrulandı.');}catch(err){setError(message(err));}finally{setSaving(false);}}
 if(loading)return<div role="status" className="flex min-h-64 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true"/>Canlı marka görünümü yükleniyor…</div>;
 if(!value)return<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error||'Marka görünümü yüklenemedi.'}<button type="button" onClick={()=>void load()} className="mt-4 block min-h-11 rounded-xl border px-4 font-semibold"><RefreshCw className="mr-2 inline h-4 w-4" aria-hidden="true"/>Tekrar dene</button></div>;
 const textContrast=contrastRatio(value.tokens.text,value.tokens.background).toFixed(2),greenContrast=contrastRatio(value.tokens.onGreen,value.tokens.brandGreen).toFixed(2),goldContrast=contrastRatio(value.tokens.onGold,value.tokens.brandGold).toFixed(2);
 return<div className="space-y-6">
  <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold"><Palette className="h-4 w-4" aria-hidden="true"/>Super Admin</div><h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Görünüm ve Marka Teması</h2><p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Arka plan, kart yüzeyi, metinler ve marka renklerini kod açmadan yönetir. Sunucu, kritik metin ve buton kontrastlarını en az 4.5:1 olarak zorunlu tutar.</p></div><button type="button" onClick={()=>void load()} disabled={saving} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50"><RefreshCw className="mr-2 inline h-4 w-4" aria-hidden="true"/>Canlı değeri yenile</button></header>
  {error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>:null}{status?<div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200">{status}</div>:null}
  <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
   <div className="rounded-3xl border bg-white p-5 shadow-sm dark:bg-gray-800">
    <h3 className="font-bold">Tema davranışı</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-semibold">Varsayılan tema</span><select value={value.defaultTheme} onChange={e=>setValue({...value,defaultTheme:e.target.value as AppTheme})} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3">{APP_THEME_OPTIONS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label><span className="text-sm font-semibold">Marka temasının renk şeması</span><select value={value.colorScheme} onChange={e=>setValue({...value,colorScheme:e.target.value as'light'|'dark'})} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3"><option value="light">Açık sistem şeması</option><option value="dark">Koyu sistem şeması</option></select></label></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(field=><label key={field.key} className="rounded-2xl border p-3"><span className="block text-sm font-bold">{field.label}</span><span className="mt-0.5 block text-xs text-gray-500">{field.help}</span><div className="mt-3 flex items-center gap-2"><input type="color" aria-label={`${field.label} renk seçici`} value={value.tokens[field.key]} onChange={e=>patchToken(field.key,e.target.value)} className="h-12 w-14 cursor-pointer rounded-lg border bg-transparent p-1"/><input aria-label={`${field.label} HEX değeri`} value={value.tokens[field.key]} onChange={e=>patchToken(field.key,e.target.value)} pattern="#[0-9A-Fa-f]{6}" maxLength={7} className="min-h-12 min-w-0 flex-1 rounded-xl border bg-transparent px-3 font-mono uppercase"/></div></label>)}</div>
   </div>
   <div className="space-y-5">
    <section className="rounded-3xl border p-5" style={{background:value.tokens.background,color:value.tokens.text,borderColor:value.tokens.border}}><div className="flex items-center gap-2 text-sm font-bold" style={{color:value.tokens.brandGold}}><Eye className="h-4 w-4" aria-hidden="true"/>Canlı önizleme</div><div className="mt-4 rounded-2xl border p-4" style={{background:value.tokens.card,borderColor:value.tokens.border}}><h3 className="text-xl font-bold">Golden Oremar</h3><p className="mt-2 text-sm" style={{color:value.tokens.muted}}>Bu kart Super Admin’in seçtiği gerçek token’larla önizlenir.</p><div className="mt-4 grid gap-2"><button type="button" className="min-h-11 rounded-xl px-4 font-bold" style={{background:value.tokens.brandGreen,color:value.tokens.onGreen}}>Birincil aksiyon</button><button type="button" className="min-h-11 rounded-xl px-4 font-bold" style={{background:value.tokens.brandGold,color:value.tokens.onGold}}>Premium aksiyon</button></div></div></section>
    <section className="rounded-3xl border bg-white p-5 dark:bg-gray-800"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-green" aria-hidden="true"/><h3 className="font-bold">Erişilebilirlik doğrulaması</h3></div><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>Metin / arka plan</dt><dd className="font-mono font-bold">{textContrast}:1</dd></div><div className="flex justify-between gap-4"><dt>Yeşil buton</dt><dd className="font-mono font-bold">{greenContrast}:1</dd></div><div className="flex justify-between gap-4"><dt>Altın buton</dt><dd className="font-mono font-bold">{goldContrast}:1</dd></div></dl>{issues.length?<div role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{issues.join(' ')}</div>:<div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true"/>Zorunlu kontrastlar uygun.</div>}</section>
    <button type="button" onClick={()=>{setPersonalTheme('custom');applyBrandAppearance(value,{applyDefaultWhenUnchosen:false});setStatus('Marka teması bu cihazda önizleme için etkinleştirildi.');}} className="min-h-12 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green"><Eye className="mr-2 inline h-5 w-5" aria-hidden="true"/>Marka temasını bu cihazda uygula</button>
    <button type="button" onClick={()=>void save()} disabled={saving||issues.length>0} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save className="mr-2 inline h-5 w-5" aria-hidden="true"/>{saving?'Kaydediliyor…':'Görünümü Supabase’e Kaydet'}</button>
   </div>
  </section>
 </div>;
}
