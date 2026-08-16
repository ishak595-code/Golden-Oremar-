import React, { useState } from 'react';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminDashboard } from '../admin/AdminDashboard';
import { AdminProducts } from '../admin/AdminProducts';
import { AdminOrders } from '../admin/AdminOrders';
import { AdminUsers } from '../admin/AdminUsers';
import { AdminContent } from '../admin/AdminContent';
import { AdminSettings } from '../admin/AdminSettings';
import { AdminCategories } from '../admin/AdminCategories';
import { AdminVendors } from '../admin/AdminVendors';
import { AdminStock } from '../admin/AdminStock';
import { AdminReviews } from '../admin/AdminReviews';
import { AdminCampaigns } from '../admin/AdminCampaigns';
import { AdminFinance } from '../admin/AdminFinance';
import { AdminNotifications } from '../admin/AdminNotifications';
import { AdminVendorApplications } from '../admin/AdminVendorApplications';
import { AdminEvents } from '../admin/AdminEvents';
import { VendorFinance } from '../admin/VendorFinance';
import { AdminVendorProfile } from '../admin/AdminVendorProfile';
import { useCustomerSession } from '../features/auth/useCustomerSession';

interface AdminPageProps {
  onLogout: () => void;
  onBack?: () => void;
}

export function AdminPage({ onLogout, onBack }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { currentUser, authReady } = useCustomerSession();

  const roles = Array.isArray(currentUser?.roles) ? currentUser.roles.map(String) : [];
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isVendor = roles.includes('producer') || currentUser?.role === 'vendor';
  const canEnterPanel = Boolean(currentUser && (isAdmin || isVendor));

  if (!authReady) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 dark:bg-gray-900" aria-busy="true">
        <div className="text-center" role="status" aria-live="polite">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-green dark:border-gray-700 dark:border-t-brand-green" aria-hidden="true" />
          <p className="mt-4 font-medium text-gray-700 dark:text-gray-200">Güvenli oturum doğrulanıyor...</p>
        </div>
      </main>
    );
  }

  if (!canEnterPanel) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Yetkisiz Erişim</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Bu yönetim alanı yalnızca yetkili yönetici ve doğrulanmış üretici hesaplarına açıktır.</p>
          <button type="button" onClick={onBack} className="min-h-11 px-6 py-2 bg-brand-green text-white rounded-xl font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2">
            Ana Sayfaya Dön
          </button>
        </div>
      </main>
    );
  }

  const renderContent = () => {
    if (activeTab === 'dashboard') return <AdminDashboard setActiveTab={setActiveTab} />;
    if (activeTab === 'profile') return <AdminVendorProfile setActiveTab={setActiveTab} />;
    if (activeTab === 'products') return <AdminProducts setActiveTab={setActiveTab} />;
    if (activeTab === 'product-approvals') return <AdminProducts setActiveTab={setActiveTab} initialView="pending" />;
    if (activeTab === 'orders') return <AdminOrders setActiveTab={setActiveTab} />;
    if (activeTab === 'stock') return <AdminStock setActiveTab={setActiveTab} />;
    if (activeTab === 'finance') return isVendor && !isAdmin ? <VendorFinance /> : <AdminFinance />;

    if (!isAdmin) {
      return (
        <div className="flex items-center justify-center h-full px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Yetkisiz Erişim</h2>
            <p className="text-gray-500 dark:text-gray-400">Bu bölüm yalnızca yönetici hesaplarına açıktır.</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'users': return <AdminUsers />;
      case 'content': return <AdminContent setActiveTab={setActiveTab} />;
      case 'settings': return <AdminSettings setActiveTab={setActiveTab} />;
      case 'categories': return <AdminCategories setActiveTab={setActiveTab} />;
      case 'vendors': return <AdminVendors setActiveTab={setActiveTab} />;
      case 'reviews': return <AdminReviews />;
      case 'campaigns': return <AdminCampaigns />;
      case 'notifications': return <AdminNotifications />;
      case 'vendor-applications': return <AdminVendorApplications />;
      case 'events': return <AdminEvents setActiveTab={setActiveTab} />;
      default: return <AdminDashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} onBack={onBack} onLogout={onLogout}>
      {renderContent()}
    </AdminLayout>
  );
}
