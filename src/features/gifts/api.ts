import { supabase } from '../../lib/supabase';
import { getProductDetail, publicCatalogUrl } from '../catalog/api';

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

function safeUuid(value: unknown, label: string) {
  const uuid = requiredText(value, label, 160);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) throw new Error(`${label} doğrulanamadı.`);
  return uuid;
}

export async function getGiftProduct(reference: string) {
  return getProductDetail(requiredText(reference, 'Ürün referansı', 220));
}

export async function getGiftAccountOverview() {
  const { data, error } = await supabase.rpc('get_my_account_overview_v1');
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || !isRecord(result.profile)) throw new Error('Hediye gönderen hesap bilgisi doğrulanamadı.');
  const profile = result.profile;
  return {
    profile: {
      id: safeUuid(profile.id, 'Hesap kimliği'),
      display_name: requiredText(profile.display_name, 'Hesap adı', 120),
      phone: profile.phone == null || String(profile.phone).trim() === '' ? null : normalizedPhone(profile.phone, 'Hesap telefonu'),
    },
  };
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