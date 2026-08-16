import React, { useState, useEffect } from 'react';
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
import { useData } from '../context/DataContext';

interface AdminPageProps {
  onLogout: () => void;
  onBack?: () => void;
}

export function AdminPage({ onLogout, onBack }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { currentUser } = useData();

  const userEmail = currentUser?.email?.toLowerCase() || '';
  const isAuthenticated = currentUser && (['admin', 'super_admin', 'vendor'].includes(currentUser.role) || userEmail === 'ramcofero.yt@gmail.com' || userEmail === 'goldenoremar@gmail.com');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Yetkisiz Erişim</h1>
          <p className="text-gray-500 mb-6">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
          <button onClick={onBack} className="px-6 py-2 bg-brand-green text-white rounded-xl font-medium">
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const isVendor = currentUser?.role === 'vendor';

    // Vendor-only or shared tabs
    if (activeTab === 'dashboard') return <AdminDashboard setActiveTab={setActiveTab} />;
    if (activeTab === 'profile') return <AdminVendorProfile setActiveTab={setActiveTab} />;
    if (activeTab === 'products') return <AdminProducts setActiveTab={setActiveTab} />;
    if (activeTab === 'product-approvals') return <AdminProducts setActiveTab={setActiveTab} initialView="pending" />;
    if (activeTab === 'orders') return <AdminOrders setActiveTab={setActiveTab} />;
    if (activeTab === 'stock') return <AdminStock setActiveTab={setActiveTab} />;
    if (activeTab === 'finance') return isVendor ? <VendorFinance /> : <AdminFinance setActiveTab={setActiveTab} />;

    // Admin-only tabs
    if (isVendor) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Yetkisiz Erişim</h2>
            <p className="text-gray-500">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
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
