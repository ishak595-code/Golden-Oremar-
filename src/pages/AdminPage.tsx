import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../admin/AdminLayout';
import { firstAllowedAdminTab, isAdminTab, permissionForAdminTab, type AdminTab } from '../admin/adminCapabilities';
import { useAuthorization } from '../features/auth/AuthorizationContext';
import StaffMfaGate from '../features/auth/StaffMfaGate';

const AdminDashboard = lazy(() => import('../admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminProductionReadiness = lazy(() => import('../admin/AdminProductionReadiness').then(module => ({ default: module.AdminProductionReadiness })));
const AdminBusinessCompliance = lazy(() => import('../admin/AdminBusinessCompliance').then(module => ({ default: module.AdminBusinessCompliance })));
const AdminReleaseSetup = lazy(() => import('../admin/AdminReleaseSetup').then(module => ({ default: module.AdminReleaseSetup })));
const AdminAppearance = lazy(() => import('../admin/AdminAppearance'));
const AdminProducts = lazy(() => import('../admin/AdminProducts').then(module => ({ default: module.AdminProducts })));
const AdminOfficialStoreWorkspace = lazy(() => import('../admin/AdminOfficialStoreWorkspace'));
const AdminProductHealth = lazy(() => import('../admin/AdminProductHealth').then(module => ({ default: module.AdminProductHealth })));
const AdminProductRemoval = lazy(() => import('../admin/AdminProductRemoval').then(module => ({ default: module.AdminProductRemoval })));
const AdminOrders = lazy(() => import('../admin/AdminOrders').then(module => ({ default: module.AdminOrders })));
const AdminReturns = lazy(() => import('../admin/AdminReturns').then(module => ({ default: module.AdminReturns })));
const AdminUsers = lazy(() => import('../admin/AdminUsers').then(module => ({ default: module.AdminUsers })));
const AdminAccountErasure = lazy(() => import('../admin/AdminAccountErasure').then(module => ({ default: module.AdminAccountErasure })));
const AdminRoleGovernance = lazy(() => import('../admin/AdminRoleGovernance').then(module => ({ default: module.AdminRoleGovernance })));
const AdminMfaSecurity = lazy(() => import('../admin/AdminMfaSecurity'));
const AdminSystemErrors = lazy(() => import('../admin/AdminSystemErrors').then(module => ({ default: module.AdminSystemErrors })));
const AdminContent = lazy(() => import('../admin/AdminContent').then(module => ({ default: module.AdminContent })));
const AdminSettings = lazy(() => import('../admin/AdminSettings').then(module => ({ default: module.AdminSettings })));
const AdminCategories = lazy(() => import('../admin/AdminCategories').then(module => ({ default: module.AdminCategories })));
const AdminVendors = lazy(() => import('../admin/AdminVendors').then(module => ({ default: module.AdminVendors })));
const AdminStorefronts = lazy(() => import('../admin/AdminStorefronts'));
const AdminStoreFollowSimulation = lazy(() => import('../admin/AdminStoreFollowSimulation'));
const AdminStock = lazy(() => import('../admin/AdminStock').then(module => ({ default: module.AdminStock })));
const AdminShippingReadiness = lazy(() => import('../admin/AdminShippingReadiness').then(module => ({ default: module.AdminShippingReadiness })));
const AdminReviews = lazy(() => import('../admin/AdminReviews').then(module => ({ default: module.AdminReviews })));
const AdminCampaigns = lazy(() => import('../admin/AdminCampaigns').then(module => ({ default: module.AdminCampaigns })));
const AdminFinance = lazy(() => import('../admin/AdminFinance').then(module => ({ default: module.AdminFinance })));
const AdminProducerPayouts = lazy(() => import('../admin/AdminProducerPayouts').then(module => ({ default: module.AdminProducerPayouts })));
const AdminPaymentControls = lazy(() => import('../admin/AdminPaymentControls').then(module => ({ default: module.AdminPaymentControls })));
const AdminTransactionalEmails = lazy(() => import('../admin/AdminTransactionalEmails').then(module => ({ default: module.AdminTransactionalEmails })));
const AdminNotifications = lazy(() => import('../admin/AdminNotifications').then(module => ({ default: module.AdminNotifications })));
const AdminVendorApplications = lazy(() => import('../admin/AdminVendorApplications').then(module => ({ default: module.AdminVendorApplications })));
const AdminEvents = lazy(() => import('../admin/AdminEvents').then(module => ({ default: module.AdminEvents })));
const AdminProducerEventSubmissions = lazy(() => import('../admin/AdminProducerEventSubmissions').then(module => ({ default: module.AdminProducerEventSubmissions })));

function safeAdminTab(value:unknown):AdminTab{const tab=String(value||'dashboard').trim();return isAdminTab(tab)?tab:'dashboard';}
type AdminPageProps={onLogout:()=>void|Promise<void>;onBack?:()=>void;initialTab?:string;};
function PanelLoading(){return <div className="flex min-h-[45vh] items-center justify-center px-6" aria-busy="true"><div className="text-center" role="status" aria-live="polite"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-green dark:border-gray-700 dark:border-t-brand-green" aria-hidden="true"/><p className="mt-4 font-medium text-gray-700 dark:text-gray-200">Yönetim bölümü yükleniyor…</p></div></div>;}
function AccessDenied(){return <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/60 dark:bg-gray-900"><h2 className="text-lg font-black text-gray-900 dark:text-white">Bu yönetim alanına erişim yok</h2><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Menü görünürlüğü yalnız kullanıcı deneyimidir. Sunucu da her işlemde capability kontrolünü yeniden uygular.</p></div>;}

export function AdminPage({onLogout,onBack,initialTab}:AdminPageProps){
 const{loading:authorizationLoading,can,snapshot,refresh}=useAuthorization();
 const[activeTab,setActiveTab]=useState<AdminTab>(()=>safeAdminTab(initialTab));
 const navigate=useCallback((value:string)=>{const tab=safeAdminTab(value);if(can(permissionForAdminTab(tab)))setActiveTab(tab);},[can]);
 useEffect(()=>{const requested=safeAdminTab(initialTab);if(authorizationLoading){setActiveTab(requested);return;}if(can(permissionForAdminTab(requested))){setActiveTab(requested);return;}const fallback=firstAllowedAdminTab(can);if(fallback)setActiveTab(fallback);},[initialTab,authorizationLoading,can]);
 useEffect(()=>{if(authorizationLoading)return;if(!can(permissionForAdminTab(activeTab))){const fallback=firstAllowedAdminTab(can);if(fallback&&fallback!==activeTab)setActiveTab(fallback);}},[activeTab,authorizationLoading,can]);
 if(authorizationLoading)return<PanelLoading/>;
 if(snapshot?.staffMfaRequired&&!snapshot.mfaSatisfied)return<StaffMfaGate factorEnrolled={snapshot.mfaFactorEnrolled} onVerified={refresh} onLogout={onLogout}/>;
 const fallback=firstAllowedAdminTab(can);
 if(!fallback)return<AccessDenied/>;
 if(!can(permissionForAdminTab(activeTab)))return<PanelLoading/>;
 const renderContent=()=>{switch(activeTab){case'dashboard':return<AdminDashboard setActiveTab={navigate}/>;case'production-readiness':return<AdminProductionReadiness setActiveTab={navigate}/>;case'business-compliance':return<AdminBusinessCompliance/>;case'release-setup':return<AdminReleaseSetup/>;case'appearance':return<AdminAppearance/>;case'official-store-products':return<AdminOfficialStoreWorkspace/>;case'product-health':return<AdminProductHealth/>;case'products':return<AdminProducts setActiveTab={navigate}/>;case'product-approvals':return<AdminProducts setActiveTab={navigate} initialView="pending"/>;case'product-removal':return<AdminProductRemoval/>;case'orders':return<AdminOrders setActiveTab={navigate}/>;case'returns':return<AdminReturns/>;case'stock':return<AdminStock setActiveTab={navigate}/>;case'shipping-readiness':return<AdminShippingReadiness/>;case'finance':return<AdminFinance/>;case'producer-payouts':return<AdminProducerPayouts/>;case'payment-controls':return<AdminPaymentControls/>;case'transactional-emails':return<AdminTransactionalEmails/>;case'users':return<AdminUsers/>;case'account-erasure':return<AdminAccountErasure/>;case'role-governance':return<AdminRoleGovernance/>;case'security-mfa':return<AdminMfaSecurity/>;case'system-errors':return<AdminSystemErrors/>;case'content':return<AdminContent setActiveTab={navigate}/>;case'settings':return<AdminSettings setActiveTab={navigate}/>;case'categories':return<AdminCategories setActiveTab={navigate}/>;case'vendors':return<AdminVendors setActiveTab={navigate}/>;case'storefronts':return<AdminStorefronts/>;case'store-follow-simulation':return<AdminStoreFollowSimulation/>;case'reviews':return<AdminReviews/>;case'campaigns':return<AdminCampaigns/>;case'notifications':return<AdminNotifications/>;case'vendor-applications':return<AdminVendorApplications/>;case'events':return<AdminEvents setActiveTab={navigate}/>;case'producer-event-submissions':return<AdminProducerEventSubmissions/>;default:return<AdminDashboard setActiveTab={navigate}/>;}};
 return<AdminLayout activeTab={activeTab} setActiveTab={tab=>navigate(tab)} onBack={onBack} onLogout={onLogout}><Suspense fallback={<PanelLoading/>}>{renderContent()}</Suspense></AdminLayout>;
}
