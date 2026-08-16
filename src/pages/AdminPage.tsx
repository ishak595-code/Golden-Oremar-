import { lazy, Suspense, useState } from 'react';
import { AdminLayout } from '../admin/AdminLayout';
import { useCustomerSession } from '../features/auth/useCustomerSession';

const AdminDashboard = lazy(() => import('../admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminProducts = lazy(() => import('../admin/AdminProducts').then(module => ({ default: module.AdminProducts })));
const AdminOrders = lazy(() => import('../admin/AdminOrders').then(module => ({ default: module.AdminOrders })));
const AdminReturns = lazy(() => import('../admin/AdminReturns').then(module => ({ default: module.AdminReturns })));
const AdminUsers = lazy(() => import('../admin/AdminUsers').then(module => ({ default: module.AdminUsers })));
const AdminContent = lazy(() => import('../admin/AdminContent').then(module => ({ default: module.AdminContent })));
const AdminSettings = lazy(() => import('../admin/AdminSettings').then(module => ({ default: module.AdminSettings })));
const AdminCategories = lazy(() => import('../admin/AdminCategories').then(module => ({ default: module.AdminCategories })));
const AdminVendors = lazy(() => import('../admin/AdminVendors').then(module => ({ default: module.AdminVendors })));
const AdminStock = lazy(() => import('../admin/AdminStock').then(module => ({ default: module.AdminStock })));
const AdminReviews = lazy(() => import('../admin/AdminReviews').then(module => ({ default: module.AdminReviews })));
const AdminCampaigns = lazy(() => import('../admin/AdminCampaigns').then(module => ({ default: module.AdminCampaigns })));
const AdminFinance = lazy(() => import('../admin/AdminFinance').then(module => ({ default: module.AdminFinance })));
const AdminNotifications = lazy(() => import('../admin/AdminNotifications').then(module => ({ default: module.AdminNotifications })));
const AdminVendorApplications = lazy(() => import('../admin/AdminVendorApplications').then(module => ({ default: module.AdminVendorApplications })));
const AdminEvents = lazy(() => import('../admin/AdminEvents').then(module => ({ default: module.AdminEvents })));
const ProducerProductManager = lazy(() => import('../features/producer-products/ProducerProductManager'));
const ProducerOrdersPanel = lazy(() => import('../features/producer-orders/ProducerOrdersPanel'));
const ProducerFinancePanel = lazy(() => import('../features/producer-finance/ProducerFinancePanel'));
const ProducerProfilePanel = lazy(() => import('../features/account/ProducerProfilePanel'));

interface AdminPageProps {
  onLogout: () => void;
  onBack?: () => void;
}

function PanelLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center px-6" aria-busy="true">
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-green dark:border-gray-700 dark:border-t-brand-green" aria-hidden="true" />
        <p className="mt-4 font-medium text-gray-700 dark:text-gray-200">Yönetim bölümü yükleniyor...</p>
      </div>
    </div>
  );
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

  const renderProducerContent = () => {
    if (!isVendor || isAdmin) return null;
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard setActiveTab={setActiveTab} />;
      case 'profile': return <ProducerProfilePanel />;
      case 'products': return <ProducerProductManager onBack={() => setActiveTab('dashboard')} />;
      case 'stock': return <ProducerProductManager onBack={() => setActiveTab('dashboard')} />;
      case 'orders': return <ProducerOrdersPanel onBack={() => setActiveTab('dashboard')} />;
      case 'finance': return <ProducerFinancePanel onBack={() => setActiveTab('dashboard')} />;
      default:
        return (
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Yetkisiz Erişim</h2>
              <p className="text-gray-500 dark:text-gray-400">Bu bölüm yalnızca yönetici hesaplarına açıktır.</p>
            </div>
          </div>
        );
    }
  };

  const renderAdminContent = () => {
    if (activeTab === 'dashboard') return <AdminDashboard setActiveTab={setActiveTab} />;
    if (activeTab === 'products') return <AdminProducts setActiveTab={setActiveTab} />;
    if (activeTab === 'product-approvals') return <AdminProducts setActiveTab={setActiveTab} initialView="pending" />;
    if (activeTab === 'orders') return <AdminOrders setActiveTab={setActiveTab} />;
    if (activeTab === 'returns') return <AdminReturns />;
    if (activeTab === 'stock') return <AdminStock setActiveTab={setActiveTab} />;
    if (activeTab === 'finance') return <AdminFinance />;

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
      <Suspense fallback={<PanelLoading />}>
        {isAdmin ? renderAdminContent() : renderProducerContent()}
      </Suspense>
    </AdminLayout>
  );
}
