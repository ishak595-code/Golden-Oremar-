import { supabase } from '../lib/supabase';

/** Super Admin side of ordering without online payment (WhatsApp, Havale/EFT). */

export type OrderRequestStatus = 'new' | 'contacted' | 'confirmed' | 'paid' | 'shipped' | 'completed' | 'cancelled';
export type OrderRequestFilter = 'open' | 'all' | OrderRequestStatus;
export type AdminBankAccount = { bankName: string; accountHolder: string; iban: string; branch: string; active: boolean };
export type OfflineOrderingSettings = {
  whatsappEnabled: boolean;
  bankTransferEnabled: boolean;
  whatsappNumber: string;
  contactWhatsappNumber: string | null;
  bankAccounts: AdminBankAccount[];
  paymentWindowHours: number;
  customerNote: string;
  canManage: boolean;
  publicWhatsappEnabled: boolean;
  publicBankEnabled: boolean;
};
export type OrderRequestLine = { productName: string; variantName: string; options: string | null; quantity: number; unitPriceMinor: number; lineTotalMinor: number; slug: string };
export type OrderRequest = {
  id: string; reference: string; method: 'whatsapp' | 'bank_transfer'; status: OrderRequestStatus; source: string; guest: boolean;
  customerName: string; phone: string; email: string | null; province: string; district: string; addressLine: string; customerNote: string | null;
  items: OrderRequestLine[]; currency: string; subtotalMinor: number; shippingMinor: number | null; totalMinor: number;
  stockCommitted: boolean; adminNote: string | null; createdAt: string; updatedAt: string;
};

