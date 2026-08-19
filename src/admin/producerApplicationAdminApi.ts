import { supabase } from '../lib/supabase';

export type ProducerApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn';
export type ProducerApplicantType = 'individual' | 'business';
export type ProducerSellerClassification = 'individual_non_merchant' | 'tax_exempt_artisan' | 'artisan' | 'sole_proprietor' | 'company' | 'cooperative';
export type ProducerFoodComplianceStatus = 'registered' | 'approved_facility' | 'primary_production_review' | 'pending';
export type ProducerFulfillmentMethod = 'cargo' | 'local_delivery' | 'pickup';
export type ProducerSourcingModel = 'own_production' | 'family_production' | 'cooperative_production' | 'partner_farm' | 'authorized_local_supplier';
export type ProducerOrganicClaimStatus = 'certified' | 'certification_in_progress' | 'not_certified_no_claim';
export type ProducerDocumentType = 'identity' | 'cks' | 'organic_certificate' | 'business_registration' | 'tax_certificate' | 'bank_proof' | 'food_business_registration' | 'food_business_approval' | 'tax_exemption_certificate' | 'mersis_record' | 'cooperative_registration' | 'residence_proof' | 'other';
export type ProducerDocumentVerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export type ProducerDocumentReviewStatus = Exclude<ProducerDocumentVerificationStatus, 'expired'>;
export type ProducerApplicationReviewStatus = 'under_review' | 'needs_information' | 'approved' | 'rejected';

export type ProducerApplicationDocument = {
  id: string;
  document_type: ProducerDocumentType;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  verification_status: ProducerDocumentVerificationStatus;
  verified_at: string | null;
  created_at: string;
};

export type AdminProducerApplication = {
  id: string;
  applicant_user_id: string;
  applicant_type: ProducerApplicantType;
  seller_classification: ProducerSellerClassification;
  brand_name: string;
  public_name: string;
  description: string;
  production_location: string;
  production_country_code: string;
  production_province: string | null;
  production_district: string | null;
  production_village: string | null;
  production_village_is_custom: boolean;
  product_categories: string[];
  food_compliance_status: ProducerFoodComplianceStatus;
  fulfillment_methods: ProducerFulfillmentMethod[];
  average_dispatch_days: number;
  cold_chain_capable: boolean;
  status: ProducerApplicationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  email: string;
  legal_name: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  contact_email_verified_at: string | null;
  address: Record<string, unknown> | null;
  tax_office: string | null;
  identifier_masked: string | null;
  mersis_masked: string | null;
  food_registration_masked: string | null;
  iban_masked: string | null;
  documents: ProducerApplicationDocument[];
  planned_products: string[];
  sourcing_models: ProducerSourcingModel[];
  organic_claim_status: ProducerOrganicClaimStatus;
  organic_certifier_name: string | null;
  organic_certificate_expires_on: string | null;
  village_product_commitment: boolean;
  traceability_commitment: boolean;
  product_truth_commitment: boolean;
  production_practice_notes: string;
};

export type SensitiveProducerApplication = {
  application_id: string;
  legal_name: string;
  national_id: string | null;
  tax_number: string | null;
  tax_office: string | null;
  mersis_number: string | null;
  tax_exemption_number: string | null;
  food_registration_number: string | null;
  organic_certificate_number: string | null;
  iban: string | null;
  bank_account_holder: string | null;
  phone: string;
  contact_email: string | null;
  address: Record<string, unknown>;
  consent_version: string;
  consented_at: string;
};

type ProducerApplicationReviewResult = {
  application_id: string;
  status: ProducerApplicationReviewStatus;
  producer_id: string | null;
};

