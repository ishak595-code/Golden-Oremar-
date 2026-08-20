import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Bug,
  Calendar,
  CheckSquare,
  CreditCard,
  Crown,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  PackagePlus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tags,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
  X,
  Megaphone,
} from 'lucide-react';
import { useCustomerSession } from '../features/auth/useCustomerSession';
import { getPublicStorefrontConfig } from '../features/storefront/api';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';

interface AdminLayoutProps { children: React.ReactNode; activeTab: string; setActiveTab: (tab: string) => void; onLogout: () => void | Promise<void>; onBack?: () => void; }
type MenuItem = { id: string; label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }>; superAdminOnly?: boolean; };
type MenuGroup = { title: string; items: MenuItem[] };

const ADMIN_MENU_GROUPS: MenuGroup[] = [
  { title: 'Genel', items: [{ id: 'dashboard', label: 'Panel', icon: LayoutDashboard },{id:'production-readiness',label:'Üretim Hazırlığı',icon:Rocket,superAdminOnly:true}] },
  { title: 'E-Ticaret', items: [
    { id: 'official-store-products', label: 'Resmi Mağaza Ürünleri', icon: PackagePlus, superAdminOnly: true },
    { id: 'products', label: 'Ürün Yönetimi', icon: ShoppingBag },
    { id: 'product-approvals', label: 'Ürün Onayları', icon: CheckSquare },
    { id: 'product-removal', label: 'Güvenli Ürün Kaldırma', icon: Trash2, superAdminOnly: true },
    { id: 'categories', label: 'Kategoriler', icon: Tags },
    { id: 'orders', label: 'Siparişler', icon: Package },
    { id: 'returns', label: 'İadeler', icon: RotateCcw },
    { id: 'stock', label: 'Stok Gözetimi', icon: TrendingUp },
    { id: 'shipping-readiness', label: 'Kargo Hazırlığı', icon: Package, superAdminOnly: true },
    { id: 'vendors', label: 'Satıcılar', icon: Store },
    { id: 'storefronts', label: 'Premium Mağaza Vitrinleri', icon: Sparkles, superAdminOnly: true },
    { id: 'vendor-applications', label: 'Satıcı Başvuruları', icon: FileText },
    { id: 'users', label: 'Kullanıcılar', icon: Users },
    { id: 'reviews', label: 'Yorumlar', icon: Star },
  ]},
  { title: 'Pazarlama ve Finans', items: [
    { id: 'campaigns', label: 'Kampanyalar', icon: Megaphone },
    { id: 'finance', label: 'Muhasebe ve Finans', icon: DollarSign },
    { id: 'producer-payouts', label: 'Satıcı Ödeme ve IBAN', icon: DollarSign, superAdminOnly: true },
    { id: 'payment-controls', label: 'Ödeme Altyapısı', icon: CreditCard, superAdminOnly: true },
    { id: 'transactional-emails', label: 'Makbuz E-posta Kuyruğu', icon: Mail, superAdminOnly: true },
    { id: 'notifications', label: 'Bildirim Merkezi', icon: Bell },
  ]},
  { title: 'Sahip ve Güvenlik', items: [
    { id: 'business-compliance', label: 'İşletme ve Yasal Uyum', icon: FileText, superAdminOnly: true },
    { id: 'role-governance', label: 'Yetki ve Super Admin', icon: Crown, superAdminOnly: true },
    { id: 'account-erasure', label: 'Kapalı Hesap Yönetimi', icon: UserCog, superAdminOnly: true },
    { id: 'system-errors', label: 'Günlük Sistem Hataları', icon: Bug, superAdminOnly: true },
  ]},
  { title: 'İçerik ve Sistem', items: [
    { id: 'content', label: 'İçerik Kütüphanesi', icon: FileText },
    { id: 'events', label: 'Etkinlikler', icon: Calendar },
    { id: 'producer-event-submissions', label: 'Köylü Etkinlik Onayları', icon: CheckSquare, superAdminOnly: true },
    { id: 'settings', label: 'Ayarlar', icon: Settings },
  ]},
];

