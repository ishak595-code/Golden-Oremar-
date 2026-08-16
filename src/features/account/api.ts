
import { supabase } from '../../lib/supabase';
import type { Address, AccountOverview, OrdersPage } from './types';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getAccountOverview(): Promise<AccountOverview> {
  const { data, error } = await supabase.rpc('get_my_account_overview_v1');
  return unwrap<AccountOverview>(data, error);
}

export async function updateProfile(input: {
  displayName: string;
  phone?: string | null;
  locale: string;
  marketingConsent: boolean;
}) {
  const { data, error } = await supabase.rpc('update_customer_profile', {
    p_display_name: input.displayName,
    p_phone: input.phone ?? null,
    p_locale: input.locale,
    p_marketing_consent: input.marketingConsent,
  });
  return unwrap(data, error);
}

export async function upsertAddress(address: Address) {
  const { data, error } = await supabase.rpc('upsert_customer_address', {
    p_address_id: address.id ?? null,
    p_label: address.label,
    p_recipient_name: address.recipient_name,
    p_phone: address.phone,
    p_country_code: address.country_code,
    p_province: address.province,
    p_district: address.district,
    p_neighborhood: address.neighborhood ?? null,
    p_address_line: address.address_line,
    p_postal_code: address.postal_code ?? null,
    p_delivery_notes: address.delivery_notes ?? null,
    p_is_default: address.is_default,
  });
  return unwrap(data, error);
}

export async function deleteAddress(addressId: string) {
  const { data, error } = await supabase.rpc('delete_customer_address', {
    p_address_id: addressId,
  });
  return unwrap<boolean>(data, error);
}

export async function listOrders(limit = 20, offset = 0): Promise<OrdersPage> {
  const { data, error } = await supabase.rpc('list_my_orders_v1', {
    p_limit: limit,
    p_offset: offset,
  });
  return unwrap<OrdersPage>(data, error);
}

export async function getOrderDetail(orderId: string) {
  const { data, error } = await supabase.rpc('get_my_order_detail_v1', {
    p_order_id: orderId,
  });
  return unwrap(data, error);
}

export async function cancelOrder(orderId: string) {
  const { data, error } = await supabase.rpc('cancel_customer_order', {
    p_order_id: orderId,
  });
  return unwrap(data, error);
}

export async function listFavorites() {
  const { data, error } = await supabase.rpc('list_my_favorites_v1');
  return unwrap<any[]>(data, error);
}

export async function toggleFavorite(productReference: string) {
  const { data, error } = await supabase.rpc('toggle_customer_favorite', {
    p_product_reference: productReference,
  });
  return unwrap(data, error);
}

export async function listFollowedProducers() {
  const { data, error } = await supabase.rpc('list_my_followed_producers_v1');
  return unwrap<any[]>(data, error);
}

export async function toggleProducerFollow(producerId: string) {
  const { data, error } = await supabase.rpc('toggle_producer_follow_v1', {
    p_producer_id: producerId,
  });
  return unwrap(data, error);
}

export async function listGiftOrders() {
  const { data, error } = await supabase.rpc('list_my_gift_orders_v1');
  return unwrap<any[]>(data, error);
}

export async function listPaymentActivity(limit = 20, offset = 0) {
  const { data, error } = await supabase.rpc('list_my_payment_activity_v1', {
    p_limit: limit,
    p_offset: offset,
  });
  return unwrap<any>(data, error);
}

export async function getNotificationPreferences() {
  const { data, error } = await supabase.rpc('get_my_notification_preferences_v1');
  return unwrap<any>(data, error);
}

export async function updateNotificationPreferences(input: any) {
  const { data, error } = await supabase.rpc('update_my_notification_preferences_v1', {
    p_push_enabled: input.pushEnabled,
    p_order_push: input.orderPush,
    p_payment_push: input.paymentPush,
    p_shipment_push: input.shipmentPush,
    p_return_push: input.returnPush,
    p_message_push: input.messagePush,
    p_review_push: input.reviewPush,
    p_producer_push: input.producerPush,
    p_system_push: input.systemPush,
    p_campaign_push: input.campaignPush,
  });
  return unwrap(data, error);
}

export async function requestAccountClosure(reason: string) {
  const { data, error } = await supabase.rpc('request_account_closure_v1', {
    p_reason: reason,
  });
  return unwrap(data, error);
}

export async function cancelAccountClosure() {
  const { data, error } = await supabase.rpc('cancel_account_closure_v1');
  return unwrap(data, error);
}

export function catalogPublicUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = supabase.storage.from('catalog-public').getPublicUrl(path.replace(/^\/+/, ''));
  return data.publicUrl;
}


export async function getAccountHelpContent(locale = 'tr') {
  const { data, error } = await supabase.rpc('get_account_help_content_v1', {
    p_locale: locale,
  });
  return unwrap<any>(data, error);
}

export async function signOutCurrentDevice() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function signOutOtherDevices() {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw error;
}