const APPLICATION_STATUSES = new Set<ProducerApplicationStatus>(['draft', 'submitted', 'under_review', 'needs_information', 'approved', 'rejected', 'withdrawn']);
const APPLICANT_TYPES = new Set<ProducerApplicantType>(['individual', 'business']);
const SELLER_CLASSIFICATIONS = new Set<ProducerSellerClassification>(['individual_non_merchant', 'tax_exempt_artisan', 'artisan', 'sole_proprietor', 'company', 'cooperative']);
const FOOD_COMPLIANCE_STATUSES = new Set<ProducerFoodComplianceStatus>(['registered', 'approved_facility', 'primary_production_review', 'pending']);
const FULFILLMENT_METHODS = new Set<ProducerFulfillmentMethod>(['cargo', 'local_delivery', 'pickup']);
const SOURCING_MODELS = new Set<ProducerSourcingModel>(['own_production', 'family_production', 'cooperative_production', 'partner_farm', 'authorized_local_supplier']);
const ORGANIC_CLAIM_STATUSES = new Set<ProducerOrganicClaimStatus>(['certified', 'certification_in_progress', 'not_certified_no_claim']);
const DOCUMENT_TYPES = new Set<ProducerDocumentType>(['identity', 'cks', 'organic_certificate', 'business_registration', 'tax_certificate', 'bank_proof', 'food_business_registration', 'food_business_approval', 'tax_exemption_certificate', 'mersis_record', 'cooperative_registration', 'residence_proof', 'other']);
const DOCUMENT_VERIFICATION_STATUSES = new Set<ProducerDocumentVerificationStatus>(['pending', 'verified', 'rejected', 'expired']);
const DOCUMENT_REVIEW_STATUSES = new Set<ProducerDocumentReviewStatus>(['pending', 'verified', 'rejected']);
const APPLICATION_REVIEW_STATUSES = new Set<ProducerApplicationReviewStatus>(['under_review', 'needs_information', 'approved', 'rejected']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function textAllowEmpty(value: unknown, label: string, max = 5000) {
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

function dateTime(value: unknown, label: string, required = true) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function dateOnly(value: unknown, label: string, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T12:00:00Z`).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function countryCode(value: unknown) {
  const code = requiredText(value, 'Üretim ülke kodu', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Üretim ülke kodu doğrulanamadı.');
  return code;
}

function enumValue<T extends string>(value: unknown, label: string, values: Set<T>, max = 80): T {
  const text = requiredText(value, label, max) as T;
  if (!values.has(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function stringArray<T extends string = string>(value: unknown, label: string, options?: { values?: Set<T>; min?: number; max?: number; itemMax?: number }): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} doğrulanamadı.`);
  const min = options?.min ?? 0;
  const max = options?.max ?? 100;
  if (value.length < min || value.length > max) throw new Error(`${label} doğrulanamadı.`);
  const result = value.map((item, index) => {
    const text = requiredText(item, `${label} ${index + 1}`, options?.itemMax ?? 240) as T;
    if (options?.values && !options.values.has(text)) throw new Error(`${label} doğrulanamadı.`);
    return text;
  });
  if (new Set(result).size !== result.length) throw new Error(`${label} tekrar eden değer içeriyor.`);
  return result;
}

function persistentStoragePath(value: unknown, label: string) {
  const path = requiredText(value, label, 2048).replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || /^(data|blob|javascript|https?):/i.test(path)) throw new Error(`${label} doğrulanamadı.`);
  return path;
}

function applicationStatus(value: unknown) {
  return enumValue(value, 'Başvuru durumu', APPLICATION_STATUSES, 40);
}

function normalizeDocument(value: unknown, index: number): ProducerApplicationDocument {
  if (!isRecord(value)) throw new Error(`${index + 1}. başvuru belgesi doğrulanamadı.`);
  return {
    id: uuid(value.id, `${index + 1}. belge kimliği`),
    document_type: enumValue(value.document_type, `${index + 1}. belge türü`, DOCUMENT_TYPES, 80),
    storage_path: persistentStoragePath(value.storage_path, `${index + 1}. belge dosya yolu`),
    mime_type: requiredText(value.mime_type, `${index + 1}. belge MIME türü`, 120),
    size_bytes: integer(value.size_bytes, `${index + 1}. belge boyutu`, 1, 20 * 1024 * 1024),
    verification_status: enumValue(value.verification_status, `${index + 1}. belge doğrulama durumu`, DOCUMENT_VERIFICATION_STATUSES, 40),
    verified_at: dateTime(value.verified_at, `${index + 1}. belge doğrulama tarihi`, false),
    created_at: dateTime(value.created_at, `${index + 1}. belge oluşturma tarihi`) as string,
  };
}

