import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export const NATIVE_AUTH_CALLBACK_URL = 'com.goldenoremar.app://auth/callback';

export type SocialAuthProvider = 'google' | 'facebook' | 'apple';

export type CustomerSessionStatus = {
  is_authenticated: boolean;
  user_id: string;
  email: string;
  display_name: string;
  phone: string | null;
  locale: string;
  status: string;
  roles: string[];
};

export type AdminSessionStatus = {
  is_admin: boolean;
  roles: string[];
};

const SUPPORTED_LOCALES = new Set(['tr', 'en', 'de', 'fr', 'ku', 'ar']);
const KNOWN_ROLES = new Set(['customer', 'producer', 'support', 'content_editor', 'operations', 'admin', 'super_admin', 'user', 'vendor']);
const SOCIAL_PROVIDERS = new Set<SocialAuthProvider>(['google', 'facebook', 'apple']);

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function envEnabled(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi yazın.');
  return email;
}

function validatePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72 || /[\u0000-\u001F\u007F]/.test(value)) throw new Error('Şifre 8-72 karakter arasında olmalı ve kontrol karakteri içermemelidir.');
  return value;
}

function normalizeDisplayName(value: unknown) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001F\u007F]/.test(name)) throw new Error('Ad soyad 2-120 karakter arasında olmalıdır.');
  return name;
}

function normalizePhone(value: unknown) {
  if (value == null || String(value).trim() === '') return undefined;
  const phone = typeof value === 'string' ? value.trim() : '';
  if (!phone || phone.length > 40 || /[\u0000-\u001F\u007F]/.test(phone)) throw new Error('Telefon numarası doğrulanamadı.');
  const digits = phone.replace(/\D/g, '').length;
  if (digits < 7 || digits > 20) throw new Error('Telefon numarası 7 ile 20 rakam içermelidir.');
  return phone;
}

function normalizeLocale(value: unknown, fallback = 'tr') {
  const locale = typeof value === 'string' ? value.trim().toLowerCase().split('-')[0] : '';
  return SUPPORTED_LOCALES.has(locale) ? locale : fallback;
}

function safeUserId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : '';
}

function boundedCallbackValue(value: string | null, label: string, max: number) {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F\s]/.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function callbackErrorMessage(value: string | null) {
  if (!value) return '';
  const normalized = value.replace(/\+/g, ' ').trim();
  if (!normalized || normalized.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) return 'Kimlik doğrulama sağlayıcısı güvenli bir hata açıklaması döndürmedi.';
  return normalized;
}

export function getSocialAuthAvailability() {
  return {
    google: envEnabled(import.meta.env.VITE_GOOGLE_AUTH_ENABLED),
    facebook: envEnabled(import.meta.env.VITE_FACEBOOK_AUTH_ENABLED),
    apple: envEnabled(import.meta.env.VITE_APPLE_AUTH_ENABLED),
  } satisfies Record<SocialAuthProvider, boolean>;
}

function authCallbackParams(url: string) {
  if (typeof url !== 'string' || !url.trim() || url.length > 32768 || /[\u0000-\u001F\u007F]/.test(url)) throw new Error('Kimlik doğrulama dönüş bağlantısı doğrulanamadı.');
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  hash.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return { parsed, params };
}

export function isNativeAuthCallbackUrl(url: string) {
  try {
    const { parsed } = authCallbackParams(url);
    return parsed.protocol === 'com.goldenoremar.app:' && parsed.hostname === 'auth' && parsed.pathname === '/callback';
  } catch {
    return false;
  }
}

export function isPasswordRecoveryCallbackUrl(url: string) {
  try {
    return isNativeAuthCallbackUrl(url) && authCallbackParams(url).params.get('type') === 'recovery';
  } catch {
    return false;
  }
}

