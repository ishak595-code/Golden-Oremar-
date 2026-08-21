import { supabase } from '../lib/supabase';

export type AdminInventoryProductStatus = 'draft' | 'review' | 'published' | 'rejected' | 'archived';
export type AdminInventoryStockMode = 'tracked' | 'preorder' | 'unlimited' | 'seasonal';
export type AdminInventoryProducerStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'closed';

export type AdminInventoryRow = {
  variant_id: string;
  sku: string;
  variant_name: string;
  product_id: string;
  product_name: string;
  product_status: AdminInventoryProductStatus;
  stock_mode: AdminInventoryStockMode;
  currency: string;
  price_minor: number;
  producer_id: string;
  producer_name: string;
  producer_status: AdminInventoryProducerStatus;
  producer_verified: boolean;
  available_quantity: number;
  reserved_quantity: number;
  sellable_quantity: number;
  reorder_level: number;
  version: number;
  updated_at: string;
  is_active: boolean;
};

const PRODUCT_STATUSES = new Set<AdminInventoryProductStatus>(['draft', 'review', 'published', 'rejected', 'archived']);
const STOCK_MODES = new Set<AdminInventoryStockMode>(['tracked', 'preorder', 'unlimited', 'seasonal']);
const PRODUCER_STATUSES = new Set<AdminInventoryProducerStatus>(['pending', 'active', 'suspended', 'rejected', 'closed']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function nonNegativeInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function dateTime(value: unknown, label: string) {
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function currencyCode(value: unknown) {
  const currency = requiredText(value, 'Para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Para birimi doğrulanamadı.');
  return currency;
}

function productStatus(value: unknown) {
  const status = requiredText(value, 'Ürün durumu', 40) as AdminInventoryProductStatus;
  if (!PRODUCT_STATUSES.has(status)) throw new Error('Ürün durumu doğrulanamadı.');
  return status;
}

function stockMode(value: unknown) {
  const mode = requiredText(value, 'Stok modeli', 40) as AdminInventoryStockMode;
  if (!STOCK_MODES.has(mode)) throw new Error('Stok modeli doğrulanamadı.');
  return mode;
}

function producerStatus(value: unknown) {
  const status = requiredText(value, 'Üretici durumu', 40) as AdminInventoryProducerStatus;
  if (!PRODUCER_STATUSES.has(status)) throw new Error('Üretici durumu doğrulanamadı.');
  return status;
}

function normalizeRow(value: unknown, index: number): AdminInventoryRow {
  if (!isRecord(value)) throw new Error(`${index + 1}. stok kaydı doğrulanamadı.`);
  const available = nonNegativeInteger(value.available_quantity, `${index + 1}. kullanılabilir stok`, 1000000000);
  const reserved = nonNegativeInteger(value.reserved_quantity, `${index + 1}. rezerve stok`, 1000000000);
  const sellable = nonNegativeInteger(value.sellable_quantity, `${index + 1}. satılabilir stok`, 1000000000);
  const expectedSellable = Math.max(0, available - reserved);
  if (sellable !== expectedSellable) throw new Error(`${index + 1}. stok özeti kendi içinde tutarsız.`);
  return {
    variant_id: uuid(value.variant_id, `${index + 1}. varyant kimliği`),
    sku: requiredText(value.sku, `${index + 1}. SKU`, 160),
    variant_name: requiredText(value.variant_name, `${index + 1}. varyant adı`, 240),
    product_id: uuid(value.product_id, `${index + 1}. ürün kimliği`),
    product_name: requiredText(value.product_name, `${index + 1}. ürün adı`, 300),
    product_status: productStatus(value.product_status),
    stock_mode: stockMode(value.stock_mode),
    currency: currencyCode(value.currency),
    price_minor: nonNegativeInteger(value.price_minor, `${index + 1}. varyant fiyatı`),
    producer_id: uuid(value.producer_id, `${index + 1}. üretici kimliği`),
    producer_name: requiredText(value.producer_name, `${index + 1}. üretici adı`, 240),
    producer_status: producerStatus(value.producer_status),
    producer_verified: booleanValue(value.producer_verified, `${index + 1}. üretici doğrulama durumu`),
    available_quantity: available,
    reserved_quantity: reserved,
    sellable_quantity: sellable,
    reorder_level: nonNegativeInteger(value.reorder_level, `${index + 1}. yeniden sipariş seviyesi`, 1000000000),
    version: nonNegativeInteger(value.version, `${index + 1}. stok sürümü`, 1000000000),
    updated_at: dateTime(value.updated_at, `${index + 1}. stok güncelleme tarihi`),
    is_active: booleanValue(value.is_active, `${index + 1}. varyant aktiflik durumu`),
  };
}

export async function adminListInventory(): Promise<AdminInventoryRow[]> {
  const { data, error } = await supabase.rpc('admin_list_inventory_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Stok listesi sunucudan doğrulanamadı.');
  return rows.map(normalizeRow);
}

export function inventoryAdminErrorMessage(error: unknown, fallback = 'Stok bilgileri yüklenemedi.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu stok görünümü için yönetici yetkisi gerekiyor.';
  return message.length <= 240 ? message : fallback;
}

export function inventoryMoney(minor: number | null | undefined, currency: string | null | undefined) {
  if (!Number.isSafeInteger(minor) || Number(minor) < 0) return 'Tutar doğrulanamadı';
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) return 'Para birimi doğrulanamadı';
  try {
    return (Number(minor) / 100).toLocaleString('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 });
  } catch {
    return 'Tutar doğrulanamadı';
  }
}
