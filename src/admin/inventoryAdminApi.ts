import { supabase } from '../lib/supabase';

export type AdminInventoryRow = {
  variant_id: string;
  sku: string | null;
  variant_name: string;
  product_id: string;
  product_name: string;
  product_status: string;
  stock_mode: string;
  currency: string;
  price_minor: number;
  producer_id: string;
  producer_name: string;
  producer_status: string;
  producer_verified: boolean;
  available_quantity: number;
  reserved_quantity: number;
  sellable_quantity: number;
  reorder_level: number;
  version: number;
  updated_at: string;
  is_active: boolean;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function adminListInventory(): Promise<AdminInventoryRow[]> {
  const { data, error } = await supabase.rpc('admin_list_inventory_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    variant_id: String(row.variant_id),
    sku: row.sku ? String(row.sku) : null,
    variant_name: String(row.variant_name || 'Standart'),
    product_id: String(row.product_id),
    product_name: String(row.product_name || 'İsimsiz ürün'),
    product_status: String(row.product_status || 'draft'),
    stock_mode: String(row.stock_mode || 'tracked'),
    currency: String(row.currency || 'TRY'),
    price_minor: Number(row.price_minor || 0),
    producer_id: String(row.producer_id),
    producer_name: String(row.producer_name || 'Bilinmeyen üretici'),
    producer_status: String(row.producer_status || 'suspended'),
    producer_verified: row.producer_verified === true,
    available_quantity: Number(row.available_quantity || 0),
    reserved_quantity: Number(row.reserved_quantity || 0),
    sellable_quantity: Number(row.sellable_quantity || 0),
    reorder_level: Number(row.reorder_level || 0),
    version: Number(row.version || 0),
    updated_at: String(row.updated_at || ''),
    is_active: row.is_active === true,
  }));
}

export function inventoryAdminErrorMessage(error: unknown, fallback = 'Stok bilgileri yüklenemedi.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu stok görünümü için yönetici yetkisi gerekiyor.';
  return message.length <= 240 ? message : fallback;
}

export function inventoryMoney(minor: number | null | undefined, currency = 'TRY') {
  return (Number(minor || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
}