export function AdminLayout({ children, activeTab, setActiveTab, onLogout, onBack }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandLoading, setBrandLoading] = useState(true);
  const { currentUser } = useCustomerSession();
  const sidebarRef = useAccessibleDialog<HTMLElement>(isSidebarOpen, () => setIsSidebarOpen(false));
  const roles = Array.isArray(currentUser?.roles) ? currentUser.roles.map(String) : [];
  const isSuperAdmin = roles.includes('super_admin');
  const visibleMenuGroups = useMemo(() => ADMIN_MENU_GROUPS.map(group => ({ ...group, items: group.items.filter(item => !item.superAdminOnly || isSuperAdmin) })).filter(group => group.items.length > 0), [isSuperAdmin]);
  const activeItem = useMemo(() => visibleMenuGroups.flatMap(group => group.items).find(item => item.id === activeTab), [activeTab, visibleMenuGroups]);
  const userName = String((currentUser as any)?.name || (currentUser as any)?.display_name || (currentUser as any)?.email || 'Yetkili yönetici');

  useEffect(() => {
    let cancelled = false;
    const loadBrand = async () => {
      try { const config = await getPublicStorefrontConfig('tr'); if (!cancelled) setBrandName(config.brand.name); }
      catch { if (!cancelled) setBrandName(''); }
      finally { if (!cancelled) setBrandLoading(false); }
    };
    void loadBrand();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { setIsSidebarOpen(false); }, [activeTab]);
  useEffect(() => { const hidden = ADMIN_MENU_GROUPS.flatMap(group => group.items).find(item => item.id === activeTab)?.superAdminOnly && !isSuperAdmin; if (hidden) setActiveTab('dashboard'); }, [activeTab, isSuperAdmin, setActiveTab]);

  const navigate = (tab: string) => { setActiveTab(tab); setIsSidebarOpen(false); };
  const visibleBrandName = brandLoading ? 'Yönetim' : brandName || 'Yönetim';

  return <div className="min-h-screen bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
    {isSidebarOpen ? <button type="button" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Yönetim menüsünü kapat" tabIndex={-1}/> : null}
    <aside id="admin-sidebar" ref={sidebarRef} tabIndex={-1} role={isSidebarOpen ? 'dialog' : undefined} aria-modal={isSidebarOpen ? true : undefined} className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white shadow-2xl transition-transform duration-200 dark:border-gray-700 dark:bg-gray-800 lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Yönetici menüsü">
      <div className="flex min-h-20 items-center justify-between gap-3 border-b border-gray-200 px-5 dark:border-gray-700">
        <button type="button" onClick={() => navigate('dashboard')} className="min-w-0 text-left focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label={`${visibleBrandName} yönetim ana sayfası`}><div className="truncate text-xl font-black text-brand-green dark:text-brand-gold">{visibleBrandName}</div><div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Yönetim Paneli</div></button>
        <button type="button" onClick={() => setIsSidebarOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden" aria-label="Menüyü kapat"><X className="mx-auto h-5 w-5" aria-hidden="true"/></button>
      </div>
      <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-5" aria-label="Panel navigasyonu">{visibleMenuGroups.map(group => <div key={group.title}><h2 className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">{group.title}</h2><div className="mt-2 space-y-1">{group.items.map(item => { const Icon=item.icon; const active=activeTab===item.id; return <button key={item.id} type="button" onClick={()=>navigate(item.id)} aria-current={active?'page':undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold ${active?'bg-brand-green text-brand-on-green shadow-sm':'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}><Icon className="h-5 w-5 shrink-0" aria-hidden="true"/><span>{item.label}</span></button>;})}</div></div>)}</nav>
      <div className="space-y-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="rounded-xl bg-white p-3 dark:bg-gray-900/60"><div className="truncate text-sm font-bold text-gray-900 dark:text-white">{userName}</div><div className="mt-1 text-xs text-gray-500">{isSuperAdmin?'Super Admin - Uygulama Sahibi':'Admin - Yetkili Personel'}</div></div>
        {onBack ? <button type="button" onClick={onBack} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border bg-white px-4 font-semibold dark:bg-gray-700"><ArrowLeft className="h-5 w-5" aria-hidden="true"/>Ana uygulamaya dön</button> : null}
        <button type="button" onClick={() => void onLogout()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300"><LogOut className="h-5 w-5" aria-hidden="true"/>Güvenli çıkış</button>
      </div>
    </aside>
    <div className="min-h-screen lg:pl-72"><header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 sm:px-6 lg:px-8"><button type="button" onClick={() => setIsSidebarOpen(true)} className="min-h-11 min-w-11 rounded-xl p-2 lg:hidden" aria-label="Yönetim menüsünü aç" aria-expanded={isSidebarOpen} aria-controls="admin-sidebar"><Menu className="mx-auto h-6 w-6" aria-hidden="true"/></button>{activeTab!=='dashboard'?<button type="button" onClick={()=>navigate('dashboard')} className="min-h-11 min-w-11 rounded-xl p-2" aria-label="Panele dön"><ArrowLeft className="mx-auto h-5 w-5" aria-hidden="true"/></button>:null}<div className="min-w-0 flex-1"><div className="truncate text-lg font-bold text-gray-900 dark:text-white">{activeItem?.label||'Panel'}</div><div className="hidden text-xs text-gray-500 sm:block">Canlı yönetim operasyonları</div></div><button type="button" onClick={()=>navigate('notifications')} className="min-h-11 min-w-11 rounded-xl p-2" aria-label="Bildirim merkezini aç"><Bell className="mx-auto h-5 w-5" aria-hidden="true"/></button><button type="button" onClick={()=>window.location.reload()} className="min-h-11 min-w-11 rounded-xl p-2" aria-label="Uygulama görünümünü yenile"><RefreshCw className="mx-auto h-5 w-5" aria-hidden="true"/></button></header><main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl">{children}</div></main></div>
  </div>;
}