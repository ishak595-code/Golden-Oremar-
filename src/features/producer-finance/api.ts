import { supabase } from '../../lib/supabase';

export type ProducerBalance = { producerId: string; currency: string; availableMinor: number; pendingMinor: number; netSalesMinor: number; paidMinor: number; availableLedgerMinor: number; reservedPayoutMinor: number };
export type ProducerPayout = { id: string; currency: string; amount_minor: number; status: 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled'; provider: string | null; provider_reference: string | null; note: string | null; scheduled_at: string | null; processed_at: string | null; created_at: string };
export type ProducerBankIdentity = { producerId: string; bankAccountHolder: string; iban: string; kycSource: 'approved_application'; provider: string; paymentAccountStatus: 'pending_configuration' | 'onboarding' | 'ready' | 'suspended' | 'error'; ready: boolean; updatedAt: string };

function unwrap<T>(data: T | null, error: unknown): T { if (error) throw error; return data as T; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function requiredText(value: unknown, label: string, max = 500) { const result = typeof value === 'string' ? value.trim() : ''; if (!result || result.length > max || /[\u0000-\u001F\u007F]/.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function optionalText(value: unknown, label: string, max = 1000) { if (value == null || value === '') return null; if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`); const result = value.trim(); if (!result) return null; if (result.length > max || /[\u0000-\u001F\u007F]/.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function safeInteger(value: unknown, label: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`); return value; }
function uuid(value: unknown, label: string) { const result = requiredText(value, label, 36); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new Error(`${label} doğrulanamadı.`); return result; }
function currency(value: unknown) { const code = requiredText(value, 'Para birimi', 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) throw new Error('Para birimi doğrulanamadı.'); return code; }
function isoDateTime(value: unknown, label: string, required = false) { if (value == null || value === '') { if (required) throw new Error(`${label} doğrulanamadı.`); return null; } const result = requiredText(value, label, 80); if (Number.isNaN(Date.parse(result))) throw new Error(`${label} doğrulanamadı.`); return result; }

function normalizeBalance(value: unknown, index: number): ProducerBalance {
 if (!isRecord(value)) throw new Error(`${index + 1}. bakiye kaydı doğrulanamadı.`);
 const producerId = uuid(value.producerId, 'Satıcı kimliği'), pendingMinor = safeInteger(value.pendingMinor, 'Bekleyen bakiye'), availableLedgerMinor = safeInteger(value.availableLedgerMinor, 'Muhasebeleşen bakiye'), reservedPayoutMinor = safeInteger(value.reservedPayoutMinor, 'Rezerve ödeme'), paidPayoutMinor = safeInteger(value.paidPayoutMinor, 'Ödenen bakiye'), availableToPayoutMinor = safeInteger(value.availableToPayoutMinor, 'Kullanılabilir bakiye'), lifetimeNetMinor = safeInteger(value.lifetimeNetMinor, 'Toplam net satış');
 if (lifetimeNetMinor !== pendingMinor + availableLedgerMinor) throw new Error(`${index + 1}. bakiye toplamı sunucudan tutarsız geldi.`);
 if (availableToPayoutMinor !== availableLedgerMinor - reservedPayoutMinor - paidPayoutMinor) throw new Error(`${index + 1}. kullanılabilir bakiye sunucudan tutarsız geldi.`);
 return { producerId, currency: currency(value.currency), availableMinor: availableToPayoutMinor, pendingMinor, netSalesMinor: lifetimeNetMinor, paidMinor: paidPayoutMinor, availableLedgerMinor, reservedPayoutMinor };
}

function normalizePayout(value: unknown, index: number): ProducerPayout {
 if (!isRecord(value)) throw new Error(`${index + 1}. ödeme kaydı doğrulanamadı.`); const status = requiredText(value.status, 'Ödeme durumu', 30);
 if (!['scheduled','processing','paid','failed','cancelled'].includes(status)) throw new Error(`${index + 1}. ödeme durumu doğrulanamadı.`);
 return { id: uuid(value.id, 'Ödeme kimliği'), currency: currency(value.currency), amount_minor: safeInteger(value.amount_minor, 'Ödeme tutarı', 0), status: status as ProducerPayout['status'], provider: optionalText(value.provider, 'Ödeme sağlayıcısı', 80), provider_reference: optionalText(value.provider_reference, 'Ödeme sağlayıcı referansı', 255), note: optionalText(value.note, 'Ödeme notu', 1000), scheduled_at: isoDateTime(value.scheduled_at, 'Planlanan ödeme tarihi'), processed_at: isoDateTime(value.processed_at, 'İşlenme tarihi'), created_at: isoDateTime(value.created_at, 'Ödeme oluşturulma tarihi', true) as string };
}

export async function getProducerFinance() {
 const { data, error } = await supabase.rpc('get_my_producer_finance_summary_v1'); const payload = unwrap<unknown>(data, error);
 if (!isRecord(payload)) throw new Error('Satıcı finans özeti sunucudan doğrulanamadı.'); uuid(payload.producerId, 'Satıcı kimliği'); requiredText(payload.displayName, 'Satıcı adı', 240); safeInteger(payload.commissionBasisPoints, 'Komisyon oranı', 0, 10000);
 if (!Array.isArray(payload.balances) || payload.balances.length > 100) throw new Error('Satıcı bakiye listesi sunucudan doğrulanamadı.'); return payload.balances.map(normalizeBalance);
}

export async function listProducerPayouts(limit = 20, offset = 0) {
 if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Ödeme sayfa boyutu doğrulanamadı.'); if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error('Ödeme sayfa konumu doğrulanamadı.');
 const { data, error } = await supabase.rpc('list_my_producer_payouts_v1', { p_limit: limit, p_offset: offset }); const rows = unwrap<unknown>(data, error);
 if (!Array.isArray(rows) || rows.length > limit) throw new Error('Satıcı ödeme geçmişi sunucudan doğrulanamadı.'); return rows.map(normalizePayout);
}

export async function getMyProducerBankIdentity(): Promise<ProducerBankIdentity> {
 const { data, error } = await supabase.rpc('get_my_producer_payment_identity_v1'); const raw = unwrap<unknown>(data, error);
 if (!isRecord(raw)) throw new Error('Ödeme hesabı bilgisi doğrulanamadı.');
 const iban = requiredText(raw.iban, 'IBAN', 34).replace(/\s+/g, '').toUpperCase(); if (!/^TR[0-9]{24}$/.test(iban)) throw new Error('IBAN doğrulanamadı.');
 const status = requiredText(raw.paymentAccountStatus, 'Ödeme hesabı durumu', 40); if (!['pending_configuration','onboarding','ready','suspended','error'].includes(status)) throw new Error('Ödeme hesabı durumu doğrulanamadı.');
 const source = requiredText(raw.kycSource, 'KYC kaynağı', 40); if (source !== 'approved_application') throw new Error('Ödeme hesabı kaynağı doğrulanamadı.');
 if (typeof raw.ready !== 'boolean') throw new Error('Ödeme hesabı hazırlık durumu doğrulanamadı.');
 return { producerId: uuid(raw.producerId, 'Satıcı kimliği'), bankAccountHolder: requiredText(raw.bankAccountHolder, 'Hesap sahibi', 240), iban, kycSource: 'approved_application', provider: requiredText(raw.provider, 'Ödeme sağlayıcısı', 80), paymentAccountStatus: status as ProducerBankIdentity['paymentAccountStatus'], ready: raw.ready, updatedAt: isoDateTime(raw.updatedAt, 'Banka hesabı güncelleme tarihi', true) as string };
}
