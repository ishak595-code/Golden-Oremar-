import { supabase } from '../../lib/supabase';

// Categories match the events the database really creates (see
// supabase/migrations/20261004170000_notification_preferences_v2.sql).
export const NOTIFICATION_CATEGORY_KEYS = [
  'order', 'shipment', 'payment', 'return', 'harvest', 'restock', 'message', 'review_reminder', 'review', 'campaign', 'system', 'producer',
] as const;
export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY_KEYS)[number];
// The inbox row of these categories can be switched off; the others always
// reach the inbox (order, payment, security...).
export const INBOX_OPTIONAL_CATEGORIES = new Set<NotificationCategoryKey>(['harvest', 'restock', 'review_reminder', 'campaign']);

export type ChannelChoice = { inApp: boolean; push: boolean };
export type NotificationPreferencesV2 = {
  pushEnabled: boolean;
  marketingConsent: boolean;
  categories: Record<NotificationCategoryKey, ChannelChoice>;
  quietHours: { enabled: boolean; start: string; end: string };
};
export type NotificationPreferencesPatch = {
  pushEnabled?: boolean;
  categories?: Partial<Record<NotificationCategoryKey, Partial<ChannelChoice>>>;
  quietHours?: Partial<NotificationPreferencesV2['quietHours']>;
};

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function normalizeNotificationPreferencesV2(value: unknown): NotificationPreferencesV2 {
  if (!isRecord(value) || !isRecord(value.categories)) throw new Error('Bildirim tercihleri doğrulanamadı.');
  const raw = value.categories;
  const categories = {} as Record<NotificationCategoryKey, ChannelChoice>;
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    const entry = isRecord(raw[key]) ? raw[key] as Record<string, unknown> : {};
    categories[key] = { inApp: INBOX_OPTIONAL_CATEGORIES.has(key) ? bool(entry.inApp, true) : true, push: bool(entry.push, key !== 'campaign') };
  }
  const quiet = isRecord(value.quietHours) ? value.quietHours : {};
  const start = typeof quiet.start === 'string' && TIME_RE.test(quiet.start) ? quiet.start : '22:00';
  const end = typeof quiet.end === 'string' && TIME_RE.test(quiet.end) ? quiet.end : '08:00';
  return { pushEnabled: bool(value.pushEnabled, true), marketingConsent: bool(value.marketingConsent, false), categories, quietHours: { enabled: bool(quiet.enabled, false), start, end } };
}

export async function getNotificationPreferencesV2() {
  const { data, error } = await supabase.rpc('get_my_notification_preferences_v2');
  if (error) throw error;
  return normalizeNotificationPreferencesV2(data);
}

export async function updateNotificationPreferencesV2(patch: NotificationPreferencesPatch) {
  const { data, error } = await supabase.rpc('update_my_notification_preferences_v2', { p_preferences: patch });
  if (error) throw error;
  return normalizeNotificationPreferencesV2(data);
}
