import { supabase } from '../../lib/supabase';

export async function getProductSafety(reference: string, locale = 'tr') {
  const { data, error } = await supabase.rpc('get_public_product_safety_v1', {
    p_reference: reference,
    p_locale: locale,
  });
  if (error) throw error;
  return data || {};
}
