import { supabase } from '../lib/supabase';

export type ManagedOrderStatus = 'draft' | 'pending_payment' | 'confirmed' | 'preparing' | 'partially_shipped' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'refunded';
export type SettlementStatus = 'not_required' | 'awaiting_completion' | 'blocked' | 'pending_approval' | 'processing' | 'released' | 'failed';

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

export type ManagedSettlement = {
  status: SettlementStatus;
  reason: string;
  eligible: boolean;
  canRelease: boolean;
  currency: string;
  pendingSellerMinor: number;
  availableSellerMinor: number;
  saleCount: number;
  pendingSaleCount: number;
  availableSaleCount: number;
  splitCount: number;
  pendingSplitCount: number;
  approvedSplitCount: number;
  hasOpenReturn: boolean;
  hasRefundBlock: boolean;
  requestedAt: string | null;
  releasedAt: string | null;
  lastError: string | null;
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
  shippingAddress: Record<string, unknown>;
  customerNote: string | null;
  items: ManagedOrderItem[];
  gift: ManagedGift | null;
  paymentMethod: ManagedPaymentMethod | null;
  returnStatus: string | null;
  returnReason: string | null;
  returnId: string | null;
  vendorId: string | null;
  userId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  settlement: ManagedSettlement | null;
};

export type ManagementOrdersSnapshot = {
  orders: ManagedOrder[];
  role: 'admin' | 'producer';
  producerId: string | null;
  loadedAt: string;
};

