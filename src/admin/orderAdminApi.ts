import { supabase } from '../lib/supabase';

export type ManagedOrderStatus = 'draft' | 'pending_payment' | 'confirmed' | 'preparing' | 'partially_shipped' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

export type ManagedOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  title: string;
  variantName: string | null;
  image: string | null;
  quantity: number;
  price: number;
  lineTotal: number;
  fulfillmentStatus: string;
  producerId: string | null;
};

export type ManagedGift = {
  recipientName: string;
  message: string | null;
  senderName: string | null;
  hidePrice: boolean;
  occasion: string | null;
  presentationStyle: string | null;
  cardTitle: string | null;
};

export type ManagedPaymentMethod = {
  provider: string;
  brand: string;
  last4: string;
  nickname: string | null;
  expMonth: number | null;
  expYear: number | null;
  status: string;
};

export type ManagedOrder = {
  id: string;
  orderNumber: string;
  customer: string;
  customerEmail: string | null;
  date: string;
  status: ManagedOrderStatus;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  total: number;
  totalMinor: number;
  reservationExpiresAt: string | null;
  shippingAddress: Record<string, any>;
  customerNote: string | null;
  items: ManagedOrderItem[];
  gift: ManagedGift | null;
  paymentMethod: ManagedPaymentMethod | null;
  returnStatus: string | null;
  returnReason: string | null;
  returnId: string | null;
  userId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type ManagementOrdersSnapshot = {
  orders: ManagedOrder[];
  role: 'admin' | 'producer';
  producerId: string | null;
  loadedAt: string;
};

const ORDER_STATUSES = new Set<ManagedOrderStatus>(['draft','pending_payment','confirmed','preparing','partially_shipped','shipped','delivered','completed','cancelled','refunded']);

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 300) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, max = 1000) {
  if (value == null || value === '') return null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error('Sipariş metin alanı doğrulanamadı.');
  return text;
}

function verifiedNumber(value: unknown, label: string, min = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function verifiedInteger(value: unknown, label: string, min = 0) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function normalizeDate(value: unknown, label: string) {
  const text = requiredText(value, label, 80);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function normalizeCurrency(value: unknown) {
  const currency = requiredText(value, 'Sipariş para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Sipariş para birimi doğrulanamadı.');
  return currency;
}

function normalizeGift(value: unknown): ManagedGift | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('Hediye hazırlama bilgisi doğrulanamadı.');
  if (typeof value.hidePrice !== 'boolean') throw new Error('Hediye fiyat görünürlüğü doğrulanamadı.');
  return {
    recipientName: requiredText(value.recipientName, 'Hediye alıcısı', 120),
    message: optionalText(value.message, 1000),
    senderName: optionalText(value.senderName, 120),
    hidePrice: value.hidePrice,
    occasion: optionalText(value.occasion, 40),
    presentationStyle: optionalText(value.presentationStyle, 40),
    cardTitle: optionalText(value.cardTitle, 100),
  };
}

function normalizePaymentMethod(value: unknown): ManagedPaymentMethod | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('Sipariş ödeme yöntemi doğrulanamadı.');
  const last4 = requiredText(value.last4, 'Kart son dört hanesi', 4);
  if (!/^\d{4}$/.test(last4)) throw new Error('Kart son dört hanesi doğrulanamadı.');
  const expMonth = value.expMonth == null ? null : verifiedInteger(value.expMonth, 'Kart son kullanma ayı', 1);
  if (expMonth != null && expMonth > 12) throw new Error('Kart son kullanma ayı doğrulanamadı.');
  const expYear = value.expYear == null ? null : verifiedInteger(value.expYear, 'Kart son kullanma yılı', 2024);
  if (expYear != null && expYear > 2200) throw new Error('Kart son kullanma yılı doğrulanamadı.');
  return {
    provider: requiredText(value.provider, 'Ödeme sağlayıcısı', 40),
    brand: requiredText(value.brand, 'Kart markası', 40),
    last4,
    nickname: optionalText(value.nickname, 40),
    expMonth,
    expYear,
    status: requiredText(value.status, 'Kart durumu', 20),
  };
}

