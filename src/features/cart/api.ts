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

function normalizedCountryCode(value: string) {
  const countryCode = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Ülke kodu iki harfli ISO kodu olmalıdır.');
  return countryCode;
}

function normalizedCoupon(value?: string | null) {
  const coupon = value?.trim().toUpperCase() || '';
  if (coupon.length > 64) throw new Error('Kupon kodu en fazla 64 karakter olabilir.');
  if (coupon && !/^[A-Z0-9_-]+$/.test(coupon)) throw new Error('Kupon kodu yalnız harf, rakam, tire ve alt çizgi içerebilir.');
  return coupon || null;
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
  const variantId = String(input.variantId || '').trim();
  const quantity = Number(input.quantity);
  if (!variantId) throw new Error('Ürün varyantı seçilmedi.');
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new Error('Ürün adedi 0 ile 99 arasında tam sayı olmalıdır.');
  const selectedOptions = input.selectedOptions ?? {};
  if (!selectedOptions || Array.isArray(selectedOptions) || typeof selectedOptions !== 'object') throw new Error('Ürün seçenekleri geçersiz.');
  const { data, error } = await supabase.rpc('set_my_cart_item_v1', {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_selected_options: selectedOptions,
  });
  return unwrap<CartSnapshot>(data, error);
}

export async function removeCartItem(cartItemId: string): Promise<CartSnapshot> {
  const id = String(cartItemId || '').trim();
  if (!id) throw new Error('Sepet kalemi bulunamadı.');
  const { data, error } = await supabase.rpc('remove_my_cart_item_v1', {
    p_cart_item_id: id,
  });
  return unwrap<CartSnapshot>(data, error);
}

export async function clearCart(): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('clear_my_cart_v1');
  return unwrap<CartSnapshot>(data, error);
}

export async function previewCheckout(countryCode: string, couponCode?: string | null): Promise<CheckoutPreview> {
  const { data, error } = await supabase.rpc('preview_my_checkout_v1', {
    p_country_code: normalizedCountryCode(countryCode),
    p_coupon_code: normalizedCoupon(couponCode),
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
  if (!Array.isArray(input.items) || !input.items.length) throw new Error('Sipariş için sepet boş olamaz.');
  if (input.items.length > 100) throw new Error('Tek siparişte en fazla 100 ürün kalemi olabilir.');
  const customerNote = input.customerNote?.trim() || '';
  if (customerNote.length > 1000) throw new Error('Sipariş notu en fazla 1000 karakter olabilir.');
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(idempotencyKey)) throw new Error('Sipariş güvenlik anahtarı geçersiz.');
  if (!input.shippingAddress || Array.isArray(input.shippingAddress) || typeof input.shippingAddress !== 'object') throw new Error('Teslimat adresi geçersiz.');

  const orderItems = input.items.map(item => {
    const productReference = String(item.slug || item.productId || '').trim();
    const variantReference = String(item.variantId || '').trim();
    const quantity = Number(item.quantity);
    if (!productReference || !variantReference) throw new Error('Sepette eksik ürün veya varyant bilgisi var.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Sipariş ürün adedi 1 ile 99 arasında tam sayı olmalıdır.');
    return { productReference, variantReference, quantity };
  });

  const { data, error } = await supabase.rpc('create_customer_order_v4', {
    p_items: orderItems,
    p_shipping_address: input.shippingAddress,
    p_customer_note: customerNote || null,
    p_coupon_code: normalizedCoupon(input.couponCode),
    p_gift: null,
    p_idempotency_key: idempotencyKey,
  });
  return unwrap<any>(data, error);
}

export async function startShippingQuoteSupport(input: {
  countryCode: string;
  cityLabel?: string | null;
  cart: CartSnapshot;
  preview?: CheckoutPreview | null;
}) {
  const countryCode = normalizedCountryCode(input.countryCode);
  const cityLabel = input.cityLabel?.trim().slice(0, 200) || '';
  if (!input.cart?.items?.length) throw new Error('Kargo teklifi için sepet boş olamaz.');
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
    p_subject: `Yurtdışı kargo teklifi - ${countryCode}`,
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
  const reference = String(productReference || '').trim();
  if (!reference) throw new Error('Ürün referansı bulunamadı.');
  const { data, error } = await supabase.rpc('get_public_product_detail_v1', {
    p_reference: reference,
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
