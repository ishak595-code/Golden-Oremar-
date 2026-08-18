import { supabase } from '../../lib/supabase';
import { getProductDetail, publicCatalogUrl } from '../catalog/api';
import { getCheckoutPaymentReadiness } from '../cart/api';
import { listMyPaymentMethods, type SavedPaymentMethod } from '../payments/api';

export type GiftOccasion = 'just_because' | 'birthday' | 'love' | 'thank_you' | 'celebration' | 'get_well' | 'new_home' | 'new_baby';
export type GiftPresentationStyle = 'oremar_gold' | 'mountain_warmth' | 'minimal_elegance';

export type GiftSavedAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  countryCode: string;
  administrativeArea: string;
  city: string;
  locality: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  deliveryNotes: string;
  isDefault: boolean;
};

export type GiftCheckoutPreview = {
  canCheckout: boolean;
  blockingReason: string | null;
  countryCode: string;
  currency: string;
  productId: string;
  productSlug: string;
  variantId: string;
  quantity: number;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  totalMinor: number;
  totalWeightGrams: number;
  shippingWeightGrams: number;
  missingWeightQuantity: number;
  availableQuantity: number | null;
  shipping: Record<string, any>;
  promotion: Record<string, any>;
  previewOnly: true;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max: number) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function optionalText(value: unknown, max: number) {
  if (value == null) return null;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error('Metin alanı doğrulanamadı.');
  return normalized;
}

function normalizedCountryCode(value: unknown) {
  const countryCode = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Teslimat ülke kodu iki harfli ISO kodu olmalıdır.');
  return countryCode;
}

function normalizedPhone(value: unknown, label: string) {
  const phone = requiredText(value, label, 40);
  const digits = phone.replace(/\D/g, '').length;
  if (digits < 7 || digits > 20) throw new Error(`${label} 7 ile 20 rakam içermelidir.`);
  return phone;
}

function optionalEmail(value: unknown) {
  const email = optionalText(value, 254)?.toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Hediye alıcısının e-posta adresi geçersiz.');
  return email;
}

function normalizedCoupon(value: unknown) {
  const coupon = optionalText(value, 64)?.toUpperCase() || null;
  if (coupon && !/^[A-Z0-9_-]+$/.test(coupon)) throw new Error('Kupon kodu yalnız harf, rakam, tire ve alt çizgi içerebilir.');
  return coupon;
}

function normalizedCurrency(value: unknown) {
  const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Sipariş para birimi doğrulanamadı.');
  return currency;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalSafeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (value == null) return null;
  return safeInteger(value, label, min, max);
}

function safeUuid(value: unknown, label: string) {
  const uuid = requiredText(value, label, 160);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) throw new Error(`${label} doğrulanamadı.`);
  return uuid;
}

function normalizeSavedAddress(value: unknown, index: number): GiftSavedAddress {
  if (!isRecord(value)) throw new Error(`${index + 1}. kayıtlı adres doğrulanamadı.`);
  const countryCode = normalizedCountryCode(value.country_code);
  const province = optionalText(value.province, 160) || '';
  const district = optionalText(value.district, 160) || '';
  const city = district || province;
  if (!city) throw new Error(`${index + 1}. kayıtlı adresin şehir bilgisi doğrulanamadı.`);
  if (typeof value.is_default !== 'boolean') throw new Error(`${index + 1}. kayıtlı adresin varsayılan durumu doğrulanamadı.`);
  return {
    id: safeUuid(value.id, 'Adres kimliği'),
    label: optionalText(value.label, 60) || 'Teslimat',
    recipientName: requiredText(value.recipient_name, 'Adres alıcı adı', 120),
    phone: normalizedPhone(value.phone, 'Adres telefonu'),
    countryCode,
    administrativeArea: province,
    city,
    locality: optionalText(value.neighborhood, 160) || '',
    addressLine1: requiredText(value.address_line, 'Açık adres', 1000),
    addressLine2: '',
    postalCode: optionalText(value.postal_code, 30) || '',
    deliveryNotes: optionalText(value.delivery_notes, 500) || '',
    isDefault: value.is_default,
  };
}