function normalizeItem(item: unknown, index: number): ManagedOrderItem {
  if (!isRecord(item)) throw new Error(`${index + 1}. sipariş kalemi doğrulanamadı.`);
  const name = requiredText(item.name || item.title, `${index + 1}. ürün adı`, 300);
  return {
    id: requiredText(item.id, `${index + 1}. sipariş kalemi kimliği`, 160),
    productId: optionalText(item.productId, 160),
    name,
    title: requiredText(item.title || item.name, `${index + 1}. ürün başlığı`, 300),
    variantName: optionalText(item.variantName, 240),
    image: optionalText(item.image, 1000),
    quantity: verifiedInteger(item.quantity, `${index + 1}. ürün adedi`, 1),
    price: verifiedNumber(item.price, `${index + 1}. birim fiyat`),
    lineTotal: verifiedNumber(item.lineTotal, `${index + 1}. satır toplamı`),
    fulfillmentStatus: requiredText(item.fulfillmentStatus, `${index + 1}. fulfillment durumu`, 80),
    producerId: optionalText(item.producerId, 160),
  };
}

function normalizeOrder(order: unknown, index: number): ManagedOrder {
  if (!isRecord(order)) throw new Error(`${index + 1}. sipariş doğrulanamadı.`);
  const statusText = requiredText(order.status, 'Sipariş durumu', 40) as ManagedOrderStatus;
  if (!ORDER_STATUSES.has(statusText)) throw new Error('Sipariş durumu doğrulanamadı.');
  if (!isRecord(order.shippingAddress)) throw new Error('Teslimat adresi doğrulanamadı.');
  if (!Array.isArray(order.items) || order.items.length > 200) throw new Error('Sipariş ürünleri doğrulanamadı.');
  const totalMinor = verifiedInteger(order.totalMinor, 'Sipariş toplamı');
  const total = verifiedNumber(order.total, 'Sipariş görüntüleme toplamı');
  const expectedTotal = totalMinor / 100;
  if (Math.abs(total - expectedTotal) > 0.0001) throw new Error('Sipariş toplamı minor-unit değeriyle eşleşmiyor.');
  return {
    id: requiredText(order.id, 'Sipariş kimliği', 160),
    orderNumber: requiredText(order.orderNumber, 'Sipariş numarası', 160),
    customer: requiredText(order.customer, 'Müşteri adı', 240),
    customerEmail: optionalText(order.customerEmail, 254),
    date: normalizeDate(order.date, 'Sipariş tarihi'),
    status: statusText,
    paymentStatus: requiredText(order.paymentStatus, 'Ödeme durumu', 80),
    fulfillmentStatus: requiredText(order.fulfillmentStatus, 'Fulfillment durumu', 80),
    currency: normalizeCurrency(order.currency),
    total,
    totalMinor,
    reservationExpiresAt: order.reservationExpiresAt == null ? null : normalizeDate(order.reservationExpiresAt, 'Stok rezervasyon süresi'),
    shippingAddress: order.shippingAddress,
    customerNote: optionalText(order.customerNote, 1000),
    items: order.items.map(normalizeItem),
    gift: normalizeGift(order.gift),
    paymentMethod: normalizePaymentMethod(order.paymentMethod),
    returnStatus: optionalText(order.returnStatus, 80),
    returnReason: optionalText(order.returnReason, 1000),
    returnId: optionalText(order.returnId, 160),
    userId: requiredText(order.userId, 'Müşteri kimliği', 160),
    trackingNumber: optionalText(order.trackingNumber, 120),
    trackingUrl: optionalText(order.trackingUrl, 1000),
  };
}

export async function managementOrdersSnapshot(): Promise<ManagementOrdersSnapshot> {
  const { data, error } = await supabase.rpc('management_orders_snapshot_v2');
  const raw = unwrap<unknown>(data, error);
  if (!isRecord(raw) || !Array.isArray(raw.orders) || raw.orders.length > 5000) throw new Error('Sipariş yönetim cevabı doğrulanamadı.');
  const role = raw.role === 'producer' ? 'producer' : raw.role === 'admin' ? 'admin' : null;
  if (!role) throw new Error('Sipariş yönetim rolü doğrulanamadı.');
  return {
    role,
    producerId: raw.producerId == null ? null : requiredText(raw.producerId, 'Üretici kimliği', 160),
    loadedAt: normalizeDate(raw.loadedAt, 'Sipariş yönetim güncelleme zamanı'),
    orders: raw.orders.map(normalizeOrder),
  };
}

