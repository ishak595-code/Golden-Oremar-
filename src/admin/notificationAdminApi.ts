import { supabase } from '../lib/supabase';

export type NotificationTargetScope = 'all' | 'producer' | 'specific';
export type PlatformNotificationType = 'order' | 'payment' | 'shipment' | 'return' | 'campaign' | 'system' | 'producer';

const notificationScopes: NotificationTargetScope[] = ['all', 'producer', 'specific'];
const notificationTypes: PlatformNotificationType[] = ['order', 'payment', 'shipment', 'return', 'campaign', 'system', 'producer'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function normalizeActionUrl(value?: string | null) {
  const actionUrl = String(value || '').trim();
  if (!actionUrl) return null;
  if (actionUrl.length > 2048) throw new Error('Eylem bağlantısı 2048 karakteri aşamaz.');
  if (actionUrl.startsWith('/')) return actionUrl;
  try {
    const parsed = new URL(actionUrl);
    if (parsed.protocol !== 'https:') throw new Error('invalid_action_url');
    return parsed.toString();
  } catch {
    throw new Error('Bildirim eylem bağlantısı yalnız uygulama içi yol veya güvenli HTTPS adresi olabilir.');
  }
}

function validateScope(scope: NotificationTargetScope) {
  if (!notificationScopes.includes(scope)) throw new Error('Bildirim hedef kitlesi geçersiz.');
  return scope;
}

function normalizedTargetUserId(scope: NotificationTargetScope, userId?: string | null) {
  if (scope !== 'specific') return null;
  const id = String(userId || '').trim();
  if (!id) throw new Error('Belirli kullanıcı hedefinde kullanıcı seçilmelidir.');
  if (!UUID_RE.test(id)) throw new Error('Seçilen kullanıcı kimliği geçersiz.');
  return id;
}

function safeAudienceCount(value: unknown) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Bildirim hedef kitle sayısı doğrulanamadı.');
  return count;
}

export async function adminNotificationAudienceCount(scope: NotificationTargetScope, userId?: string | null) {
  const targetScope = validateScope(scope);
  const targetUserId = normalizedTargetUserId(targetScope, userId);
  const { data, error } = await supabase.rpc('admin_notification_audience_count_v1', {
    p_target_scope: targetScope,
    p_user_id: targetUserId,
  });
  return safeAudienceCount(unwrap<unknown>(data, error));
}

export async function adminBroadcastNotification(input: {
  scope: NotificationTargetScope;
  userId?: string | null;
  title: string;
  message: string;
  type: PlatformNotificationType;
  actionUrl?: string | null;
}) {
  const scope = validateScope(input.scope);
  const userId = normalizedTargetUserId(scope, input.userId);
  const title = input.title.trim();
  const message = input.message.trim();
  const actionUrl = normalizeActionUrl(input.actionUrl);
  if (!notificationTypes.includes(input.type)) throw new Error('Bildirim türü geçersiz.');
  if (title.length < 2 || title.length > 160) throw new Error('Bildirim başlığı 2 ile 160 karakter arasında olmalıdır.');
  if (message.length < 2 || message.length > 5000) throw new Error('Bildirim mesajı 2 ile 5000 karakter arasında olmalıdır.');
  const { data, error } = await supabase.rpc('admin_broadcast_notification_v1', {
    p_target_scope: scope,
    p_user_id: userId,
    p_title: title,
    p_message: message,
    p_type: input.type,
    p_action_url: actionUrl,
  });
  const result = unwrap<any>(data, error);
  const broadcastId = String(result?.broadcastId || result?.broadcast_id || '').trim();
  const recipientCount = safeAudienceCount(result?.recipientCount ?? result?.recipient_count);
  if (!UUID_RE.test(broadcastId)) throw new Error('Bildirim yayın kaydı doğrulanamadı.');
  return {
    broadcastId,
    recipientCount,
    targetScope: String(result?.targetScope || result?.target_scope || scope),
    type: String(result?.type || input.type),
  };
}

export function notificationAdminErrorMessage(error: unknown, fallback = 'Bildirim işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['invalid_notification_target_scope', 'Bildirim hedef kitlesi geçersiz.'],
    ['notification_target_user_required', 'Belirli kullanıcı gönderiminde kullanıcı seçilmelidir.'],
    ['notification_audience_empty', 'Seçilen hedef kitlede aktif alıcı bulunamadı.'],
    ['invalid_notification_content', 'Bildirim başlığı veya mesaj uzunluğu geçersiz.'],
    ['invalid_notification_type', 'Bildirim türü geçersiz.'],
    ['invalid_action_url', 'Bildirim eylem bağlantısı geçersiz veya çok uzun.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}