export async function signOutAllDevices() {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
}


export async function getMyProducerDashboard() {
  const { data, error } = await supabase.rpc('get_my_producer_dashboard_v1');
  return unwrap<any>(data, error);
}

export async function getMyProducerApplicationDraft(applicationId?: string | null) {
  const { data, error } = await supabase.rpc('get_my_producer_application_draft_v4', {
    p_application_id: applicationId ?? null,
  });
  return unwrap<any>(data, error);
}

export async function updateProducerInventory(input: {
  variantId: string;
  availableQuantity: number;
  reorderLevel: number;
  expectedVersion: number;
}) {
  const key = `stock_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_-]/g, '');
  const { data, error } = await supabase.rpc('producer_update_inventory_v1', {
    p_variant_id: input.variantId,
    p_available_quantity: input.availableQuantity,
    p_reorder_level: input.reorderLevel,
    p_expected_version: input.expectedVersion,
    p_idempotency_key: key,
  });
  return unwrap<any>(data, error);
}

export async function withdrawProducerProductChange(changeRequestId: string) {
  const { data, error } = await supabase.rpc('producer_withdraw_product_change_v1', {
    p_change_request_id: changeRequestId,
  });
  return unwrap<boolean>(data, error);
}


export async function listNotifications(limit = 50, before?: string | null) {
  const { data, error } = await supabase.rpc('list_my_notifications_v1', {
    p_limit: limit,
    p_before: before ?? null,
  });
  return unwrap<any>(data, error);
}

export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase.rpc('mark_notification_read_v1', {
    p_notification_id: notificationId,
  });
  return unwrap<any>(data, error);
}

export async function markAllNotificationsRead() {
  const { data, error } = await supabase.rpc('mark_all_notifications_read_v1');
  return unwrap<number>(data, error);
}


export async function getPrivateAssetSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('user-private').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadCustomerAvatar(userId: string, file: File) {
  const allowed = ['image/jpeg','image/png','image/webp','image/avif'];
  if (!allowed.includes(file.type)) throw new Error('Profil fotoğrafı JPEG, PNG, WebP veya AVIF olmalıdır.');
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('Profil fotoğrafı en fazla 5 MB olabilir.');

  const extension =
    file.type === 'image/jpeg' ? 'jpg' :
    file.type === 'image/png' ? 'png' :
    file.type === 'image/avif' ? 'avif' : 'webp';

  const path = `${userId}/avatar/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('user-private').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('update_customer_avatar_v1', {
    p_avatar_path: path,
  });
  if (error) {
    await supabase.storage.from('user-private').remove([path]).catch(()=>{});
    throw error;
  }
  return data as { avatar_path: string };
}

export async function removeCustomerAvatar(currentPath?: string | null) {
  const { data, error } = await supabase.rpc('update_customer_avatar_v1', {
    p_avatar_path: null,
  });
  if (error) throw error;
  if (currentPath) {
    await supabase.storage.from('user-private').remove([currentPath]).catch(()=>{});
  }
  return data;
}


export async function changeMyPassword(currentPassword: string, newPassword: string) {
  if (currentPassword.length < 1) throw new Error('Mevcut şifrenizi yazın.');
  if (newPassword.length < 8 || newPassword.length > 72) throw new Error('Yeni şifre 8-72 karakter arasında olmalıdır.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = userData.user?.email;
  if (!email) throw new Error('Bu hesap için parola tabanlı e-posta kimliği bulunamadı.');

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError) throw new Error('Mevcut şifre doğrulanamadı.');

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw updateError;

  return true;
}


export async function getMyNewsletterStatus() {
  const { data, error } = await supabase.rpc('get_my_newsletter_status_v1');
  return unwrap<any>(data, error);
}

export async function subscribeNewsletter(email: string, locale = 'tr') {
  const { data, error } = await supabase.rpc('subscribe_newsletter_v1', {
    p_email: email.trim().toLowerCase(),
    p_locale: locale,
    p_consent_version: 'newsletter-consent-v1-2026-08-16',
    p_source: 'mobile-app-settings',
  });
  return unwrap<any>(data, error);
}

export async function unsubscribeMyNewsletter() {
  const { data, error } = await supabase.rpc('unsubscribe_my_newsletter_v1');
  return unwrap<boolean>(data, error);
}

export async function registerNativePushToken(input: {
  provider: 'fcm' | 'apns';
  platform: 'android' | 'ios';
  token: string;
  environment: 'development' | 'production';
}) {
  const { data, error } = await supabase.rpc('register_push_token_v1', {
    p_provider: input.provider,
    p_platform: input.platform,
    p_token: input.token,
    p_environment: input.environment,
  });
  return unwrap<any>(data, error);
}

export async function unregisterNativePushDevice(deviceId: string) {
  const { data, error } = await supabase.rpc('unregister_push_device_v1', {
    p_device_id: deviceId,
  });
  return unwrap<boolean>(data, error);
}