function normalizeApplication(value: unknown, index: number): AdminProducerApplication {
  if (!isRecord(value)) throw new Error(`${index + 1}. satıcı başvurusu doğrulanamadı.`);
  if (!Array.isArray(value.documents)) throw new Error(`${index + 1}. başvuru belgeleri doğrulanamadı.`);
  const address = value.address == null ? null : isRecord(value.address) ? value.address : (() => { throw new Error(`${index + 1}. başvuru adresi doğrulanamadı.`); })();
  const status = applicationStatus(value.status);
  const submittedAt = dateTime(value.submitted_at, `${index + 1}. başvuru gönderim tarihi`, false);
  if (status === 'submitted' && !submittedAt) throw new Error(`${index + 1}. gönderilmiş başvuruda gönderim tarihi eksik.`);
  const reviewedAt = dateTime(value.reviewed_at, `${index + 1}. başvuru inceleme tarihi`, false);
  if (['approved', 'rejected'].includes(status) && !reviewedAt) throw new Error(`${index + 1}. sonuçlanmış başvuruda inceleme tarihi eksik.`);
  const organicClaim = enumValue(value.organic_claim_status, `${index + 1}. organik iddia durumu`, ORGANIC_CLAIM_STATUSES, 60);
  const organicExpiry = dateOnly(value.organic_certificate_expires_on, `${index + 1}. organik sertifika bitiş tarihi`);
  if (organicClaim === 'certified' && !organicExpiry) throw new Error(`${index + 1}. sertifikalı organik iddiasında sertifika bitiş tarihi eksik.`);
  return {
    id: uuid(value.id, `${index + 1}. başvuru kimliği`),
    applicant_user_id: uuid(value.applicant_user_id, `${index + 1}. başvuru sahibi kimliği`),
    applicant_type: enumValue(value.applicant_type, `${index + 1}. başvuru sahibi türü`, APPLICANT_TYPES, 40),
    seller_classification: enumValue(value.seller_classification, `${index + 1}. satıcı sınıflandırması`, SELLER_CLASSIFICATIONS, 80),
    brand_name: requiredText(value.brand_name, `${index + 1}. mağaza adı`, 180),
    public_name: textAllowEmpty(value.public_name, `${index + 1}. herkese açık ad`, 180),
    description: textAllowEmpty(value.description, `${index + 1}. başvuru açıklaması`, 10000),
    production_location: textAllowEmpty(value.production_location, `${index + 1}. üretim konumu`, 500),
    production_country_code: countryCode(value.production_country_code),
    production_province: optionalText(value.production_province, `${index + 1}. üretim ili`, 160),
    production_district: optionalText(value.production_district, `${index + 1}. üretim ilçesi`, 160),
    production_village: optionalText(value.production_village, `${index + 1}. üretim köyü`, 240),
    production_village_is_custom: booleanValue(value.production_village_is_custom, `${index + 1}. özel köy adı durumu`),
    product_categories: stringArray(value.product_categories, `${index + 1}. ürün kategorileri`, { max: 50, itemMax: 160 }),
    food_compliance_status: enumValue(value.food_compliance_status, `${index + 1}. gıda uygunluk durumu`, FOOD_COMPLIANCE_STATUSES, 60),
    fulfillment_methods: stringArray(value.fulfillment_methods, `${index + 1}. teslimat yöntemleri`, { values: FULFILLMENT_METHODS, min: 1, max: 3, itemMax: 40 }),
    average_dispatch_days: integer(value.average_dispatch_days, `${index + 1}. ortalama hazırlık süresi`, 1, 30),
    cold_chain_capable: booleanValue(value.cold_chain_capable, `${index + 1}. soğuk zincir kapasitesi`),
    status,
    submitted_at: submittedAt,
    reviewed_at: reviewedAt,
    rejection_reason: optionalText(value.rejection_reason, `${index + 1}. ret veya bilgi talebi gerekçesi`, 1000),
    created_at: dateTime(value.created_at, `${index + 1}. başvuru oluşturma tarihi`) as string,
    updated_at: dateTime(value.updated_at, `${index + 1}. başvuru güncelleme tarihi`) as string,
    email: textAllowEmpty(value.email, `${index + 1}. iletişim e-postası`, 320),
    legal_name: optionalText(value.legal_name, `${index + 1}. yasal ad`, 300),
    phone: optionalText(value.phone, `${index + 1}. telefon`, 80),
    phone_verified_at: dateTime(value.phone_verified_at, `${index + 1}. telefon doğrulama tarihi`, false),
    contact_email_verified_at: dateTime(value.contact_email_verified_at, `${index + 1}. e-posta doğrulama tarihi`, false),
    address,
    tax_office: optionalText(value.tax_office, `${index + 1}. vergi dairesi`, 240),
    identifier_masked: optionalText(value.identifier_masked, `${index + 1}. maskelenmiş kimlik`, 80),
    mersis_masked: optionalText(value.mersis_masked, `${index + 1}. maskelenmiş MERSİS`, 80),
    food_registration_masked: optionalText(value.food_registration_masked, `${index + 1}. maskelenmiş gıda kayıt`, 120),
    iban_masked: optionalText(value.iban_masked, `${index + 1}. maskelenmiş IBAN`, 120),
    documents: value.documents.map(normalizeDocument),
    planned_products: stringArray(value.planned_products, `${index + 1}. planlanan ürünler`, { max: 30, itemMax: 240 }),
    sourcing_models: stringArray(value.sourcing_models, `${index + 1}. tedarik modelleri`, { values: SOURCING_MODELS, min: 1, max: 5, itemMax: 60 }),
    organic_claim_status: organicClaim,
    organic_certifier_name: optionalText(value.organic_certifier_name, `${index + 1}. organik sertifikalandırıcı`, 240),
    organic_certificate_expires_on: organicExpiry,
    village_product_commitment: booleanValue(value.village_product_commitment, `${index + 1}. köy ürünü taahhüdü`),
    traceability_commitment: booleanValue(value.traceability_commitment, `${index + 1}. izlenebilirlik taahhüdü`),
    product_truth_commitment: booleanValue(value.product_truth_commitment, `${index + 1}. ürün doğruluğu taahhüdü`),
    production_practice_notes: textAllowEmpty(value.production_practice_notes, `${index + 1}. üretim uygulama notları`, 10000),
  };
}

