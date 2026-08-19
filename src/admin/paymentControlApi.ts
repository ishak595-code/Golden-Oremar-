import { supabase } from '../lib/supabase';

export type PrimaryPaymentProvider = 'iyzico' | null;
export type PaymentMode = 'manual_confirmation' | 'provider';
export type GooglePayEnvironment = 'TEST' | 'PRODUCTION';
export type CarrierBillingProvider = 'boku' | null;

export type PaymentControl = {
  mode: PaymentMode;
  provider: PrimaryPaymentProvider;
  liveCardPaymentsEnabled: boolean;
  cardEnrollmentEnabled: boolean;
  payWithIyzicoEnabled: boolean;
  bankTransferEnabled: boolean;
  requiresProviderConfiguration: boolean;
  googlePay: {
    enabled: boolean;
    environment: GooglePayEnvironment;
    merchantId: string | null;
    gateway: string | null;
    requiresGatewayApproval: boolean;
  };
  applePay: {
    enabled: boolean;
    merchantId: string | null;
    merchantDisplayName: string;
    requiresProcessorApproval: boolean;
  };
  carrierBilling: {
    enabled: boolean;
    provider: CarrierBillingProvider;
    allowedCountries: string[];
    requiresCommercialContract: boolean;
    physicalGoodsEligibilityConfirmed: boolean;
  };
};

const MODES = new Set<PaymentMode>(['manual_confirmation', 'provider']);
const GOOGLE_ENVS = new Set<GooglePayEnvironment>(['TEST', 'PRODUCTION']);
const COUNTRY_RE = /^[A-Z]{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function bool(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number) {
  const next = typeof value === 'string' ? value.trim() : '';
  if (!next || next.length > max || /[\u0000-\u001F\u007F]/.test(next)) throw new Error(`${label} doğrulanamadı.`);
  return next;
}
function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === '') return null;
  return requiredText(value, label, max);
}
function normalizeCountries(value: unknown) {
  if (!Array.isArray(value) || value.length > 250) throw new Error('Operatör faturalandırma ülke kapsamı doğrulanamadı.');
  const unique = new Set<string>();
  for (const raw of value) {
    const code = requiredText(raw, 'Ülke kodu', 2).toUpperCase();
    if (!COUNTRY_RE.test(code)) throw new Error('Ülke kodu ISO-2 biçiminde olmalıdır.');
    unique.add(code);
  }
  return [...unique].sort();
}

export function normalizePaymentControl(value: unknown): PaymentControl {
  if (!isRecord(value)) throw new Error('Ödeme altyapısı ayarları doğrulanamadı.');
  const mode = requiredText(value.mode, 'Ödeme modu', 40) as PaymentMode;
  if (!MODES.has(mode)) throw new Error('Ödeme modu doğrulanamadı.');
  const providerRaw = optionalText(value.provider, 'Ana ödeme sağlayıcısı', 40)?.toLowerCase() || null;
  if (providerRaw !== null && providerRaw !== 'iyzico') throw new Error('Ana ödeme sağlayıcısı doğrulanamadı.');
  if (!isRecord(value.google_pay) || !isRecord(value.apple_pay) || !isRecord(value.carrier_billing)) throw new Error('Ödeme yöntemi ayarları doğrulanamadı.');

  const googleEnvironment = requiredText(value.google_pay.environment, 'Google Pay ortamı', 20).toUpperCase() as GooglePayEnvironment;
  if (!GOOGLE_ENVS.has(googleEnvironment)) throw new Error('Google Pay ortamı doğrulanamadı.');
  const carrierProviderRaw = optionalText(value.carrier_billing.provider, 'Operatör faturalandırma sağlayıcısı', 40)?.toLowerCase() || null;
  if (carrierProviderRaw !== null && carrierProviderRaw !== 'boku') throw new Error('Operatör faturalandırma sağlayıcısı doğrulanamadı.');

  return {
    mode,
    provider: providerRaw,
    liveCardPaymentsEnabled: bool(value.live_card_payments_enabled, 'Kart tahsilatı'),
    cardEnrollmentEnabled: bool(value.card_enrollment_enabled, 'Kayıtlı kart'),
    payWithIyzicoEnabled: bool(value.pay_with_iyzico_enabled, 'iyzico ile Öde'),
    bankTransferEnabled: bool(value.bank_transfer_enabled, 'Banka/EFT'),
    requiresProviderConfiguration: bool(value.requires_provider_configuration, 'Sağlayıcı yapılandırma durumu'),
    googlePay: {
      enabled: bool(value.google_pay.enabled, 'Google Pay'),
      environment: googleEnvironment,
      merchantId: optionalText(value.google_pay.merchant_id, 'Google Pay merchant kimliği', 240),
      gateway: optionalText(value.google_pay.gateway, 'Google Pay gateway', 120)?.toLowerCase() || null,
      requiresGatewayApproval: bool(value.google_pay.requires_gateway_approval, 'Google Pay gateway onayı'),
    },
    applePay: {
      enabled: bool(value.apple_pay.enabled, 'Apple Pay'),
      merchantId: optionalText(value.apple_pay.merchant_id, 'Apple Pay merchant kimliği', 240),
      merchantDisplayName: requiredText(value.apple_pay.merchant_display_name, 'Apple Pay mağaza adı', 120),
      requiresProcessorApproval: bool(value.apple_pay.requires_processor_approval, 'Apple Pay işlemci onayı'),
    },
    carrierBilling: {
      enabled: bool(value.carrier_billing.enabled, 'Operatör faturalandırma'),
      provider: carrierProviderRaw,
      allowedCountries: normalizeCountries(value.carrier_billing.allowed_countries),
      requiresCommercialContract: bool(value.carrier_billing.requires_commercial_contract, 'Operatör sözleşme durumu'),
      physicalGoodsEligibilityConfirmed: bool(value.carrier_billing.physical_goods_eligibility_confirmed, 'Fiziksel ürün uygunluğu'),
    },
  };
}

