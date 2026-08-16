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
    producer_applications: any[];
    products: any[];
    returns: any[];
    reviews: any[];
  };
};

export type ProducerDashboardV2 = {
  profile: {
    id: string;
    display_name: string;
    description: string | null;
    story: string | null;
    production_location: string | null;
    production_country_code: string | null;
    production_province: string | null;
    production_district: string | null;
    production_village: string | null;
    production_village_is_custom: boolean;
    logo_path: string | null;
    cover_path: string | null;
    status: string;
    is_verified: boolean;
    verified_at: string | null;
    verification_due_at: string | null;
    rating_average: number;
    rating_count: number;
    commission_basis_points: number;
    product_count: number;
    published_product_count: number;
    order_count: number;
    customer_count: number;
  };
  summary: {
    draftProducts: number;
    reviewProducts: number;
    publishedProducts: number;
    rejectedProducts: number;
    pendingChanges: number;
    draftBatches: number;
    reviewBatches: number;
    releasedBatches: number;
    lowStockVariants: number;
  };
  finance: {
    producerId: string;
    displayName: string;
    commissionBasisPoints: number;
    balances: Array<{
      currency: string;
      pendingMinor: number;
      availableLedgerMinor: number;
      reservedPayoutMinor: number;
      paidPayoutMinor: number;
      availableToPayoutMinor: number;
      lifetimeNetMinor: number;
    }>;
  };
  commerce: {
    followerCount: number;
    orderCount: number;
    openOrderCount: number;
    customerCount: number;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      fulfillmentStatus: string;
      currency: string;
      producerTotalMinor: number;
      placedAt: string | null;
      createdAt: string;
    }>;
  };
  changeRequests: any[];
  batches: any[];
  recentPayouts: any[];
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function numberize(value: unknown) {
  return Number(value || 0);
}

export async function getAdminOperationsOverview(): Promise<AdminOperationsOverview> {
  const { data, error } = await supabase.rpc('admin_operations_overview_v1');
  const raw = unwrap<any>(data, error) || {};
  const counts = raw.counts || {};
  return {
    generated_at: String(raw.generated_at || new Date().toISOString()),
    counts: {
      active_users: numberize(counts.active_users),
      verified_producers: numberize(counts.verified_producers),
      published_products: numberize(counts.published_products),
      open_orders: numberize(counts.open_orders),
      producer_applications: numberize(counts.producer_applications),
      product_reviews: numberize(counts.product_reviews),
      product_change_requests: numberize(counts.product_change_requests),
      return_requests: numberize(counts.return_requests),
      review_moderation: numberize(counts.review_moderation),
      support_conversations: numberize(counts.support_conversations),
      account_closures: numberize(counts.account_closures),
      producer_payouts: numberize(counts.producer_payouts),
    },
    finance_by_currency: Array.isArray(raw.finance_by_currency) ? raw.finance_by_currency.map((row: any) => ({
      currency: String(row.currency || 'TRY'),
      captured_minor: numberize(row.captured_minor),
      refunded_minor: numberize(row.refunded_minor),
      net_collected_minor: numberize(row.net_collected_minor),
    })) : [],
    recent_orders: Array.isArray(raw.recent_orders) ? raw.recent_orders.map((row: any) => ({
      ...row,
      id: String(row.id),
      order_number: String(row.order_number || row.id),
      total_minor: numberize(row.total_minor),
    })) : [],
    queues: {
      producer_applications: Array.isArray(raw.queues?.producer_applications) ? raw.queues.producer_applications : [],
      products: Array.isArray(raw.queues?.products) ? raw.queues.products : [],
      returns: Array.isArray(raw.queues?.returns) ? raw.queues.returns : [],
      reviews: Array.isArray(raw.queues?.reviews) ? raw.queues.reviews : [],
    },
  };
}

export async function getMyProducerDashboardV2(): Promise<ProducerDashboardV2> {
  const { data, error } = await supabase.rpc('get_my_producer_dashboard_v2');
  const raw = unwrap<any>(data, error) || {};
  const profile = raw.profile || {};
  const summary = raw.summary || {};
  const finance = raw.finance || {};
  const commerce = raw.commerce || {};
  return {
    ...raw,
    profile: {
      ...profile,
      id: String(profile.id || ''),
      display_name: String(profile.display_name || 'Mağazam'),
      rating_average: numberize(profile.rating_average),
      rating_count: numberize(profile.rating_count),
      commission_basis_points: numberize(profile.commission_basis_points),
      product_count: numberize(profile.product_count),
      published_product_count: numberize(profile.published_product_count),
      order_count: numberize(profile.order_count),
      customer_count: numberize(profile.customer_count),
      is_verified: profile.is_verified === true,
      production_village_is_custom: profile.production_village_is_custom === true,
    },
    summary: {
      draftProducts: numberize(summary.draftProducts),
      reviewProducts: numberize(summary.reviewProducts),
      publishedProducts: numberize(summary.publishedProducts),
      rejectedProducts: numberize(summary.rejectedProducts),
      pendingChanges: numberize(summary.pendingChanges),
      draftBatches: numberize(summary.draftBatches),
      reviewBatches: numberize(summary.reviewBatches),
      releasedBatches: numberize(summary.releasedBatches),
      lowStockVariants: numberize(summary.lowStockVariants),
    },
    finance: {
      producerId: String(finance.producerId || profile.id || ''),
      displayName: String(finance.displayName || profile.display_name || 'Mağazam'),
      commissionBasisPoints: numberize(finance.commissionBasisPoints),
      balances: Array.isArray(finance.balances) ? finance.balances.map((row: any) => ({
        ...row,
        currency: String(row.currency || 'TRY'),
        pendingMinor: numberize(row.pendingMinor),
        availableLedgerMinor: numberize(row.availableLedgerMinor),
        reservedPayoutMinor: numberize(row.reservedPayoutMinor),
        paidPayoutMinor: numberize(row.paidPayoutMinor),
        availableToPayoutMinor: numberize(row.availableToPayoutMinor),
        lifetimeNetMinor: numberize(row.lifetimeNetMinor),
      })) : [],
    },
    commerce: {
      followerCount: numberize(commerce.followerCount),
      orderCount: numberize(commerce.orderCount),
      openOrderCount: numberize(commerce.openOrderCount),
      customerCount: numberize(commerce.customerCount),
      recentOrders: Array.isArray(commerce.recentOrders) ? commerce.recentOrders.map((row: any) => ({
        ...row,
        id: String(row.id),
        orderNumber: String(row.orderNumber || row.id),
        producerTotalMinor: numberize(row.producerTotalMinor),
      })) : [],
    },
    changeRequests: Array.isArray(raw.changeRequests) ? raw.changeRequests : [],
    batches: Array.isArray(raw.batches) ? raw.batches : [],
    recentPayouts: Array.isArray(raw.recentPayouts) ? raw.recentPayouts : [],
  };
}

export function dashboardErrorMessage(error: unknown, fallback = 'Panel verileri yüklenemedi.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu yönetici paneli için yetkiniz yok.';
  if (message.includes('producer_profile_required') || message.includes('producer_profile_not_found')) return 'Bu hesapla eşleşen üretici profili bulunamadı.';
  if (message.includes('authentication_required')) return 'Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.';
  return message.length <= 240 ? message : fallback;
}

export function formatMinor(value: number | null | undefined, currency = 'TRY') {
  return (Number(value || 0) / 100).toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
}
