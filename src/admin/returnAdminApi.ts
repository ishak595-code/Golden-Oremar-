import { supabase } from '../lib/supabase';

export type AdminReturnStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'closed' | 'refunded';
export type ReturnResolution = 'refund' | 'replacement' | 'partial_refund' | 'store_credit' | 'none';
export type ReturnReasonCode = 'damaged' | 'wrong_item' | 'quality_issue' | 'missing_item' | 'changed_mind' | 'delivery_issue' | 'other';
export type ReturnItemCondition = 'unopened' | 'opened' | 'damaged' | 'spoiled' | 'other';
export type RefundStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export type AdminReturnRow = {
  id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  status: AdminReturnStatus;
  reason_code: ReturnReasonCode;
  customer_message: string;
  resolution: ReturnResolution | null;
  resolution_note: string | null;
  review_reason: string | null;
  restock_approved: boolean | null;
  requested_at: string;
  reviewed_at: string | null;
  received_at: string | null;
  closed_at: string | null;
  currency: string;
  order_total_minor: number;
  item_count: number;
  requested_quantity: number;
  requested_refund_minor: number;
  succeeded_refund_minor: number;
};

export type AdminReturnDetail = {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customer: { userId: string; displayName: string | null; phone: string | null };
  reasonCode: ReturnReasonCode;
  customerMessage: string;
  status: AdminReturnStatus;
  resolution: ReturnResolution | null;
  resolutionNote: string | null;
  reviewReason: string | null;
  restockApproved: boolean | null;
  requestedAt: string;
  reviewedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  items: Array<{
    id: string;
    orderItemId: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    purchasedQuantity: number;
    condition: ReturnItemCondition | null;
    evidencePaths: string[];
    refundAmountMinor: number | null;
    currency: string;
  }>;
  refunds: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    status: RefundStatus;
    reason: string;
    processedAt: string | null;
  }>;
};

type AdminReturnMutationResult = {
  id: string;
  orderId: string;
  status: AdminReturnStatus;
  returnNumber: string;
  resolution: ReturnResolution | null;
  restockApproved: boolean | null;
};

