import { supabase } from '../lib/supabase';
import { listPublicCategories, searchCatalog, type CatalogItem, type PublicCategory } from '../features/catalog/api';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export type CampaignDiscountType = 'percentage' | 'fixed' | 'free_shipping';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';
export type CampaignTargetScope = 'all' | 'products' | 'categories';

export type AdminCampaign = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  banner_path?: string | null;
  discount_type: CampaignDiscountType;
  // Backend contract: percentage is basis points, fixed is currency minor units.
  discount_value: number;
  currency?: string | null;
  minimum_order_minor: number;
  usage_limit?: number | null;
  per_user_limit: number;
  starts_at: string;
  ends_at: string;
  status: CampaignStatus;
  target_scope: CampaignTargetScope;
  target_ids: string[];
  created_at?: string;
  updated_at?: string;
};

export type AdminCampaignInput = {
  id?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  discountType: CampaignDiscountType;
  // Human-facing value: 10 means 10%, or 10 TRY for a fixed discount.
  discountDisplayValue: number;
  currency?: string | null;
  // Human-facing TRY amount. Conversion to minor unit happens only in this API boundary.
  minimumOrderTry?: number;
  usageLimit?: number | null;
  perUserLimit?: number;
  startsAt: string;
  endsAt: string;
  status: CampaignStatus;
  targetScope: CampaignTargetScope;
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
    usage_limit: row.usage_limit == null ? null : Number(row.usage_limit),
    per_user_limit: Math.max(1, Number(row.per_user_limit || 1)),
  }));
}

export async function adminSaveCampaign(input: AdminCampaignInput) {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const targetIds = input.targetScope === 'all'
    ? []
    : [...new Set((input.targetIds || []).map(String).filter(Boolean))];

  if (title.length < 2 || title.length > 160) throw new Error('Kampanya adı 2 ile 160 karakter arasında olmalıdır.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Kampanya kısa adı yalnızca küçük harf, sayı ve tire içerebilir.');
  if ((input.description || '').length > 4000) throw new Error('Kampanya açıklaması 4000 karakteri aşamaz.');
  if (input.targetScope !== 'all' && targetIds.length === 0) throw new Error('Kampanya hedefi için en az bir ürün veya kategori seçin.');

  let backendDiscountValue = 0;
  if (input.discountType === 'percentage') {
    if (!Number.isFinite(input.discountDisplayValue) || input.discountDisplayValue < 0.01 || input.discountDisplayValue > 100) {
      throw new Error('Yüzde indirim %0,01 ile %100 arasında olmalıdır.');
    }
    backendDiscountValue = percentageToBasisPoints(input.discountDisplayValue);
  } else if (input.discountType === 'fixed') {
    if (!Number.isFinite(input.discountDisplayValue) || input.discountDisplayValue <= 0) {
      throw new Error('Sabit indirim tutarı sıfırdan büyük olmalıdır.');
    }
    backendDiscountValue = majorToMinor(input.discountDisplayValue);
  }

  const minimumOrderMinor = majorToMinor(input.minimumOrderTry || 0);
  const startMs = new Date(input.startsAt).getTime();
  const endMs = new Date(input.endsAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('Bitiş tarihi başlangıç tarihinden sonra olmalıdır.');
  }

  const { data, error } = await supabase.rpc('admin_upsert_campaign', {
    p_id: input.id || null,
    p_slug: slug,
    p_title: title,
    p_description: input.description?.trim() || null,
    p_banner_path: null,
    p_discount_type: input.discountType,
    p_discount_value: backendDiscountValue,
    p_currency: input.discountType === 'fixed' ? (input.currency || 'TRY').toUpperCase() : null,
    p_minimum_order_minor: minimumOrderMinor,
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
  return {
    categories: Array.isArray(categories) ? categories : [],
    products: Array.isArray(productResult?.items) ? productResult.items : [],
  };
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
  daily_sales: Array<{
    date: string;
    order_count: number;
    gross_sales_minor: number;
    refund_minor: number;
    net_sales_minor: number;
  }>;
  vendor_income: Array<{
    producer_id: string;
    vendor_name: string;
    order_count: number;
    gross_sales_minor: number;
    commission_minor: number;
    estimated_payout_minor: number;
  }>;
};

export async function adminFinanceReport(from: string, to: string): Promise<AdminFinanceReport> {
  const { data, error } = await supabase.rpc('admin_finance_report', { p_from: from, p_to: to });
  const report = unwrap<AdminFinanceReport>(data, error);
  return {
    ...report,
    totals: {
      order_count: Number(report?.totals?.order_count || 0),
      gross_sales_minor: Number(report?.totals?.gross_sales_minor || 0),
      refund_minor: Number(report?.totals?.refund_minor || 0),
      net_sales_minor: Number(report?.totals?.net_sales_minor || 0),
      commission_minor: Number(report?.totals?.commission_minor || 0),
      estimated_payout_minor: Number(report?.totals?.estimated_payout_minor || 0),
    },
    daily_sales: Array.isArray(report?.daily_sales) ? report.daily_sales : [],
    vendor_income: Array.isArray(report?.vendor_income) ? report.vendor_income : [],
  };
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
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    rating: Math.max(0, Math.min(5, Number(row.rating || 0))),
    user_name: String(row.user_name || 'Kullanıcı'),
    product_name: String(row.product_name || 'Ürün'),
    comment: String(row.comment || ''),
    is_verified_purchase: row.is_verified_purchase === true,
  }));
}

export async function adminModerateReview(
  reviewId: string,
  status: 'published' | 'rejected' | 'hidden',
  reason?: string | null,
) {
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

export function percentageToBasisPoints(value: number) {
  return Math.round(Number(value || 0) * 100);
}

export function basisPointsToPercentage(value: number | null | undefined) {
  return Number(value || 0) / 100;
}

export function majorToMinor(value: number | null | undefined) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

export function minorToMajor(value: number | null | undefined) {
  return Number(value || 0) / 100;
}

export function minorToTry(value: number | null | undefined) {
  return minorToMajor(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function adminErrorMessage(error: unknown, fallback = 'İşlem tamamlanamadı.') {
  const message = String((error as any)?.message || (error as any)?.error_description || '').trim();
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu işlem için yönetici yetkisi gerekiyor.';
  if (message.includes('active_campaign_outside_window')) return 'Aktif kampanyanın başlangıç ve bitiş aralığı şu anı kapsamalıdır.';
  if (message.includes('campaign_target_not_found')) return 'Seçilen ürün veya kategori artık bulunamadı. Listeyi yenileyip tekrar deneyin.';
  if (message.includes('invalid_finance_date_range')) return 'Finans raporu tarih aralığı geçersiz.';
  if (message.includes('invalid_campaign')) return 'Kampanya bilgileri backend doğrulamasından geçmedi.';
  return message.length <= 240 ? message : fallback;
}
