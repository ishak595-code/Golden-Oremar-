import { supabase } from '../../lib/supabase';
import { isTheme, type AppTheme } from '../appearance/theme';
import { NOTIFICATION_SOUND_OPTIONS, type NotificationSoundId } from '../notifications/premiumSounds';

export type AppPreferences = {
  theme: AppTheme | null;
  notificationSound: NotificationSoundId;
  notificationSoundEnabled: boolean;
  updatedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSound(value: unknown): value is NotificationSoundId {
  return typeof value === 'string' && NOTIFICATION_SOUND_OPTIONS.some(option => option.id === value);
}

function normalize(value: unknown): AppPreferences {
  if (!isRecord(value)) throw new Error('Uygulama tercihleri sunucudan doğrulanamadı.');
  const theme = value.theme == null ? null : isTheme(value.theme) ? value.theme : null;
  if (value.theme != null && theme == null) throw new Error('Hesap tema tercihi doğrulanamadı.');
  if (!isSound(value.notificationSound)) throw new Error('Hesap bildirim sesi doğrulanamadı.');
  if (typeof value.notificationSoundEnabled !== 'boolean') throw new Error('Hesap bildirim sesi durumu doğrulanamadı.');
  const updatedAt = value.updatedAt == null ? null : typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt)) ? value.updatedAt : null;
  if (value.updatedAt != null && updatedAt == null) throw new Error('Uygulama tercih tarihi doğrulanamadı.');
  return { theme, notificationSound: value.notificationSound, notificationSoundEnabled: value.notificationSoundEnabled, updatedAt };
}

export async function getMyAppPreferences(): Promise<AppPreferences> {
  const { data, error } = await supabase.rpc('get_my_app_preferences_v1');
  if (error) throw error;
  return normalize(data);
}

export async function updateMyAppPreferences(input: {
  theme?: AppTheme;
  notificationSound?: NotificationSoundId;
  notificationSoundEnabled?: boolean;
}): Promise<AppPreferences> {
  if (input.theme !== undefined && !isTheme(input.theme)) throw new Error('Tema tercihi doğrulanamadı.');
  if (input.notificationSound !== undefined && !isSound(input.notificationSound)) throw new Error('Bildirim sesi tercihi doğrulanamadı.');
  if (input.notificationSoundEnabled !== undefined && typeof input.notificationSoundEnabled !== 'boolean') throw new Error('Bildirim sesi durumu doğrulanamadı.');
  if (input.theme === undefined && input.notificationSound === undefined && input.notificationSoundEnabled === undefined) throw new Error('Kaydedilecek uygulama tercihi bulunamadı.');
  const { data, error } = await supabase.rpc('update_my_app_preferences_v1', {
    p_theme: input.theme ?? null,
    p_notification_sound: input.notificationSound ?? null,
    p_notification_sound_enabled: input.notificationSoundEnabled ?? null,
  });
  if (error) throw error;
  return normalize(data);
}
