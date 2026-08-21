import { supabase } from '../../lib/supabase';

export type ProducerOrderScope = 'open' | 'shipped' | 'all';

type ProducerOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  producerSubtotalMinor: number;
  itemCount: number;
  remainingItemCount: number;
  processingItemCount: number;
  fulfilledItemCount: number;
  recipientName: string | null;
  destination: {
    countryCode: string | null;
    province: string | null;
    district: string | null;
  };
  placedAt: string | null;
  createdAt: string;
};

export type ProducerOrderPage = {
  scope: ProducerOrderScope;
  limit: number;
  offset: number;
  total: number;
  items: ProducerOrderListItem[];
};

export type ProducerOrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  producerSubtotalMinor: number;
  placedAt: string | null;
  shipping: {
    recipientName: string;
    phone: string;
    countryCode: string;
    province: string | null;
    district: string | null;
    neighborhood: string | null;
    addressLine: string;
    postalCode: string | null;
    deliveryNotes: string | null;
  };
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    sku: string | null;
    imagePath: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    fulfillmentStatus: string;
    shippedQuantity: number;
    remainingToShip: number;
  }>;
  shipments: Array<{
    id: string;
    carrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
    status: string;
    shippedAt: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
    items: Array<{ orderItemId: string; quantity: number }>;
  }>;
  canFulfill: boolean;
};

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, label: string, max = 1000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function safeBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function currency(value: unknown) {
  const code = requiredText(value, 'Para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('Para birimi doğrulanamadı.');
  return code;
}

function countryCode(value: unknown, label: string, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const code = requiredText(value, label, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`${label} doğrulanamadı.`);
  return code;
}

function isoDateTime(value: unknown, label: string, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function httpsUrl(value: unknown, label: string) {
  const text = optionalText(value, label, 500);
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} doğrulanamadı.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} yalnız güvenli HTTPS bağlantısı olmalıdır.`);
  return url.toString();
}

function safeAssetPath(value: unknown) {
  const path = optionalText(value, 'Ürün görsel yolu', 1200);
  if (!path) return null;
  const normalized = path.replace(/^\/+/, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized) || normalized.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Ürün görsel yolu doğrulanamadı.');
  }
  return normalized;
}

function normalizeListItem(value: unknown, index: number): ProducerOrderListItem {
  if (!isRecord(value) || !isRecord(value.destination)) throw new Error(`${index + 1}. sipariş özeti doğrulanamadı.`);
  const itemCount = safeInteger(value.itemCount, 'Sipariş kalem sayısı', 1, 100000);
  const remainingItemCount = safeInteger(value.remainingItemCount, 'Bekleyen kalem sayısı', 0, itemCount);
  const processingItemCount = safeInteger(value.processingItemCount, 'Hazırlanan kalem sayısı', 0, itemCount);
  const fulfilledItemCount = safeInteger(value.fulfilledItemCount, 'Gönderilen kalem sayısı', 0, itemCount);
  return {
    id: uuid(value.id, 'Sipariş kimliği'),
    orderNumber: requiredText(value.orderNumber, 'Sipariş numarası', 120),
    status: requiredText(value.status, 'Sipariş durumu', 60),
    paymentStatus: requiredText(value.paymentStatus, 'Ödeme durumu', 60),
    fulfillmentStatus: requiredText(value.fulfillmentStatus, 'Gönderim durumu', 60),
    currency: currency(value.currency),
    producerSubtotalMinor: safeInteger(value.producerSubtotalMinor, 'Satıcı sipariş tutarı'),
    itemCount,
    remainingItemCount,
    processingItemCount,
    fulfilledItemCount,
    recipientName: optionalText(value.recipientName, 'Alıcı adı', 200),
    destination: {
      countryCode: countryCode(value.destination.countryCode, 'Teslimat ülke kodu'),
      province: optionalText(value.destination.province, 'Teslimat il/bölge', 160),
      district: optionalText(value.destination.district, 'Teslimat ilçe', 160),
    },
    placedAt: isoDateTime(value.placedAt, 'Sipariş tarihi'),
    createdAt: isoDateTime(value.createdAt, 'Sipariş oluşturulma tarihi', true) as string,
  };
}

function normalizeDetailItem(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. sipariş kalemi doğrulanamadı.`);
  const quantity = safeInteger(value.quantity, 'Sipariş adedi', 1, 1_000_000);
  const shippedQuantity = safeInteger(value.shippedQuantity, 'Gönderilen adet', 0, quantity);
  const remainingToShip = safeInteger(value.remainingToShip, 'Kalan gönderim adedi', 0, quantity);
  if (remainingToShip !== quantity - shippedQuantity) throw new Error(`${index + 1}. sipariş kalemi gönderim miktarı tutarsız.`);
  const unitPriceMinor = safeInteger(value.unitPriceMinor, 'Birim fiyat');
  const lineTotalMinor = safeInteger(value.lineTotalMinor, 'Satır toplamı');
  if (lineTotalMinor !== unitPriceMinor * quantity) throw new Error(`${index + 1}. sipariş kalemi tutarı tutarsız.`);
  return {
    id: uuid(value.id, 'Sipariş kalemi kimliği'),
    productId: uuid(value.productId, 'Ürün kimliği'),
    variantId: value.variantId == null ? null : uuid(value.variantId, 'Varyant kimliği'),
    productName: requiredText(value.productName, 'Ürün adı', 300),
    variantName: optionalText(value.variantName, 'Varyant adı', 240),
    sku: optionalText(value.sku, 'SKU', 160),
    imagePath: safeAssetPath(value.imagePath),
    quantity,
    unitPriceMinor,
    lineTotalMinor,
    fulfillmentStatus: requiredText(value.fulfillmentStatus, 'Kalem gönderim durumu', 60),
    shippedQuantity,
    remainingToShip,
  };
}

