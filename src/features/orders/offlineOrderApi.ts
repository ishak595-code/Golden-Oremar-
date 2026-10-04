import { supabase } from '../../lib/supabase';
import { formatMoney } from '../cart/checkoutHelpers';

/**
 * Ordering without online payment: WhatsApp and bank transfer (Havale/EFT).
 *
 * The storefront only sends what the customer chose (variant, quantity,
 * options) and how to reach them. Prices, stock, shipping and the order code
 * come from the database (submit_order_request_v1), so nothing the browser
 * says about money is trusted. Guests can order too.
 */

export type OfflineBankAccount = { bankName: string; accountHolder: string; iban: string; branch: string | null };
export type OfflineOrderingConfig = {
  whatsapp: { enabled: boolean; number: string | null };
  bankTransfer: { enabled: boolean; accounts: OfflineBankAccount[]; paymentWindowHours: number };
  note: string | null;
};
export type OfflineOrderMethod = 'whatsapp' | 'bank_transfer';
export type OfflineOrderLineInput = { variantId: string; quantity: number; selectedOptions?: Record<string, unknown> };
export type OfflineOrderCustomer = { name: string; phone: string; email: string; province: string; district: string; addressLine: string; note: string };
export type OfflineOrderReceiptLine = { productName: string; variantName: string; options: string | null; quantity: number; unitPriceMinor: number; lineTotalMinor: number; slug: string };
export type OfflineOrderReceipt = {
  reference: string;
  method: OfflineOrderMethod;
  items: OfflineOrderReceiptLine[];
  currency: string;
  subtotalMinor: number;
  shippingMinor: number | null;
  totalMinor: number;
  customerName: string;
  whatsappNumber: string | null;
  bankTransfer: OfflineOrderingConfig['bankTransfer'] | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function str(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function int(value: unknown) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null; }

function normalizeAccounts(value: unknown): OfflineBankAccount[] {
  if (!Array.isArray(value)) return [];
  return value.filter(record).map(account => ({
    bankName: str(account.bankName, 80),
    accountHolder: str(account.accountHolder, 140),
    iban: str(account.iban, 40),
    branch: str(account.branch, 80) || null,
  })).filter(account => account.bankName && account.accountHolder && /^TR\d{2}( \d{4}){5} \d{2}$/.test(account.iban)).slice(0, 5);
}

function normalizeBank(value: unknown): OfflineOrderingConfig['bankTransfer'] {
  const bank = record(value) ? value : {};
  const accounts = normalizeAccounts(bank.accounts);
  return { enabled: bank.enabled === true && accounts.length > 0, accounts, paymentWindowHours: int(bank.paymentWindowHours) || 48 };
}

export function normalizeOfflineOrderingConfig(value: unknown): OfflineOrderingConfig {
  const data = record(value) ? value : {};
  const wa = record(data.whatsapp) ? data.whatsapp : {};
  const number = /^\d{10,15}$/.test(str(wa.number, 20)) ? str(wa.number, 20) : null;
  return {
    whatsapp: { enabled: wa.enabled === true && Boolean(number), number },
    bankTransfer: normalizeBank(data.bankTransfer),
    note: str(data.note, 600) || null,
  };
}

let configPromise: Promise<OfflineOrderingConfig> | null = null;
let configLoadedAt = 0;

/** Read once per few minutes; the settings change rarely. */
export function getOfflineOrderingConfig(force = false): Promise<OfflineOrderingConfig> {
  if (!force && configPromise && Date.now() - configLoadedAt < 5 * 60_000) return configPromise;
  configLoadedAt = Date.now();
  configPromise = (async () => {
    const { data, error } = await supabase.rpc('get_public_offline_ordering_v1');
    if (error) throw error;
    return normalizeOfflineOrderingConfig(data);
  })();
  configPromise.catch(() => { configPromise = null; });
  return configPromise;
}

export function offlineOrderingAvailable(config: OfflineOrderingConfig | null | undefined) {
  return Boolean(config && (config.whatsapp.enabled || config.bankTransfer.enabled));
}

/** Turkish mobile and landline numbers, or any +country number. */
export function normalizeCustomerPhone(raw: string) {
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  let value = '';
  if (cleaned.startsWith('+')) value = `+${digits}`;
  else if (/^5\d{9}$/.test(digits)) value = `+90${digits}`;
  else if (/^05\d{9}$/.test(digits)) value = `+9${digits}`;
  else if (/^905\d{9}$/.test(digits)) value = `+${digits}`;
  else if (/^00[1-9]\d{8,13}$/.test(digits)) value = `+${digits.slice(2)}`;
  if (!/^\+\d{10,15}$/.test(value)) return null;
  if (value.startsWith('+90') && !/^\+90[2-5]\d{9}$/.test(value)) return null;
  return value;
}

export function validateOfflineCustomer(customer: OfflineOrderCustomer): Partial<Record<keyof OfflineOrderCustomer, string>> {
  const errors: Partial<Record<keyof OfflineOrderCustomer, string>> = {};
  if (customer.name.trim().length < 2) errors.name = 'Adınızı ve soyadınızı yazın.';
  if (!normalizeCustomerPhone(customer.phone)) errors.phone = 'Geçerli bir telefon numarası yazın (ör. 0532 123 45 67).';
  if (customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email.trim())) errors.email = 'E-posta adresini kontrol edin.';
  if (customer.province.trim().length < 2) errors.province = 'İli yazın.';
  if (customer.district.trim().length < 2) errors.district = 'İlçeyi yazın.';
  if (customer.addressLine.trim().length < 10) errors.addressLine = 'Mahalle, sokak ve kapı numarasıyla açık adresi yazın.';
  return errors;
}

