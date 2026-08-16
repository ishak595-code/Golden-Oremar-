import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Users, FileText, Settings, 
  LogOut, Menu, X, Bell, Search, Package, Calendar, BarChart3,
  MessageSquare, ArrowLeft, RefreshCw, Tags, Store, TrendingUp, Star, Megaphone, DollarSign, CheckSquare
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onBack?: () => void;
}

import { useData } from '../context/DataContext';

export function AdminLayout({ children, activeTab, setActiveTab, onLogout, onBack }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { settings, currentUser } = useData();

  const userRole = currentUser?.role || 'user';
  const userName = currentUser?.name || 'Kullanıcı';

  const adminMenuGroups = [
    {
      title: 'Genel',
      items: [
        { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
      ]
    },
    {
      title: 'E-Ticaret',
      items: [
        { id: 'products', label: 'Ürün Yönetimi', icon: ShoppingBag },
        { id: 'product-approvals', label: 'Satıcı Ürün Onayları', icon: CheckSquare },
        { id: 'categories', label: 'Kategoriler', icon: Tags },
        { id: 'orders', label: 'Siparişler', icon: Package },
        { id: 'stock', label: 'Stok Yönetimi', icon: TrendingUp },
        { id: 'vendors', label: 'Satıcılar', icon: Store },
        { id: 'vendor-applications', label: 'Satıcı Başvuruları', icon: FileText },
        { id: 'users', label: 'Kullanıcılar', icon: Users },
        { id: 'reviews', label: 'Yorumlar', icon: Star },
      ]
    },
    {
      title: 'Pazarlama & Finans',
      items: [
        { id: 'campaigns', label: 'Kampanyalar', icon: Megaphone },
        { id: 'finance', label: 'Finans Raporları', icon: DollarSign },
        { id: 'notifications', label: 'Bildirimler', icon: Bell },
      ]
    },
    {
      title: 'İçerik & Sistem',
      items: [
        { id: 'content', label: 'İçerik Yönetimi', icon: FileText },
        { id: 'events', label: 'Etkinlikler', icon: Calendar },
        { id: 'settings', label: 'Ayarlar', icon: Settings },
      ]
    }
  ];

  const vendorMenuGroups = [
    {
      title: 'Genel',
      items: [
        { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Mağaza Yönetimi',
      items: [
        { id: 'profile', label: 'Mağaza Profili', icon: Store },
        { id: 'products', label: 'Ürünlerim', icon: ShoppingBag },
        { id: 'orders', label: 'Siparişlerim', icon: Package },
        { id: 'stock', label: 'Stok Durumu', icon: TrendingUp },
        { id: 'finance', label: 'Finans / Gelir-Gider', icon: DollarSign },
      ]
    }
  ];

  const menuGroups = userRole === 'vendor' ? vendorMenuGroups : adminMenuGroups;

  if (activeTab !== 'dashboard') {
    const activeItem = menuGroups.flatMap(g => g.items).find(i => i.id === activeTab);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col font-sans text-gray-800 dark:text-gray-200">
        <header className="h-16 bg-white dark:bg-gray-800 shadow-sm flex items-center px-4 lg:px-8 shrink-0 z-30 border-b border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Paneline Dön</span>
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {activeItem?.label || 'Uygulama'}
            </h2>
          </div>
          <div className="w-32"></div> {/* Spacer for centering */}
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex font-sans text-gray-800 dark:text-gray-200">
      {/* Sidebar (Drawer) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col border-r border-gray-200 dark:border-gray-700`}
        aria-label="Yönetici Menüsü"
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.siteName} className="h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-brand-gold rounded-full flex items-center justify-center text-white font-serif font-bold">
                {settings.siteName.charAt(0)}
              </div>
            )}
            <h1 className="text-xl font-bold text-brand-green dark:text-brand-gold font-serif">{settings.siteName} {userRole === 'vendor' ? 'Satıcı' : 'Admin'}</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg lg:hidden"
            aria-label="Menüyü Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8" aria-label="Ana Navigasyon">
          {menuGroups.map((group, idx) => (
            <div key={idx} role="group" aria-labelledby={`menu-group-${idx}`}>
              <h3 
                id={`menu-group-${idx}`}
                className="px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3"
              >
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-brand-green text-white shadow-md font-bold'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium'
                    }`}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                    aria-label={`${item.label} Sayfasına Git`}
                  >
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
          {onBack && (
            <button 
              onClick={onBack}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-bold"
              aria-label="Ana Sayfaya Dön"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              <span>Ana Sayfaya Dön</span>
            </button>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-bold"
            aria-label="Çıkış Yap"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        {/* Header */}
        <header className="h-20 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between px-6 lg:px-8 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors lg:hidden"
              aria-label="Menüyü Aç"
              aria-expanded={isSidebarOpen}
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white hidden sm:block">
              {menuGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.label || 'Panel'}
            </h2>
          </div>

          <div className="flex-1 max-w-xl mx-8 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-brand-green transition-colors" aria-hidden="true" />
              <input 
                type="text" 
                placeholder="Sipariş, ürün veya müşteri ara... (Ctrl+K)" 
                className="w-full pl-12 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 outline-none transition-all text-sm"
                aria-label="Global Arama"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button 
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative text-gray-600 dark:text-gray-300 transition-colors"
              aria-label="Bildirimler"
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
            </button>
            
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" aria-hidden="true"></div>
            
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              role="button"
              tabIndex={0}
              aria-label={`Kullanıcı Profili: ${userName}`}
            >
              <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-white font-bold shadow-md" aria-hidden="true">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-right">
                <div className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{userName}</div>
                <div className="text-xs text-gray-500">{userRole === 'vendor' ? 'Satıcı' : 'Yönetici'}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900/50" role="main">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}
    </div>
  );
}
