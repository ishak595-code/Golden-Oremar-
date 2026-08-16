import { supabase } from '../lib/supabase';

export type AdminProducerStatus = 'active' | 'suspended';

export type AdminProducer = {
  id: string;
  owner_user_id: string;
  application_id: string | null;
  slug: string;
  display_name: string;
  description: string | null;
  production_location: string | null;
  production_country_code: string | null;
  production_province: string | null;
  production_district: string | null;
  production_village: string | null;
  production_village_is_custom: boolean;
  logo_path: string | null;
  status: AdminProducerStatus;
  is_verified: boolean;
  verified_at: string | null;
  verification_due_at: string | null;
  origin_verified: boolean;
  origin_verified_at: string | null;
  origin_verification_basis: string | null;
  commission_basis_points: number;
  rating_average: number;
  rating_count: number;
  email: string;
  phone: string | null;
  created_at: string;
  product_count: number;
  order_count: number;
  follower_count: number;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function adminListProducers(): Promise<AdminProducer[]> {
  const { data, error } = await supabase.rpc('admin_list_producers_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    owner_user_id: String(row.owner_user_id),
    application_id: row.application_id ? String(row.application_id) : null,
    slug: String(row.slug || ''),
    display_name: String(row.display_name || 'İsimsiz mağaza'),
    email: String(row.email || ''),
    phone: row.phone ? String(row.phone) : null,
    status: row.status === 'suspended' ? 'suspended' : 'active',
    is_verified: row.is_verified === true,
    origin_verified: row.origin_verified === true,
    production_village_is_custom: row.production_village_is_custom === true,
    commission_basis_points: Number(row.commission_basis_points || 0),
    rating_average: Number(row.rating_average || 0),
    rating_count: Number(row.rating_count || 0),
    product_count: Number(row.product_count || 0),
    order_count: Number(row.order_count || 0),
    follower_count: Number(row.follower_count || 0),
  }));
}

export async function adminSetProducerStatus(producerId: string, status: AdminProducerStatus, reason?: string) {
  const cleanReason = reason?.trim() || null;
  if (status === 'suspended' && (!cleanReason || cleanReason.length < 10)) {
    throw new Error('Satıcıyı askıya almak için en az 10 karakterlik gerekçe yazılmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_set_producer_status_v1', {
    p_producer_id: producerId,
    p_status: status,
    p_reason: cleanReason,
  });
  return unwrap<any>(data, error);
}

export async function adminSetProducerCommission(producerId: string, percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 30) {
    throw new Error('Platform komisyonu %0 ile %30 arasında olmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_set_producer_commission_v1', {
    p_producer_id: producerId,
    p_commission_basis_points: Math.round(percent * 100),
  });
  return unwrap<any>(data, error);
}

export async function adminSetProducerOriginVerified(producerId: string, verified: boolean, reason: string) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 10 || cleanReason.length > 1000) {
    throw new Error('Menşe doğrulama kararı için 10 ile 1000 karakter arasında gerekçe yazılmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_set_producer_origin_verified_v1', {
    p_producer_id: producerId,
    p_verified: verified,
    p_reason: cleanReason,
  });
  return unwrap<any>(data, error);
}

export function producerAdminErrorMessage(error: unknown, fallback = 'Satıcı yönetim işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['producer_profile_not_found', 'Satıcı profili artık bulunamadı. Listeyi yenileyin.'],
    ['producer_not_found', 'Satıcı profili artık bulunamadı. Listeyi yenileyin.'],
    ['producer_not_verified', 'Kimliği doğrulanmamış bir satıcı yeniden etkinleştirilemez.'],
    ['producer_identity_not_verified', 'Kimlik doğrulaması tamamlanmadan üretim menşei doğrulanamaz.'],
    ['producer_origin_information_required', 'Menşe doğrulaması için üretim yeri bilgileri eksiksiz olmalıdır.'],
    ['producer_status_reason_required', 'Satıcıyı askıya almak için en az 10 karakterlik gerekçe gerekiyor.'],
    ['origin_verification_reason_required', 'Menşe doğrulama kararı için 10 ile 1000 karakter arasında gerekçe gerekiyor.'],
    ['invalid_producer_commission', 'Platform komisyonu %0 ile %30 arasında olmalıdır.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function basisPointsToPercent(value: number | null | undefined) {
  return Number(value || 0) / 100;
}