function normalizeReceipt(value: unknown): OfflineOrderReceipt {
  if (!record(value) || !/^GO-\d{6}-[A-Z0-9]{4}$/.test(str(value.reference, 20))) throw new Error('Sipariş kaydı doğrulanamadı.');
  const method = value.method === 'bank_transfer' ? 'bank_transfer' : value.method === 'whatsapp' ? 'whatsapp' : null;
  const subtotal = int(value.subtotalMinor), total = int(value.totalMinor);
  if (!method || subtotal === null || total === null || !Array.isArray(value.items)) throw new Error('Sipariş kaydı doğrulanamadı.');
  return {
    reference: str(value.reference, 20),
    method,
    items: value.items.filter(record).map(item => ({
      productName: str(item.productName, 300), variantName: str(item.variantName, 240), options: str(item.options, 400) || null,
      quantity: int(item.quantity) || 0, unitPriceMinor: int(item.unitPriceMinor) || 0, lineTotalMinor: int(item.lineTotalMinor) || 0, slug: str(item.slug, 220),
    })),
    currency: str(value.currency, 3) || 'TRY',
    subtotalMinor: subtotal,
    shippingMinor: int(value.shippingMinor),
    totalMinor: total,
    customerName: str(value.customerName, 120),
    whatsappNumber: /^\d{10,15}$/.test(str(value.whatsappNumber, 20)) ? str(value.whatsappNumber, 20) : null,
    bankTransfer: value.bankTransfer ? normalizeBank(value.bankTransfer) : null,
  };
}

export function newOrderRequestKey() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `ord_${random}`.slice(0, 80);
}

export async function submitOfflineOrder(input: {
  idempotencyKey: string;
  method: OfflineOrderMethod;
  source: 'product' | 'cart';
  items: OfflineOrderLineInput[];
  customer: OfflineOrderCustomer;
  consent: boolean;
}) {
  const items = input.items
    .filter(item => UUID_RE.test(item.variantId) && Number.isSafeInteger(item.quantity) && item.quantity > 0)
    .map(item => ({ variantId: item.variantId, quantity: Math.min(50, item.quantity), ...(item.selectedOptions && Object.keys(item.selectedOptions).length ? { selectedOptions: item.selectedOptions } : {}) }));
  if (!items.length) throw new Error('Siparişte ürün bulunamadı.');
  const phone = normalizeCustomerPhone(input.customer.phone);
  const { data, error } = await supabase.rpc('submit_order_request_v1', {
    p_idempotency_key: input.idempotencyKey,
    p_method: input.method,
    p_source: input.source,
    p_items: items,
    p_customer: {
      name: input.customer.name.trim(),
      phone: phone || input.customer.phone.trim(),
      email: input.customer.email.trim(),
      province: input.customer.province.trim(),
      district: input.customer.district.trim(),
      addressLine: input.customer.addressLine.trim(),
      note: input.customer.note.trim(),
    },
    p_consent: input.consent,
  });
  if (error) throw error;
  return normalizeReceipt(data);
}

/**
 * The normal order path failed for a server-side reason while the database
 * may still answer: record the order on the simpler fallback path (same
 * key, so it can never be stored twice). See
 * supabase/migrations/20261004190000_order_requests_mine_and_fallback_v1.sql.
 */
