import { supabase } from '../../lib/supabase';

function normalizeLocale(locale: string) {
  const value = String(locale || 'tr').trim().toLowerCase();
  return /^[a-z]{2}(?:-[a-z]{2})?$/.test(value) ? value : 'tr';
}

export async function getProductSafety(reference: string, locale = 'tr') {
  const normalizedReference = String(reference || '').trim();
  if (!normalizedReference || normalizedReference.length > 200) throw new Error('Geçerli bir ürün referansı gerekiyor.');

  const { data, error } = await supabase.rpc('get_public_product_safety_v1', {
    p_reference: normalizedReference,
    p_locale: normalizeLocale(locale),
  });
  if (error) throw error;
  return data || {};
}
