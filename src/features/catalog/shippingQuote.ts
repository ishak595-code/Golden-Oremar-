import { supabase } from '../../lib/supabase';

/**
 * Shipping for the product page's "Kargo ve teslimat bilgisi": the same
 * public quote the checkout uses (get_shipping_quote_v1, from the shipping
 * zones in the admin panel), for one pack sent within Türkiye. Nothing here
 * is a number of its own: a fee, a free-shipping threshold or a delivery
 * window is shown only when the quote carries it. When the backend is out of
 * quota the shipped copy answers (src/lib/offlineCatalog.ts).
 */
export type ShippingQuote = {
  feeMinor: number;
  freeThresholdMinor: number | null;
  minDays: number | null;
  maxDays: number | null;
  currency: string;
};

const int = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);

export async function getDomesticShippingQuote(weightGrams: number | null, subtotalMinor: number, currency: string): Promise<ShippingQuote | null> {
  const weight = weightGrams && weightGrams > 0 ? Math.min(weightGrams, 100000) : 1000;
  const { data, error } = await supabase.rpc('get_shipping_quote_v1', { p_country_code: 'TR', p_weight_grams: weight, p_subtotal_minor: Math.max(0, subtotalMinor), p_currency: currency || 'TRY' });
  if (error || !data || typeof data !== 'object' || (data as any).available !== true) return null;
  const quote = data as Record<string, unknown>;
  const fee = int(quote.shippingMinor);
  if (fee === null) return null;
  const min = int(quote.minDeliveryDays), max = int(quote.maxDeliveryDays);
  return {
    feeMinor: fee,
    freeThresholdMinor: int(quote.freeShippingThresholdMinor),
    minDays: min && min > 0 ? min : null,
    maxDays: max && max > 0 ? max : null,
    currency: typeof quote.currency === 'string' ? quote.currency : currency,
  };
}
