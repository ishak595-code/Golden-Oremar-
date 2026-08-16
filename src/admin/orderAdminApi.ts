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

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function numberize(value: unknown) {
  return Number(value || 0);
}

export async function managementOrdersSnapshot(): Promise<ManagementOrdersSnapshot> {
  const { data, error } = await supabase.rpc('management_orders_snapshot_v1');
  const raw = unwrap<any>(data, error) || {};
  return {
    role: raw.role === 'producer' ? 'producer' : 'admin',
    producerId: raw.producerId ? String(raw.producerId) : null,
    loadedAt: String(raw.loadedAt || new Date().toISOString()),
    orders: Array.isArray(raw.orders) ? raw.orders.map((order: any) => ({
      ...order,
      id: String(order.id),
      orderNumber: String(order.orderNumber || order.id),
      customer: String(order.customer || 'Müşteri'),
      customerEmail: order.customerEmail ? String(order.customerEmail) : null,
      date: String(order.date || ''),
      status: String(order.status || 'draft') as ManagedOrderStatus,
      paymentStatus: String(order.paymentStatus || 'unpaid'),
      fulfillmentStatus: String(order.fulfillmentStatus || 'unfulfilled'),
      currency: String(order.currency || 'TRY'),
      total: numberize(order.total),
      totalMinor: numberize(order.totalMinor),
      reservationExpiresAt: order.reservationExpiresAt ? String(order.reservationExpiresAt) : null,
      shippingAddress: order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {},
      customerNote: order.customerNote ? String(order.customerNote) : null,
      returnStatus: order.returnStatus ? String(order.returnStatus) : null,
      returnReason: order.returnReason ? String(order.returnReason) : null,
      returnId: order.returnId ? String(order.returnId) : null,
      userId: String(order.userId || ''),
      trackingNumber: order.trackingNumber ? String(order.trackingNumber) : null,
      trackingUrl: order.trackingUrl ? String(order.trackingUrl) : null,
      items: Array.isArray(order.items) ? order.items.map((item: any) => ({
        ...item,
        id: String(item.id),
        productId: item.productId ? String(item.productId) : null,
        name: String(item.name || item.title || 'Ürün'),
        title: String(item.title || item.name || 'Ürün'),
        variantName: item.variantName ? String(item.variantName) : null,
        image: item.image ? String(item.image) : null,
        quantity: numberize(item.quantity),
        price: numberize(item.price),
        lineTotal: numberize(item.lineTotal),
        fulfillmentStatus: String(item.fulfillmentStatus || 'unfulfilled'),
        producerId: item.producerId ? String(item.producerId) : null,
      })) : [],
    })) : [],
  };
}

export async function managementUpdateOrderStatus(input: {
  orderId: string;
  status: ManagedOrderStatus;
  trackingNumber?: string | null;
  note?: string | null;
}) {
  const trackingNumber = input.trackingNumber?.trim() || null;
  const note = input.note?.trim() || null;
  if (trackingNumber && trackingNumber.length > 120) throw new Error('Kargo takip numarası 120 karakteri aşamaz.');
  if (note && note.length > 1000) throw new Error('Sipariş işlem notu 1000 karakteri aşamaz.');
  if (['partially_shipped', 'shipped'].includes(input.status) && (!trackingNumber || trackingNumber.length < 4)) {
    throw new Error('Kargolama için geçerli bir takip numarası gerekir.');
  }
  const { data, error } = await supabase.rpc('management_update_order_status_v1', {
    p_order_id: input.orderId,
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

export function formatOrderMoney(minor: number | null | undefined, currency = 'TRY') {
  return (Number(minor || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
}

export function orderAddressLabel(address: Record<string, any>) {
  const recipient = String(address.recipientName || address.recipient_name || '').trim();
  const line1 = String(address.line1 || address.address_line1 || address.address || '').trim();
  const district = String(address.district || '').trim();
  const city = String(address.city || address.province || '').trim();
  const postal = String(address.postalCode || address.postal_code || '').trim();
  const country = String(address.countryCode || address.country_code || '').trim();
  return {
    recipient,
    address: [line1, district, city, postal, country].filter(Boolean).join(', '),
    phone: String(address.phone || address.recipientPhone || '').trim(),
  };
}
