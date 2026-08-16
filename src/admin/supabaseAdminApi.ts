import { supabase } from '../lib/supabase';
import { listPublicCategories, searchCatalog, type CatalogItem, type PublicCategory } from '../features/catalog/api';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export type AdminCampaign = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  banner_path?: string | null;
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: number;
  currency?: string | null;
  minimum_order_minor: number;
  usage_limit?: number | null;
  per_user_limit: number;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
  target_scope: 'all' | 'products' | 'categories';
  target_ids: string[];
  created_at?: string;
  updated_at?: string;
};

export type AdminCampaignInput = {
  id?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  discountValue: number;
  currency?: string | null;
  minimumOrderMinor?: number;
  usageLimit?: number | null;
  perUserLimit?: number;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
  targetScope: 'all' | 'products' | 'categories';
  targetIds?: string[];
};

export async function adminListCampaigns(): Promise<AdminCampaign[]> {
  const { data, error } = await supabase.rpc('admin_list_campaigns');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    target_ids: Array.isArray(row.target_ids) ? row.target_ids.map(String) : [],
    discount_value: Number(row.discount_value || 0),
    minimum_order_minor: Number(row.minimum_order_minor || 0),
    per_user_limit: Number(row.per_user_limit || 1),
  }));
}

export async function adminSaveCampaign(input: AdminCampaignInput) {
  const targetIds = input.targetScope === 'all' ? [] : [...new Set(input.targetIds || [])];
  if (input.targetScope !== 'all' && targetIds.length === 0) throw new Error('Kampanya hedefi için en az bir ürün veya kategori seçin.');
  if (input.discountType === 'percentage' && (input.discountValue < 1 || input.discountValue > 10000)) throw new Error('Yüzde indirim %0,01 ile %100 arasında olmalıdır.');
  if (input.discountType === 'fixed' && input.discountValue <= 0) throw new Error('Sabit indirim tutarı sıfırdan büyük olmalıdır.');
  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) throw new Error('Bitiş tarihi başlangıç tarihinden sonra olmalıdır.');

  const { data, error } = await supabase.rpc('admin_upsert_campaign', {
    p_id: input.id || null,
    p_slug: input.slug,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || null,
    p_banner_path: null,
    p_discount_type: input.discountType,
    p_discount_value: Math.round(input.discountValue),
    p_currency: input.discountType === 'fixed' ? (input.currency || 'TRY') : null,
    p_minimum_order_minor: Math.max(0, Math.round(input.minimumOrderMinor || 0)),
    p_usage_limit: input.usageLimit && input.usageLimit > 0 ? Math.round(input.usageLimit) : null,
    p_per_user_limit: Math.max(1, Math.round(input.perUserLimit || 1)),
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_status: input.status,
    p_target_scope: input.targetScope,
    p_target_ids: targetIds,
  });
  return unwrap<string>(data, error);
}

export async function adminCampaignTargetOptions(): Promise<{ categories: PublicCategory[]; products: CatalogItem[] }> {
  const [categories, productResult] = await Promise.all([
    listPublicCategories(),
    searchCatalog({ limit: 100, offset: 0, sort: 'newest' }),
  ]);
  return { categories: Array.isArray(categories) ? categories : [], products: productResult.items || [] };
}

export type AdminFinanceReport = {
  currency: string;
  from: string;
  to: string;
  totals: {
    order_count: number;
    gross_sales_minor: number;
    refund_minor: number;
    net_sales_minor: number;
    commission_minor: number;
    estimated_payout_minor: number;
  };
  daily_sales: Array<{ date: string; order_count: number; gross_sales_minor: number; refund_minor: number; net_sales_minor: number }>;
  vendor_income: Array<{ producer_id: string; vendor_name: string; order_count: number; gross_sales_minor: number; commission_minor: number; estimated_payout_minor: number }>;
};

export async function adminFinanceReport(from: string, to: string): Promise<AdminFinanceReport> {
  const { data, error } = await supabase.rpc('admin_finance_report', { p_from: from, p_to: to });
  return unwrap<AdminFinanceReport>(data, error);
}

export type AdminReview = {
  id: string;
  user_name: string;
  product_name: string;
  rating: number;
  title?: string | null;
  comment: string;
  status: 'pending' | 'published' | 'rejected' | 'hidden' | 'withdrawn';
  is_verified_purchase: boolean;
  created_at: string;
  updated_at: string;
};

export async function adminListReviews(): Promise<AdminReview[]> {
  const { data, error } = await supabase.rpc('admin_list_reviews');
  return unwrap<AdminReview[]>(data, error) || [];
}

export async function adminModerateReview(reviewId: string, status: 'published' | 'rejected' | 'hidden', reason?: string | null) {
  const { data, error } = await supabase.rpc('admin_moderate_review_v1', {
    p_review_id: reviewId,
    p_status: status,
    p_reason: reason?.trim() || null,
  });
  return unwrap<any>(data, error);
}

export function slugifyCampaign(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function minorToTry(value: number | null | undefined) {
  return (Number(value || 0) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
