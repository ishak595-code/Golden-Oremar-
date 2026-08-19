import { supabase } from '../lib/supabase';

export type AdminProducerStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'closed';
export type AdminProducerManagedStatus = 'active' | 'suspended';

export type AdminProducer = {
  id: string;
  owner_user_id: string;
  application_id: string | null;
  slug: string;
  display_name: string;
  description: string;
  production_location: string;
  production_country_code: string;
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

const PRODUCER_STATUSES = new Set<AdminProducerStatus>(['pending', 'active', 'suspended', 'rejected', 'closed']);
const MANAGED_STATUSES = new Set<AdminProducerManagedStatus>(['active', 'suspended']);
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

function textAllowEmpty(value: unknown, label: string, max = 2000) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001F\u007F]/.test(value)) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalText(value: unknown, label: string, max = 1000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalUuid(value: unknown, label: string) {
  if (value == null || value === '') return null;
  return uuid(value, label);
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function numeric(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
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

function producerStatus(value: unknown): AdminProducerStatus {
  const status = requiredText(value, 'Satıcı durumu', 40) as AdminProducerStatus;
  if (!PRODUCER_STATUSES.has(status)) throw new Error('Satıcı durumu doğrulanamadı.');
  return status;
}

function countryCode(value: unknown) {
  const code = requiredText(value, 'Üretim ülke kodu', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Üretim ülke kodu doğrulanamadı.');
  return code;
}

function normalizeProducer(value: unknown, index: number): AdminProducer {
  if (!isRecord(value)) throw new Error(`${index + 1}. satıcı kaydı doğrulanamadı.`);
  return {
    id: uuid(value.id, `${index + 1}. satıcı kimliği`),
    owner_user_id: uuid(value.owner_user_id, `${index + 1}. satıcı hesap kimliği`),
    application_id: optionalUuid(value.application_id, `${index + 1}. satıcı başvuru kimliği`),
    slug: requiredText(value.slug, `${index + 1}. mağaza kısa adı`, 180),
    display_name: requiredText(value.display_name, `${index + 1}. mağaza adı`, 240),
    description: textAllowEmpty(value.description, `${index + 1}. mağaza açıklaması`, 10000),
    production_location: textAllowEmpty(value.production_location, `${index + 1}. üretim konumu`, 500),
    production_country_code: countryCode(value.production_country_code),
    production_province: optionalText(value.production_province, `${index + 1}. üretim ili`, 160),
    production_district: optionalText(value.production_district, `${index + 1}. üretim ilçesi`, 160),
    production_village: optionalText(value.production_village, `${index + 1}. üretim köyü`, 240),
    production_village_is_custom: booleanValue(value.production_village_is_custom, `${index + 1}. özel köy adı durumu`),
    logo_path: optionalText(value.logo_path, `${index + 1}. mağaza logosu`, 2048),
    status: producerStatus(value.status),
    is_verified: booleanValue(value.is_verified, `${index + 1}. kimlik doğrulama durumu`),
    verified_at: dateTime(value.verified_at, `${index + 1}. kimlik doğrulama tarihi`, false),
    verification_due_at: dateTime(value.verification_due_at, `${index + 1}. yeniden doğrulama tarihi`, false),
    origin_verified: booleanValue(value.origin_verified, `${index + 1}. menşe doğrulama durumu`),
    origin_verified_at: dateTime(value.origin_verified_at, `${index + 1}. menşe doğrulama tarihi`, false),
    origin_verification_basis: optionalText(value.origin_verification_basis, `${index + 1}. menşe doğrulama dayanağı`, 240),
    commission_basis_points: integer(value.commission_basis_points, `${index + 1}. komisyon oranı`, 0, 10000),
    rating_average: numeric(value.rating_average, `${index + 1}. mağaza puanı`, 0, 5),
    rating_count: integer(value.rating_count, `${index + 1}. değerlendirme sayısı`, 0, 1000000000),
    email: requiredText(value.email, `${index + 1}. hesap e-postası`, 320),
    phone: optionalText(value.phone, `${index + 1}. hesap telefonu`, 80),
    created_at: dateTime(value.created_at, `${index + 1}. mağaza oluşturma tarihi`) as string,
    product_count: integer(value.product_count, `${index + 1}. ürün sayısı`, 0, 1000000000),
    order_count: integer(value.order_count, `${index + 1}. sipariş sayısı`, 0, 1000000000),
    follower_count: integer(value.follower_count, `${index + 1}. takipçi sayısı`, 0, 1000000000),
  };
}

export async function adminListProducers(): Promise<AdminProducer[]> {
  const { data, error } = await supabase.rpc('admin_list_producers_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Satıcı listesi sunucudan doğrulanamadı.');
  return rows.map(normalizeProducer);
}

export async function adminSetProducerStatus(producerId: string, status: AdminProducerManagedStatus, reason?: string) {
  const id = uuid(producerId, 'Satıcı kimliği');
  if (!MANAGED_STATUSES.has(status)) throw new Error('Satıcı yönetim durumu geçersiz.');
  const cleanReason = reason?.trim() || null;
  if (status === 'suspended' && (!cleanReason || cleanReason.length < 10 || cleanReason.length > 1000)) {
    throw new Error('Satıcıyı askıya almak için 10 ile 1000 karakter arasında gerekçe yazılmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_set_producer_status_v1', {
    p_producer_id: id,
    p_status: status,
    p_reason: cleanReason,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Satıcı kimliği') !== id || producerStatus(result.status) !== status) {
    throw new Error('Satıcı durum güncelleme sonucu doğrulanamadı.');
  }
  return { id, status };
}

export async function adminSetProducerCommission(producerId: string, percent: number) {
  const id = uuid(producerId, 'Satıcı kimliği');
  if (!Number.isFinite(percent) || percent < 0 || percent > 30) {
    throw new Error('Platform komisyonu %0 ile %30 arasında olmalıdır.');
  }
  const basisPoints = Math.round(percent * 100);
  const { data, error } = await supabase.rpc('admin_set_producer_commission_v1', {
    p_producer_id: id,
    p_commission_basis_points: basisPoints,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.producerId, 'Satıcı kimliği') !== id || integer(result.commissionBasisPoints, 'Komisyon oranı', 0, 3000) !== basisPoints) {
    throw new Error('Satıcı komisyon güncelleme sonucu doğrulanamadı.');
  }
  return { producerId: id, commissionBasisPoints: basisPoints };
}

export async function adminSetProducerOriginVerified(producerId: string, verified: boolean, reason: string) {
  const id = uuid(producerId, 'Satıcı kimliği');
  if (typeof verified !== 'boolean') throw new Error('Menşe doğrulama kararı geçersiz.');
  const cleanReason = reason.trim();
  if (cleanReason.length < 10 || cleanReason.length > 1000) {
    throw new Error('Menşe doğrulama kararı için 10 ile 1000 karakter arasında gerekçe yazılmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_set_producer_origin_verified_v1', {
    p_producer_id: id,
    p_verified: verified,
    p_reason: cleanReason,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.producer_id, 'Satıcı kimliği') !== id || booleanValue(result.origin_verified, 'Menşe doğrulama durumu') !== verified || requiredText(result.reason, 'Menşe doğrulama gerekçesi', 1000) !== cleanReason) {
    throw new Error('Menşe doğrulama sonucu doğrulanamadı.');
  }
  return { producer_id: id, origin_verified: verified, reason: cleanReason };
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
    ['invalid_producer_status', 'Seçilen satıcı durumu geçersiz.'],
    ['invalid_producer_commission', 'Platform komisyonu %0 ile %30 arasında olmalıdır.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}

export function basisPointsToPercent(value: number | null | undefined) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 10000) throw new Error('Komisyon oranı doğrulanamadı.');
  return Number(value) / 100;
}