function normalizeSensitive(value: unknown, expectedApplicationId: string): SensitiveProducerApplication {
  if (!isRecord(value) || !isRecord(value.address)) throw new Error('Hassas başvuru bilgileri doğrulanamadı.');
  const applicationId = uuid(value.application_id, 'Başvuru kimliği');
  if (applicationId !== expectedApplicationId) throw new Error('Hassas başvuru bilgileri başka bir başvuruya ait.');
  return {
    application_id: applicationId,
    legal_name: requiredText(value.legal_name, 'Yasal ad', 300),
    national_id: optionalText(value.national_id, 'Kimlik numarası', 40),
    tax_number: optionalText(value.tax_number, 'Vergi numarası', 40),
    tax_office: optionalText(value.tax_office, 'Vergi dairesi', 240),
    mersis_number: optionalText(value.mersis_number, 'MERSİS numarası', 40),
    tax_exemption_number: optionalText(value.tax_exemption_number, 'Vergi muafiyet numarası', 80),
    food_registration_number: optionalText(value.food_registration_number, 'Gıda kayıt numarası', 120),
    organic_certificate_number: optionalText(value.organic_certificate_number, 'Organik sertifika numarası', 120),
    iban: optionalText(value.iban, 'IBAN', 64),
    bank_account_holder: optionalText(value.bank_account_holder, 'Banka hesap sahibi', 300),
    phone: requiredText(value.phone, 'Telefon', 80),
    contact_email: optionalText(value.contact_email, 'İletişim e-postası', 320),
    address: value.address,
    consent_version: requiredText(value.consent_version, 'Açık rıza sürümü', 80),
    consented_at: dateTime(value.consented_at, 'Açık rıza tarihi') as string,
  };
}

function normalizeReviewResult(value: unknown, expectedApplicationId: string, expectedStatus: ProducerApplicationReviewStatus): ProducerApplicationReviewResult {
  if (!isRecord(value)) throw new Error('Başvuru inceleme sonucu doğrulanamadı.');
  const applicationId = uuid(value.application_id, 'Başvuru kimliği');
  const status = enumValue(value.status, 'Başvuru inceleme durumu', APPLICATION_REVIEW_STATUSES, 40);
  if (applicationId !== expectedApplicationId || status !== expectedStatus) throw new Error('Başvuru inceleme sonucu beklenen işlemle eşleşmiyor.');
  const producerId = optionalUuid(value.producer_id, 'Üretici kimliği');
  if (status === 'approved' && !producerId) throw new Error('Onaylanan başvuruda üretici hesabı oluşturulmadı.');
  if (status !== 'approved' && producerId) throw new Error('Onaylanmamış başvuruda üretici hesabı beklenmiyor.');
  return { application_id: applicationId, status, producer_id: producerId };
}

export async function adminListProducerApplications(): Promise<AdminProducerApplication[]> {
  const { data, error } = await supabase.rpc('admin_list_producer_applications_v3');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Satıcı başvurusu listesi sunucudan doğrulanamadı.');
  return rows.map(normalizeApplication);
}

