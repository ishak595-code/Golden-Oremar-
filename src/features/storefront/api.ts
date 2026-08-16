import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getPublicStorefrontConfig(locale = 'tr') {
  const { data, error } = await supabase.rpc('get_public_storefront_config_v1', {
    p_locale: locale,
  });
  return unwrap<any>(data, error);
}

export async function getPublicInfoPages(locale = 'tr') {
  const { data, error } = await supabase.rpc('get_account_help_content_v1', {
    p_locale: locale,
  });
  return unwrap<any>(data, error);
}
