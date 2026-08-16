import { supabase } from '../lib/supabase';

export async function getMyAccountOverview() {
  const { data, error } = await supabase.rpc('get_my_account_overview_v1');
  if (error) throw error;
  return data;
}

export async function updateMyProfile(input: {
  displayName: string;
  phone?: string | null;
  locale: 'tr' | 'en' | 'de' | 'fr' | 'ku' | 'ar';
  marketingConsent: boolean;
}) {
  const { data, error } = await supabase.rpc('update_customer_profile', {
    p_display_name: input.displayName,
    p_phone: input.phone ?? null,
    p_locale: input.locale,
    p_marketing_consent: input.marketingConsent,
  });
  if (error) throw error;
  return data;
}

export async function updateMyAvatar(path: string | null) {
  const { data, error } = await supabase.rpc('update_customer_avatar_v1', {
    p_avatar_path: path,
  });
  if (error) throw error;
  return data;
}