function normalizeGiftPreview(value: unknown, expected: { productReference: string; variantReference: string; quantity: number; countryCode: string }): GiftCheckoutPreview {
  if (!isRecord(value) || value.previewOnly !== true) throw new Error('Hediye sipariş özeti sunucudan doğrulanamadı.');
  if (typeof value.canCheckout !== 'boolean' || !isRecord(value.shipping) || !isRecord(value.promotion)) throw new Error('Hediye checkout durumu doğrulanamadı.');
  const quantity = safeInteger(value.quantity, 'Hediye ürün adedi', 1, 20);
  if (quantity !== expected.quantity) throw new Error('Hediye checkout adedi istekle eşleşmiyor.');
  const countryCode = normalizedCountryCode(value.countryCode);
  if (countryCode !== expected.countryCode) throw new Error('Hediye checkout ülkesi istekle eşleşmiyor.');
  const variantId = safeUuid(value.variantId, 'Varyant kimliği');
  if (variantId !== expected.variantReference) throw new Error('Hediye checkout varyantı istekle eşleşmiyor.');
  const subtotalMinor = safeInteger(value.subtotalMinor, 'Hediye ara toplamı');
  const shippingMinor = safeInteger(value.shippingMinor, 'Hediye kargo tutarı');
  const discountMinor = safeInteger(value.discountMinor, 'Hediye indirim tutarı');
  const totalMinor = safeInteger(value.totalMinor, 'Hediye toplamı');
  if (totalMinor !== subtotalMinor + shippingMinor - discountMinor) throw new Error('Hediye checkout toplamı bileşenleriyle eşleşmiyor.');
  return {
    canCheckout: value.canCheckout,
    blockingReason: optionalText(value.blockingReason, 200),
    countryCode,
    currency: normalizedCurrency(value.currency),
    productId: safeUuid(value.productId, 'Ürün kimliği'),
    productSlug: requiredText(value.productSlug, 'Ürün bağlantısı', 220),
    variantId,
    quantity,
    subtotalMinor,
    shippingMinor,
    discountMinor,
    totalMinor,
    totalWeightGrams: safeInteger(value.totalWeightGrams, 'Toplam ağırlık'),
    shippingWeightGrams: safeInteger(value.shippingWeightGrams, 'Kargo ağırlığı'),
    missingWeightQuantity: safeInteger(value.missingWeightQuantity, 'Eksik ağırlık adedi', 0, 20),
    availableQuantity: optionalSafeInteger(value.availableQuantity, 'Satılabilir stok', 0, 999999999),
    shipping: value.shipping,
    promotion: value.promotion,
    previewOnly: true,
  };
}

export async function getGiftProduct(reference: string) {
  return getProductDetail(requiredText(reference, 'Ürün referansı', 220));
}

export async function getGiftAccountOverview(): Promise<{
  profile: { id: string; display_name: string; phone: string | null };
  addresses: GiftSavedAddress[];
  paymentMethods: SavedPaymentMethod[];
  paymentReadiness: Awaited<ReturnType<typeof getCheckoutPaymentReadiness>>;
}> {
  const [{ data, error }, paymentMethods, paymentReadiness] = await Promise.all([
    supabase.rpc('get_my_account_overview_v1'),
    listMyPaymentMethods(),
    getCheckoutPaymentReadiness(),
  ]);
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || !isRecord(result.profile) || !Array.isArray(result.addresses)) throw new Error('Hediye gönderen hesap bilgisi doğrulanamadı.');
  if (result.addresses.length > 50) throw new Error('Kayıtlı adres sayısı desteklenen sınırı aşıyor.');
  const profile = result.profile;
  return {
    profile: {
      id: safeUuid(profile.id, 'Hesap kimliği'),
      display_name: requiredText(profile.display_name, 'Hesap adı', 120),
      phone: profile.phone == null || String(profile.phone).trim() === '' ? null : normalizedPhone(profile.phone, 'Hesap telefonu'),
    },
    addresses: result.addresses.map(normalizeSavedAddress),
    paymentMethods,
    paymentReadiness,
  };
}

