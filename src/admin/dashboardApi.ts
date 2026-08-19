import { supabase } from '../lib/supabase';

export type AdminOperationsOverview = {
  generated_at: string;
  counts: {
    active_users: number;
    verified_producers: number;
    published_products: number;
    open_orders: number;
    producer_applications: number;
    product_reviews: number;
    product_change_requests: number;
    return_requests: number;
    review_moderation: number;
    support_conversations: number;
    account_closures: number;
    producer_payouts: number;
  };
  finance_by_currency: Array<{
    currency: string;
    captured_minor: number;
    refunded_minor: number;
    net_collected_minor: number;
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
  queues: {
    producer_applications: unknown[];
    products: unknown[];
    returns: unknown[];
    reviews: unknown[];
  };
};

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 300) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function signedSafeInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function currencyCode(value: unknown) {
  const code = requiredText(value, 'Para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('Para birimi doğrulanamadı.');
  return code;
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

function normalizeCounts(value: unknown): AdminOperationsOverview['counts'] {
  if (!isRecord(value)) throw new Error('Yönetim sayaçları doğrulanamadı.');
  return {
    active_users: safeInteger(value.active_users, 'Aktif kullanıcı sayısı'),
    verified_producers: safeInteger(value.verified_producers, 'Doğrulanmış üretici sayısı'),
    published_products: safeInteger(value.published_products, 'Yayındaki ürün sayısı'),
    open_orders: safeInteger(value.open_orders, 'Açık sipariş sayısı'),
    producer_applications: safeInteger(value.producer_applications, 'Satıcı başvurusu sayısı'),
    product_reviews: safeInteger(value.product_reviews, 'Ürün inceleme sayısı'),
    product_change_requests: safeInteger(value.product_change_requests, 'Ürün değişiklik talebi sayısı'),
    return_requests: safeInteger(value.return_requests, 'İade talebi sayısı'),
    review_moderation: safeInteger(value.review_moderation, 'Yorum moderasyonu sayısı'),
    support_conversations: safeInteger(value.support_conversations, 'Destek konuşması sayısı'),
    account_closures: safeInteger(value.account_closures, 'Hesap kapatma talebi sayısı'),
    producer_payouts: safeInteger(value.producer_payouts, 'Satıcı ödeme sayısı'),
  };
}

function normalizeFinanceRow(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. finans özeti doğrulanamadı.`);
  const captured = safeInteger(value.captured_minor, 'Tahsil edilen tutar');
  const refunded = safeInteger(value.refunded_minor, 'İade edilen tutar');
  const net = signedSafeInteger(value.net_collected_minor, 'Net tahsilat');
  if (net !== captured - refunded) throw new Error(`${index + 1}. finans özeti matematiksel olarak tutarsız.`);
  return {
    currency: currencyCode(value.currency),
    captured_minor: captured,
    refunded_minor: refunded,
    net_collected_minor: net,
  };
}

function normalizeOrder(value: unknown, index: number): AdminOperationsOverview['recent_orders'][number] {
  if (!isRecord(value)) throw new Error(`${index + 1}. sipariş özeti doğrulanamadı.`);
  return {
    id: requiredText(value.id, 'Sipariş kimliği', 80),
    order_number: requiredText(value.order_number, 'Sipariş numarası', 120),
    status: requiredText(value.status, 'Sipariş durumu', 60),
    payment_status: requiredText(value.payment_status, 'Ödeme durumu', 60),
    fulfillment_status: requiredText(value.fulfillment_status, 'Gönderim durumu', 60),
    currency: currencyCode(value.currency),
    total_minor: safeInteger(value.total_minor, 'Sipariş toplamı'),
    placed_at: dateTime(value.placed_at, 'Sipariş verilme tarihi', false),
    created_at: dateTime(value.created_at, 'Sipariş oluşturulma tarihi', true) as string,
  };
}

function normalizeQueues(value: unknown): AdminOperationsOverview['queues'] {
  if (!isRecord(value)) throw new Error('Yönetim kuyrukları doğrulanamadı.');
  const producerApplications = value.producer_applications;
  const products = value.products;
  const returns = value.returns;
  const reviews = value.reviews;
  if (!Array.isArray(producerApplications) || !Array.isArray(products) || !Array.isArray(returns) || !Array.isArray(reviews)) {
    throw new Error('Yönetim kuyruklarından biri doğrulanamadı.');
  }
  return {
    producer_applications: producerApplications,
    products,
    returns,
    reviews,
  };
}

export async function getAdminOperationsOverview(): Promise<AdminOperationsOverview> {
  const { data, error } = await supabase.rpc('admin_operations_overview_v1');
  const raw = unwrap<unknown>(data, error);
  if (!isRecord(raw)) throw new Error('Yönetim paneli yanıtı doğrulanamadı.');
  if (!Array.isArray(raw.finance_by_currency) || raw.finance_by_currency.length > 100) throw new Error('Finans para birimi listesi doğrulanamadı.');
  if (!Array.isArray(raw.recent_orders) || raw.recent_orders.length > 50) throw new Error('Son sipariş listesi doğrulanamadı.');
  return {
    generated_at: dateTime(raw.generated_at, 'Panel oluşturulma tarihi', true) as string,
    counts: normalizeCounts(raw.counts),
    finance_by_currency: raw.finance_by_currency.map(normalizeFinanceRow),
    recent_orders: raw.recent_orders.map(normalizeOrder),
    queues: normalizeQueues(raw.queues),
  };
}

export function dashboardErrorMessage(error: unknown, fallback = 'Panel verileri yüklenemedi.') {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu yönetici paneli için yetkiniz yok.';
  if (message.includes('authentication_required')) return 'Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.';
  return message.length <= 240 ? message : fallback;
}

export function formatMinor(value: unknown, currency: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return 'Tutar doğrulanamadı';
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) return 'Para birimi doğrulanamadı';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(value / 100);
  } catch {
    return `${(value / 100).toFixed(2)} ${code}`;
  }
}