function toRpcConfig(control: PaymentControl) {
  return {
    mode: control.mode,
    provider: control.provider,
    live_card_payments_enabled: control.liveCardPaymentsEnabled,
    card_enrollment_enabled: control.cardEnrollmentEnabled,
    pay_with_iyzico_enabled: control.payWithIyzicoEnabled,
    bank_transfer_enabled: control.bankTransferEnabled,
    requires_provider_configuration: control.requiresProviderConfiguration,
    google_pay: {
      enabled: control.googlePay.enabled,
      environment: control.googlePay.environment,
      merchant_id: control.googlePay.merchantId,
      gateway: control.googlePay.gateway,
      requires_gateway_approval: control.googlePay.requiresGatewayApproval,
    },
    apple_pay: {
      enabled: control.applePay.enabled,
      merchant_id: control.applePay.merchantId,
      merchant_display_name: control.applePay.merchantDisplayName,
      requires_processor_approval: control.applePay.requiresProcessorApproval,
    },
    carrier_billing: {
      enabled: control.carrierBilling.enabled,
      provider: control.carrierBilling.provider,
      allowed_countries: control.carrierBilling.allowedCountries,
      requires_commercial_contract: control.carrierBilling.requiresCommercialContract,
      physical_goods_eligibility_confirmed: control.carrierBilling.physicalGoodsEligibilityConfirmed,
    },
  };
}

export async function getPaymentControl() {
  const { data, error } = await supabase.rpc('super_admin_get_payment_control_v1');
  if (error) throw error;
  return normalizePaymentControl(data);
}

export async function updatePaymentControl(control: PaymentControl) {
  const normalized = normalizePaymentControl(toRpcConfig(control));
  const { data, error } = await supabase.rpc('super_admin_update_payment_control_v1', { p_config: toRpcConfig(normalized) });
  if (error) throw error;
  return normalizePaymentControl(data);
}

export function paymentControlErrorMessage(error: unknown, fallback = 'Ödeme altyapısı ayarı kaydedilemedi.') {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || '');
  const map: Array<[string, string]> = [
    ['super_admin_required', 'Ödeme altyapısını yalnız Super Admin yönetebilir.'],
    ['primary_payment_provider_required', 'Kart veya iyzico yöntemlerini açmadan önce ana ödeme sağlayıcısını seçin.'],
    ['provider_payment_mode_required', 'Canlı sağlayıcı yöntemleri için ödeme modunu Sağlayıcı olarak seçin.'],
    ['google_pay_merchant_id_required', 'Google Pay merchant kimliği eksik.'],
    ['google_pay_gateway_required', 'Google Pay için onaylı ödeme gateway bilgisi eksik.'],
    ['google_pay_gateway_approval_pending', 'Google Pay gateway/merchant üretim onayı tamamlanmadan yöntem açılamaz.'],
    ['apple_pay_merchant_id_required', 'Apple Pay Merchant ID eksik.'],
    ['apple_pay_processor_approval_pending', 'Apple Pay işlemci ve merchant onayı tamamlanmadan yöntem açılamaz.'],
    ['carrier_billing_provider_required', 'Operatör faturalandırma için desteklenen sağlayıcı seçin.'],
    ['carrier_billing_contract_pending', 'Operatör faturalandırma ticari sözleşmesi tamamlanmadan yöntem açılamaz.'],
    ['carrier_billing_physical_goods_eligibility_required', 'Sağlayıcı fiziksel ürün/etkinlik uygunluğunu yazılı olarak onaylamadan DCB açılamaz.'],
    ['carrier_billing_country_scope_required', 'Operatör faturalandırma için en az bir ülke kapsamı belirleyin.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message && message.length <= 300 ? message : fallback;
}
