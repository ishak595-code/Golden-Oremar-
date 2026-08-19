import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEVICE_STORAGE_KEY = 'golden_oremar_device_id_v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!url || !publishableKey) {
  throw new Error('Missing Supabase client environment variables.');
}

function createDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return '';
}

function resolveDeviceId() {
  try {
    const existing = typeof localStorage !== 'undefined' ? String(localStorage.getItem(DEVICE_STORAGE_KEY) || '').trim() : '';
    if (UUID_RE.test(existing)) return existing;
    const created = createDeviceId();
    if (UUID_RE.test(created) && typeof localStorage !== 'undefined') localStorage.setItem(DEVICE_STORAGE_KEY, created);
    return UUID_RE.test(created) ? created : '';
  } catch {
    const created = createDeviceId();
    return UUID_RE.test(created) ? created : '';
  }
}

export const goldenOremarDeviceId = resolveDeviceId();

export const supabase = createClient(url, publishableKey, {
  global: {
    headers: goldenOremarDeviceId ? { 'x-golden-device-id': goldenOremarDeviceId } : {},
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Browser redirects can be detected automatically. Native Capacitor callbacks
    // are consumed explicitly from the App plugin so local WebView origins are
    // never mistaken for production auth callback URLs.
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  },
});