export const ORDER_REQUEST_STATUS_LABELS: Record<OrderRequestStatus, string> = {
  new: 'Yeni', contacted: 'İletişime geçildi', confirmed: 'Onaylandı', paid: 'Ödeme alındı', shipped: 'Kargoda', completed: 'Tamamlandı', cancelled: 'İptal',
};

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function str(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function int(value: unknown) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null; }
const STATUSES = new Set<OrderRequestStatus>(['new', 'contacted', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled']);

/** TR + 24 digits with the ISO 13616 mod-97 check, like the database. */
export function isValidTurkishIban(raw: string) {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function formatIban(raw: string) {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

function normalizeSettings(value: unknown): OfflineOrderingSettings {
  if (!record(value)) throw new Error('Sipariş kanalı ayarları doğrulanamadı.');
  const accounts = Array.isArray(value.bankAccounts) ? value.bankAccounts.filter(record).map(account => ({
    bankName: str(account.bankName, 80), accountHolder: str(account.accountHolder, 140), iban: str(account.iban, 40), branch: str(account.branch, 80), active: account.active !== false,
  })) : [];
  const pub = record(value.public) ? value.public : {};
  return {
    whatsappEnabled: value.whatsappEnabled === true,
    bankTransferEnabled: value.bankTransferEnabled === true,
    whatsappNumber: str(value.whatsappNumber, 20),
    contactWhatsappNumber: str(value.contactWhatsappNumber, 20) || null,
    bankAccounts: accounts,
    paymentWindowHours: int(value.paymentWindowHours) || 48,
    customerNote: str(value.customerNote, 600),
    canManage: value.canManage === true,
    publicWhatsappEnabled: record(pub.whatsapp) && pub.whatsapp.enabled === true,
    publicBankEnabled: record(pub.bankTransfer) && pub.bankTransfer.enabled === true,
  };
}

export async function getOfflineOrderingSettings() {
  const { data, error } = await supabase.rpc('admin_get_offline_ordering_settings_v1');
  if (error) throw error;
  return normalizeSettings(data);
}

export async function saveOfflineOrderingSettings(input: Omit<OfflineOrderingSettings, 'contactWhatsappNumber' | 'canManage' | 'publicWhatsappEnabled' | 'publicBankEnabled'>) {
  for (const [index, account] of input.bankAccounts.entries()) {
    if (!isValidTurkishIban(account.iban)) throw new Error(`${index + 1}. hesabın IBAN numarası geçersiz. TR ile başlayan 26 karakteri kontrol edin.`);
    if (account.bankName.trim().length < 2) throw new Error(`${index + 1}. hesabın banka adını yazın.`);
    if (account.accountHolder.trim().length < 2) throw new Error(`${index + 1}. hesabın alıcı adını (hesap sahibi) yazın.`);
  }
  const { data, error } = await supabase.rpc('admin_update_offline_ordering_settings_v1', {
    p_payload: {
      whatsappEnabled: input.whatsappEnabled,
      bankTransferEnabled: input.bankTransferEnabled,
      whatsappNumber: input.whatsappNumber.trim(),
      bankAccounts: input.bankAccounts.map(account => ({ bankName: account.bankName.trim(), accountHolder: account.accountHolder.trim(), iban: account.iban.replace(/\s/g, '').toUpperCase(), branch: account.branch.trim(), active: account.active })),
      paymentWindowHours: input.paymentWindowHours,
      customerNote: input.customerNote.trim(),
    },
  });
  if (error) throw error;
  return normalizeSettings(data);
}

function normalizeRequest(value: unknown): OrderRequest | null {
  if (!record(value)) return null;
  const status = str(value.status, 20) as OrderRequestStatus;
  if (!STATUSES.has(status)) return null;
  return {
    id: str(value.id, 40), reference: str(value.reference, 20), method: value.method === 'bank_transfer' ? 'bank_transfer' : 'whatsapp', status,
    source: str(value.source, 20), guest: value.guest === true, customerName: str(value.customerName, 120), phone: str(value.phone, 20),
    email: str(value.email, 254) || null, province: str(value.province, 80), district: str(value.district, 80), addressLine: str(value.addressLine, 500),
    customerNote: str(value.customerNote, 1000) || null,
    items: Array.isArray(value.items) ? value.items.filter(record).map(item => ({ productName: str(item.productName, 300), variantName: str(item.variantName, 240), options: str(item.options, 400) || null, quantity: int(item.quantity) || 0, unitPriceMinor: int(item.unitPriceMinor) || 0, lineTotalMinor: int(item.lineTotalMinor) || 0, slug: str(item.slug, 220) })) : [],
    currency: str(value.currency, 3) || 'TRY', subtotalMinor: int(value.subtotalMinor) || 0, shippingMinor: int(value.shippingMinor), totalMinor: int(value.totalMinor) || 0,
    stockCommitted: value.stockCommitted === true, adminNote: str(value.adminNote, 2000) || null, createdAt: str(value.createdAt, 60), updatedAt: str(value.updatedAt, 60),
  };
}

export async function listOrderRequests(input: { status: OrderRequestFilter; query?: string; limit?: number; offset?: number }) {
  const { data, error } = await supabase.rpc('admin_list_order_requests_v1', { p_status: input.status, p_query: (input.query || '').trim().slice(0, 120) || null, p_limit: input.limit || 50, p_offset: input.offset || 0 });
  if (error) throw error;
  if (!record(data)) throw new Error('Sipariş talepleri doğrulanamadı.');
  const counts: Partial<Record<OrderRequestStatus, number>> = {};
  if (record(data.counts)) for (const [key, value] of Object.entries(data.counts)) if (STATUSES.has(key as OrderRequestStatus) && int(value) !== null) counts[key as OrderRequestStatus] = int(value)!;
  return { counts, total: int(data.total) || 0, items: Array.isArray(data.items) ? data.items.map(normalizeRequest).filter((item): item is OrderRequest => Boolean(item)) : [] };
}

export async function updateOrderRequest(id: string, status: OrderRequestStatus, adminNote?: string) {
  const { error } = await supabase.rpc('admin_update_order_request_v1', { p_id: id, p_status: status, p_admin_note: adminNote?.trim() || null });
  if (error) throw error;
}

export function orderRequestAdminError(error: unknown) {
  const message = String((error as { message?: unknown })?.message || '').trim();
  const stock = message.match(/insufficient_stock:(.+)$/);
  if (stock) return `Stok yetersiz: ${stock[1].slice(0, 120)}. Stoğu güncelleyin veya siparişi düzenleyin.`;
  const map: Array<[string, string]> = [
    ['permission_required:payment.manage', 'Sipariş kanalı ayarları yalnız ödeme yönetimi yetkili (MFA doğrulanmış) Süper Yönetici hesabına açıktır.'],
    ['permission_required:order', 'Bu işlem için sipariş yetkisi ve doğrulanmış MFA oturumu gerekiyor.'],
    ['invalid_iban', 'IBAN geçersiz. TR ile başlayan 26 karakteri kontrol edin.'],
    ['invalid_bank_name', 'Banka adını yazın.'],
    ['invalid_account_holder', 'Alıcı adını (hesap sahibi) yazın.'],
    ['invalid_whatsapp_number', 'WhatsApp numarasını ülke koduyla yazın (ör. 905xx...).'],
    ['invalid_payment_window', 'Ödeme süresi 1 ile 240 saat arasında olmalı.'],
    ['order_request_closed', 'Tamamlanan veya iptal edilen sipariş yeniden açılamaz.'],
    ['order_request_not_found', 'Sipariş talebi bulunamadı. Listeyi yenileyin.'],
  ];
  for (const [key, label] of map) if (message.includes(key)) return label;
  return message && message.length <= 200 ? message : 'İşlem tamamlanamadı.';
}