function normalizeShipment(value: unknown, index: number) {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 100) throw new Error(`${index + 1}. kargo kaydı doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Kargo kimliği'),
    carrier: requiredText(value.carrier, 'Taşıyıcı adı', 100),
    trackingNumber: requiredText(value.trackingNumber, 'Takip numarası', 160),
    trackingUrl: httpsUrl(value.trackingUrl, 'Takip bağlantısı'),
    status: requiredText(value.status, 'Kargo durumu', 60),
    shippedAt: isoDateTime(value.shippedAt, 'Kargoya verilme tarihi'),
    estimatedDeliveryAt: isoDateTime(value.estimatedDeliveryAt, 'Tahmini teslim tarihi'),
    deliveredAt: isoDateTime(value.deliveredAt, 'Teslim tarihi'),
    items: value.items.map((item, itemIndex) => {
      if (!isRecord(item)) throw new Error(`${index + 1}.${itemIndex + 1}. kargo kalemi doğrulanamadı.`);
      return {
        orderItemId: uuid(item.orderItemId, 'Kargo sipariş kalemi kimliği'),
        quantity: safeInteger(item.quantity, 'Kargo adedi', 1, 1_000_000),
      };
    }),
  };
}

function normalizeDetail(value: unknown): ProducerOrderDetail {
  if (!isRecord(value) || !isRecord(value.shipping)) throw new Error('Satıcı sipariş ayrıntısı doğrulanamadı.');
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 500) throw new Error('Satıcı sipariş kalemleri doğrulanamadı.');
  if (!Array.isArray(value.shipments) || value.shipments.length > 500) throw new Error('Satıcı kargo geçmişi doğrulanamadı.');
  const items = value.items.map(normalizeDetailItem);
  const producerSubtotalMinor = safeInteger(value.producerSubtotalMinor, 'Satıcı sipariş tutarı');
  const computedSubtotal = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  if (!Number.isSafeInteger(computedSubtotal) || producerSubtotalMinor !== computedSubtotal) throw new Error('Satıcı sipariş toplamı sunucudan tutarsız geldi.');
  return {
    id: uuid(value.id, 'Sipariş kimliği'),
    orderNumber: requiredText(value.orderNumber, 'Sipariş numarası', 120),
    status: requiredText(value.status, 'Sipariş durumu', 60),
    paymentStatus: requiredText(value.paymentStatus, 'Ödeme durumu', 60),
    fulfillmentStatus: requiredText(value.fulfillmentStatus, 'Gönderim durumu', 60),
    currency: currency(value.currency),
    producerSubtotalMinor,
    placedAt: isoDateTime(value.placedAt, 'Sipariş tarihi'),
    shipping: {
      recipientName: requiredText(value.shipping.recipientName, 'Alıcı adı', 200),
      phone: requiredText(value.shipping.phone, 'Teslimat telefonu', 40),
      countryCode: countryCode(value.shipping.countryCode, 'Teslimat ülke kodu', true) as string,
      province: optionalText(value.shipping.province, 'Teslimat il/bölge', 160),
      district: optionalText(value.shipping.district, 'Teslimat ilçe', 160),
      neighborhood: optionalText(value.shipping.neighborhood, 'Teslimat mahalle/köy', 200),
      addressLine: requiredText(value.shipping.addressLine, 'Teslimat adresi', 500),
      postalCode: optionalText(value.shipping.postalCode, 'Posta kodu', 30),
      deliveryNotes: optionalText(value.shipping.deliveryNotes, 'Teslimat notu', 1000),
    },
    items,
    shipments: value.shipments.map(normalizeShipment),
    canFulfill: safeBoolean(value.canFulfill, 'Sipariş gönderilebilirlik durumu'),
  };
}

export async function listProducerOrders(scope: ProducerOrderScope = 'open', limit = 30, offset = 0): Promise<ProducerOrderPage> {
  if (!['open', 'shipped', 'all'].includes(scope)) throw new Error('Sipariş filtresi doğrulanamadı.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Sipariş sayfa boyutu doğrulanamadı.');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error('Sipariş sayfa konumu doğrulanamadı.');
  const { data, error } = await supabase.rpc('list_my_producer_orders_v1', {
    p_scope: scope,
    p_limit: limit,
    p_offset: offset,
  });
  const payload = unwrap<unknown>(data, error);
  if (!isRecord(payload) || !Array.isArray(payload.items) || payload.items.length > limit) throw new Error('Satıcı sipariş listesi sunucudan doğrulanamadı.');
  const normalizedScope = requiredText(payload.scope, 'Sipariş filtre cevabı', 20);
  if (normalizedScope !== scope) throw new Error('Sipariş filtre cevabı istekle eşleşmiyor.');
  const responseLimit = safeInteger(payload.limit, 'Sipariş sayfa boyutu', 1, 100);
  const responseOffset = safeInteger(payload.offset, 'Sipariş sayfa konumu', 0, 1_000_000);
  if (responseLimit !== limit || responseOffset !== offset) throw new Error('Sipariş sayfalama cevabı istekle eşleşmiyor.');
  const total = safeInteger(payload.total, 'Sipariş toplam sayısı', 0, 10_000_000);
  const items = payload.items.map(normalizeListItem);
  if (offset === 0 && total < items.length) throw new Error('Sipariş toplam sayısı sunucudan tutarsız geldi.');
  return { scope, limit, offset, total, items };
}

export async function getProducerOrderDetail(orderId: string) {
  const normalizedOrderId = uuid(orderId, 'Sipariş kimliği');
  const { data, error } = await supabase.rpc('get_my_producer_order_detail_v1', {
    p_order_id: normalizedOrderId,
  });
  const detail = normalizeDetail(unwrap<unknown>(data, error));
  if (detail.id !== normalizedOrderId) throw new Error('Sipariş ayrıntısı istekle eşleşmiyor.');
  return detail;
}

export async function markProducerOrderItemsProcessing(orderId: string, orderItemIds: string[]) {
  const normalizedOrderId = uuid(orderId, 'Sipariş kimliği');
  if (!Array.isArray(orderItemIds) || orderItemIds.length < 1 || orderItemIds.length > 50) throw new Error('Hazırlanacak 1 ile 50 sipariş kalemi seçin.');
  const normalizedIds = orderItemIds.map((id, index) => uuid(id, `${index + 1}. sipariş kalemi kimliği`));
  if (new Set(normalizedIds).size !== normalizedIds.length) throw new Error('Aynı sipariş kalemi birden fazla kez seçilemez.');
  const { data, error } = await supabase.rpc('producer_mark_order_items_processing_v1', {
    p_order_id: normalizedOrderId,
    p_order_item_ids: normalizedIds,
  });
  const detail = normalizeDetail(unwrap<unknown>(data, error));
  if (detail.id !== normalizedOrderId) throw new Error('Güncellenen sipariş cevabı istekle eşleşmiyor.');
  return detail;
}

export async function createProducerShipment(input: {
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  estimatedDeliveryAt?: string | null;
}) {
  const orderId = uuid(input.orderId, 'Sipariş kimliği');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) throw new Error('Kargoya verilecek 1 ile 50 sipariş kalemi seçin.');
  const items = input.items.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${index + 1}. kargo kalemi doğrulanamadı.`);
    return {
      orderItemId: uuid(item.orderItemId, `${index + 1}. sipariş kalemi kimliği`),
      quantity: safeInteger(item.quantity, `${index + 1}. gönderim adedi`, 1, 1_000_000),
    };
  });
  if (new Set(items.map(item => item.orderItemId)).size !== items.length) throw new Error('Aynı sipariş kalemi bir kargoya birden fazla kez eklenemez.');
  const carrier = requiredText(input.carrier, 'Kargo/taşıyıcı', 100);
  if (carrier.length < 2) throw new Error('Kargo/taşıyıcı adı en az 2 karakter olmalıdır.');
  const trackingNumber = requiredText(input.trackingNumber, 'Takip numarası', 160);
  if (trackingNumber.length < 2) throw new Error('Takip numarası en az 2 karakter olmalıdır.');
  const trackingUrl = httpsUrl(input.trackingUrl, 'Takip bağlantısı');
  let estimatedDeliveryAt: string | null = null;
  if (input.estimatedDeliveryAt) {
    estimatedDeliveryAt = isoDateTime(input.estimatedDeliveryAt, 'Tahmini teslim tarihi', true);
    const timestamp = new Date(estimatedDeliveryAt as string).getTime();
    const now = Date.now();
    if (timestamp < now - 5 * 60_000 || timestamp > now + 120 * 24 * 60 * 60_000) throw new Error('Tahmini teslim tarihi geçerli aralıkta değildir.');
  }
  const { data, error } = await supabase.rpc('producer_create_shipment_v1', {
    p_order_id: orderId,
    p_items: items,
    p_carrier: carrier,
    p_tracking_number: trackingNumber,
    p_tracking_url: trackingUrl,
    p_estimated_delivery_at: estimatedDeliveryAt,
  });
  const detail = normalizeDetail(unwrap<unknown>(data, error));
  if (detail.id !== orderId) throw new Error('Kargo sonrası sipariş cevabı istekle eşleşmiyor.');
  return detail;
}
