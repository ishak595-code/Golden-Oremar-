import React, { useEffect, useState } from 'react';
import { Check, Globe2, Loader2, Palette, RefreshCw, Save, Settings2, Store, X } from 'lucide-react';
import { adminGetBrandConfiguration, adminUpdateBrandSection, contentAdminErrorMessage, type AdminBrandConfig } from './contentAdminApi';

type Tab = 'general' | 'contact' | 'home';

type GeneralState = { siteName: string; logoUrl: string; theme: 'light' | 'dark'; maintenanceMode: boolean };
type ContactState = { address: string; phone: string; whatsapp: string; email: string; mapUrl: string; social: Record<string, string> };
type HeroItem = { id: string; title: string; subtitle: string; image: string; icon: string; targetCategory: string };
type HomeSection = { id: string; title: string; active: boolean };

const SOCIALS = ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin'] as const;

export function AdminSettings({ setActiveTab: _setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [tab, setTab] = useState<Tab>('general');
  const [config, setConfig] = useState<AdminBrandConfig | null>(null);
  const [general, setGeneral] = useState<GeneralState>({ siteName: 'Golden Oremar', logoUrl: '', theme: 'light', maintenanceMode: false });
  const [contact, setContact] = useState<ContactState>({ address: '', phone: '', whatsapp: '', email: '', mapUrl: '', social: {} });
  const [heroCategories, setHeroCategories] = useState<HeroItem[]>([]);
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const hydrate = (next: AdminBrandConfig) => {
    const publicConfig = next.publicConfig || {};
    const appSettings = publicConfig.appSettings || {};
    const contactInfo = publicConfig.contactInfo || {};
    setConfig(next);
    setGeneral({
      siteName: next.brandName || 'Golden Oremar',
      logoUrl: String(appSettings.logoUrl || ''),
      theme: appSettings.theme === 'dark' ? 'dark' : 'light',
      maintenanceMode: next.maintenanceMode === true,
    });
    setContact({
      address: String(contactInfo.address || ''),
      phone: String(contactInfo.phone || next.supportPhone || ''),
      whatsapp: String(contactInfo.whatsapp || ''),
      email: String(contactInfo.email || next.supportEmail || ''),
      mapUrl: String(contactInfo.mapUrl || ''),
      social: contactInfo.social && typeof contactInfo.social === 'object' ? Object.fromEntries(Object.entries(contactInfo.social).map(([key, value]) => [key, String(value || '')])) : {},
    });
    setHeroCategories(Array.isArray(publicConfig.heroCategories) ? publicConfig.heroCategories.map((item: any) => ({
      id: String(item.id || ''),
      title: String(item.title || ''),
      subtitle: String(item.subtitle || ''),
      image: String(item.image || ''),
      icon: String(item.icon || ''),
      targetCategory: String(item.targetCategory || ''),
    })) : []);
    setHomeSections(Array.isArray(publicConfig.homeSections) ? publicConfig.homeSections.map((item: any) => ({ id: String(item.id || ''), title: String(item.title || ''), active: item.active === true })) : []);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      hydrate(await adminGetBrandConfiguration());
    } catch (err) {
      setError(contentAdminErrorMessage(err, 'Site ayarları yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveGeneral = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await adminUpdateBrandSection('general', {
        siteName: general.siteName.trim(),
        logoUrl: general.logoUrl.trim(),
        theme: general.theme,
        maintenanceMode: general.maintenanceMode,
      });
      hydrate(await adminGetBrandConfiguration());
      showToast('Genel uygulama ayarları kaydedildi.');
    } catch (err) {
      setError(contentAdminErrorMessage(err, 'Genel ayarlar kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await adminUpdateBrandSection('contactInfo', {
        address: contact.address.trim(),
        phone: contact.phone.trim(),
        whatsapp: contact.whatsapp.trim(),
        email: contact.email.trim(),
        mapUrl: contact.mapUrl.trim(),
        social: Object.fromEntries(SOCIALS.map(platform => [platform, String(contact.social[platform] || '').trim()])),
      });
      hydrate(await adminGetBrandConfiguration());
      showToast('İletişim ve sosyal medya bilgileri kaydedildi.');
    } catch (err) {
      setError(contentAdminErrorMessage(err, 'İletişim ayarları kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const saveHome = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await adminUpdateBrandSection('heroCategories', { items: heroCategories });
      await adminUpdateBrandSection('homeSections', { items: homeSections });
      hydrate(await adminGetBrandConfiguration());
      showToast('Ana sayfa vitrin ayarları kaydedildi.');
    } catch (err) {
      setError(contentAdminErrorMessage(err, 'Ana sayfa ayarları kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const updateHero = (index: number, patch: Partial<HeroItem>) => setHeroCategories(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateSection = (index: number, patch: Partial<HomeSection>) => setHomeSections(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  if (loading) return <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Canlı ayarlar yükleniyor...</div>;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Uygulama ve Marka Ayarları</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Firebase, sahte seed verisi ve cihazda data URL logo kaydı kaldırıldı. Bu ekran Golden Oremar'ın canlı Supabase marka yapılandırmasını yönetir.</p></div><button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-gray-200 px-4 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"><RefreshCw className="mr-2 inline h-4 w-4" aria-hidden="true"/>Yenile</button></header>

    {config?.publicConfig?.launchReadiness?.status && <section className={`rounded-2xl border p-4 text-sm ${String(config.publicConfig.launchReadiness.status).startsWith('blocked') ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100' : 'border-green-200 bg-green-50 text-green-950'}`}><strong>Canlı satış hazırlığı:</strong> {String(config.publicConfig.launchReadiness.status)}{config.publicConfig.launchReadiness.reason ? ` - ${String(config.publicConfig.launchReadiness.reason)}` : ''}</section>}

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

    <nav className="flex gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700" aria-label="Ayar bölümleri"><TabButton active={tab==='general'} onClick={()=>setTab('general')} icon={<Settings2 className="h-4 w-4"/>}>Genel</TabButton><TabButton active={tab==='contact'} onClick={()=>setTab('contact')} icon={<Globe2 className="h-4 w-4"/>}>İletişim</TabButton><TabButton active={tab==='home'} onClick={()=>setTab('home')} icon={<Store className="h-4 w-4"/>}>Ana Sayfa Vitrini</TabButton></nav>

    {tab === 'general' && <section className="max-w-3xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-center gap-2"><Palette className="h-5 w-5 text-brand-green"/><h3 className="font-bold text-gray-900 dark:text-white">Genel görünüm ve erişim</h3></div><div className="mt-5 space-y-4"><Field label="Marka / uygulama adı"><input minLength={2} maxLength={80} value={general.siteName} onChange={event=>setGeneral({...general,siteName:event.target.value})}/></Field><Field label="Kalıcı logo yolu veya HTTPS URL"><input maxLength={2048} value={general.logoUrl} onChange={event=>setGeneral({...general,logoUrl:event.target.value})} placeholder="/logo.svg veya https://..."/></Field><Field label="Varsayılan tema"><select value={general.theme} onChange={event=>setGeneral({...general,theme:event.target.value as 'light'|'dark'})}><option value="light">Açık</option><option value="dark">Koyu</option></select></Field><label className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div><div className="font-semibold text-gray-900 dark:text-white">Bakım modu</div><div className="mt-1 text-xs text-gray-500">Müşteri tarafını geçici olarak bakım durumuna alır.</div></div><input type="checkbox" checked={general.maintenanceMode} onChange={event=>setGeneral({...general,maintenanceMode:event.target.checked})} className="h-5 w-5"/></label><button type="button" disabled={saving || general.siteName.trim().length<2} onClick={()=>void saveGeneral()} className="min-h-11 rounded-xl bg-brand-green px-5 font-semibold text-white disabled:opacity-50">{saving ? 'Kaydediliyor...' : <><Save className="mr-2 inline h-4 w-4"/>Genel ayarları kaydet</>}</button></div></section>}

    {tab === 'contact' && <section className="max-w-4xl rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><h3 className="font-bold text-gray-900 dark:text-white">İletişim ve sosyal kanallar</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Destek e-postası"><input type="email" maxLength={320} value={contact.email} onChange={event=>setContact({...contact,email:event.target.value})}/></Field><Field label="Telefon"><input maxLength={40} value={contact.phone} onChange={event=>setContact({...contact,phone:event.target.value})}/></Field><Field label="WhatsApp"><input maxLength={40} value={contact.whatsapp} onChange={event=>setContact({...contact,whatsapp:event.target.value})}/></Field><Field label="Harita bağlantısı"><input maxLength={2048} value={contact.mapUrl} onChange={event=>setContact({...contact,mapUrl:event.target.value})}/></Field><div className="sm:col-span-2"><Field label="Açık adres"><textarea rows={3} maxLength={500} value={contact.address} onChange={event=>setContact({...contact,address:event.target.value})}/></Field></div>{SOCIALS.map(platform=><Field key={platform} label={platform.charAt(0).toUpperCase()+platform.slice(1)}><input maxLength={2048} value={contact.social[platform]||''} onChange={event=>setContact({...contact,social:{...contact.social,[platform]:event.target.value}})}/></Field>)}</div><button type="button" disabled={saving} onClick={()=>void saveContact()} className="mt-5 min-h-11 rounded-xl bg-brand-green px-5 font-semibold text-white disabled:opacity-50"><Save className="mr-2 inline h-4 w-4"/>İletişim ayarlarını kaydet</button></section>}

    {tab === 'home' && <div className="space-y-5"><section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><h3 className="font-bold text-gray-900 dark:text-white">Hero kategori kartları</h3><p className="mt-1 text-xs text-gray-500">1 ile 12 kart. Her kart gerçek kategori hedefi taşır.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{heroCategories.map((item,index)=><div key={`${item.id}-${index}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="flex items-start justify-between gap-3"><strong className="text-gray-900 dark:text-white">Kart {index+1}</strong><button type="button" onClick={()=>setHeroCategories(current=>current.filter((_,i)=>i!==index))} disabled={heroCategories.length<=1} className="min-h-11 min-w-11 rounded-xl text-red-600 disabled:opacity-30" aria-label={`Kart ${index+1} sil`}><X className="mx-auto h-4 w-4"/></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Kimlik"><input maxLength={80} value={item.id} onChange={event=>updateHero(index,{id:event.target.value})}/></Field><Field label="Başlık"><input maxLength={120} value={item.title} onChange={event=>updateHero(index,{title:event.target.value})}/></Field><Field label="Alt başlık"><input maxLength={180} value={item.subtitle} onChange={event=>updateHero(index,{subtitle:event.target.value})}/></Field><Field label="Kategori hedefi"><input maxLength={120} value={item.targetCategory} onChange={event=>updateHero(index,{targetCategory:event.target.value})}/></Field><Field label="İkon"><input maxLength={80} value={item.icon} onChange={event=>updateHero(index,{icon:event.target.value})}/></Field><Field label="Kalıcı görsel"><input maxLength={2048} value={item.image} onChange={event=>updateHero(index,{image:event.target.value})}/></Field></div></div>)}</div><button type="button" disabled={heroCategories.length>=12} onClick={()=>setHeroCategories(current=>[...current,{id:`kategori-${current.length+1}`,title:'Yeni Kategori',subtitle:'',image:'',icon:'',targetCategory:''}])} className="mt-4 min-h-11 rounded-xl border border-brand-green px-4 font-semibold text-brand-green disabled:opacity-40">Yeni hero kartı ekle</button></section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><h3 className="font-bold text-gray-900 dark:text-white">Ana sayfa ürün bölümleri</h3><div className="mt-4 space-y-3">{homeSections.map((section,index)=><div key={`${section.id}-${index}`} className="grid gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700 sm:grid-cols-[180px_minmax(0,1fr)_auto]"><Field label="Kimlik"><input maxLength={80} value={section.id} onChange={event=>updateSection(index,{id:event.target.value})}/></Field><Field label="Başlık"><input maxLength={160} value={section.title} onChange={event=>updateSection(index,{title:event.target.value})}/></Field><label className="flex min-h-11 items-center gap-2 self-end"><input type="checkbox" checked={section.active} onChange={event=>updateSection(index,{active:event.target.checked})}/>Aktif</label></div>)}</div><button type="button" disabled={homeSections.length>=20} onClick={()=>setHomeSections(current=>[...current,{id:`section-${current.length+1}`,title:'Yeni Bölüm',active:true}])} className="mt-4 min-h-11 rounded-xl border border-brand-green px-4 font-semibold text-brand-green disabled:opacity-40">Yeni bölüm ekle</button></section>

      <button type="button" disabled={saving || heroCategories.length<1 || homeSections.length<1} onClick={()=>void saveHome()} className="min-h-12 rounded-xl bg-brand-green px-6 font-bold text-white disabled:opacity-50"><Save className="mr-2 inline h-5 w-5"/>{saving ? 'Kaydediliyor...' : 'Ana sayfa vitrini kaydet'}</button>
    </div>}

    {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400"/>{toast}</div>}
    <style>{`.settings-field{width:100%;min-height:44px;border:1px solid rgb(209 213 219);border-radius:.75rem;padding:.7rem .8rem;background:transparent}.dark .settings-field{border-color:rgb(55 65 81)}`}</style>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactElement;key?:React.Key}){return <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>{React.cloneElement(children,{className:'settings-field'})}</label>}
function TabButton({active,onClick,icon,children}:{active:boolean;onClick:()=>void;icon:React.ReactNode;children:React.ReactNode}){return <button type="button" onClick={onClick} className={`flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 font-semibold ${active?'border-brand-green text-brand-green':'border-transparent text-gray-500'}`}>{icon}{children}</button>}
