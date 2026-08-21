import { supabase } from '../../lib/supabase';
import { getPaymentReadiness, listMyPaymentMethods, type PaymentReadiness, type SavedPaymentMethod } from '../payments/api';

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

export type CheckoutPaymentReadiness = PaymentReadiness;
export type CheckoutSavedPaymentMethod = SavedPaymentMethod;

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 240) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function optionalText(value: unknown, max = 500) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, max) : null;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return value;
}

function optionalSafeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value == null) return null;
  return safeInteger(value, label, min, max);
}

function normalizedCurrency(value: unknown) {
  const currency = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Sepet para birimi doğrulanamadı.');
  return currency;
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

function optionalUuid(value: unknown, label: string) {
  if (value == null || String(value).trim() === '') return null;
  const id = String(value).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`${label} doğrulanamadı.`);
  return id;
}

function normalizeCartSnapshot(value: unknown): CartSnapshot {
  if (!isRecord(value)) throw new Error('Sepet sunucudan doğrulanamadı.');
  if (!Array.isArray(value.items)) throw new Error('Sepet ürünleri sunucudan doğrulanamadı.');
  if (value.items.length > 100) throw new Error('Sepette desteklenenden fazla ürün kalemi var.');
  const currency = normalizedCurrency(value.currency);
  const items = value.items.map((raw: any, index: number) => {
    if (!isRecord(raw)) throw new Error(`${index + 1}. sepet kalemi doğrulanamadı.`);
    const producer = raw.producer;
    if (!isRecord(producer)) throw new Error(`${index + 1}. ürünün üretici bilgisi doğrulanamadı.`);
    const selectedOptions = raw.selectedOptions == null ? {} : raw.selectedOptions;
    if (!isRecord(selectedOptions)) throw new Error(`${index + 1}. ürün seçenekleri doğrulanamadı.`);
    if (typeof raw.available !== 'boolean') throw new Error(`${index + 1}. ürünün satış durumu doğrulanamadı.`);
    return {
      cartItemId: requiredText(raw.cartItemId, 'Sepet kalemi kimliği', 160),
      quantity: safeInteger(raw.quantity, 'Ürün adedi', 1, 99),
      selectedOptions,
      productId: requiredText(raw.productId, 'Ürün kimliği', 160),
      legacyId: optionalText(raw.legacyId, 160),
      slug: requiredText(raw.slug, 'Ürün bağlantısı', 220),
      productName: requiredText(raw.productName, 'Ürün adı', 300),
      unitLabel: optionalText(raw.unitLabel, 120),
      variantId: requiredText(raw.variantId, 'Varyant kimliği', 160),
      variantName: requiredText(raw.variantName, 'Varyant adı', 240),
      sku: optionalText(raw.sku, 160),
      priceMinor: safeInteger(raw.priceMinor, 'Ürün fiyatı'),
      compareAtPriceMinor: optionalSafeInteger(raw.compareAtPriceMinor, 'Karşılaştırma fiyatı'),
      weightGrams: optionalSafeInteger(raw.weightGrams, 'Kargo ağırlığı'),
      producer: { id: requiredText(producer.id, 'Üretici kimliği', 160), name: requiredText(producer.name, 'Üretici adı', 240) },
      imagePath: optionalText(raw.imagePath, 1000),
      stockMode: requiredText(raw.stockMode, 'Stok modu', 80),
      sellableQuantity: optionalSafeInteger(raw.sellableQuantity, 'Satılabilir stok', 0, 999999999),
      available: raw.available,
      lineTotalMinor: safeInteger(raw.lineTotalMinor, 'Satır toplamı'),
    };
  });
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  if (!Number.isSafeInteger(itemCount)) throw new Error('Sepetteki toplam ürün adedi doğrulanamadı.');
  const subtotalMinor = safeInteger(value.subtotalMinor, 'Sepet ara toplamı');
  const calculatedSubtotal = items.reduce((total, item) => total + item.lineTotalMinor, 0);
  if (!Number.isSafeInteger(calculatedSubtotal) || calculatedSubtotal !== subtotalMinor) throw new Error('Sepet ara toplamı ürün satırlarıyla eşleşmiyor.');
  const cartId = value.cartId == null ? null : requiredText(value.cartId, 'Sepet kimliği', 160);
  const expiresAt = optionalText(value.expiresAt, 80);
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new Error('Sepet geçerlilik tarihi doğrulanamadı.');
  return { cartId, currency, itemCount, subtotalMinor, expiresAt, items };
}

