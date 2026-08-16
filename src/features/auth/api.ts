import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export const NATIVE_AUTH_CALLBACK_URL = 'com.goldenoremar.app://auth/callback';

export type SocialAuthProvider = 'google' | 'facebook';

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

function envEnabled(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function getSocialAuthAvailability() {
  return {
    google: envEnabled(import.meta.env.VITE_GOOGLE_AUTH_ENABLED),
    facebook: envEnabled(import.meta.env.VITE_FACEBOOK_AUTH_ENABLED),
  } satisfies Record<SocialAuthProvider, boolean>;
}

function authCallbackParams(url: string) {
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
    return authCallbackParams(url).params.get('type') === 'recovery';
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
  if (webConfigured) return webConfigured;
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/?tab=account`;
  }
  return undefined;
}

export function clearBrowserAuthCallbackArtifacts() {
  if (Capacitor.isNativePlatform() || typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    ['code', 'error', 'error_code', 'error_description', 'type'].forEach(key => url.searchParams.delete(key));
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
  const errorDescription = params.get('error_description') || params.get('error');
  if (errorDescription) throw new Error(errorDescription.replace(/\+/g, ' '));

  const recovery = params.get('type') === 'recovery';
  const code = params.get('code');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return { handled: true, recovery, session: data.session };
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return { handled: true, recovery, session: data.session };
  }

  throw new Error('Kimlik doğrulama bağlantısında geçerli oturum bilgisi bulunamadı.');
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
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
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      ...(redirect ? { emailRedirectTo: redirect } : {}),
      data: {
        display_name: input.displayName.trim(),
        phone: input.phone?.trim() || undefined,
        locale: input.locale || 'tr',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function startSocialAuth(provider: SocialAuthProvider) {
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
    if (!data.url) throw new Error('social_auth_authorization_url_missing');
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
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    ...(redirect ? { redirectTo: redirect } : {}),
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function getCustomerSessionStatus(): Promise<CustomerSessionStatus | null> {
  const { data, error } = await supabase.rpc('customer_session_status');
  if (error) throw error;
  return (data || null) as CustomerSessionStatus | null;
}

export async function getAdminSessionStatus(): Promise<AdminSessionStatus> {
  const { data, error } = await supabase.rpc('admin_session_status');
  if (error) throw error;
  const raw = (data || {}) as Partial<AdminSessionStatus>;
  return {
    is_admin: raw.is_admin === true,
    roles: Array.isArray(raw.roles) ? raw.roles.map(String) : [],
  };
}

export async function signOutCurrentSession() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export function roleForLegacyCompatibility(roles: string[]) {
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('producer')) return 'vendor';
  return 'user';
}

export async function buildCurrentUserFromSession(session: Session | null) {
  if (!session?.user) return null;
  const status = await getCustomerSessionStatus();
  if (!status || status.status !== 'active') return null;
  const roles = Array.isArray(status.roles) ? status.roles : [];
  return {
    id: session.user.id,
    uid: session.user.id,
    email: status.email || session.user.email || '',
    name: status.display_name || session.user.user_metadata?.display_name || session.user.user_metadata?.name || 'Kullanıcı',
    displayName: status.display_name || session.user.user_metadata?.display_name || session.user.user_metadata?.name || 'Kullanıcı',
    phone: status.phone,
    locale: status.locale || 'tr',
    status: status.status,
    roles,
    role: roleForLegacyCompatibility(roles),
    emailVerified: Boolean(session.user.email_confirmed_at),
    provider: session.user.app_metadata?.provider || 'email',
  };
}
