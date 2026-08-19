export type AccountView =
  | 'home'
  | 'profile'
  | 'orders'
  | 'reviews'
  | 'addresses'
  | 'favorites'
  | 'followed-producers'
  | 'gifts'
  | 'payments'
  | 'notifications'
  | 'messages'
  | 'contact'
  | 'support'
  | 'seller'
  | 'producer-products'
  | 'producer-profile-edit'
  | 'settings';

export type AccountRole = 'customer' | 'producer' | 'support' | 'content_editor' | 'operations' | 'admin' | 'super_admin';
export type AccountLocale = 'tr' | 'en' | 'de' | 'fr' | 'ku' | 'ar';
export type ProfileStatus = 'active' | 'restricted' | 'blocked' | 'deleted';
export type OrderStatus = 'draft' | 'pending_payment' | 'confirmed' | 'preparing' | 'partially_shipped' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
export type OrderPaymentStatus = 'unpaid' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'failed' | 'disputed';
export type OrderFulfillmentStatus = 'unfulfilled' | 'processing' | 'partially_fulfilled' | 'fulfilled' | 'returned';
export type PaymentMethodType = 'card' | 'bank_transfer' | 'cash_on_delivery' | 'wallet' | 'other';
export type PaymentActivityStatus = 'created' | 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'partially_refunded' | 'refunded' | 'disputed';
export type NotificationType = 'order' | 'payment' | 'shipment' | 'return' | 'campaign' | 'system' | 'producer' | 'message' | 'review';
export type AccountClosureStatus = 'requested' | 'processing' | 'ready_for_auth_deletion' | 'completed' | 'cancelled' | 'rejected';
export type NewsletterStatus = 'none' | 'pending' | 'active' | 'unsubscribed' | 'bounced' | 'complained';

export interface AccountProfile {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_path: string | null;
  locale: AccountLocale;
  status: ProfileStatus;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export interface Address {
  id?: string;
  label: string;
  recipient_name: string;
  phone: string;
  country_code: string;
  province: string;
  district: string;
  neighborhood?: string | null;
  address_line: string;
  postal_code?: string | null;
  delivery_notes?: string | null;
  is_default: boolean;
  updated_at?: string;
}

export interface AccountSummary {
  favorite_count: number;
  address_count: number;
  order_count: number;
  active_order_count: number;
  return_count: number;
  gift_count: number;
  followed_producer_count: number;
  unread_notification_count: number;
}

export interface AccountRecentOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  fulfillment_status: OrderFulfillmentStatus;
  currency: string;
  total_minor: number;
  placed_at: string | null;
  created_at: string;
  gift: boolean;
}

export interface AccountProducerSummary {
  id: string;
  display_name: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected' | 'closed';
  is_verified: boolean;
  origin_verified: boolean;
  village: string | null;
  district: string | null;
  province: string | null;
}

export interface AccountClosureSummary {
  id: string;
  status: AccountClosureStatus;
  reason: string | null;
  requested_at: string;
  updated_at: string;
}

export interface AccountClosureRequestResult {
  id: string;
  status: 'requested' | 'processing' | 'ready_for_auth_deletion';
  requestedAt: string;
  unchanged: boolean;
  activeOrders: number | null;
  activeReturns: number | null;
}

export interface AccountClosureCancelResult {
  id: string;
  status: 'cancelled';
  cancelledAt: string;
}

export interface AccountOverview {
  profile: AccountProfile;
  roles: AccountRole[];
  addresses: Address[];
  summary: AccountSummary;
  recent_orders: AccountRecentOrder[];
  producer: AccountProducerSummary | null;
  account_closure: AccountClosureSummary | null;
}

export interface OrderPreviewItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  imagePath: string | null;
  lineTotalMinor: number;
}

export interface AccountOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  placedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  reservationExpiresAt: string | null;
  itemCount: number;
  previewItems: OrderPreviewItem[];
  gift: boolean;
  shipmentStatus: string | null;
  trackingNumber: string | null;
}

export interface OrdersPage {
  total: number;
  limit: number;
  offset: number;
  items: AccountOrderRow[];
}

export interface PaymentActivityItem {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: string;
  paymentMethodType: PaymentMethodType;
  amountMinor: number;
  currency: string;
  status: PaymentActivityStatus;
  failureCode: string | null;
  failureMessage: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentActivityPage {
  total: number;
  limit: number;
  offset: number;
  items: PaymentActivityItem[];
}

export interface FavoriteItem {
  productId: string;
  legacyId: string | null;
  slug: string;
  name: string;
  shortDescription: string;
  origin: string | null;
  currency: string;
  producer: {
    id: string;
    name: string;
    verified: boolean;
    originVerified: boolean;
    locationLabel: string;
  };
  variant: {
    id: string;
    name: string;
    priceMinor: number;
    compareAtPriceMinor: number | null;
  } | null;
  imagePath: string | null;
  available: boolean;
  favoritedAt: string;
}

export interface FollowedProducerItem {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  logoPath: string | null;
  coverPath: string | null;
  ratingAverage: number;
  ratingCount: number;
  verified: boolean;
  originVerified: boolean;
  locationLabel: string;
  location: {
    countryCode: string;
    province: string | null;
    district: string | null;
    village: string | null;
  };
  productCount: number;
  followedAt: string;
}

export interface GiftOrderItem {
  productName: string;
  variantName: string | null;
  quantity: number;
  imagePath: string | null;
}

export interface GiftOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  currency: string;
  totalMinor: number;
  placedAt: string | null;
  createdAt: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  message: string | null;
  senderName: string | null;
  hidePrice: boolean;
  items: GiftOrderItem[];
}

export interface NewsletterSummary {
  status: NewsletterStatus;
  email: string | null;
  locale: AccountLocale | null;
  consentVersion: string | null;
  consentedAt: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
}

export interface NewsletterSubscribeResult {
  id: string;
  status: 'pending' | 'active';
  email: string;
  unchanged: boolean;
}

export interface NativePushRegistrationResult {
  id: string;
  provider: 'fcm' | 'apns';
  platform: 'android' | 'ios';
  environment: 'development' | 'production';
  registered: true;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  orderPush: boolean;
  paymentPush: boolean;
  shipmentPush: boolean;
  returnPush: boolean;
  messagePush: boolean;
  reviewPush: boolean;
  producerPush: boolean;
  systemPush: boolean;
  campaignPush: boolean;
}

export interface AccountNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface NotificationsPage {
  unreadCount: number;
  items: AccountNotification[];
}
