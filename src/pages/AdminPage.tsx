import { lazy, Suspense, useState } from 'react';
import { AdminLayout } from '../admin/AdminLayout';

const AdminDashboard = lazy(() => import('../admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminProducts = lazy(() => import('../admin/AdminProducts').then(module => ({ default: module.AdminProducts })));
const AdminProductRemoval = lazy(() => import('../admin/AdminProductRemoval').then(module => ({ default: module.AdminProductRemoval })));
const AdminOrders = lazy(() => import('../admin/AdminOrders').then(module => ({ default: module.AdminOrders })));
const AdminReturns = lazy(() => import('../admin/AdminReturns').then(module => ({ default: module.AdminReturns })));
const AdminUsers = lazy(() => import('../admin/AdminUsers').then(module => ({ default: module.AdminUsers })));
const AdminAccountErasure = lazy(() => import('../admin/AdminAccountErasure').then(module => ({ default: module.AdminAccountErasure })));
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
const AdminProducerEventSubmissions = lazy(() => import('../admin/AdminProducerEventSubmissions').then(module => ({ default: module.AdminProducerEventSubmissions })));

type AdminPageProps = { onLogout: () => void | Promise<void>; onBack?: () => void; };
function PanelLoading(){return <div className="flex min-h-[45vh] items-center justify-center px-6" aria-busy="true"><div className="text-center" role="status" aria-live="polite"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-green dark:border-gray-700 dark:border-t-brand-green" aria-hidden="true"/><p className="mt-4 font-medium text-gray-700 dark:text-gray-200">Yönetim bölümü yükleniyor…</p></div></div>;}
export function AdminPage({onLogout,onBack}:AdminPageProps){
 const[activeTab,setActiveTab]=useState('dashboard');
 const renderContent=()=>{switch(activeTab){
  case'dashboard':return<AdminDashboard setActiveTab={setActiveTab}/>;
  case'products':return<AdminProducts setActiveTab={setActiveTab}/>;
  case'product-approvals':return<AdminProducts setActiveTab={setActiveTab} initialView="pending"/>;
  case'product-removal':return<AdminProductRemoval/>;
  case'orders':return<AdminOrders setActiveTab={setActiveTab}/>;
  case'returns':return<AdminReturns/>;
  case'stock':return<AdminStock setActiveTab={setActiveTab}/>;
  case'finance':return<AdminFinance/>;
  case'users':return<AdminUsers/>;
  case'account-erasure':return<AdminAccountErasure/>;
  case'content':return<AdminContent setActiveTab={setActiveTab}/>;
  case'settings':return<AdminSettings setActiveTab={setActiveTab}/>;
  case'categories':return<AdminCategories setActiveTab={setActiveTab}/>;
  case'vendors':return<AdminVendors setActiveTab={setActiveTab}/>;
  case'reviews':return<AdminReviews/>;
  case'campaigns':return<AdminCampaigns/>;
  case'notifications':return<AdminNotifications/>;
  case'vendor-applications':return<AdminVendorApplications/>;
  case'events':return<AdminEvents setActiveTab={setActiveTab}/>;
  case'producer-event-submissions':return<AdminProducerEventSubmissions/>;
  default:return<AdminDashboard setActiveTab={setActiveTab}/>;
 }};
 return<AdminLayout activeTab={activeTab} setActiveTab={setActiveTab} onBack={onBack} onLogout={onLogout}><Suspense fallback={<PanelLoading/>}>{renderContent()}</Suspense></AdminLayout>;
}