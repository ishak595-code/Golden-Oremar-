export const CANONICAL_ROLES = [
  'customer',
  'producer',
  'support',
  'content_editor',
  'operations',
  'moderator',
  'admin',
  'super_admin',
] as const;

export type CanonicalRole = typeof CANONICAL_ROLES[number];

export const CANONICAL_PERMISSION_KEYS = [
  'admin.access',
  'user.read','user.manage','user.suspend','user.restore','user.erase',
  'role.read','role.manage',
  'seller.read','seller.sensitive_read','seller.review','seller.approve','seller.reject','seller.request_information','seller.suspend','seller.restore',
  'product.read','product.create','product.update','product.moderate','product.approve','product.reject','product.publish','product.health_manage','product.suspend','product.archive','product.remove',
  'review.read','review.moderate','review.publish','review.reject','review.remove',
  'report.read','report.moderate','message.moderate',
  'order.read','order.manage','order.cancel',
  'refund.read','refund.request','refund.approve','refund.execute',
  'finance.read','finance.manage',
  'payout.read','payout.request','payout.review','payout.release',
  'payment.read','payment.manage',
  'content.read','content.create','content.update','content.publish','content.moderate',
  'campaign.read','campaign.manage',
  'notification.read','notification.send','notification.manage',
  'support.read','support.manage',
  'audit.read','analytics.read',
  'security.read','security.manage',
  'mfa.self_manage',
  'system.read','system.configure',
  'inventory.read','inventory.manage',
  'shipping.read','shipping.manage',
  'event.read','event.manage','event.moderate',
  'storefront.read','storefront.manage','storefront.moderate',
] as const;

export type PermissionKey = typeof CANONICAL_PERMISSION_KEYS[number];

const CANONICAL_ROLE_SET = new Set<string>(CANONICAL_ROLES);
const CANONICAL_PERMISSION_SET = new Set<string>(CANONICAL_PERMISSION_KEYS);

export function isCanonicalRole(value: unknown): value is CanonicalRole {
  return typeof value === 'string' && CANONICAL_ROLE_SET.has(value);
}

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && CANONICAL_PERMISSION_SET.has(value);
}