export async function submitOrderFallback(input: {
  idempotencyKey: string;
  method: OfflineOrderMethod;
  source: 'product' | 'cart';
  lines: Array<{ variantId: string; quantity: number; productName: string; variantName: string; unitPriceMinor: number }>;
  customer: OfflineOrderCustomer;
  reason: 'order_path_failed' | 'offline_sync';
}) {
  const items = input.lines
    .filter(line => UUID_RE.test(line.variantId) && Number.isSafeInteger(line.quantity) && line.quantity > 0 && Number.isSafeInteger(line.unitPriceMinor) && line.unitPriceMinor > 0)
    .map(line => ({ variantId: line.variantId, quantity: Math.min(50, line.quantity), unitPriceMinor: line.unitPriceMinor, productName: line.productName.slice(0, 200) || 'Ürün', variantName: (line.variantName || '').slice(0, 200) }));
  if (!items.length) throw new Error('Siparişte ürün bulunamadı.');
  const phone = normalizeCustomerPhone(input.customer.phone);
  const { data, error } = await supabase.rpc('submit_order_request_fallback_v1', {
    p_idempotency_key: input.idempotencyKey,
    p_method: input.method,
    p_source: input.source,
    p_items: items,
    p_customer: { ...input.customer, phone: phone || input.customer.phone.trim() },
    p_consent: true,
    p_reason: input.reason,
  });
  if (error) throw error;
  return normalizeReceipt(data);
}

export type MyOrderRequest = {
  reference: string; idempotencyKey: string; method: OfflineOrderMethod; status: string;
  items: Array<{ productName: string; variantName: string | null; quantity: number; lineTotalMinor: number }>;
  currency: string; shippingMinor: number | null; totalMinor: number; pricesVerified: boolean; createdAt: string;
};

/** WhatsApp and Havale/EFT orders placed from this account (Siparişlerim). */
export async function listMyOrderRequests(limit = 20): Promise<MyOrderRequest[]> {
  const { data, error } = await supabase.rpc('list_my_order_requests_v1', { p_limit: Math.min(50, Math.max(1, limit)), p_offset: 0 });
  if (error) throw error;
  const rows = record(data) && Array.isArray(data.items) ? data.items : [];
  return rows.filter(record).map(row => ({
    reference: str(row.reference, 20),
    idempotencyKey: str(row.idempotencyKey, 100),
    method: (row.method === 'bank_transfer' ? 'bank_transfer' : 'whatsapp') as OfflineOrderMethod,
    status: str(row.status, 20),
    items: Array.isArray(row.items) ? row.items.filter(record).map(item => ({ productName: str(item.productName, 200), variantName: str(item.variantName, 200) || null, quantity: int(item.quantity) || 0, lineTotalMinor: int(item.lineTotalMinor) || 0 })) : [],
    currency: str(row.currency, 3) || 'TRY',
    shippingMinor: int(row.shippingMinor),
    totalMinor: int(row.totalMinor) || 0,
    pricesVerified: row.pricesVerified !== false,
    createdAt: str(row.createdAt, 40),
  })).filter(row => /^GO-\d{6}-[A-Z0-9]{4}$/.test(row.reference));
}

/** The message the customer sends; the order code lets the store find it. */
export function whatsappOrderMessage(receipt: OfflineOrderReceipt, extra = '') {
  const lines = receipt.items.map(item => `- ${item.quantity} x ${item.productName} (${[item.variantName, item.options].filter(Boolean).join(', ')}) ${formatMoney(item.lineTotalMinor, receipt.currency)}`);
  const shipping = receipt.shippingMinor === null ? 'Kargo: onayda bildirilecek' : receipt.shippingMinor === 0 ? 'Kargo: ücretsiz' : `Kargo: ${formatMoney(receipt.shippingMinor, receipt.currency)}`;
  return [
    `Merhaba, Golden Oremar'dan sipariş vermek istiyorum.`,
    `Sipariş kodu: ${receipt.reference}`,
    ...lines,
    shipping,
    `Toplam: ${formatMoney(receipt.totalMinor, receipt.currency)}`,
    ...(extra.trim() ? [extra.trim().slice(0, 600)] : []),
    receipt.method === 'bank_transfer' ? 'Ödemeyi Havale/EFT ile yapacağım.' : 'Siparişimi onaylar mısınız?',
  ].join('\n');
}

export function whatsappOrderUrl(receipt: OfflineOrderReceipt, extra = '') {
  if (!receipt.whatsappNumber) return null;
  return `https://wa.me/${receipt.whatsappNumber}?text=${encodeURIComponent(whatsappOrderMessage(receipt, extra))}`;
}

/**
 * The order service itself is unreachable (offline, quota or server outage),
 * as opposed to the customer's input being refused. In that case the sheet
 * offers sending the order straight to WhatsApp so the sale is not lost.
 */
