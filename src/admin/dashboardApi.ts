import { supabase } from '../lib/supabase';

export type AdminOperationsOverview = {
  generated_at: string;
  counts: {
    members_total: number;
    members_active: number;
    customers_active: number;
    staff_users: number;
    producer_role_users: number;
    categories_total: number;
    categories_active: number;
    products_total: number;
    products_published: number;
    producers_total: number;
    verified_producers: number;
    orders_total: number;
    open_orders: number;
    producer_applications: number;
    product_reviews: number;
    product_change_requests: number;
    return_requests: number;
    review_moderation: number;
    support_conversations: number;
    account_closures: number;
    producer_payouts: number;
    settlements_waiting: number;
    catalog_objects: number;
    content_objects: number;
    certificate_objects: number;
  };
  finance_by_currency: Array<{
    currency: string;
    captured_minor: number;
    refunded_minor: number;
    net_collected_minor: number;
    protected_pool_minor: number;
    approved_seller_minor: number;
    seller_pending_ledger_minor: number;
    seller_available_ledger_minor: number;
    seller_paid_out_minor: number;
  }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    currency: string;
    total_minor: number;
    placed_at: string | null;
    created_at: string;
  }>;
  queues: { producer_applications: unknown[]; products: unknown[]; returns: unknown[]; reviews: unknown[] };
};

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, label: string, max = 300) { const result = typeof value === 'string' ? value.trim() : ''; if (!result || result.length > max || /[\u0000-\u001F\u007F]/.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function integer(value: unknown, label: string, min = 0) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error(`${label} doğrulanamadı.`); return value; }
function signed(value: unknown, label: string) { if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${label} doğrulanamadı.`); return value; }
function currency(value: unknown) { const code = text(value, 'Para birimi', 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) throw new Error('Para birimi doğrulanamadı.'); return code; }
function dateTime(value: unknown, label: string, nullable = false) { if (nullable && (value == null || value === '')) return null; const result = text(value, label, 80); if (Number.isNaN(Date.parse(result))) throw new Error(`${label} doğrulanamadı.`); return result; }

function normalizeCounts(value: unknown): AdminOperationsOverview['counts'] {
  if (!isRecord(value)) throw new Error('Yönetim sayaçları doğrulanamadı.');
  const names: Array<keyof AdminOperationsOverview['counts']> = [
    'members_total','members_active','customers_active','staff_users','producer_role_users','categories_total','categories_active','products_total','products_published','producers_total','verified_producers','orders_total','open_orders','producer_applications','product_reviews','product_change_requests','return_requests','review_moderation','support_conversations','account_closures','producer_payouts','settlements_waiting','catalog_objects','content_objects','certificate_objects',
  ];
  const result = {} as AdminOperationsOverview['counts'];
  for (const name of names) result[name] = integer(value[name], name);
  if (result.members_active > result.members_total || result.categories_active > result.categories_total || result.products_published > result.products_total || result.verified_producers > result.producers_total || result.open_orders > result.orders_total) throw new Error('Yönetim sayaçları birbirleriyle tutarsız.');
  return result;
}

function normalizeFinance(value: unknown, index: number): AdminOperationsOverview['finance_by_currency'][number] {
  if (!isRecord(value)) throw new Error(`${index + 1}. finans özeti doğrulanamadı.`);
  const captured = integer(value.captured_minor, 'Tahsilat');
  const refunded = integer(value.refunded_minor, 'İade');
  const net = signed(value.net_collected_minor, 'Net tahsilat');
  if (net !== captured - refunded) throw new Error(`${index + 1}. finans özeti matematiksel olarak tutarsız.`);
  return {
    currency: currency(value.currency),
    captured_minor: captured,
    refunded_minor: refunded,
    net_collected_minor: net,
    protected_pool_minor: integer(value.protected_pool_minor, 'Korumalı havuz'),
    approved_seller_minor: integer(value.approved_seller_minor, 'Onaylanan satıcı hakkı'),
    seller_pending_ledger_minor: integer(value.seller_pending_ledger_minor, 'Bekleyen satıcı defteri'),
    seller_available_ledger_minor: integer(value.seller_available_ledger_minor, 'Kullanılabilir satıcı defteri'),
    seller_paid_out_minor: integer(value.seller_paid_out_minor, 'Ödenen satıcı hakkı'),
  };
}

function normalizeOrder(value: unknown, index: number): AdminOperationsOverview['recent_orders'][number] {
  if (!isRecord(value)) throw new Error(`${index + 1}. sipariş özeti doğrulanamadı.`);
  return {
    id: text(value.id, 'Sipariş kimliği', 80), order_number: text(value.order_number, 'Sipariş numarası', 160), status: text(value.status, 'Sipariş durumu', 60), payment_status: text(value.payment_status, 'Ödeme durumu', 60), fulfillment_status: text(value.fulfillment_status, 'Gönderim durumu', 60), currency: currency(value.currency), total_minor: integer(value.total_minor, 'Sipariş toplamı'), placed_at: dateTime(value.placed_at, 'Sipariş verilme tarihi', true), created_at: dateTime(value.created_at, 'Sipariş oluşturma tarihi') as string,
  };
}

function normalizeQueues(value: unknown): AdminOperationsOverview['queues'] {
  if (!isRecord(value)) throw new Error('Yönetim kuyrukları doğrulanamadı.');
  const producerApplications = value.producer_applications, products = value.products, returns = value.returns, reviews = value.reviews;
  if (!Array.isArray(producerApplications) || !Array.isArray(products) || !Array.isArray(returns) || !Array.isArray(reviews)) throw new Error('Yönetim kuyruklarından biri doğrulanamadı.');
  return { producer_applications: producerApplications, products, returns, reviews };
}

export async function getAdminOperationsOverview(): Promise<AdminOperationsOverview> {
  const { data, error } = await supabase.rpc('admin_operations_overview_v2');
  if (error) throw error;
  if (!isRecord(data)) throw new Error('Yönetim paneli yanıtı doğrulanamadı.');
  if (!Array.isArray(data.finance_by_currency) || data.finance_by_currency.length > 100) throw new Error('Finans para birimi listesi doğrulanamadı.');
  if (!Array.isArray(data.recent_orders) || data.recent_orders.length > 50) throw new Error('Son sipariş listesi doğrulanamadı.');
  return { generated_at: dateTime(data.generated_at, 'Panel oluşturulma tarihi') as string, counts: normalizeCounts(data.counts), finance_by_currency: data.finance_by_currency.map(normalizeFinance), recent_orders: data.recent_orders.map(normalizeOrder), queues: normalizeQueues(data.queues) };
}

export function dashboardErrorMessage(error: unknown, fallback = 'Panel verileri yüklenemedi.') {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu yönetim paneli için yetkiniz yok.';
  if (message.includes('authentication_required')) return 'Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.';
  return message.length <= 300 ? message : fallback;
}

export function formatMinor(value: unknown, codeValue: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 'Tutar doğrulanamadı';
  const code = typeof codeValue === 'string' ? codeValue.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) return 'Para birimi doğrulanamadı';
  try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(value / 100); }
  catch { return `${(value / 100).toFixed(2)} ${code}`; }
}