export function getConfiguredAuthRedirectUrl(): string | undefined {
  const webConfigured = String(import.meta.env.VITE_AUTH_REDIRECT_URL || '').trim();
  const nativeConfigured = String(import.meta.env.VITE_NATIVE_AUTH_REDIRECT_URL || '').trim();
  if (Capacitor.isNativePlatform()) {
    return nativeConfigured === NATIVE_AUTH_CALLBACK_URL ? nativeConfigured : undefined;
  }
  if (webConfigured) {
    try {
      const parsed = new URL(webConfigured);
      if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return parsed.toString();
    } catch {
      return undefined;
    }
    return undefined;
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/?tab=account`;
  }
  return undefined;
}

export function clearBrowserAuthCallbackArtifacts() {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    ['code', 'error', 'error_code', 'error_description', 'type', 'access_token', 'refresh_token'].forEach(key => url.searchParams.delete(key));
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  } catch {
    // URL cleanup is best-effort and must never break a valid authenticated session.
  }
}

export async function consumeNativeAuthCallbackUrl(url: string): Promise<{
  handled: boolean;
  recovery: boolean;
  session: Session | null;
}> {
  if (!isNativeAuthCallbackUrl(url)) return { handled: false, recovery: false, session: null };

  const { params } = authCallbackParams(url);
  const providerError = callbackErrorMessage(params.get('error_description') || params.get('error'));
  if (providerError) throw new Error(providerError);

  const type = params.get('type');
  if (type && !['recovery', 'signup', 'magiclink', 'invite', 'email_change'].includes(type)) throw new Error('Kimlik doğrulama dönüş türü doğrulanamadı.');
  const recovery = type === 'recovery';
  const code = boundedCallbackValue(params.get('code'), 'Yetkilendirme kodu', 4096);
  const accessToken = boundedCallbackValue(params.get('access_token'), 'Erişim belirteci', 16384);
  const refreshToken = boundedCallbackValue(params.get('refresh_token'), 'Yenileme belirteci', 16384);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.session?.user?.id) throw new Error('Kimlik doğrulama oturumu oluşturulamadı.');
    return { handled: true, recovery, session: data.session };
  }

  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) throw new Error('Kimlik doğrulama bağlantısındaki oturum belirteçleri eksik.');
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    if (!data.session?.user?.id) throw new Error('Kimlik doğrulama oturumu doğrulanamadı.');
    return { handled: true, recovery, session: data.session };
  }

  throw new Error('Kimlik doğrulama bağlantısında geçerli oturum bilgisi bulunamadı.');
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password: validatePassword(password),
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  locale?: string;
}) {
  const redirect = getConfiguredAuthRedirectUrl();
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const displayName = normalizeDisplayName(input.displayName);
  const phone = normalizePhone(input.phone);
  const locale = normalizeLocale(input.locale);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(redirect ? { emailRedirectTo: redirect } : {}),
      data: {
        display_name: displayName,
        phone,
        locale,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function startSocialAuth(provider: SocialAuthProvider) {
  if (!SOCIAL_PROVIDERS.has(provider)) throw new Error('social_provider_not_configured');
  const available = getSocialAuthAvailability();
  if (!available[provider]) throw new Error(`social_provider_not_configured:${provider}`);

  const redirect = getConfiguredAuthRedirectUrl();
  if (!redirect) throw new Error('social_auth_redirect_not_configured');

  const native = Capacitor.isNativePlatform();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirect,
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;

  if (native) {
    if (!data.url || !/^https:\/\//i.test(data.url)) throw new Error('social_auth_authorization_url_missing');
    await Browser.open({ url: data.url, presentationStyle: 'popover' });
  }
  return data;
}

export async function closeNativeAuthBrowser() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Browser.close();
  } catch {
    // Some Android browser implementations close themselves when the deep link returns.
  }
}

export async function requestPasswordReset(email: string) {
  const redirect = getConfiguredAuthRedirectUrl();
  if (Capacitor.isNativePlatform() && !redirect) {
    throw new Error('native_auth_redirect_not_configured');
  }
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    ...(redirect ? { redirectTo: redirect } : {}),
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password: validatePassword(password) });
  if (error) throw error;
  return data;
}

export async function getCustomerSessionStatus(): Promise<CustomerSessionStatus | null> {
  const { data, error } = await supabase.rpc('customer_session_status');
  if (error) throw error;
  if (data == null) return null;
  if (!isRecord(data)) throw new Error('Müşteri oturumu sunucudan doğrulanamadı.');
  if (data.is_authenticated !== true) return null;
  const userId = safeUserId(data.user_id);
  if (!userId) throw new Error('Müşteri kimliği sunucudan doğrulanamadı.');
  const email = normalizeEmail(data.email);
  const displayName = normalizeDisplayName(data.display_name);
  const phone = data.phone == null || String(data.phone).trim() === '' ? null : normalizePhone(data.phone) || null;
  const locale = normalizeLocale(data.locale, '');
  if (!locale) throw new Error('Müşteri dil tercihi doğrulanamadı.');
  const status = typeof data.status === 'string' ? data.status.trim() : '';
  if (!status || status.length > 80) throw new Error('Müşteri hesap durumu doğrulanamadı.');
  const roles = Array.isArray(data.roles) ? [...new Set(data.roles.map((role: unknown) => typeof role === 'string' ? role.trim() : '').filter((role: string) => KNOWN_ROLES.has(role)))] : [];
  return { is_authenticated: true, user_id: userId, email, display_name: displayName, phone, locale, status, roles };
}

export async function getAdminSessionStatus(): Promise<AdminSessionStatus> {
  const { data, error } = await supabase.rpc('admin_session_status');
  if (error) throw error;
  const raw = isRecord(data) ? data : {};
  const roles = Array.isArray(raw.roles) ? [...new Set(raw.roles.map((role: unknown) => typeof role === 'string' ? role.trim() : '').filter((role: string) => role === 'admin' || role === 'super_admin'))] : [];
  return {
    is_admin: raw.is_admin === true && roles.length > 0,
    roles,
  };
}

export async function signOutCurrentSession() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export function roleForLegacyCompatibility(roles: string[]) {
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('producer') || roles.includes('vendor')) return 'vendor';
  return 'user';
}

export async function buildCurrentUserFromSession(session: Session | null) {
  if (!session?.user) return null;
  const status = await getCustomerSessionStatus();
  if (!status || status.status !== 'active') return null;
  if (status.user_id !== session.user.id) throw new Error('Oturum kimliği profil kimliğiyle eşleşmiyor.');
  const roles = status.roles;
  return {
    id: session.user.id,
    uid: session.user.id,
    email: status.email,
    name: status.display_name,
    displayName: status.display_name,
    phone: status.phone,
    locale: status.locale,
    status: status.status,
    roles,
    role: roleForLegacyCompatibility(roles),
    emailVerified: Boolean(session.user.email_confirmed_at),
    provider: typeof session.user.app_metadata?.provider === 'string' ? session.user.app_metadata.provider : 'email',
  };
}
