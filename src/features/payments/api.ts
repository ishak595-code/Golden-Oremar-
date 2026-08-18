import { supabase } from '../../lib/supabase';

export type SavedPaymentMethod = {
  id: string;
  provider: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  billingName: string | null;
  isDefault: boolean;
  status: 'active' | 'expired';
  createdAt: string;
};

export type PaymentReadiness = {
  mode: 'manual_confirmation' | 'provider_checkout' | string;
  liveCardPaymentsEnabled: boolean;
  provider: string | null;
  savedPaymentMethodsSupported: boolean;
  providerHostedCardEntryRequired: true;
  requiresProviderConfiguration: boolean;
  paymentVerificationRequired: true;
  storesProviderSecretsClientSide: false;
  storesRawCardData: false;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max: number) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} doğrulanamadı.`);
  return normalized;
}

function optionalText(value: unknown, max: number) {
  if (value == null || value === '') return null;
  return requiredText(value, 'Ödeme yöntemi metni', max);
}

function uuid(value: unknown, label: string) {
  const id = requiredText(value, label, 160);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`${label} doğrulanamadı.`);
  return id;
}

function optionalInteger(value: unknown, label: string, min: number, max: number) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function normalizeMethod(value: unknown, index: number): SavedPaymentMethod {
  if (!isRecord(value)) throw new Error(`${index + 1}. ödeme yöntemi doğrulanamadı.`);
  const status = requiredText(value.status, 'Ödeme yöntemi durumu', 20);
  if (status !== 'active' && status !== 'expired') throw new Error('Ödeme yöntemi durumu doğrulanamadı.');
  const last4 = requiredText(value.last4, 'Kart son dört hanesi', 4);
  if (!/^[0-9]{4}$/.test(last4)) throw new Error('Kart son dört hanesi doğrulanamadı.');
  const provider = requiredText(value.provider, 'Ödeme sağlayıcısı', 40).toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(provider)) throw new Error('Ödeme sağlayıcısı doğrulanamadı.');
  const createdAt = requiredText(value.createdAt, 'Ödeme yöntemi kayıt tarihi', 80);
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('Ödeme yöntemi kayıt tarihi doğrulanamadı.');
  if (typeof value.isDefault !== 'boolean') throw new Error('Varsayılan ödeme yöntemi durumu doğrulanamadı.');
  return {
    id: uuid(value.id, 'Ödeme yöntemi kimliği'),
    provider,
    brand: requiredText(value.brand, 'Kart markası', 40),
    last4,
    expMonth: optionalInteger(value.expMonth, 'Son kullanma ayı', 1, 12),
    expYear: optionalInteger(value.expYear, 'Son kullanma yılı', 2024, 2200),
    billingName: optionalText(value.billingName, 120),
    isDefault: value.isDefault,
    status,
    createdAt,
  };
}

function normalizeReadiness(value: unknown): PaymentReadiness {
  if (!isRecord(value)) throw new Error('Ödeme hazırlık durumu doğrulanamadı.');
  const provider = value.provider == null ? null : requiredText(value.provider, 'Ödeme sağlayıcısı', 40).toLowerCase();
  if (provider && !/^[a-z0-9_-]{2,40}$/.test(provider)) throw new Error('Ödeme sağlayıcısı doğrulanamadı.');
  const mode = requiredText(value.mode, 'Ödeme modu', 60);
  if (typeof value.liveCardPaymentsEnabled !== 'boolean'
      || typeof value.savedPaymentMethodsSupported !== 'boolean'
      || value.providerHostedCardEntryRequired !== true
      || typeof value.requiresProviderConfiguration !== 'boolean'
      || value.paymentVerificationRequired !== true
      || value.storesProviderSecretsClientSide !== false
      || value.storesRawCardData !== false) {
    throw new Error('Ödeme güvenlik sözleşmesi doğrulanamadı.');
  }
  if (value.liveCardPaymentsEnabled && !provider) throw new Error('Canlı ödeme açıkken sağlayıcı kimliği eksik.');
  if (value.savedPaymentMethodsSupported && !value.liveCardPaymentsEnabled) throw new Error('Kayıtlı kart desteği canlı ödeme olmadan açılamaz.');
  return {
    mode,
    liveCardPaymentsEnabled: value.liveCardPaymentsEnabled,
    provider,
    savedPaymentMethodsSupported: value.savedPaymentMethodsSupported,
    providerHostedCardEntryRequired: true,
    requiresProviderConfiguration: value.requiresProviderConfiguration,
    paymentVerificationRequired: true,
    storesProviderSecretsClientSide: false,
    storesRawCardData: false,
  };
}

export async function listMyPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const { data, error } = await supabase.rpc('list_my_payment_methods_v1');
  if (error) throw error;
  if (!Array.isArray(data) || data.length > 20) throw new Error('Ödeme yöntemleri sunucudan doğrulanamadı.');
  return data.map(normalizeMethod);
}

export async function getPaymentReadiness(): Promise<PaymentReadiness> {
  const { data, error } = await supabase.rpc('get_checkout_payment_readiness_v2');
  if (error) throw error;
  return normalizeReadiness(data);
}

export async function setMyDefaultPaymentMethod(paymentMethodId: string) {
  const id = uuid(paymentMethodId, 'Ödeme yöntemi kimliği');
  const { data, error } = await supabase.rpc('set_my_default_payment_method_v1', { p_payment_method_id: id });
  if (error) throw error;
  if (!isRecord(data) || data.ok !== true || data.isDefault !== true || uuid(data.id, 'Ödeme yöntemi kimliği') !== id) throw new Error('Varsayılan ödeme yöntemi sonucu doğrulanamadı.');
  return data;
}

export async function removeMyPaymentMethod(paymentMethodId: string) {
  const id = uuid(paymentMethodId, 'Ödeme yöntemi kimliği');
  const { data, error } = await supabase.rpc('remove_my_payment_method_v1', { p_payment_method_id: id });
  if (error) throw error;
  if (!isRecord(data) || data.ok !== true || uuid(data.removedId, 'Silinen ödeme yöntemi kimliği') !== id) throw new Error('Ödeme yöntemi kaldırma sonucu doğrulanamadı.');
  const newDefaultId = data.newDefaultId == null ? null : uuid(data.newDefaultId, 'Yeni varsayılan ödeme yöntemi kimliği');
  return { ok: true as const, removedId: id, newDefaultId };
}

export function paymentMethodLabel(method: SavedPaymentMethod) {
  const brand = method.brand.trim();
  const expiry = method.expMonth && method.expYear ? ` • ${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}` : '';
  return `${brand} •••• ${method.last4}${expiry}`;
}