function normalizeCheckoutPreview(value: unknown): CheckoutPreview {
  if (!isRecord(value)) throw new Error('Sipariş özeti sunucudan doğrulanamadı.');
  if (typeof value.canCheckout !== 'boolean') throw new Error('Checkout uygunluk durumu doğrulanamadı.');
  if (!isRecord(value.shipping) || !isRecord(value.promotion)) throw new Error('Kargo veya kampanya özeti doğrulanamadı.');
  const blockingReason = optionalText(value.blockingReason, 200);
  const itemCount = safeInteger(value.itemCount, 'Checkout ürün adedi', 0, 9900);
  const validLegacyEmptyPreview = value.previewOnly == null && value.canCheckout === false && blockingReason === 'cart_empty' && itemCount === 0;
  if (value.previewOnly !== true && !validLegacyEmptyPreview) throw new Error('Checkout önizleme sözleşmesi doğrulanamadı.');
  const result: CheckoutPreview = {
    canCheckout: value.canCheckout,
    blockingReason,
    countryCode: normalizedCountryCode(String(value.countryCode || '')),
    currency: normalizedCurrency(value.currency),
    itemCount,
    subtotalMinor: safeInteger(value.subtotalMinor, 'Checkout ara toplamı'),
    shippingMinor: safeInteger(value.shippingMinor, 'Kargo tutarı'),
    discountMinor: safeInteger(value.discountMinor, 'İndirim tutarı'),
    totalMinor: safeInteger(value.totalMinor, 'Checkout toplamı'),
    shipping: value.shipping,
    promotion: value.promotion,
    previewOnly: true,
  };
  const totalWeightGrams = optionalSafeInteger(value.totalWeightGrams, 'Toplam ağırlık');
  const shippingWeightGrams = optionalSafeInteger(value.shippingWeightGrams, 'Gönderim ağırlığı');
  const missingWeightQuantity = optionalSafeInteger(value.missingWeightQuantity, 'Eksik ağırlık adedi', 0, 9900);
  if (totalWeightGrams != null) result.totalWeightGrams = totalWeightGrams;
  if (shippingWeightGrams != null) result.shippingWeightGrams = shippingWeightGrams;
  if (missingWeightQuantity != null) result.missingWeightQuantity = missingWeightQuantity;
  if (result.totalMinor !== result.subtotalMinor + result.shippingMinor - result.discountMinor) throw new Error('Checkout toplamı bileşenleriyle eşleşmiyor.');
  return result;
}

export async function getCart(): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('get_my_cart_v1');
  return normalizeCartSnapshot(unwrap<unknown>(data, error));
}

export async function setCartItem(input: {
  variantId: string;
  quantity: number;
  selectedOptions?: Record<string, unknown>;
}): Promise<CartSnapshot> {
  const variantId = String(input.variantId || '').trim();
  const quantity = Number(input.quantity);
  if (!variantId || variantId.length > 160) throw new Error('Ürün varyantı seçilmedi.');
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new Error('Ürün adedi 0 ile 99 arasında tam sayı olmalıdır.');
  const selectedOptions = input.selectedOptions ?? {};
  if (!selectedOptions || Array.isArray(selectedOptions) || typeof selectedOptions !== 'object') throw new Error('Ürün seçenekleri geçersiz.');
  const { data, error } = await supabase.rpc('set_my_cart_item_v1', { p_variant_id: variantId, p_quantity: quantity, p_selected_options: selectedOptions });
  return normalizeCartSnapshot(unwrap<unknown>(data, error));
}

export async function removeCartItem(cartItemId: string): Promise<CartSnapshot> {
  const id = requiredText(cartItemId, 'Sepet kalemi', 160);
  const { data, error } = await supabase.rpc('remove_my_cart_item_v1', { p_cart_item_id: id });
  return normalizeCartSnapshot(unwrap<unknown>(data, error));
}

export async function clearCart(): Promise<CartSnapshot> {
  const { data, error } = await supabase.rpc('clear_my_cart_v1');
  return normalizeCartSnapshot(unwrap<unknown>(data, error));
}

export async function previewCheckout(countryCode: string, couponCode?: string | null): Promise<CheckoutPreview> {
  const requestedCountry = normalizedCountryCode(countryCode);
  const { data, error } = await supabase.rpc('preview_my_checkout_v1', { p_country_code: requestedCountry, p_coupon_code: normalizedCoupon(couponCode) });
  const preview = normalizeCheckoutPreview(unwrap<unknown>(data, error));
  if (preview.countryCode !== requestedCountry) throw new Error('Checkout ülke doğrulaması istekle eşleşmiyor.');
  return preview;
}

