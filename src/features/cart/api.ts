import { supabase } from '../../lib/supabase';

export type CartSnapshot = {
  cartId: string | null;
  currency: string;
  itemCount: number;
  subtotalMinor: number;
  expiresAt?: string | null;
  items: Array<{
    cartItemId: string;
    quantity: number;
    selectedOptions: Record<string, unknown>;
    productId: string;
    legacyId?: string | null;
    slug: string;
    productName: string;
    unitLabel?: string | null;
    variantId: string;
    variantName: string;
    sku?: string | null;
    priceMinor: number;
    compareAtPriceMinor?: number | null;
    weightGrams?: number | null;
    producer: { id: string; name: string };
    imagePath?: string | null;
    stockMode: string;
    sellableQuantity?: number | null;
    available: boolean;
    lineTotalMinor: number;
  }>;
};

export type CheckoutPreview = {
  canCheckout: boolean;
  blockingReason?: string | null;
  countryCode: string;
  currency: string;
  itemCount: number;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  totalMinor: number;
  totalWeightGrams?: number;
  shippingWeightGrams?: number;
  missingWeightQuantity?: number;
  shipping: Record<string, any>;
  promotion: Record<string, any>;
  previewOnly: true;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getCart(): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('get_my_cart_v1');
  return unwrap<CartSnapshot>(data, error);
}

export async function setCartItem(input: {
  variantId: string;
  quantity: number;
  selectedOptions?: Record<string, unknown>;
}): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('set_my_cart_item_v1', {
    p_variant_id: input.variantId,
    p_quantity: input.quantity,
    p_selected_options: input.selectedOptions ?? {},
  });
  return unwrap<CartSnapshot>(data, error);
}

export async function removeCartItem(cartItemId: string): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('remove_my_cart_item_v1', {
    p_cart_item_id: cartItemId,
  });
  return unwrap<CartSnapshot>(data, error);
}

export async function clearCart(): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('clear_my_cart_v1');
  return unwrap<CartSnapshot>(data, error);
}

export async function previewCheckout(countryCode: string, couponCode?: string | null): Promise<CheckoutPreview> {
  const { data, error } = await supabase.rpc('preview_my_checkout_v1', {
    p_country_code: countryCode,
    p_coupon_code: couponCode?.trim() || null,
  });
  return unwrap<CheckoutPreview>(data, error);
}

export async function createOrder(input: {
  items: CartSnapshot['items'];
  shippingAddress: Record<string, any>;
  customerNote?: string | null;
  couponCode?: string | null;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc('create_customer_order_v4', {
    p_items: input.items.map(item => ({
      productReference: item.slug || item.productId,
      variantReference: item.variantId,
      quantity: item.quantity,
    })),
    p_shipping_address: input.shippingAddress,
    p_customer_note: input.customerNote?.trim() || null,
    p_coupon_code: input.couponCode?.trim() || null,
    p_gift: null,
    p_idempotency_key: input.idempotencyKey,
  });
  return unwrap<any>(data, error);
}

export async function getCheckoutAccountOverview() {
  const { data, error } = await supabase.rpc('get_my_account_overview_v1');
  return unwrap<any>(data, error);
}

export async function resolveDefaultVariant(productReference: string) {
  const { data, error } = await supabase.rpc('get_public_product_detail_v1', {
    p_reference: productReference,
  });
  const detail = unwrap<any>(data, error);
  const variants = Array.isArray(detail?.variants) ? detail.variants.filter((v: any) => v.available !== false) : [];
  const variant = variants.find((v: any) => v.default) || variants[0];
  if (!variant?.id) throw new Error('Satılabilir ürün varyantı bulunamadı.');
  return { detail, variant };
}

export function publicCatalogUrl(path?: string | null) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('catalog-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