export async function managementUpdateOrderStatus(input: {
  orderId: string;
  status: ManagedOrderStatus;
  trackingNumber?: string | null;
  note?: string | null;
}) {
  const orderId = requiredText(input.orderId, 'Sipariş kimliği', 160);
  if (!ORDER_STATUSES.has(input.status)) throw new Error('Sipariş geçiş durumu doğrulanamadı.');
  const trackingNumber = input.trackingNumber?.trim() || null;
  const note = input.note?.trim() || null;
  if (trackingNumber && trackingNumber.length > 120) throw new Error('Kargo takip numarası 120 karakteri aşamaz.');
  if (note && note.length > 1000) throw new Error('Sipariş işlem notu 1000 karakteri aşamaz.');
  if (['partially_shipped', 'shipped'].includes(input.status) && (!trackingNumber || trackingNumber.length < 4)) throw new Error('Kargolama için geçerli bir takip numarası gerekir.');
  const { data, error } = await supabase.rpc('management_update_order_status_v1', {
    p_order_id: orderId,
    p_status: input.status,
    p_tracking_number: trackingNumber,
    p_note: note,
  });
  return unwrap<any>(data, error);
}

export function allowedAdminOrderTransitions(status: ManagedOrderStatus): ManagedOrderStatus[] {
  const map: Record<ManagedOrderStatus, ManagedOrderStatus[]> = {
    draft: ['pending_payment', 'cancelled'],
    pending_payment: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['partially_shipped', 'shipped', 'cancelled'],
    partially_shipped: ['shipped'],
    shipped: ['delivered'],
    delivered: ['completed'],
    completed: [],
    cancelled: [],
    refunded: [],
  };
  return map[status] || [];
}

export function orderAdminErrorMessage(error: unknown, fallback = 'Sipariş işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['authentication_required', 'Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.'],
    ['management_role_required', 'Bu sipariş yönetim alanı için yetkiniz yok.'],
    ['order_access_denied', 'Bu siparişe erişim yetkiniz yok.'],
    ['order_not_found', 'Sipariş artık bulunamadı. Listeyi yenileyin.'],
    ['invalid_order_status_transition', 'Bu sipariş durumu doğrudan seçilen duruma geçirilemez. İş akışını sırayla ilerletin.'],
    ['verified_payment_required_before_confirmation', 'Doğrulanmış ödeme olmadan sipariş onaylanamaz.'],
    ['paid_order_requires_refund_workflow', 'Ödemesi alınmış sipariş doğrudan iptal edilemez. İade ve geri ödeme akışını kullanın.'],
    ['tracking_number_required', 'Kargolama için en az 4 karakterlik takip numarası gerekir.'],
    ['order_is_terminal', 'Tamamlanmış, iptal edilmiş veya geri ödenmiş sipariş artık bu akıştan değiştirilemez.'],
    ['order_not_ready_for_fulfillment', 'Sipariş henüz hazırlama veya sevkiyat aşamasına uygun değil.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function formatOrderMoney(minor: number | null | undefined, currency: string) {
  if (!Number.isSafeInteger(minor) || Number(minor) < 0 || !/^[A-Z]{3}$/.test(currency)) return 'Tutar doğrulanamadı';
  return (Number(minor) / 100).toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
}

export function orderAddressLabel(address: Record<string, any>) {
  const recipient = String(address.recipientName || address.recipient_name || '').trim();
  const line1 = String(address.line1 || address.address_line1 || address.address_line || address.address || '').trim();
  const district = String(address.district || address.city || '').trim();
  const city = String(address.province || address.administrative_area || '').trim();
  const postal = String(address.postalCode || address.postal_code || '').trim();
  const country = String(address.countryCode || address.country_code || '').trim().toUpperCase();
  return {
    recipient,
    address: [line1, district, city, postal, country].filter(Boolean).join(', '),
    phone: String(address.phone || address.recipientPhone || '').trim(),
  };
}
