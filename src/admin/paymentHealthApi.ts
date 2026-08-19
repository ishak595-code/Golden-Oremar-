import { supabase } from '../lib/supabase';

type MethodHealth = { enabled: boolean; ready: boolean };
export type PaymentRuntimeHealth = {
  provider: string | null;
  runtime: { iyzicoSecretsConfigured: boolean; bokuSecretsConfigured: boolean };
  methods: {
    card: MethodHealth;
    savedCard: MethodHealth;
    payWithIyzico: MethodHealth;
    googlePay: MethodHealth;
    applePay: MethodHealth;
    carrierBilling: MethodHealth;
    bankTransfer: MethodHealth;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function bool(value: unknown, label: string) { if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`); return value; }
function method(value: unknown, label: string): MethodHealth { if (!isRecord(value)) throw new Error(`${label} çalışma durumu doğrulanamadı.`); return { enabled: bool(value.enabled, `${label} aktiflik`), ready: bool(value.ready, `${label} hazırlık`) }; }

export async function getPaymentRuntimeHealth(): Promise<PaymentRuntimeHealth> {
  const { data, error } = await supabase.functions.invoke('payment-runtime-health', { body: {} });
  if (error) throw error;
  if (!isRecord(data) || data.ok !== true || !isRecord(data.runtime) || !isRecord(data.methods)) throw new Error('Ödeme çalışma zamanı doğrulanamadı.');
  const provider = data.provider == null ? null : typeof data.provider === 'string' ? data.provider.trim().toLowerCase() : null;
  return {
    provider,
    runtime: {
      iyzicoSecretsConfigured: bool(data.runtime.iyzicoSecretsConfigured, 'iyzico gizli anahtarları'),
      bokuSecretsConfigured: bool(data.runtime.bokuSecretsConfigured, 'DCB gizli anahtarları'),
    },
    methods: {
      card: method(data.methods.card, 'Kart'), savedCard: method(data.methods.savedCard, 'Kayıtlı kart'), payWithIyzico: method(data.methods.payWithIyzico, 'iyzico ile Öde'),
      googlePay: method(data.methods.googlePay, 'Google Pay'), applePay: method(data.methods.applePay, 'Apple Pay'), carrierBilling: method(data.methods.carrierBilling, 'Operatör faturalandırma'), bankTransfer: method(data.methods.bankTransfer, 'Banka/EFT'),
    },
  };
}
