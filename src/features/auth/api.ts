import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

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

export function getConfiguredAuthRedirectUrl(): string | undefined {
  const configured = String(import.meta.env.VITE_AUTH_REDIRECT_URL || '').trim();
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/?tab=account`;
  }
  return undefined;
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

export async function requestPasswordReset(email: string) {
  const redirect = getConfiguredAuthRedirectUrl();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    ...(redirect ? { redirectTo: redirect } : {}),
  });
  if (error) throw error;
  return data;
}

export async function getCustomerSessionStatus(): Promise<CustomerSessionStatus | null> {
  const { data, error } = await supabase.rpc('customer_session_status');
  if (error) throw error;
  return (data || null) as CustomerSessionStatus | null;
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
