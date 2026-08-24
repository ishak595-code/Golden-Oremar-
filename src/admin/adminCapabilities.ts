import type { PermissionKey } from '../features/auth/permissions';

export const ADMIN_TAB_PERMISSIONS = {
  dashboard:'admin.access',
  'production-readiness':'system.read',
  'business-compliance':'system.configure',
  'release-setup':'system.configure',
  appearance:'system.configure',
  'official-store-products':'product.update',
  'product-health':'content.read',
  products:'product.read',
  'product-approvals':'product.moderate',
  'product-removal':'product.remove',
  orders:'order.read',
  returns:'refund.read',
  stock:'inventory.read',
  'shipping-readiness':'shipping.read',
  vendors:'seller.read',
  storefronts:'storefront.read',
  'store-follow-simulation':'system.configure',
  'vendor-applications':'seller.read',
  users:'user.read',
  reviews:'review.read',
  campaigns:'campaign.read',
  finance:'finance.read',
  'producer-payouts':'payout.read',
  'payment-controls':'payment.manage',
  'transactional-emails':'notification.manage',
  notifications:'notification.read',
  'role-governance':'role.manage',
  'account-erasure':'user.erase',
  'system-errors':'system.read',
  content:'content.read',
  events:'event.read',
  'producer-event-submissions':'event.moderate',
  settings:'system.configure',
  categories:'content.read',
} as const satisfies Record<string,PermissionKey>;

export type AdminTab = keyof typeof ADMIN_TAB_PERMISSIONS;
const TAB_SET=new Set<string>(Object.keys(ADMIN_TAB_PERMISSIONS));

export function isAdminTab(value:unknown):value is AdminTab{
  return typeof value==='string'&&TAB_SET.has(value);
}

export function permissionForAdminTab(tab:AdminTab):PermissionKey{
  return ADMIN_TAB_PERMISSIONS[tab];
}

export function firstAllowedAdminTab(can:(permission:PermissionKey)=>boolean):AdminTab|null{
  const preferred:AdminTab[]=['dashboard','product-approvals','reviews','orders','vendor-applications','products','content','events','finance','users'];
  for(const tab of preferred)if(can(permissionForAdminTab(tab)))return tab;
  for(const tab of Object.keys(ADMIN_TAB_PERMISSIONS) as AdminTab[])if(can(permissionForAdminTab(tab)))return tab;
  return null;
}