const RETURN_STATUSES = new Set<AdminReturnStatus>(['requested', 'under_review', 'approved', 'rejected', 'in_transit', 'received', 'closed', 'refunded']);
const RETURN_RESOLUTIONS = new Set<ReturnResolution>(['refund', 'replacement', 'partial_refund', 'store_credit', 'none']);
const RETURN_REASONS = new Set<ReturnReasonCode>(['damaged', 'wrong_item', 'quality_issue', 'missing_item', 'changed_mind', 'delivery_issue', 'other']);
const RETURN_CONDITIONS = new Set<ReturnItemCondition>(['unopened', 'opened', 'damaged', 'spoiled', 'other']);
const REFUND_STATUSES = new Set<RefundStatus>(['pending', 'processing', 'succeeded', 'failed', 'cancelled']);
const UPDATE_STATUSES = new Set<Exclude<AdminReturnStatus, 'requested' | 'refunded'>>(['under_review', 'approved', 'rejected', 'in_transit', 'received', 'closed']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function textAllowEmpty(value: unknown, label: string, max = 3000) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001F\u007F]/.test(value)) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalText(value: unknown, label: string, max = 3000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function nonNegativeInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function positiveInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalNonNegativeInteger(value: unknown, label: string) {
  if (value == null) return null;
  return nonNegativeInteger(value, label);
}

function nullableBoolean(value: unknown, label: string) {
  if (value == null) return null;
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function dateTime(value: unknown, label: string, required = true) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function currencyCode(value: unknown) {
  const currency = requiredText(value, 'Para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Para birimi doğrulanamadı.');
  return currency;
}

function returnStatus(value: unknown) {
  const status = requiredText(value, 'İade durumu', 40) as AdminReturnStatus;
  if (!RETURN_STATUSES.has(status)) throw new Error('İade durumu doğrulanamadı.');
  return status;
}

function returnResolution(value: unknown): ReturnResolution | null {
  if (value == null || value === '') return null;
  const resolution = requiredText(value, 'İade çözümü', 40) as ReturnResolution;
  if (!RETURN_RESOLUTIONS.has(resolution)) throw new Error('İade çözümü doğrulanamadı.');
  return resolution;
}

function returnReason(value: unknown) {
  const reason = requiredText(value, 'İade nedeni', 40) as ReturnReasonCode;
  if (!RETURN_REASONS.has(reason)) throw new Error('İade nedeni doğrulanamadı.');
  return reason;
}

function returnCondition(value: unknown): ReturnItemCondition | null {
  if (value == null || value === '') return null;
  const condition = requiredText(value, 'İade ürün durumu', 40) as ReturnItemCondition;
  if (!RETURN_CONDITIONS.has(condition)) throw new Error('İade ürün durumu doğrulanamadı.');
  return condition;
}

function refundStatus(value: unknown) {
  const status = requiredText(value, 'Geri ödeme durumu', 40) as RefundStatus;
  if (!REFUND_STATUSES.has(status)) throw new Error('Geri ödeme durumu doğrulanamadı.');
  return status;
}

function evidencePath(value: unknown, label: string) {
  const path = requiredText(value, label, 2048).replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || /^(data|blob|javascript|https?):/i.test(path)) throw new Error(`${label} doğrulanamadı.`);
  return path;
}

function normalizeRow(value: unknown, index: number): AdminReturnRow {
  if (!isRecord(value)) throw new Error(`${index + 1}. iade kaydı doğrulanamadı.`);
  const requestedRefund = nonNegativeInteger(value.requested_refund_minor, `${index + 1}. talep edilen iade tutarı`);
  const succeededRefund = nonNegativeInteger(value.succeeded_refund_minor, `${index + 1}. başarılı geri ödeme tutarı`);
  if (succeededRefund > requestedRefund && requestedRefund > 0) throw new Error(`${index + 1}. geri ödeme toplamı talep edilen tutarla tutarsız.`);
  return {
    id: uuid(value.id, `${index + 1}. iade kimliği`),
    return_number: requiredText(value.return_number, `${index + 1}. iade numarası`, 160),
    order_id: uuid(value.order_id, `${index + 1}. sipariş kimliği`),
    order_number: requiredText(value.order_number, `${index + 1}. sipariş numarası`, 160),
    customer_name: requiredText(value.customer_name, `${index + 1}. müşteri adı`, 240),
    customer_phone: optionalText(value.customer_phone, `${index + 1}. müşteri telefonu`, 80),
    status: returnStatus(value.status),
    reason_code: returnReason(value.reason_code),
    customer_message: textAllowEmpty(value.customer_message, `${index + 1}. müşteri mesajı`, 5000),
    resolution: returnResolution(value.resolution),
    resolution_note: optionalText(value.resolution_note, `${index + 1}. çözüm notu`),
    review_reason: optionalText(value.review_reason, `${index + 1}. inceleme gerekçesi`),
    restock_approved: nullableBoolean(value.restock_approved, `${index + 1}. yeniden stok kararı`),
    requested_at: dateTime(value.requested_at, `${index + 1}. iade talep tarihi`) as string,
    reviewed_at: dateTime(value.reviewed_at, `${index + 1}. iade inceleme tarihi`, false),
    received_at: dateTime(value.received_at, `${index + 1}. iade teslim tarihi`, false),
    closed_at: dateTime(value.closed_at, `${index + 1}. iade kapanış tarihi`, false),
    currency: currencyCode(value.currency),
    order_total_minor: nonNegativeInteger(value.order_total_minor, `${index + 1}. sipariş toplamı`),
    item_count: nonNegativeInteger(value.item_count, `${index + 1}. iade kalem sayısı`, 10000),
    requested_quantity: nonNegativeInteger(value.requested_quantity, `${index + 1}. iade ürün adedi`, 1000000),
    requested_refund_minor: requestedRefund,
    succeeded_refund_minor: succeededRefund,
  };
}

function normalizeDetail(value: unknown): AdminReturnDetail {
  if (!isRecord(value) || !isRecord(value.customer) || !Array.isArray(value.items) || !Array.isArray(value.refunds)) {
    throw new Error('İade detay cevabı doğrulanamadı.');
  }
  if (value.items.length > 1000 || value.refunds.length > 1000) throw new Error('İade detay cevabı beklenen sınırı aşıyor.');
  return {
    id: uuid(value.id, 'İade kimliği'),
    returnNumber: requiredText(value.returnNumber, 'İade numarası', 160),
    orderId: uuid(value.orderId, 'Sipariş kimliği'),
    orderNumber: requiredText(value.orderNumber, 'Sipariş numarası', 160),
    customer: {
      userId: uuid(value.customer.userId, 'Müşteri kimliği'),
      displayName: optionalText(value.customer.displayName, 'Müşteri adı', 240),
      phone: optionalText(value.customer.phone, 'Müşteri telefonu', 80),
    },
    reasonCode: returnReason(value.reasonCode),
    customerMessage: textAllowEmpty(value.customerMessage, 'Müşteri mesajı', 5000),
    status: returnStatus(value.status),
    resolution: returnResolution(value.resolution),
    resolutionNote: optionalText(value.resolutionNote, 'Çözüm notu'),
    reviewReason: optionalText(value.reviewReason, 'İnceleme gerekçesi'),
    restockApproved: nullableBoolean(value.restockApproved, 'Yeniden stok kararı'),
    requestedAt: dateTime(value.requestedAt, 'İade talep tarihi') as string,
    reviewedAt: dateTime(value.reviewedAt, 'İade inceleme tarihi', false),
    receivedAt: dateTime(value.receivedAt, 'İade teslim tarihi', false),
    closedAt: dateTime(value.closedAt, 'İade kapanış tarihi', false),
    items: value.items.map((item, index) => {
      if (!isRecord(item) || !Array.isArray(item.evidencePaths)) throw new Error(`${index + 1}. iade ürünü doğrulanamadı.`);
      const quantity = positiveInteger(item.quantity, `${index + 1}. iade miktarı`, 1000000);
      const purchasedQuantity = positiveInteger(item.purchasedQuantity, `${index + 1}. satın alınan miktar`, 1000000);
      if (quantity > purchasedQuantity) throw new Error(`${index + 1}. iade miktarı satın alınan miktarı aşıyor.`);
      return {
        id: uuid(item.id, `${index + 1}. iade kalemi kimliği`),
        orderItemId: uuid(item.orderItemId, `${index + 1}. sipariş kalemi kimliği`),
        productName: requiredText(item.productName, `${index + 1}. ürün adı`, 300),
        variantName: optionalText(item.variantName, `${index + 1}. varyant adı`, 240),
        quantity,
        purchasedQuantity,
        condition: returnCondition(item.condition),
        evidencePaths: item.evidencePaths.map((path, pathIndex) => evidencePath(path, `${index + 1}. kanıt dosyası ${pathIndex + 1}`)),
        refundAmountMinor: optionalNonNegativeInteger(item.refundAmountMinor, `${index + 1}. iade tutarı`),
        currency: currencyCode(item.currency),
      };
    }),
    refunds: value.refunds.map((refund, index) => {
      if (!isRecord(refund)) throw new Error(`${index + 1}. geri ödeme kaydı doğrulanamadı.`);
      return {
        id: uuid(refund.id, `${index + 1}. geri ödeme kimliği`),
        amountMinor: positiveInteger(refund.amountMinor, `${index + 1}. geri ödeme tutarı`),
        currency: currencyCode(refund.currency),
        status: refundStatus(refund.status),
        reason: textAllowEmpty(refund.reason, `${index + 1}. geri ödeme gerekçesi`, 3000),
        processedAt: dateTime(refund.processedAt, `${index + 1}. geri ödeme işlem tarihi`, false),
      };
    }),
  };
}

function normalizeMutationResult(value: unknown, expectedStatus: Exclude<AdminReturnStatus, 'requested' | 'refunded'>): AdminReturnMutationResult {
  if (!isRecord(value)) throw new Error('İade güncelleme sonucu doğrulanamadı.');
  const status = returnStatus(value.status);
  if (status !== expectedStatus) throw new Error('İade güncelleme sonucu beklenen durumla eşleşmiyor.');
  return {
    id: uuid(value.id, 'İade kimliği'),
    orderId: uuid(value.orderId, 'Sipariş kimliği'),
    status,
    returnNumber: requiredText(value.returnNumber, 'İade numarası', 160),
    resolution: returnResolution(value.resolution),
    restockApproved: nullableBoolean(value.restockApproved, 'Yeniden stok kararı'),
  };
}

export async function adminListReturns(): Promise<AdminReturnRow[]> {
  const { data, error } = await supabase.rpc('admin_list_returns_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('İade listesi sunucudan doğrulanamadı.');
  return rows.map(normalizeRow);
}

export async function adminGetReturnDetail(returnId: string): Promise<AdminReturnDetail> {
  const id = uuid(returnId, 'İade kimliği');
  const { data, error } = await supabase.rpc('admin_get_return_detail_v1', { p_return_id: id });
  return normalizeDetail(unwrap<unknown>(data, error));
}

export async function adminUpdateReturn(input: {
  returnId: string;
  status: Exclude<AdminReturnStatus, 'requested' | 'refunded'>;
  reason?: string | null;
  resolution?: ReturnResolution | null;
  restockApproved?: boolean | null;
}) {
  const returnId = uuid(input.returnId, 'İade kimliği');
  if (!UPDATE_STATUSES.has(input.status)) throw new Error('İade güncelleme durumu geçersiz.');
  if (input.resolution != null && !RETURN_RESOLUTIONS.has(input.resolution)) throw new Error('İade çözümü geçersiz.');
  if (input.restockApproved != null && typeof input.restockApproved !== 'boolean') throw new Error('Yeniden stok kararı geçersiz.');
  const reason = input.reason?.trim() || null;
  if (input.status === 'rejected' && (!reason || reason.length < 8)) throw new Error('İade reddi için en az 8 karakterlik gerekçe gerekir.');
  if (reason && reason.length > 3000) throw new Error('İade işlem notu 3000 karakteri aşamaz.');
  if (input.status === 'approved' && !input.resolution) throw new Error('İade onayı için çözüm türü seçilmelidir.');
  if (input.status === 'received' && input.restockApproved == null) throw new Error('Ürün teslim alındığında yeniden stoğa alınma kararı verilmelidir.');
  const { data, error } = await supabase.rpc('admin_update_return_v2', {
    p_return_id: returnId,
    p_status: input.status,
    p_reason: reason,
    p_resolution: input.resolution || null,
    p_restock_approved: input.restockApproved == null ? null : input.restockApproved,
  });
  return normalizeMutationResult(unwrap<unknown>(data, error), input.status);
}

export async function createReturnEvidenceUrl(pathValue: string) {
  const path = evidencePath(pathValue, 'Kanıt dosyası yolu');
  const { data, error } = await supabase.storage.from('return-evidence').createSignedUrl(path, 300);
  if (error) throw error;
  const signedUrl = typeof data?.signedUrl === 'string' ? data.signedUrl.trim() : '';
  if (!signedUrl) throw new Error('Kanıt dosyası için geçici bağlantı oluşturulamadı.');
  let parsed: URL;
  try { parsed = new URL(signedUrl); } catch { throw new Error('Kanıt dosyası bağlantısı doğrulanamadı.'); }
  if (parsed.protocol !== 'https:') throw new Error('Kanıt dosyası bağlantısı güvenli değil.');
  return parsed.toString();
}

export function allowedReturnTransitions(status: AdminReturnStatus): Array<Exclude<AdminReturnStatus, 'requested' | 'refunded'>> {
  const map: Record<AdminReturnStatus, Array<Exclude<AdminReturnStatus, 'requested' | 'refunded'>>> = {
    requested: ['under_review', 'approved', 'rejected'],
    under_review: ['approved', 'rejected'],
    approved: ['in_transit', 'received', 'closed'],
    rejected: [],
    in_transit: ['received', 'closed'],
    received: ['closed'],
    closed: [],
    refunded: [],
  };
  return map[status];
}

export function returnAdminErrorMessage(error: unknown, fallback = 'İade işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['return_not_found', 'İade talebi artık bulunamadı. Listeyi yenileyin.'],
    ['return_request_not_found', 'İade talebi artık bulunamadı. Listeyi yenileyin.'],
    ['invalid_return_status_transition', 'İade talebi seçilen duruma doğrudan geçirilemez.'],
    ['invalid_return_status', 'Seçilen iade durumu geçersiz.'],
    ['rejection_reason_required', 'İade reddi için en az 8 karakterlik gerekçe gerekir.'],
    ['return_resolution_required', 'İade onayı için çözüm türü seçilmelidir.'],
    ['restock_decision_required', 'Teslim alınan ürün için stoğa geri alma kararı gerekir.'],
    ['invalid_return_resolution', 'Seçilen iade çözümü geçersiz.'],
    ['return_reason_too_long', 'İade işlem notu 3000 karakteri aşamaz.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function returnMoney(minor: number | null | undefined, currency: string | null | undefined) {
  if (!Number.isSafeInteger(minor) || Number(minor) < 0) return 'Tutar doğrulanamadı';
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) return 'Para birimi doğrulanamadı';
  try {
    return (Number(minor) / 100).toLocaleString('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 });
  } catch {
    return 'Tutar doğrulanamadı';
  }
}
