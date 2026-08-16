
import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getGiftProduct(reference: string) {
  const { data, error } = await supabase.rpc('get_public_product_detail_v1', {
    p_reference: reference,
  });
  return unwrap<any>(data, error);
}

export async function getGiftAccountOverview() {
  const { data, error } = await supabase.rpc('get_my_account_overview_v1');
  return unwrap<any>(data, error);
}

export async function createGiftOrder(input: {
  productReference: string;
  variantReference: string;
  quantity: number;
  shippingAddress: Record<string, any>;
  customerNote?: string | null;
  couponCode?: string | null;
  gift: {
    recipientName: string;
    recipientPhone?: string | null;
    recipientEmail?: string | null;
    message?: string | null;
    senderName?: string | null;
    hidePrice: boolean;
  };
}) {
  const idempotencyKey = `gift_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_-]/g, '');
  const { data, error } = await supabase.rpc('create_customer_order_v4', {
    p_items: [{
      productReference: input.productReference,
      variantReference: input.variantReference,
      quantity: input.quantity,
    }],
    p_shipping_address: input.shippingAddress,
    p_customer_note: input.customerNote ?? null,
    p_coupon_code: input.couponCode?.trim() || null,
    p_gift: {
      recipientName: input.gift.recipientName,
      recipientPhone: input.gift.recipientPhone || null,
      recipientEmail: input.gift.recipientEmail || null,
      message: input.gift.message || null,
      senderName: input.gift.senderName || null,
      hidePrice: input.gift.hidePrice,
    },
    p_idempotency_key: idempotencyKey,
  });
  return unwrap<any>(data, error);
}

export function publicCatalogUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('catalog-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
