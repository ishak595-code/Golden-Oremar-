import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckSquare,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  RotateCcw,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Tags,
  TrendingUp,
  Users,
  X,
  Megaphone,
} from 'lucide-react';
import { useCustomerSession } from '../features/auth/useCustomerSession';
import { getPublicStorefrontConfig } from '../features/storefront/api';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onBack?: () => void;
}

type MenuItem = { id: string; label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }> };
type MenuGroup = { title: string; items: MenuItem[] };

const adminMenuGroups: MenuGroup[] = [
  { title: 'Genel', items: [{ id: 'dashboard', label: 'Panel', icon: LayoutDashboard }] },
  {
    title: 'E-Ticaret',
    items: [
      { id: 'products', label: 'Ürün Yönetimi', icon: ShoppingBag },
      { id: 'product-approvals', label: 'Ürün Onayları', icon: CheckSquare },
      { id: 'categories', label: 'Kategoriler', icon: Tags },
      { id: 'orders', label: 'Siparişler', icon: Package },
      { id: 'returns', label: 'İadeler', icon: RotateCcw },
      { id: 'stock', label: 'Stok Gözetimi', icon: TrendingUp },
      { id: 'vendors', label: 'Satıcılar', icon: Store },
      { id: 'vendor-applications', label: 'Satıcı Başvuruları', icon: FileText },
      { id: 'users', label: 'Kullanıcılar', icon: Users },
      { id: 'reviews', label: 'Yorumlar', icon: Star },
    ],
  },
  {
    title: 'Pazarlama ve Finans',
    items: [
      { id: 'campaigns', label: 'Kampanyalar', icon: Megaphone },
      { id: 'finance', label: 'Finans Raporları', icon: DollarSign },
      { id: 'notifications', label: 'Bildirim Merkezi', icon: Bell },
    ],
  },
  {
    title: 'İçerik ve Sistem',
    items: [
      { id: 'content', label: 'İçerik Kütüphanesi', icon: FileText },
      { id: 'events', label: 'Etkinlikler', icon: Calendar },
      { id: 'settings', label: 'Ayarlar', icon: Settings },
    ],
  },
];

const vendorMenuGroups: MenuGroup[] = [
  { title: 'Genel', items: [{ id: 'dashboard', label: 'Panel', icon: LayoutDashboard }] },
  {
    title: 'Mağaza Yönetimi',
    items: [
      { id: 'profile', label: 'Mağaza Profili', icon: Store },
      { id: 'products', label: 'Ürünlerim', icon: ShoppingBag },
      { id: 'orders', label: 'Siparişlerim', icon: Package },
      { id: 'stock', label: 'Stok ve Parti Yönetimi', icon: TrendingUp },
      { id: 'finance', label: 'Finans ve Hakediş', icon: DollarSign },
    ],
  },
];

export function AdminLayout({ children, activeTab, setActiveTab, onLogout, onBack }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState('Golden Oremar');
  const [brandLoading, setBrandLoading] = useState(true);
  const { currentUser } = useCustomerSession();

  const roles = useMemo(() => Array.isArray(currentUser?.roles) ? currentUser.roles.map(String) : [], [currentUser?.roles]);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isVendor = !isAdmin && (roles.includes('producer') || currentUser?.role === 'vendor');
  const menuGroups = isVendor ? vendorMenuGroups : adminMenuGroups;
  const userName = String((currentUser as any)?.name || (currentUser as any)?.display_name || (currentUser as any)?.email || (isVendor ? 'Satıcı' : 'Yönetici'));

  const activeItem = useMemo(() => menuGroups.flatMap(group => group.items).find(item => item.id === activeTab), [menuGroups, activeTab]);

  useEffect(() => {
    let cancelled = false;
    const loadBrand = async () => {
      try {
        const config = await getPublicStorefrontConfig('tr');
        const name = String(config?.brand?.name || '').trim();
        if (!cancelled && name) setBrandName(name);
      } catch {
        if (!cancelled) setBrandName('Golden Oremar');
      } finally {
        if (!cancelled) setBrandLoading(false);
      }
    };
    void loadBrand();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
      {isSidebarOpen && <button type="button" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Yönetim menüsünü kapat" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white shadow-2xl transition-transform duration-200 dark:border-gray-700 dark:bg-gray-800 lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label={isVendor ? 'Satıcı menüsü' : 'Yönetici menüsü'}
      >
        <div className="flex min-h-20 items-center justify-between gap-3 border-b border-gray-200 px-5 dark:border-gray-700">
          <button type="button" onClick={() => navigate('dashboard')} className="min-w-0 text-left" aria-label={`${brandName} panel ana sayfası`}>
            <div className="truncate text-xl font-black text-brand-green dark:text-brand-gold">{brandLoading ? 'Golden Oremar' : brandName}</div>
            <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{isVendor ? 'Satıcı Paneli' : 'Yönetim Paneli'}</div>
          </button>
          <button type="button" onClick={() => setIsSidebarOpen(false)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden" aria-label="Menüyü kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button>
        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-5" aria-label="Panel navigasyonu">
          {menuGroups.map(group => <div key={group.title}><h2 className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">{group.title}</h2><div className="mt-2 space-y-1">{group.items.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return <button key={item.id} type="button" onClick={() => navigate(item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold transition ${active ? 'bg-brand-green text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}><Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span>{item.label}</span></button>;
          })}</div></div>)}
        </nav>

        <div className="space-y-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="rounded-xl bg-white p-3 dark:bg-gray-900/60"><div className="truncate text-sm font-bold text-gray-900 dark:text-white">{userName}</div><div className="mt-1 text-xs text-gray-500">{isVendor ? 'Doğrulanmış üretici oturumu' : isAdmin ? 'Yönetici oturumu' : 'Yetkili oturum'}</div></div>
          {onBack && <button type="button" onClick={onBack} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"><ArrowLeft className="h-5 w-5" aria-hidden="true" /> Ana uygulamaya dön</button>}
          <button type="button" onClick={onLogout} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300"><LogOut className="h-5 w-5" aria-hidden="true" /> Güvenli çıkış</button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setIsSidebarOpen(true)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden" aria-label="Yönetim menüsünü aç" aria-expanded={isSidebarOpen}><Menu className="mx-auto h-6 w-6" aria-hidden="true" /></button>
          {activeTab !== 'dashboard' && <button type="button" onClick={() => navigate('dashboard')} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Panele dön"><ArrowLeft className="mx-auto h-5 w-5" aria-hidden="true" /></button>}
          <div className="min-w-0 flex-1"><div className="truncate text-lg font-bold text-gray-900 dark:text-white">{activeItem?.label || 'Panel'}</div><div className="hidden text-xs text-gray-500 sm:block">{isVendor ? 'Mağazanızın canlı operasyonları' : 'Golden Oremar canlı yönetim operasyonları'}</div></div>
          {isAdmin && <button type="button" onClick={() => navigate('notifications')} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Bildirim merkezini aç"><Bell className="mx-auto h-5 w-5" aria-hidden="true" /></button>}
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="Uygulama görünümünü yenile"><RefreshCw className="mx-auto h-5 w-5" aria-hidden="true" /></button>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