export async function createOrder(input: {
  items: CartSnapshot['items'];
  shippingAddress: Record<string, any>;
  customerNote?: string | null;
  couponCode?: string | null;
  paymentMethodId?: string | null;
  idempotencyKey: string;
}) {
  if (!Array.isArray(input.items) || !input.items.length) throw new Error('Sipariş için sepet boş olamaz.');
  if (input.items.length > 100) throw new Error('Tek siparişte en fazla 100 ürün kalemi olabilir.');
  const customerNote = input.customerNote?.trim() || '';
  if (customerNote.length > 1000) throw new Error('Sipariş notu en fazla 1000 karakter olabilir.');
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!/^[A-Za-z0-9_-]{16,120}$/.test(idempotencyKey)) throw new Error('Sipariş güvenlik anahtarı geçersiz.');
  if (!isRecord(input.shippingAddress)) throw new Error('Teslimat adresi geçersiz.');
  const recipientName = requiredText(input.shippingAddress.recipient_name, 'Teslim alacak kişi', 120);
  const phone = requiredText(input.shippingAddress.phone, 'Teslimat telefonu', 40);
  const phoneDigits = phone.replace(/\D/g, '').length;
  if (phoneDigits < 7 || phoneDigits > 20) throw new Error('Teslimat telefonu 7 ile 20 rakam içermelidir.');
  const countryCode = normalizedCountryCode(String(input.shippingAddress.country_code || ''));
  const province = optionalText(input.shippingAddress.province, 120) || '';
  const district = optionalText(input.shippingAddress.district, 120) || '';
  if (!province && !district) throw new Error('Teslimat şehir, ilçe veya bölge bilgisi gereklidir.');
  const addressLine = requiredText(input.shippingAddress.address_line || input.shippingAddress.address_line1, 'Açık teslimat adresi', 500);
  if (addressLine.length < 5) throw new Error('Açık teslimat adresi en az 5 karakter olmalıdır.');
  const shippingAddress = {
    ...input.shippingAddress,
    label: optionalText(input.shippingAddress.label, 60) || 'Teslimat',
    recipient_name: recipientName,
    phone,
    country_code: countryCode,
    province,
    district,
    neighborhood: optionalText(input.shippingAddress.neighborhood, 160) || '',
    address_line: addressLine,
    postal_code: optionalText(input.shippingAddress.postal_code, 24) || '',
    delivery_notes: optionalText(input.shippingAddress.delivery_notes, 500) || '',
  };

  const orderItems = input.items.map(item => {
    const productReference = requiredText(item.slug || item.productId, 'Ürün referansı', 220);
    const variantReference = requiredText(item.variantId, 'Varyant referansı', 160);
    const quantity = typeof item.quantity === 'number' ? item.quantity : Number.NaN;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Sipariş ürün adedi 1 ile 99 arasında tam sayı olmalıdır.');
    return { productReference, variantReference, quantity };
  });

  const paymentMethodId = optionalUuid(input.paymentMethodId, 'Ödeme yöntemi kimliği');
  const { data, error } = await supabase.rpc('create_customer_order_v5', {
    p_items: orderItems,
    p_shipping_address: shippingAddress,
    p_customer_note: customerNote || null,
    p_coupon_code: normalizedCoupon(input.couponCode),
    p_gift: null,
    p_payment_method_id: paymentMethodId,
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
  const cart = normalizeCartSnapshot(input.cart);
  if (!cart.items.length) throw new Error('Kargo teklifi için sepet boş olamaz.');
  const lines = cart.items.slice(0, 25).map(item => `- ${item.productName} / ${item.variantName}: ${item.quantity} adet`);
  const reason = optionalText(input.preview?.blockingReason, 200) || 'manual_shipping_quote_required';
  const missingWeight = input.preview?.missingWeightQuantity == null ? 0 : safeInteger(input.preview.missingWeightQuantity, 'Eksik ağırlık adedi', 0, 9900);
  const message = [
    `Yurtdışı kargo teklifi talep ediyorum.`,
    `Hedef ülke: ${countryCode}${cityLabel ? ` • ${cityLabel}` : ''}`,
    `Sepet ara toplamı: ${cart.subtotalMinor} ${cart.currency} minor-unit`,
    `Checkout durumu: ${reason}`,
    missingWeight > 0 ? `Eksik doğrulanmış ağırlık adedi: ${missingWeight}` : '',
    `Sepet:`,
    ...lines,
    cart.items.length > lines.length ? `- ve ${cart.items.length - lines.length} ek kalem` : '',
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
  return getPaymentReadiness();
}

export async function getCheckoutAccountOverview() {
  const [{ data, error }, paymentReadiness, paymentMethods] = await Promise.all([
    supabase.rpc('get_my_account_overview_v1'),
    getPaymentReadiness(),
    listMyPaymentMethods(),
  ]);
  const overview = unwrap<any>(data, error) || {};
  return { ...overview, paymentReadiness, paymentMethods };
}

export async function resolveDefaultVariant(productReference: string) {
  const reference = requiredText(productReference, 'Ürün referansı', 220);
  const { data, error } = await supabase.rpc('get_public_product_detail_v6', { p_reference: reference });
  const detail = unwrap<any>(data, error);
  if (!isRecord(detail) || !Array.isArray(detail.variants)) throw new Error('Ürün seçenekleri doğrulanamadı.');
  const variants = detail.variants.filter((v: any) => isRecord(v) && typeof v.id === 'string' && v.id.trim() && v.available === true);
  const variant = variants.find((v: any) => v.default === true) || variants[0];
  if (!variant?.id) throw new Error('Satılabilir ürün varyantı bulunamadı.');
  return { detail, variant };
}

export function publicCatalogUrl(path?: string | null) {
  if (!path) return '';
  if (/^https:\/\//i.test(path)) return path;
  if (/^http:\/\//i.test(path)) return '';
  return supabase.storage.from('catalog-public').getPublicUrl(path.replace(/^\/+/, '')).data.publicUrl;
}
