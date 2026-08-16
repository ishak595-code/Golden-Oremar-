import { supabase } from '../lib/supabase';

export type AdminReturnStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'closed' | 'refunded';
export type ReturnResolution = 'refund' | 'replacement' | 'partial_refund' | 'store_credit' | 'none';

export type AdminReturnRow = {
  id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  status: AdminReturnStatus;
  reason_code: string;
  customer_message: string | null;
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
  reasonCode: string;
  customerMessage: string | null;
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
    condition: string | null;
    evidencePaths: string[];
    refundAmountMinor: number;
    currency: string;
  }>;
  refunds: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    status: string;
    reason: string | null;
    processedAt: string | null;
  }>;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function adminListReturns(): Promise<AdminReturnRow[]> {
  const { data, error } = await supabase.rpc('admin_list_returns_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    return_number: String(row.return_number || row.id),
    order_id: String(row.order_id),
    order_number: String(row.order_number || row.order_id),
    customer_name: String(row.customer_name || 'Müşteri'),
    customer_phone: row.customer_phone ? String(row.customer_phone) : null,
    status: String(row.status || 'requested') as AdminReturnStatus,
    reason_code: String(row.reason_code || 'other'),
    resolution: row.resolution ? String(row.resolution) as ReturnResolution : null,
    restock_approved: row.restock_approved == null ? null : row.restock_approved === true,
    currency: String(row.currency || 'TRY'),
    order_total_minor: Number(row.order_total_minor || 0),
    item_count: Number(row.item_count || 0),
    requested_quantity: Number(row.requested_quantity || 0),
    requested_refund_minor: Number(row.requested_refund_minor || 0),
    succeeded_refund_minor: Number(row.succeeded_refund_minor || 0),
  })) : [];
}

export async function adminGetReturnDetail(returnId: string): Promise<AdminReturnDetail> {
  const { data, error } = await supabase.rpc('admin_get_return_detail_v1', { p_return_id: returnId });
  const raw = unwrap<any>(data, error) || {};
  return {
    ...raw,
    id: String(raw.id),
    returnNumber: String(raw.returnNumber || raw.id),
    orderId: String(raw.orderId || ''),
    orderNumber: String(raw.orderNumber || raw.orderId || ''),
    customer: {
      userId: String(raw.customer?.userId || ''),
      displayName: raw.customer?.displayName ? String(raw.customer.displayName) : null,
      phone: raw.customer?.phone ? String(raw.customer.phone) : null,
    },
    status: String(raw.status || 'requested') as AdminReturnStatus,
    resolution: raw.resolution ? String(raw.resolution) as ReturnResolution : null,
    restockApproved: raw.restockApproved == null ? null : raw.restockApproved === true,
    items: Array.isArray(raw.items) ? raw.items.map((item: any) => ({
      ...item,
      id: String(item.id),
      orderItemId: String(item.orderItemId),
      productName: String(item.productName || 'Ürün'),
      variantName: item.variantName ? String(item.variantName) : null,
      quantity: Number(item.quantity || 0),
      purchasedQuantity: Number(item.purchasedQuantity || 0),
      condition: item.condition ? String(item.condition) : null,
      evidencePaths: Array.isArray(item.evidencePaths) ? item.evidencePaths.map(String) : [],
      refundAmountMinor: Number(item.refundAmountMinor || 0),
      currency: String(item.currency || 'TRY'),
    })) : [],
    refunds: Array.isArray(raw.refunds) ? raw.refunds.map((refund: any) => ({
      ...refund,
      id: String(refund.id),
      amountMinor: Number(refund.amountMinor || 0),
      currency: String(refund.currency || 'TRY'),
      status: String(refund.status || 'pending'),
    })) : [],
  };
}

export async function adminUpdateReturn(input: {
  returnId: string;
  status: Exclude<AdminReturnStatus, 'requested' | 'refunded'>;
  reason?: string | null;
  resolution?: ReturnResolution | null;
  restockApproved?: boolean | null;
}) {
  const reason = input.reason?.trim() || null;
  if (input.status === 'rejected' && (!reason || reason.length < 8)) throw new Error('İade reddi için en az 8 karakterlik gerekçe gerekir.');
  if (reason && reason.length > 3000) throw new Error('İade işlem notu 3000 karakteri aşamaz.');
  if (input.status === 'approved' && !input.resolution) throw new Error('İade onayı için çözüm türü seçilmelidir.');
  if (input.status === 'received' && input.restockApproved == null) throw new Error('Ürün teslim alındığında yeniden stoğa alınma kararı verilmelidir.');
  const { data, error } = await supabase.rpc('admin_update_return_v2', {
    p_return_id: input.returnId,
    p_status: input.status,
    p_reason: reason,
    p_resolution: input.resolution || null,
    p_restock_approved: input.restockApproved == null ? null : input.restockApproved,
  });
  return unwrap<any>(data, error);
}

export async function createReturnEvidenceUrl(pathValue: string) {
  const path = pathValue.trim().replace(/^\/+/, '');
  if (!path) throw new Error('Kanıt dosyası yolu bulunamadı.');
  const { data, error } = await supabase.storage.from('return-evidence').createSignedUrl(path, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Kanıt dosyası için geçici bağlantı oluşturulamadı.');
  return data.signedUrl;
}

export function allowedReturnTransitions(status: AdminReturnStatus): Array<Exclude<AdminReturnStatus, 'requested' | 'refunded'>> {
  const map: Record<string, Array<Exclude<AdminReturnStatus, 'requested' | 'refunded'>>> = {
    requested: ['under_review', 'approved', 'rejected'],
    under_review: ['approved', 'rejected'],
    approved: ['in_transit', 'received', 'closed'],
    in_transit: ['received', 'closed'],
    received: ['closed'],
  };
  return map[status] || [];
}

export function returnAdminErrorMessage(error: unknown, fallback = 'İade işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['return_not_found', 'İade talebi artık bulunamadı. Listeyi yenileyin.'],
    ['return_request_not_found', 'İade talebi artık bulunamadı. Listeyi yenileyin.'],
    ['invalid_return_status_transition', 'İade talebi seçilen duruma doğrudan geçirilemez.'],
    ['rejection_reason_required', 'İade reddi için en az 8 karakterlik gerekçe gerekir.'],
    ['return_resolution_required', 'İade onayı için çözüm türü seçilmelidir.'],
    ['restock_decision_required', 'Teslim alınan ürün için stoğa geri alma kararı gerekir.'],
    ['invalid_return_resolution', 'Seçilen iade çözümü geçersiz.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function returnMoney(minor: number | null | undefined, currency = 'TRY') {
  return (Number(minor || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
}