const ORDER_STATUSES: ManagedOrderStatus[] = ['draft', 'pending_payment', 'confirmed', 'preparing', 'partially_shipped', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
const SETTLEMENT_STATUSES: SettlementStatus[] = ['not_required', 'awaiting_completion', 'blocked', 'pending_approval', 'processing', 'released', 'failed'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, label: string, max = 500) { const result = typeof value === 'string' ? value.trim() : ''; if (!result || result.length > max || /[\u0000-\u001F\u007F]/.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function optionalText(value: unknown, label: string, max = 1000) { if (value == null || value === '') return null; if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`); const result = value.trim(); if (!result) return null; if (result.length > max || /[\u0000-\u001F\u007F]/.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function bool(value: unknown, label: string) { if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`); return value; }
function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`); return value; }
function finite(value: unknown, label: string) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} doğrulanamadı.`); return value; }
function uuid(value: unknown, label: string, nullable = false) { if (nullable && (value == null || value === '')) return null; const result = text(value, label, 80); if (!UUID_RE.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function currency(value: unknown) { const code = text(value, 'Para birimi', 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) throw new Error('Para birimi doğrulanamadı.'); return code; }
function dateTime(value: unknown, label: string, nullable = false) { if (nullable && (value == null || value === '')) return null; const result = text(value, label, 80); if (Number.isNaN(Date.parse(result))) throw new Error(`${label} doğrulanamadı.`); return result; }

function normalizeItem(value: unknown, index: number): ManagedOrderItem {
  if (!isRecord(value)) throw new Error(`${index + 1}. sipariş kalemi doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Sipariş kalemi kimliği') as string,
    productId: uuid(value.productId, 'Ürün kimliği', true),
    name: text(value.name ?? value.title, 'Ürün adı', 300),
    title: text(value.title ?? value.name, 'Ürün başlığı', 300),
    variantName: optionalText(value.variantName, 'Varyant adı', 240),
    image: optionalText(value.image, 'Ürün görsel yolu', 1000),
    quantity: integer(value.quantity, 'Ürün adedi', 1, 100000),
    price: finite(value.price, 'Birim fiyat'),
    lineTotal: finite(value.lineTotal, 'Satır toplamı'),
    fulfillmentStatus: text(value.fulfillmentStatus, 'Kalem gönderim durumu', 60),
    producerId: uuid(value.producerId, 'Satıcı kimliği', true),
  };
}

function normalizeGift(value: unknown): ManagedGift | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('Hediye talimatı doğrulanamadı.');
  return {
    recipientName: text(value.recipientName, 'Hediye alıcısı', 240),
    message: optionalText(value.message, 'Hediye mesajı', 1000),
    senderName: optionalText(value.senderName, 'Hediye göndereni', 240),
    hidePrice: bool(value.hidePrice, 'Fiyat gizleme tercihi'),
    occasion: optionalText(value.occasion, 'Özel gün', 80),
    presentationStyle: optionalText(value.presentationStyle, 'Hediye sunumu', 80),
    cardTitle: optionalText(value.cardTitle, 'Kart başlığı', 160),
  };
}

function normalizePaymentMethod(value: unknown): ManagedPaymentMethod | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('Ödeme yöntemi doğrulanamadı.');
  const last4 = text(value.last4, 'Kart son dört hanesi', 4);
  if (!/^\d{4}$/.test(last4)) throw new Error('Kart son dört hanesi doğrulanamadı.');
  return {
    provider: text(value.provider, 'Ödeme sağlayıcısı', 80),
    brand: text(value.brand, 'Kart markası', 80),
    last4,
    nickname: optionalText(value.nickname, 'Kart rumuzu', 120),
    expMonth: value.expMonth == null ? null : integer(value.expMonth, 'Son kullanma ayı', 1, 12),
    expYear: value.expYear == null ? null : integer(value.expYear, 'Son kullanma yılı', 2000, 2200),
    status: text(value.status, 'Ödeme yöntemi durumu', 40),
  };
}

function normalizeSettlement(value: unknown, orderCurrency: string): ManagedSettlement | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error('Hakediş havuzu durumu doğrulanamadı.');
  const status = text(value.status, 'Hakediş durumu', 40) as SettlementStatus;
  if (!SETTLEMENT_STATUSES.includes(status)) throw new Error('Hakediş durumu doğrulanamadı.');
  const settlementCurrency = currency(value.currency);
  if (settlementCurrency !== orderCurrency) throw new Error('Hakediş para birimi siparişle eşleşmiyor.');
  const splitCount = integer(value.splitCount, 'Ödeme kırılımı sayısı');
  const pendingSplitCount = integer(value.pendingSplitCount, 'Bekleyen ödeme kırılımı');
  const approvedSplitCount = integer(value.approvedSplitCount, 'Onaylı ödeme kırılımı');
  if (pendingSplitCount + approvedSplitCount > splitCount) throw new Error('Hakediş kırılım sayıları tutarsız.');
  return {
    status,
    reason: text(value.reason, 'Hakediş gerekçesi', 120),
    eligible: bool(value.eligible, 'Hakediş uygunluğu'),
    canRelease: bool(value.canRelease, 'Hakediş yetkisi'),
    currency: settlementCurrency,
    pendingSellerMinor: integer(value.pendingSellerMinor, 'Bekleyen satıcı hakedişi'),
    availableSellerMinor: integer(value.availableSellerMinor, 'Kullanılabilir satıcı hakedişi'),
    saleCount: integer(value.saleCount, 'Satıcı satış kaydı sayısı'),
    pendingSaleCount: integer(value.pendingSaleCount, 'Bekleyen satış kaydı sayısı'),
    availableSaleCount: integer(value.availableSaleCount, 'Kullanılabilir satış kaydı sayısı'),
    splitCount,
    pendingSplitCount,
    approvedSplitCount,
    hasOpenReturn: bool(value.hasOpenReturn, 'Açık iade durumu'),
    hasRefundBlock: bool(value.hasRefundBlock, 'Geri ödeme engeli'),
    requestedAt: dateTime(value.requestedAt, 'Hakediş talep tarihi', true),
    releasedAt: dateTime(value.releasedAt, 'Hakediş serbest bırakma tarihi', true),
    lastError: optionalText(value.lastError, 'Hakediş hata bilgisi', 500),
  };
}

function normalizeOrder(value: unknown, index: number): ManagedOrder {
  if (!isRecord(value)) throw new Error(`${index + 1}. sipariş doğrulanamadı.`);
  const status = text(value.status, 'Sipariş durumu', 40) as ManagedOrderStatus;
  if (!ORDER_STATUSES.includes(status)) throw new Error(`${index + 1}. sipariş durumu doğrulanamadı.`);
  const code = currency(value.currency);
  if (!isRecord(value.shippingAddress)) throw new Error(`${index + 1}. teslimat adresi doğrulanamadı.`);
  if (!Array.isArray(value.items) || value.items.length > 500) throw new Error(`${index + 1}. sipariş kalemleri doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Sipariş kimliği') as string,
    orderNumber: text(value.orderNumber, 'Sipariş numarası', 160),
    customer: text(value.customer, 'Müşteri adı', 240),
    customerEmail: optionalText(value.customerEmail, 'Müşteri e-postası', 254),
    date: dateTime(value.date, 'Sipariş tarihi') as string,
    status,
    paymentStatus: text(value.paymentStatus, 'Ödeme durumu', 60),
    fulfillmentStatus: text(value.fulfillmentStatus, 'Sipariş gönderim durumu', 60),
    currency: code,
    total: finite(value.total, 'Sipariş toplamı'),
    totalMinor: integer(value.totalMinor, 'Sipariş toplamı'),
    reservationExpiresAt: dateTime(value.reservationExpiresAt, 'Rezervasyon sonu', true),
    shippingAddress: value.shippingAddress,
    customerNote: optionalText(value.customerNote, 'Müşteri notu', 3000),
    items: value.items.map(normalizeItem),
    gift: normalizeGift(value.gift),
    paymentMethod: normalizePaymentMethod(value.paymentMethod),
    returnStatus: optionalText(value.returnStatus, 'İade durumu', 80),
    returnReason: optionalText(value.returnReason, 'İade gerekçesi', 3000),
    returnId: uuid(value.returnId, 'İade kimliği', true),
    vendorId: uuid(value.vendorId, 'Satıcı kimliği', true),
    userId: uuid(value.userId, 'Müşteri kimliği') as string,
    trackingNumber: optionalText(value.trackingNumber, 'Takip numarası', 160),
    trackingUrl: optionalText(value.trackingUrl, 'Takip bağlantısı', 1000),
    settlement: normalizeSettlement(value.settlement, code),
  };
}

export async function managementOrdersSnapshot(): Promise<ManagementOrdersSnapshot> {
  const { data, error } = await supabase.rpc('management_orders_snapshot_v2');
  if (error) throw error;
  if (!isRecord(data)) throw new Error('Sipariş yönetimi yanıtı doğrulanamadı.');
  const role = text(data.role, 'Yönetim rolü', 20);
  if (role !== 'admin' && role !== 'producer') throw new Error('Yönetim rolü doğrulanamadı.');
  if (!Array.isArray(data.orders) || data.orders.length > 5000) throw new Error('Sipariş listesi doğrulanamadı.');
  return {
    role,
    producerId: uuid(data.producerId, 'Satıcı kimliği', true),
    loadedAt: dateTime(data.loadedAt, 'Yükleme tarihi') as string,
    orders: data.orders.map(normalizeOrder),
  };
}

export async function managementUpdateOrderStatus(input: { orderId: string; status: ManagedOrderStatus; trackingNumber?: string | null; note?: string | null }) {
  if (!UUID_RE.test(input.orderId)) throw new Error('Sipariş kimliği doğrulanamadı.');
  if (!ORDER_STATUSES.includes(input.status)) throw new Error('Sipariş durumu doğrulanamadı.');
  const { data, error } = await supabase.rpc('management_update_order_status_v1', {
    p_order_id: input.orderId,
    p_status: input.status,
    p_tracking_number: input.trackingNumber?.trim() || null,
    p_note: input.note?.trim() || null,
  });
  if (error) throw error;
  if (!isRecord(data) || uuid(data.id, 'Güncellenen sipariş kimliği') !== input.orderId || text(data.status, 'Güncellenen sipariş durumu', 40) !== input.status) {
    throw new Error('Sipariş durumu sunucudan doğrulanamadı.');
  }
  return data;
}

export async function releaseOrderSettlement(orderId: string) {
  if (!UUID_RE.test(orderId)) throw new Error('Sipariş kimliği doğrulanamadı.');
  const { data, error } = await supabase.functions.invoke('admin-order-settlement', { body: { orderId } });
  if (error) throw error;
  if (!isRecord(data) || data.ok !== true || data.orderId !== orderId || typeof data.released !== 'boolean') throw new Error('Hakediş onayı sunucudan doğrulanamadı.');
  if (!data.released) throw new Error('Hakediş sağlayıcı onayı tamamlanmadı. Yenileyip kalan kırılımları kontrol edin.');
  return data;
}

export function allowedAdminOrderTransitions(status: ManagedOrderStatus): ManagedOrderStatus[] {
  const transitions: Record<ManagedOrderStatus, ManagedOrderStatus[]> = {
    draft: ['pending_payment', 'cancelled'], pending_payment: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'],
    preparing: ['partially_shipped', 'shipped', 'cancelled'], partially_shipped: ['shipped'], shipped: ['delivered'], delivered: ['completed'],
    completed: [], cancelled: [], refunded: [],
  };
  return transitions[status];
}

export function settlementLabel(status: SettlementStatus) {
  return ({ not_required: 'Satıcı hakedişi yok', awaiting_completion: 'Sipariş tamamlanması bekleniyor', blocked: 'Hakediş kilitli', pending_approval: 'Super Admin onayı bekliyor', processing: 'Sağlayıcı onayı işleniyor', released: 'Satıcıya serbest bırakıldı', failed: 'Onay yeniden denenmeli' } as Record<SettlementStatus, string>)[status];
}

export function settlementReason(reason: string) {
  const labels: Record<string, string> = {
    no_seller_settlement: 'Bu siparişte satıcıya aktarılacak hakediş yok.', order_not_completed: 'Sipariş tamamlanmadan satıcı hakedişi açılamaz.',
    payment_not_fully_paid: 'Ödeme tamamen tahsil edilmedi.', open_return: 'Açık iade talebi var.', refund_or_refund_review: 'Geri ödeme veya geri ödeme incelemesi var.',
    seller_ledger_missing: 'Satıcı finans kaydı oluşmadı.', payment_split_missing: 'Ödeme sağlayıcı kırılımı oluşmadı.', ledger_split_mismatch: 'Satıcı defteri ile sağlayıcı kırılımı eşleşmiyor.',
    provider_split_disapproved: 'Sağlayıcı kırılımı onaysız duruma alındı.', provider_approval_processing: 'Sağlayıcı onayı işleniyor.', provider_approval_failed: 'Sağlayıcı onayı tamamlanamadı.',
    super_admin_approval_required: 'Ürün teslim edildi. Satıcı hakedişinin korumalı havuzdan çıkması için Super Admin onayı gerekiyor.', released: 'Sağlayıcı kırılımları onaylandı ve satıcı bakiyesi kullanılabilir hale geldi.',
  };
  return labels[reason] || 'Hakediş durumu sunucuda kontrol ediliyor.';
}

export function orderAdminErrorMessage(error: unknown, fallback = 'İşlem tamamlanamadı.') {
  const message = error instanceof Error ? error.message.trim() : String((error as { message?: unknown } | null)?.message || '').trim();
  if (!message) return fallback;
  if (message.includes('super_admin_required')) return 'Satıcı hakedişini yalnız Super Admin serbest bırakabilir.';
  if (message.includes('settlement_not_releasable')) return 'Hakediş şu anda serbest bırakılamaz. Sipariş, ödeme, iade ve geri ödeme durumunu kontrol edin.';
  if (message.includes('payment_provider_credentials_missing')) return 'Canlı ödeme sağlayıcısı kimlik bilgileri henüz hazır değil. Hakediş güvenli biçimde havuzda kalıyor.';
  if (message.includes('settlement_provider')) return 'Ödeme sağlayıcısı hakediş onayını tamamlamadı. Para havuzda kaldı, işlem daha sonra yeniden denenebilir.';
  return message.length <= 300 ? message : fallback;
}

export function formatOrderMoney(minor: number, code: string) {
  try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(minor / 100); }
  catch { return `${(minor / 100).toFixed(2)} ${code}`; }
}

export function orderAddressLabel(raw: Record<string, unknown>) {
  const read = (...keys: string[]) => keys.map(key => typeof raw[key] === 'string' ? String(raw[key]).trim() : '').find(Boolean) || '';
  const recipient = read('recipientName', 'recipient_name');
  const phone = read('phone');
  const lines = [read('addressLine1', 'address_line1', 'address_line'), read('addressLine2', 'address_line2'), read('neighborhood', 'locality'), read('district'), read('province', 'city'), read('postalCode', 'postal_code'), read('countryCode', 'country_code')].filter(Boolean);
  return { recipient, phone, address: lines.join(', ') };
}