export async function previewGiftCheckout(input: {
  productReference: string;
  variantReference: string;
  quantity: number;
  countryCode: string;
  couponCode?: string | null;
}): Promise<GiftCheckoutPreview> {
  const productReference = requiredText(input.productReference, 'Ürün referansı', 220);
  const variantReference = safeUuid(input.variantReference, 'Varyant kimliği');
  const quantity = safeInteger(input.quantity, 'Hediye ürün adedi', 1, 20);
  const countryCode = normalizedCountryCode(input.countryCode);
  const couponCode = normalizedCoupon(input.couponCode);
  const { data, error } = await supabase.rpc('preview_gift_checkout_v1', {
    p_product_reference: productReference,
    p_variant_reference: variantReference,
    p_quantity: quantity,
    p_country_code: countryCode,
    p_coupon_code: couponCode,
  });
  const preview = normalizeGiftPreview(unwrap<unknown>(data, error), { productReference, variantReference, quantity, countryCode });
  if (preview.productSlug !== productReference && preview.productId !== productReference) {
    // Product references may be slug, UUID or legacy ID. The server-authoritative
    // product identity above is still required, but legacy references cannot be
    // compared directly without re-reading the product.
    if (!productReference || productReference.length > 220) throw new Error('Hediye checkout ürün kimliği istekle eşleşmiyor.');
  }
  return preview;
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
    occasion: GiftOccasion;
    presentationStyle: GiftPresentationStyle;
    cardTitle?: string | null;
  };
}) {
  const productReference = requiredText(input.productReference, 'Ürün referansı', 220);
  const variantReference = requiredText(input.variantReference, 'Varyant referansı', 160);
  const quantity = safeInteger(input.quantity, 'Hediye ürün adedi', 1, 20);
  if (!isRecord(input.shippingAddress)) throw new Error('Hediye teslimat adresi geçersiz.');
  const countryCode = normalizedCountryCode(input.shippingAddress.country_code);
  const recipientName = requiredText(input.shippingAddress.recipient_name, 'Teslim alacak kişi', 120);
  const shippingPhone = normalizedPhone(input.shippingAddress.phone, 'Teslimat telefonu');
  const administrativeArea = optionalText(input.shippingAddress.administrative_area, 160);
  const city = requiredText(input.shippingAddress.city, 'Şehir veya ilçe', 160);
  const locality = optionalText(input.shippingAddress.locality, 160);
  const addressLine1 = requiredText(input.shippingAddress.address_line1, 'Açık teslimat adresi', 1000);
  if (addressLine1.length < 5) throw new Error('Açık teslimat adresi en az 5 karakter olmalıdır.');
  const addressLine2 = optionalText(input.shippingAddress.address_line2, 500);
  const postalCode = optionalText(input.shippingAddress.postal_code, 30);
  const deliveryNotes = optionalText(input.shippingAddress.delivery_notes, 500);
  const customerNote = optionalText(input.customerNote, 1000);
  const giftRecipientName = requiredText(input.gift?.recipientName, 'Hediye alıcısı', 120);
  const giftRecipientPhone = input.gift?.recipientPhone == null || String(input.gift.recipientPhone).trim() === '' ? null : normalizedPhone(input.gift.recipientPhone, 'Hediye alıcısının telefonu');
  const giftRecipientEmail = optionalEmail(input.gift?.recipientEmail);
  const giftMessage = optionalText(input.gift?.message, 1000);
  const senderName = optionalText(input.gift?.senderName, 120);
  if (typeof input.gift?.hidePrice !== 'boolean') throw new Error('Hediye fiyat görünürlüğü doğrulanamadı.');
  const occasion = input.gift?.occasion;
  if (!['just_because','birthday','love','thank_you','celebration','get_well','new_home','new_baby'].includes(occasion)) throw new Error('Hediye özel gün seçimi doğrulanamadı.');
  const presentationStyle = input.gift?.presentationStyle;
  if (!['oremar_gold','mountain_warmth','minimal_elegance'].includes(presentationStyle)) throw new Error('Hediye kartı stili doğrulanamadı.');
  const cardTitle = optionalText(input.gift?.cardTitle, 100);
  if (cardTitle && cardTitle.length < 2) throw new Error('Hediye kartı başlığı en az 2 karakter olmalıdır.');
  const couponCode = normalizedCoupon(input.couponCode);
  const idempotencyKey = `gift_${crypto.randomUUID().replaceAll('-', '')}`;

  const { data, error } = await supabase.rpc('create_customer_order_v4', {
    p_items: [{ productReference, variantReference, quantity }],
    p_shipping_address: {
      label: 'Hediye Teslimatı',
      recipient_name: recipientName,
      phone: shippingPhone,
      country_code: countryCode,
      administrative_area: administrativeArea,
      city,
      locality,
      address_line1: addressLine1,
      address_line2: addressLine2,
      postal_code: postalCode,
      delivery_notes: deliveryNotes,
    },
    p_customer_note: customerNote,
    p_coupon_code: couponCode,
    p_gift: {
      recipientName: giftRecipientName,
      recipientPhone: giftRecipientPhone,
      recipientEmail: giftRecipientEmail,
      message: giftMessage,
      senderName,
      hidePrice: input.gift.hidePrice,
      occasion,
      presentationStyle,
      cardTitle,
    },
    p_idempotency_key: idempotencyKey,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || result.ok !== true || result.gift !== true) throw new Error('Hediye siparişi sonucu sunucudan doğrulanamadı.');
  const orderId = safeUuid(result.orderId, 'Sipariş kimliği');
  const orderNumber = requiredText(result.orderNumber, 'Sipariş numarası', 120);
  const status = requiredText(result.status, 'Sipariş durumu', 80);
  const paymentStatus = requiredText(result.paymentStatus, 'Ödeme durumu', 80);
  const currency = normalizedCurrency(result.currency);
  const subtotalMinor = safeInteger(result.subtotalMinor, 'Ara toplam');
  const shippingMinor = safeInteger(result.shippingMinor, 'Kargo tutarı');
  const discountMinor = safeInteger(result.discountMinor, 'İndirim tutarı');
  const totalMinor = safeInteger(result.totalMinor, 'Sipariş toplamı');
  if (totalMinor !== subtotalMinor + shippingMinor - discountMinor) throw new Error('Hediye siparişi toplamı bileşenleriyle eşleşmiyor.');
  const responseCountry = normalizedCountryCode(result.shippingCountryCode);
  if (responseCountry !== countryCode) throw new Error('Hediye teslimat ülkesi istekle eşleşmiyor.');
  if (requiredText(result.giftOccasion, 'Hediye özel günü', 40) !== occasion) throw new Error('Hediye özel gün kaydı istekle eşleşmiyor.');
  if (requiredText(result.giftPresentationStyle, 'Hediye sunum stili', 40) !== presentationStyle) throw new Error('Hediye sunum stili istekle eşleşmiyor.');
  const reservationExpiresAt = requiredText(result.reservationExpiresAt, 'Stok rezervasyon süresi', 80);
  if (Number.isNaN(Date.parse(reservationExpiresAt))) throw new Error('Stok rezervasyon süresi doğrulanamadı.');
  return {
    ...result,
    orderId,
    orderNumber,
    status,
    paymentStatus,
    currency,
    subtotalMinor,
    shippingMinor,
    discountMinor,
    totalMinor,
    shippingCountryCode: responseCountry,
    reservationExpiresAt,
  };
}

export { publicCatalogUrl };