/** The order rules refused it (stock, input, limits): the fallback path must not bypass that. */
export function orderRefusedByRules(error: unknown) {
  return /^(?:invalid_|order_|insufficient_stock|product_not_available|duplicate_order_items|rate_limit_exceeded|mixed_currency|consent_required|empty_order)/.test(String((error as { message?: unknown })?.message || ''));
}

export function orderServiceUnavailable(error: unknown) {
  const e = (error || {}) as { message?: unknown; status?: unknown; code?: unknown };
  const message = String(e.message || '');
  if (typeof e.status === 'number' && (e.status === 402 || e.status >= 500)) return true;
  if (/^(?:invalid_|order_|insufficient_stock|product_not_available|duplicate_order_items|rate_limit_exceeded|mixed_currency)/.test(message)) return false;
  return /restricted|quota|fetch|network|timeout|upstream|unavailable|Load failed|ECONN/i.test(message);
}

/** A complete order written into a WhatsApp message, for when the service is down. */
export function whatsappDirectOrderUrl(number: string, lines: Array<{ productName: string; variantName: string; quantity: number; priceMinor: number; currency: string }>, customer: OfflineOrderCustomer, method: OfflineOrderMethod, deviceCode = '') {
  const currency = lines[0]?.currency || 'TRY';
  const subtotal = lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0);
  const text = [
    `Merhaba, Golden Oremar'dan sipariş vermek istiyorum.`,
    deviceCode ? `Geçici sipariş kodu: ${deviceCode}` : '',
    ...lines.map(line => `- ${line.quantity} x ${line.productName}${line.variantName ? ` (${line.variantName})` : ''} ${formatMoney(line.priceMinor * line.quantity, line.currency)}`),
    `Ara toplam: ${formatMoney(subtotal, currency)} (kargo ve kesin tutarı onaylarsınız)`,
    `Ad soyad: ${customer.name.trim()}`,
    `Telefon: ${normalizeCustomerPhone(customer.phone) || customer.phone.trim()}`,
    `Adres: ${customer.addressLine.trim()}, ${customer.district.trim()} / ${customer.province.trim()}`,
    customer.note.trim() ? `Not: ${customer.note.trim()}` : '',
    method === 'bank_transfer' ? 'Ödemeyi Havale/EFT ile yapacağım. Kargo dahil toplam tutarı onaylar mısınız?' : 'Siparişimi onaylar mısınız?',
  ].filter(Boolean).join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function offlineOrderErrorMessage(error: unknown) {
  const message = String((error as { message?: unknown })?.message || '').trim();
  const stock = message.match(/insufficient_stock:(\d+)/);
  if (stock) return Number(stock[1]) > 0 ? `Bu üründen şu anda en fazla ${stock[1]} adet sipariş verebilirsiniz.` : 'Ürünlerden biri şu anda stokta yok. Sepetinizi güncelleyip tekrar deneyin.';
  const map: Array<[string, string]> = [
    ['order_method_unavailable', 'Bu sipariş yöntemi şu anda kapalı. Lütfen diğer yöntemi seçin.'],
    ['order_consent_required', 'Devam etmek için ön bilgilendirme onay kutusunu işaretleyin.'],
    ['invalid_customer_phone', 'Telefon numarasını kontrol edin.'],
    ['invalid_customer_email', 'E-posta adresini kontrol edin.'],
    ['invalid_customer_address', 'Açık adresi biraz daha ayrıntılı yazın.'],
    ['invalid_customer_location', 'İl ve ilçeyi yazın.'],
    ['invalid_customer_name', 'Adınızı ve soyadınızı yazın.'],
    ['product_not_available', 'Ürünlerden biri şu anda satışta değil. Sepetinizi güncelleyip tekrar deneyin.'],
    ['invalid_order_quantity', 'Tek siparişte bir üründen en fazla 50 adet verilebilir.'],
    ['duplicate_order_items', 'Aynı ürün siparişte iki kez yer alıyor.'],
    ['order_customization', 'Ürün seçeneklerini kontrol edip tekrar deneyin.'],
    ['rate_limit_exceeded', 'Kısa sürede çok fazla sipariş denemesi yapıldı. Lütfen biraz sonra tekrar deneyin veya bize WhatsApp\'tan yazın.'],
  ];
  for (const [key, label] of map) if (message.includes(key)) return label;
  if (/fetch|network|Failed to fetch|NetworkError/i.test(message)) return 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin; bilgileriniz bu ekranda duruyor.';
  return 'Sipariş şu anda kaydedilemedi. Lütfen tekrar deneyin.';
}
