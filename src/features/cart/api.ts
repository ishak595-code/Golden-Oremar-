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

export type CheckoutPaymentReadiness = {
  mode: 'manual_confirmation' | 'provider_checkout' | string;
  liveCardPaymentsEnabled: boolean;
  provider: string | null;
  requiresProviderConfiguration: boolean;
  paymentVerificationRequired: boolean;
  storesProviderSecretsClientSide: boolean;
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

export async function startShippingQuoteSupport(input: {
  countryCode: string;
  cityLabel?: string | null;
  cart: CartSnapshot;
  preview?: CheckoutPreview | null;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  const cityLabel = input.cityLabel?.trim() || '';
  const lines = input.cart.items.slice(0, 25).map(item =>
    `- ${item.productName} / ${item.variantName}: ${item.quantity} adet`
  );
  const reason = input.preview?.blockingReason || 'manual_shipping_quote_required';
  const missingWeight = Number(input.preview?.missingWeightQuantity || 0);
  const message = [
    `Yurtdışı kargo teklifi talep ediyorum.`,
    `Hedef ülke: ${countryCode}${cityLabel ? ` • ${cityLabel}` : ''}`,
    `Sepet ara toplamı: ${input.cart.subtotalMinor} ${input.cart.currency} minor-unit`,
    `Checkout durumu: ${reason}`,
    missingWeight > 0 ? `Eksik doğrulanmış ağırlık adedi: ${missingWeight}` : '',
    `Sepet:`,
    ...lines,
    input.cart.items.length > lines.length ? `- ve ${input.cart.items.length - lines.length} ek kalem` : '',
    `Not: Kesin teslimat fiyatı ve uygunluk ödeme öncesinde doğrulanmalıdır.`,
  ].filter(Boolean).join('\n');

  const { data, error } = await supabase.rpc('start_support_conversation_v1', {
    p_order_id: null,
    p_subject: `Yurtdışı kargo teklifi – ${countryCode}`,
    p_initial_message: message,
  });
  return unwrap<any>(data, error);
}

export async function getCheckoutPaymentReadiness(): Promise<CheckoutPaymentReadiness> {
  const { data, error } = await supabase.rpc('get_checkout_payment_readiness_v1');
  const readiness = unwrap<CheckoutPaymentReadiness | null>(data, error);
  if (!readiness) {
    return {
      mode: 'manual_confirmation',
      liveCardPaymentsEnabled: false,
      provider: null,
      requiresProviderConfiguration: true,
      paymentVerificationRequired: true,
      storesProviderSecretsClientSide: false,
    };
  }
  return readiness;
}

export async function getCheckoutAccountOverview() {
  const [{ data, error }, paymentReadiness] = await Promise.all([
    supabase.rpc('get_my_account_overview_v1'),
    getCheckoutPaymentReadiness(),
  ]);
  const overview = unwrap<any>(data, error) || {};
  return { ...overview, paymentReadiness };
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
