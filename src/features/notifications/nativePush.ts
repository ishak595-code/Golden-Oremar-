import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type Token } from '@capacitor/push-notifications';
import { registerNativePushToken, unregisterNativePushDevice } from '../account/api';

export type NativePushAction = {
  actionUrl: string | null;
  metadata: Record<string, unknown>;
};

export type NativePushRegistrationResult = {
  status: 'registered' | 'denied' | 'unsupported' | 'not-configured';
  deviceId?: string;
};

const DEVICE_ID_KEY = 'golden-oremar:push-device-id';
const PUSH_CHANNEL_ID = 'golden-oremar-updates';
const registrationTimeoutMs = 15000;
const subscribers = new Set<(action: NativePushAction) => void>();
const receiptSubscribers = new Set<() => void>();
const pendingActions: NativePushAction[] = [];
let pendingReceipt = false;
let listenersReady = false;
let listenersInitialization: Promise<void> | null = null;
let listenerHandles: PluginListenerHandle[] = [];
let pendingRegistration: {
  resolve: (result: NativePushRegistrationResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

function pushEnvironment(): 'development' | 'production' {
  const configured = String(import.meta.env.VITE_PUSH_ENVIRONMENT || '').trim().toLowerCase();
  if (configured === 'development') return 'development';
  if (configured === 'production') return 'production';
  return import.meta.env.DEV ? 'development' : 'production';
}

export function isNativePushPlatform() {
  return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios');
}

export function isNativePushProviderConfigured() {
  return isNativePushPlatform() && String(import.meta.env.VITE_NATIVE_PUSH_ENABLED || '').toLowerCase() === 'true';
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseAction(event: ActionPerformed): NativePushAction {
  const data = normalizeMetadata(event.notification?.data);
  let metadata: Record<string, unknown> = data;
  if (typeof data.metadata === 'string') {
    try { metadata = { ...data, ...normalizeMetadata(JSON.parse(data.metadata)) }; } catch { metadata = data; }
  } else if (data.metadata && typeof data.metadata === 'object') {
    metadata = { ...data, ...normalizeMetadata(data.metadata) };
  }
  const rawUrl = data.actionUrl ?? data.action_url ?? metadata.actionUrl ?? metadata.action_url;
  return { actionUrl: typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl.trim() : null, metadata };
}

function emitAction(action: NativePushAction) {
  if (!subscribers.size) {
    pendingActions.push(action);
    if (pendingActions.length > 10) pendingActions.splice(0, pendingActions.length - 10);
    return;
  }
  for (const subscriber of subscribers) subscriber(action);
}

function emitReceipt() {
  if (!receiptSubscribers.size) {
    pendingReceipt = true;
    return;
  }
  for (const subscriber of receiptSubscribers) subscriber();
}

function settleRegistration(error?: unknown, result?: NativePushRegistrationResult) {
  if (!pendingRegistration) return;
  clearTimeout(pendingRegistration.timer);
  const pending = pendingRegistration;
  pendingRegistration = null;
  if (error) pending.reject(error instanceof Error ? error : new Error(String(error)));
  else pending.resolve(result || { status: 'registered' });
}

async function handleRegistration(token: Token) {
  try {
    const platform = Capacitor.getPlatform();
    if (platform !== 'android' && platform !== 'ios') throw new Error('Desteklenmeyen push platformu.');
    const value = String(token.value || '').trim();
    if (!value) throw new Error('Cihaz bildirim anahtarı alınamadı.');
    const registered = await registerNativePushToken({
      provider: platform === 'android' ? 'fcm' : 'apns',
      platform,
      token: value,
      environment: pushEnvironment(),
    });
    const deviceId = String(registered?.id || '').trim();
    if (!deviceId) throw new Error('Cihaz bildirim kaydı doğrulanamadı.');
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    settleRegistration(undefined, { status: 'registered', deviceId });
  } catch (error) {
    settleRegistration(error);
  }
}

export async function initNativePushListeners() {
  if (!isNativePushPlatform() || listenersReady) return;
  if (listenersInitialization) return listenersInitialization;

  listenersInitialization = (async () => {
    const handles = await Promise.all([
      PushNotifications.addListener('registration', token => { void handleRegistration(token); }),
      PushNotifications.addListener('registrationError', event => {
        settleRegistration(new Error(String(event?.error || 'Cihaz push kaydı başarısız oldu.')));
      }),
      PushNotifications.addListener('pushNotificationReceived', () => {
        // A foreground push updates the in-app unread badge without forcing navigation.
        // The unread total remains server-authoritative.
        emitReceipt();
      }),
      PushNotifications.addListener('pushNotificationActionPerformed', event => {
        emitAction(parseAction(event));
      }),
    ]);
    listenerHandles = handles;
    listenersReady = true;
  })();

  try {
    await listenersInitialization;
  } finally {
    listenersInitialization = null;
  }
}

export function subscribeNativePushActions(listener: (action: NativePushAction) => void) {
  subscribers.add(listener);
  if (pendingActions.length) {
    const queued = pendingActions.splice(0, pendingActions.length);
    queueMicrotask(() => {
      for (const action of queued) listener(action);
    });
  }
  return () => { subscribers.delete(listener); };
}

export function subscribeNativePushReceipts(listener: () => void) {
  receiptSubscribers.add(listener);
  if (pendingReceipt) {
    pendingReceipt = false;
    queueMicrotask(listener);
  }
  return () => { receiptSubscribers.delete(listener); };
}

export async function clearNativeDeliveredNotifications() {
  if (!isNativePushPlatform()) return;
  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.warn('Delivered native notifications could not be cleared', error);
  }
}

export async function getNativePushPermission() {
  if (!isNativePushPlatform()) return 'unsupported' as const;
  const status = await PushNotifications.checkPermissions();
  return status.receive;
}

export async function enableNativePushRegistration(): Promise<NativePushRegistrationResult> {
  if (!isNativePushPlatform()) return { status: 'unsupported' };
  if (!isNativePushProviderConfigured()) return { status: 'not-configured' };
  await initNativePushListeners();

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return { status: 'denied' };

  if (Capacitor.getPlatform() === 'android') {
    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'Golden Oremar',
      description: 'Sipariş, ödeme, teslimat ve hesap bildirimleri',
    });
  }

  if (pendingRegistration) settleRegistration(new Error('Yeni cihaz kaydı başlatıldı.'));
  const result = new Promise<NativePushRegistrationResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingRegistration) pendingRegistration = null;
      reject(new Error('Cihaz bildirim kaydı zaman aşımına uğradı.'));
    }, registrationTimeoutMs);
    pendingRegistration = { resolve, reject, timer };
  });
  try {
    await PushNotifications.register();
  } catch (error) {
    settleRegistration(error);
  }
  return result;
}

export async function disableNativePushRegistration() {
  if (!isNativePushPlatform()) return;
  const deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  const providerConfigured = isNativePushProviderConfigured();
  if (deviceId) await unregisterNativePushDevice(deviceId);
  if (providerConfigured) await PushNotifications.unregister();
  window.localStorage.removeItem(DEVICE_ID_KEY);
  pendingActions.splice(0, pendingActions.length);
  pendingReceipt = false;
  await clearNativeDeliveredNotifications();
}

export async function removeNativePushListeners() {
  if (listenersInitialization) await listenersInitialization.catch(() => undefined);
  await Promise.all(listenerHandles.map(handle => handle.remove().catch(() => undefined)));
  listenerHandles = [];
  listenersReady = false;
  pendingActions.splice(0, pendingActions.length);
  pendingReceipt = false;
}