export async function adminGetProducerApplicationSensitive(applicationId: string, purpose: string): Promise<SensitiveProducerApplication> {
  const id = uuid(applicationId, 'Başvuru kimliği');
  const normalizedPurpose = purpose.trim();
  if (normalizedPurpose.length < 10 || normalizedPurpose.length > 200) {
    throw new Error('Hassas veri erişim amacı 10 ile 200 karakter arasında olmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_get_producer_application_sensitive_v3', {
    p_application_id: id,
    p_purpose: normalizedPurpose,
  });
  return normalizeSensitive(unwrap<unknown>(data, error), id);
}

export async function adminSetProducerDocumentStatus(documentId: string, status: ProducerDocumentReviewStatus) {
  const id = uuid(documentId, 'Belge kimliği');
  if (!DOCUMENT_REVIEW_STATUSES.has(status)) throw new Error('Belge doğrulama durumu geçersiz.');
  const { data, error } = await supabase.rpc('admin_set_producer_document_status', {
    p_document_id: id,
    p_status: status,
  });
  const result = unwrap<unknown>(data, error);
  if (result !== true) throw new Error('Belge doğrulama sonucu doğrulanamadı.');
  return true;
}

export async function adminReviewProducerApplication(input: {
  applicationId: string;
  status: ProducerApplicationReviewStatus;
  reason?: string;
  commissionPercent: number;
}) {
  const applicationId = uuid(input.applicationId, 'Başvuru kimliği');
  if (!APPLICATION_REVIEW_STATUSES.has(input.status)) throw new Error('Başvuru inceleme durumu geçersiz.');
  const reason = input.reason?.trim() || null;
  if ((input.status === 'needs_information' || input.status === 'rejected') && (!reason || reason.length < 10 || reason.length > 1000)) {
    throw new Error('Bilgi talebi veya ret için 10 ile 1000 karakter arasında gerekçe yazılmalıdır.');
  }
  if (reason && reason.length > 1000) throw new Error('İnceleme notu 1000 karakteri aşamaz.');
  if (!Number.isFinite(input.commissionPercent) || input.commissionPercent < 0 || input.commissionPercent > 30) {
    throw new Error('Platform komisyonu %0 ile %30 arasında olmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_review_producer_application_v3', {
    p_application_id: applicationId,
    p_status: input.status,
    p_reason: reason,
    p_commission_basis_points: Math.round(input.commissionPercent * 100),
  });
  return normalizeReviewResult(unwrap<unknown>(data, error), applicationId, input.status);
}

export function producerApplicationErrorMessage(error: unknown, fallback = 'Satıcı başvurusu işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['producer_application_not_found', 'Başvuru artık bulunamadı. Listeyi yenileyin.'],
    ['producer_application_already_final', 'Bu başvuru daha önce kesin sonuca bağlanmış.'],
    ['producer_application_not_ready', 'Başvuru onaylanmaya hazır durumda değil.'],
    ['producer_document_not_found', 'Belge artık bulunamadı. Listeyi yenileyin.'],
    ['invalid_producer_document_status', 'Belge doğrulama durumu geçersiz.'],
    ['required_producer_document_not_verified', 'Zorunlu kimlik veya işletme belgesi henüz doğrulanmamış.'],
    ['producer_email_not_verified', 'Başvuru sahibinin e-posta adresi doğrulanmadan onay verilemez.'],
    ['producer_phone_not_verified', 'Başvuru sahibinin telefonu doğrulanmadan onay verilemez.'],
    ['tax_exemption_document_not_verified', 'Vergi muafiyet belgesi doğrulanmadan onay verilemez.'],
    ['food_registration_document_not_verified', 'Gıda işletmesi kayıt belgesi doğrulanmadan onay verilemez.'],
    ['food_approval_document_not_verified', 'Gıda işletmesi onay belgesi doğrulanmadan onay verilemez.'],
    ['primary_producer_document_not_verified', 'Birincil üretici belgesi doğrulanmadan onay verilemez.'],
    ['food_compliance_not_ready', 'Gıda uygunluk incelemesi tamamlanmadan onay verilemez.'],
    ['organic_certificate_expired', 'Organik sertifikanın süresi dolmuş.'],
    ['organic_certificate_document_not_verified', 'Organik sertifika belgesi doğrulanmadan sertifikalı organik iddiası onaylanamaz.'],
    ['sensitive_access_purpose_required', 'Hassas verilere erişmek için açık ve denetlenebilir bir amaç yazılmalıdır.'],
    ['invalid_producer_application_status', 'Başvuru inceleme durumu geçersiz.'],
    ['producer_review_reason_required', 'Bilgi talebi veya ret için 10 ile 1000 karakter arasında gerekçe yazılmalıdır.'],
    ['invalid_producer_commission', 'Platform komisyonu %0 ile %30 arasında olmalıdır.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}
