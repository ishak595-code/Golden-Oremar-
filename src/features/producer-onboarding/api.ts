import { supabase } from '../../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SELLER_CLASSES = new Set(['individual_non_merchant','tax_exempt_artisan','artisan','sole_proprietor','company','cooperative']);
const APPLICATION_STATUSES = new Set(['draft','submitted','under_review','needs_information','approved','rejected','withdrawn']);
const DOCUMENT_TYPES = new Set(['identity','cks','organic_certificate','business_registration','tax_certificate','bank_proof','food_business_registration','food_business_approval','tax_exemption_certificate','mersis_record','cooperative_registration','residence_proof','other']);
const SOURCE_MODELS = new Set(['own_production','family_production','cooperative_production']);
const ACTIVITY_TYPES = new Set(['beekeeping','livestock','dairy','poultry','field_farming','fruit_growing','vegetable_growing','wild_harvest','fishing','food_processing','beverage_production','natural_materials']);
const FULFILLMENT_METHODS = new Set(['cargo','local_delivery','pickup']);
const FOOD_COMPLIANCE_STATUSES = new Set(['registered','approved_facility','primary_production_review','pending']);
const ORGANIC_CLAIM_STATUSES = new Set(['certified','certification_in_progress','not_certified_no_claim']);
const DOCUMENT_MIME_EXTENSIONS = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

type JsonRecord = Record<string, unknown>;

export type ProducerPlannedProduct = {
  name: string;
  category: string;
  source_model: string;
  unit: string;
  estimated_quantity: number;
};

export type ProducerApplicationDraft = {
  applicationId: string;
  status: string;
  sellerClassification: string;
  activityTypes: string[];
  brandName: string;
  publicName: string;
  description: string;
  countryCode: string;
  province: string;
  district: string;
  village: string;
  villageIsCustom: boolean;
  latitude: number | null;
  longitude: number | null;
  productCategories: string[];
  legalName: string;
  identifier: string;
  taxOffice: string;
  mersisNumber: string;
  taxExemptionNumber: string;
  iban: string;
  phone: string;
  contactEmail: string;
  addressLine: string;
  postalCode: string;
  foodComplianceStatus: string;
  foodRegistrationNumber: string;
  fulfillmentMethods: string[];
  averageDispatchDays: number;
  coldChainCapable: boolean;
  plannedProducts: ProducerPlannedProduct[];
  sourcingModels: string[];
  organicClaimStatus: string;
  organicCertifierName: string;
  organicCertificateNumber: string;
  organicCertificateExpiresOn: string;
  villageProductCommitment: boolean;
  traceabilityCommitment: boolean;
  productTruthCommitment: boolean;
  productionPracticeNotes: string;
  existingDocumentTypes: string[];
};

export type OnboardingCategory = { id: string; slug: string; name: string };
export type ProductionLocationSuggestion = { country_code: string; province: string; district: string; village: string };
export type ProducerApplicationMutationResult = { application_id: string; status: string };

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${label} geçersiz.`);
  return value as JsonRecord;
}

function optionalRecord(value: unknown, label: string): JsonRecord | null {
  if (value === null || value === undefined) return null;
  return asRecord(value, label);
}

function optionalUuid(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} geçersiz.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (!UUID_RE.test(normalized)) throw new Error(`${label} geçersiz.`);
  return normalized;
}

function requiredUuid(value: unknown, label: string) {
  const normalized = optionalUuid(value, label);
  if (!normalized) throw new Error(`${label} bulunamadı.`);
  return normalized;
}

function boundedText(value: unknown, label: string, max: number, required = false) {
  if (value === null || value === undefined) {
    if (required) throw new Error(`${label} zorunludur.`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${label} geçersiz.`);
  const normalized = value.trim();
  if (required && !normalized) throw new Error(`${label} zorunludur.`);
  if (normalized.length > max) throw new Error(`${label} en fazla ${max} karakter olabilir.`);
  return normalized;
}

function minBoundedText(value: unknown, label: string, min: number, max: number) {
  const normalized = boundedText(value, label, max, true);
  if (normalized.length < min) throw new Error(`${label} en az ${min} karakter olmalıdır.`);
  return normalized;
}

function countryCode(value: unknown) {
  const normalized = boundedText(value, 'Ülke kodu', 2, true).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Ülke kodu iki harfli ISO kodu olmalıdır.');
  return normalized;
}

function optionalCountryCode(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return countryCode(value);
}

function finiteCoordinate(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number') throw new Error(`${label} geçersiz.`);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} geçersiz.`);
  return value;
}

function booleanValue(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} geçersiz.`);
  return value;
}

function optionalBoolean(value: unknown, label: string) {
  if (value === null || value === undefined) return false;
  return booleanValue(value, label);
}

function enumText(value: unknown, label: string, allowed: Set<string>, required = true) {
  const normalized = boundedText(value, label, 100, required);
  if (!normalized && !required) return '';
  if (!allowed.has(normalized)) throw new Error(`${label} desteklenmeyen bir değer içeriyor.`);
  return normalized;
}

function optionalDate(value: unknown, label: string) {
  const normalized = boundedText(value, label, 10);
  if (!normalized) return '';
  if (!DATE_RE.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) throw new Error(`${label} geçersiz.`);
  return normalized;
}

function stringArray(value: unknown, label: string, maxItems: number, allowed?: Set<string>, minItems = 0) {
  if (!Array.isArray(value)) throw new Error(`${label} geçersiz.`);
  if (value.length < minItems || value.length > maxItems) throw new Error(`${label} ${minItems} ile ${maxItems} öğe arasında olmalıdır.`);
  if (value.some(item => typeof item !== 'string')) throw new Error(`${label} geçersiz.`);
  const normalized = Array.from(new Set(value.map(item => item.trim()).filter(Boolean)));
  if (normalized.length !== value.length) throw new Error(`${label} boş veya tekrar eden değer içeremez.`);
  if (allowed && normalized.some(item => !allowed.has(item))) throw new Error(`${label} desteklenmeyen bir değer içeriyor.`);
  return normalized;
}

function optionalStringArray(value: unknown, label: string, maxItems: number, allowed?: Set<string>) {
  if (value === null || value === undefined) return [];
  return stringArray(value, label, maxItems, allowed, 0);
}

function normalizePlannedProducts(value: unknown, allowedCategories: Set<string>, requireAtLeastOne = true) {
  if (!Array.isArray(value)) throw new Error('Planlanan ürün bilgisi geçersiz.');
  const minimum = requireAtLeastOne ? 1 : 0;
  if (value.length < minimum || value.length > 30) throw new Error(`Planlanan ürün sayısı ${minimum} ile 30 arasında olmalıdır.`);
  return value.map(item => {
    const row = asRecord(item, 'Planlanan ürün bilgisi');
    const sourceModel = enumText(row.source_model, 'Ürün kaynağı', SOURCE_MODELS);
    const category = boundedText(row.category, 'Ürün kategorisi', 80, true);
    if (allowedCategories.size && !allowedCategories.has(category)) throw new Error('Planlanan ürün, seçtiğiniz üretim kategorilerinin dışında olamaz.');
    if (typeof row.estimated_quantity !== 'number' || !Number.isFinite(row.estimated_quantity) || row.estimated_quantity <= 0 || row.estimated_quantity > 1_000_000) throw new Error('Tahmini ürün miktarı geçersiz.');
    return {
      name: minBoundedText(row.name, 'Ürün adı', 2, 120),
      category,
      source_model: sourceModel,
      unit: minBoundedText(row.unit, 'Ürün birimi', 1, 30),
      estimated_quantity: row.estimated_quantity,
    };
  });
}

function normalizeApplicationResult(value: unknown, label: string): ProducerApplicationMutationResult {
  const row = asRecord(value, label);
  return {
    application_id: requiredUuid(row.application_id ?? row.applicationId, 'Başvuru kimliği'),
    status: enumText(row.status, 'Başvuru durumu', APPLICATION_STATUSES),
  };
}

function normalizeDraft(value: unknown): ProducerApplicationDraft | null {
  if (value === null || value === undefined) return null;
  const row = asRecord(value, 'Satıcı başvuru taslağı');
  const location = optionalRecord(row.production_location, 'Üretim konumu');
  const address = optionalRecord(row.address, 'Başvuru adresi');
  const productCategories = optionalStringArray(row.product_categories, 'Ürün kategorileri', 30);
  const categoryScope = new Set(productCategories);
  const latitude = finiteCoordinate(location?.latitude ?? row.production_latitude, -90, 90, 'Enlem');
  const longitude = finiteCoordinate(location?.longitude ?? row.production_longitude, -180, 180, 'Boylam');
  if ((latitude === null) !== (longitude === null)) throw new Error('Üretim koordinatları eksik veya tutarsız.');

  const dispatchValue = row.average_dispatch_days;
  let averageDispatchDays = 0;
  if (dispatchValue !== null && dispatchValue !== undefined) {
    if (typeof dispatchValue !== 'number' || !Number.isInteger(dispatchValue) || dispatchValue < 1 || dispatchValue > 30) throw new Error('Ortalama gönderim süresi geçersiz.');
    averageDispatchDays = dispatchValue;
  }

  return {
    applicationId: requiredUuid(row.application_id ?? row.id, 'Başvuru kimliği'),
    status: enumText(row.status, 'Başvuru durumu', APPLICATION_STATUSES),
    sellerClassification: row.seller_classification == null ? '' : enumText(row.seller_classification, 'Satıcı türü', SELLER_CLASSES),
    activityTypes: optionalStringArray(row.activity_types, 'Üretim faaliyetleri', 12, ACTIVITY_TYPES),
    brandName: boundedText(row.brand_name, 'Marka adı', 160),
    publicName: boundedText(row.public_name, 'Üretici adı', 160),
    description: boundedText(row.description, 'Üretici açıklaması', 4000),
    countryCode: optionalCountryCode(location?.country_code ?? row.production_country_code),
    province: boundedText(location?.province ?? row.production_province, 'İl/bölge', 100),
    district: boundedText(location?.district ?? row.production_district, 'İlçe/şehir', 100),
    village: boundedText(location?.village ?? row.production_village, 'Köy/mezra', 160),
    villageIsCustom: optionalBoolean(location?.village_is_custom ?? row.production_village_is_custom, 'Özel köy işareti'),
    latitude,
    longitude,
    productCategories,
    legalName: boundedText(row.legal_name, 'Yasal ad/unvan', 240),
    identifier: boundedText(row.identifier, 'Kimlik/vergi numarası', 32),
    taxOffice: boundedText(row.tax_office, 'Vergi dairesi', 160),
    mersisNumber: boundedText(row.mersis_number, 'MERSİS numarası', 32),
    taxExemptionNumber: boundedText(row.tax_exemption_number, 'Vergi muafiyet numarası', 80),
    iban: boundedText(row.iban, 'IBAN', 34),
    phone: boundedText(row.phone, 'Telefon', 40),
    contactEmail: boundedText(row.contact_email, 'E-posta', 254).toLowerCase(),
    addressLine: boundedText(address?.address_line, 'Açık adres', 500),
    postalCode: boundedText(address?.postal_code, 'Posta kodu', 24),
    foodComplianceStatus: row.food_compliance_status == null ? '' : enumText(row.food_compliance_status, 'Gıda uygunluk durumu', FOOD_COMPLIANCE_STATUSES),
    foodRegistrationNumber: boundedText(row.food_registration_number, 'Gıda kayıt/onay numarası', 120),
    fulfillmentMethods: optionalStringArray(row.fulfillment_methods, 'Teslimat yöntemleri', 3, FULFILLMENT_METHODS),
    averageDispatchDays,
    coldChainCapable: optionalBoolean(row.cold_chain_capable, 'Soğuk zincir bilgisi'),
    plannedProducts: row.planned_products == null ? [] : normalizePlannedProducts(row.planned_products, categoryScope, false),
    sourcingModels: optionalStringArray(row.sourcing_models, 'Üretim kaynağı', 3, SOURCE_MODELS),
    organicClaimStatus: row.organic_claim_status == null ? '' : enumText(row.organic_claim_status, 'Organik beyan durumu', ORGANIC_CLAIM_STATUSES),
    organicCertifierName: boundedText(row.organic_certifier_name, 'Organik sertifika kuruluşu', 160),
    organicCertificateNumber: boundedText(row.organic_certificate_number, 'Organik sertifika numarası', 100),
    organicCertificateExpiresOn: optionalDate(row.organic_certificate_expires_on, 'Organik sertifika tarihi'),
    villageProductCommitment: optionalBoolean(row.village_product_commitment, 'Köy ürünü taahhüdü'),
    traceabilityCommitment: optionalBoolean(row.traceability_commitment, 'İzlenebilirlik taahhüdü'),
    productTruthCommitment: optionalBoolean(row.product_truth_commitment, 'Ürün doğruluk taahhüdü'),
    productionPracticeNotes: boundedText(row.production_practice_notes, 'Üretim uygulamaları', 2000),
    existingDocumentTypes: optionalStringArray(row.existing_document_types, 'Mevcut belge türleri', 30, DOCUMENT_TYPES),
  };
}

async function requireAuthenticatedUser(expectedUserId?: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = requiredUuid(data.user?.id, 'Oturum kullanıcı kimliği');
  if (expectedUserId && userId !== expectedUserId) throw new Error('Oturum kullanıcı kimliği belge sahibiyle eşleşmiyor.');
  return userId;
}

function safeDocumentPath(path: unknown, label = 'Belge yolu') {
  const normalized = boundedText(path, label, 500, true);
  if (normalized.includes('..') || normalized.startsWith('/') || /[\\\u0000-\u001f]/.test(normalized)) throw new Error(`${label} geçersiz.`);
  return normalized;
}

export async function getMyProducerApplicationDraft(applicationId?: string | null) {
  const { data, error } = await supabase.rpc('get_my_producer_application_draft_v5', {
    p_application_id: optionalUuid(applicationId, 'Başvuru kimliği'),
  });
  return normalizeDraft(unwrap<unknown>(data, error));
}

export async function listOnboardingCategories(): Promise<OnboardingCategory[]> {
  const { data, error } = await supabase.rpc('list_public_categories_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows)) throw new Error('Kategori listesi geçersiz.');
  return rows.map(item => {
    const row = asRecord(item, 'Kategori');
    return {
      id: requiredUuid(row.id, 'Kategori kimliği'),
      slug: minBoundedText(row.slug, 'Kategori kodu', 1, 100),
      name: minBoundedText(row.name, 'Kategori adı', 1, 160),
    };
  });
}

export async function saveProducerApplicationDraft(input: any): Promise<ProducerApplicationMutationResult> {
  const source = asRecord(input, 'Satıcı başvurusu');
  const sellerClassification = enumText(source.sellerClassification, 'Satıcı türü', SELLER_CLASSES);
  const activityTypes = stringArray(source.activityTypes, 'Üretim faaliyetleri', 12, ACTIVITY_TYPES, 1);
  if (typeof source.averageDispatchDays !== 'number' || !Number.isInteger(source.averageDispatchDays) || source.averageDispatchDays < 1 || source.averageDispatchDays > 30) throw new Error('Ortalama gönderim süresi 1 ile 30 gün arasında olmalıdır.');
  const productCategories = stringArray(source.productCategories, 'Ürün kategorileri', 30, undefined, 1);
  const categoryScope = new Set(productCategories);
  const fulfillmentMethods = stringArray(source.fulfillmentMethods, 'Teslimat yöntemleri', 3, FULFILLMENT_METHODS, 1);
  const sourcingModels = stringArray(source.sourcingModels, 'Üretim kaynağı', 3, SOURCE_MODELS, 1);
  const plannedProducts = normalizePlannedProducts(source.plannedProducts, categoryScope, true);
  const address = asRecord(source.address, 'Başvuru adresi');
  const productionCountryCode = countryCode(source.countryCode);
  const latitude = finiteCoordinate(source.latitude, -90, 90, 'Enlem');
  const longitude = finiteCoordinate(source.longitude, -180, 180, 'Boylam');
  if ((latitude === null) !== (longitude === null)) throw new Error('Enlem ve boylam birlikte girilmelidir.');
  const publicName = minBoundedText(source.publicName, 'Üretici adı', 2, 160);
  const description = minBoundedText(source.description, 'Üretici açıklaması', 40, 4000);
  const province = minBoundedText(source.province, 'İl/bölge', 2, 100);
  const district = minBoundedText(source.district, 'İlçe/şehir', 2, 100);
  const village = minBoundedText(source.village, 'Köy/mezra', 2, 160);
  const legalName = minBoundedText(source.legalName, 'Yasal ad/unvan', 2, 240);
  const identifier = boundedText(source.identifier, 'Kimlik/vergi numarası', 32, true).replace(/\D/g, '');
  if (productionCountryCode === 'TR') {
    const businessClass = ['artisan','sole_proprietor','company','cooperative'].includes(sellerClassification);
    if (businessClass && !/^\d{10}$/.test(identifier)) throw new Error('İşletme için 10 haneli vergi numarası gerekir.');
    if (!businessClass && !/^\d{11}$/.test(identifier)) throw new Error('Bireysel üretici için 11 haneli T.C. kimlik numarası gerekir.');
  }
  const mersisNumber = boundedText(source.mersisNumber, 'MERSİS numarası', 32).replace(/\D/g, '');
  if (productionCountryCode === 'TR' && ['company','cooperative'].includes(sellerClassification) && !/^\d{16}$/.test(mersisNumber)) throw new Error('Şirket/kooperatif için 16 haneli MERSİS numarası gerekir.');
  const iban = boundedText(source.iban, 'IBAN', 34, true).replace(/\s/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) throw new Error('IBAN TR ile başlamalı ve toplam 26 karakter olmalıdır.');
  const phone = boundedText(source.phone, 'Telefon', 40, true);
  if (phone.replace(/\D/g, '').length < 10 || phone.replace(/\D/g, '').length > 15) throw new Error('Telefon 10 ile 15 rakam içermelidir.');
  const contactEmail = boundedText(source.contactEmail, 'E-posta', 254, true).toLowerCase();
  if (!EMAIL_RE.test(contactEmail)) throw new Error('E-posta adresi geçersiz.');
  const foodComplianceStatus = enumText(source.foodComplianceStatus, 'Gıda uygunluk durumu', FOOD_COMPLIANCE_STATUSES);
  const foodRegistrationNumber = boundedText(source.foodRegistrationNumber, 'Gıda kayıt/onay numarası', 120);
  if (['registered','approved_facility'].includes(foodComplianceStatus) && foodRegistrationNumber.length < 4) throw new Error('Kayıtlı/onaylı gıda işletmesi için kayıt veya onay numarası gerekir.');
  const organicClaimStatus = enumText(source.organicClaimStatus, 'Organik beyan durumu', ORGANIC_CLAIM_STATUSES);
  const organicCertifierName = boundedText(source.organicCertifierName, 'Organik sertifika kuruluşu', 160);
  const organicCertificateNumber = boundedText(source.organicCertificateNumber, 'Organik sertifika numarası', 100);
  const organicCertificateExpiresOn = optionalDate(source.organicCertificateExpiresOn, 'Organik sertifika tarihi');
  if (organicClaimStatus === 'certified' && (!organicCertifierName || organicCertificateNumber.length < 4 || !organicCertificateExpiresOn)) throw new Error('Sertifikalı organik beyanı için kuruluş, sertifika numarası ve geçerlilik tarihi zorunludur.');
  if (organicClaimStatus === 'certified' && new Date(`${organicCertificateExpiresOn}T23:59:59`).getTime() < Date.now()) throw new Error('Süresi geçmiş organik sertifikası kullanılamaz.');
  const productionPracticeNotes = minBoundedText(source.productionPracticeNotes, 'Üretim uygulamaları', 30, 2000);

  const { data, error } = await supabase.rpc('save_producer_application_draft_v5', {
    p_application_id: optionalUuid(source.applicationId, 'Başvuru kimliği'),
    p_seller_classification: sellerClassification,
    p_activity_types: activityTypes,
    p_brand_name: boundedText(source.brandName, 'Marka adı', 160) || null,
    p_public_name: publicName,
    p_description: description,
    p_production_country_code: productionCountryCode,
    p_production_province: province,
    p_production_district: district,
    p_production_village: village,
    p_production_village_is_custom: booleanValue(source.villageIsCustom, 'Özel köy işareti'),
    p_production_latitude: latitude,
    p_production_longitude: longitude,
    p_product_categories: productCategories,
    p_legal_name: legalName,
    p_identifier: identifier,
    p_tax_office: boundedText(source.taxOffice, 'Vergi dairesi', 160) || null,
    p_mersis_number: mersisNumber || null,
    p_tax_exemption_number: boundedText(source.taxExemptionNumber, 'Vergi muafiyet numarası', 80) || null,
    p_iban: iban,
    p_phone: phone,
    p_contact_email: contactEmail,
    p_address: {
      country_code: countryCode(address.country_code ?? source.countryCode),
      province: minBoundedText(address.province ?? source.province, 'Adres il/bölge', 2, 100),
      district: minBoundedText(address.district ?? source.district, 'Adres ilçe/şehir', 2, 100),
      settlement_type: boundedText(address.settlement_type ?? 'village', 'Yerleşim türü', 40, true),
      settlement_name: minBoundedText(address.settlement_name ?? source.village, 'Yerleşim adı', 2, 160),
      address_line: minBoundedText(address.address_line, 'Açık adres', 5, 500),
      postal_code: boundedText(address.postal_code, 'Posta kodu', 24) || null,
    },
    p_food_compliance_status: foodComplianceStatus,
    p_food_registration_number: foodRegistrationNumber || null,
    p_fulfillment_methods: fulfillmentMethods,
    p_average_dispatch_days: source.averageDispatchDays,
    p_cold_chain_capable: booleanValue(source.coldChainCapable, 'Soğuk zincir bilgisi'),
    p_planned_products: plannedProducts,
    p_sourcing_models: sourcingModels,
    p_organic_claim_status: organicClaimStatus,
    p_organic_certifier_name: organicCertifierName || null,
    p_organic_certificate_number: organicCertificateNumber || null,
    p_organic_certificate_expires_on: organicCertificateExpiresOn || null,
    p_village_product_commitment: booleanValue(source.villageProductCommitment, 'Köy ürünü taahhüdü'),
    p_traceability_commitment: booleanValue(source.traceabilityCommitment, 'İzlenebilirlik taahhüdü'),
    p_product_truth_commitment: booleanValue(source.productTruthCommitment, 'Ürün doğruluk taahhüdü'),
    p_production_practice_notes: productionPracticeNotes,
    p_consent_version: 'producer-onboarding-v2-2026-08-19',
  });
  return normalizeApplicationResult(unwrap<unknown>(data, error), 'Satıcı başvuru kayıt sonucu');
}

export type PendingDocument = {
  file: File;
  documentType: string;
};

export async function uploadProducerDocuments(userId: string, applicationId: string, documents: PendingDocument[]) {
  const safeUserId = requiredUuid(userId, 'Kullanıcı kimliği');
  const safeApplicationId = requiredUuid(applicationId, 'Başvuru kimliği');
  await requireAuthenticatedUser(safeUserId);
  if (!Array.isArray(documents)) throw new Error('Belge listesi geçersiz.');
  if (documents.length > 6) throw new Error('En fazla 6 belge yükleyebilirsiniz.');
  const uploaded: { storage_path: string; document_type: string }[] = [];

  try {
    for (const document of documents) {
      if (!document?.file || !(document.file instanceof File)) throw new Error('Belge dosyası geçersiz.');
      const documentType = enumText(document.documentType, 'Belge türü', DOCUMENT_TYPES);
      const storageExtension = DOCUMENT_MIME_EXTENSIONS.get(document.file.type);
      if (!storageExtension) throw new Error('Belgeler PDF, JPEG, PNG veya WebP olmalıdır.');
      if (document.file.size <= 0 || document.file.size > 20 * 1024 * 1024) throw new Error('Her belge en fazla 20 MB olabilir.');
      const path = `${safeUserId}/${safeApplicationId}/${documentType}-${crypto.randomUUID()}.${storageExtension}`;
      const { error } = await supabase.storage.from('producer-documents').upload(path, document.file, {
        contentType: document.file.type,
        upsert: false,
        cacheControl: '3600',
      });
      if (error) throw error;
      uploaded.push({ storage_path: path, document_type: documentType });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage.from('producer-documents').remove(uploaded.map(item => item.storage_path)).catch(() => {});
    }
    throw error;
  }
}

export async function submitProducerApplication(applicationId: string, documents: { storage_path: string; document_type: string }[]): Promise<ProducerApplicationMutationResult> {
  const safeApplicationId = requiredUuid(applicationId, 'Başvuru kimliği');
  const userId = await requireAuthenticatedUser();
  if (!Array.isArray(documents) || documents.length > 6) throw new Error('Belge listesi geçersiz.');
  const seenPaths = new Set<string>();
  const safeDocuments = documents.map(item => {
    const row = asRecord(item, 'Belge kaydı');
    const storagePath = safeDocumentPath(row.storage_path);
    const documentType = enumText(row.document_type, 'Belge türü', DOCUMENT_TYPES);
    if (!storagePath.startsWith(`${userId}/${safeApplicationId}/`)) throw new Error('Belge yolu bu kullanıcı ve başvuruya ait değil.');
    if (seenPaths.has(storagePath)) throw new Error('Aynı belge yolu birden fazla kez kullanılamaz.');
    seenPaths.add(storagePath);
    return { storage_path: storagePath, document_type: documentType };
  });
  const { data, error } = await supabase.rpc('submit_producer_application_v4', {
    p_application_id: safeApplicationId,
    p_documents: safeDocuments,
  });
  return normalizeApplicationResult(unwrap<unknown>(data, error), 'Satıcı başvuru gönderim sonucu');
}

export async function removeProducerUploadedDocuments(paths: string[]) {
  if (!Array.isArray(paths) || !paths.length) return;
  if (paths.length > 6) throw new Error('Belge silme listesi geçersiz.');
  const userId = await requireAuthenticatedUser();
  const safePaths = paths.map(path => {
    const normalized = safeDocumentPath(path);
    if (!normalized.startsWith(`${userId}/`)) throw new Error('Belge yolu oturum kullanıcısına ait değil.');
    return normalized;
  });
  if (new Set(safePaths).size !== safePaths.length) throw new Error('Belge silme listesi tekrar eden yol içeriyor.');
  const { error } = await supabase.storage.from('producer-documents').remove(safePaths);
  if (error) throw error;
}

export async function listProductionLocationSuggestions(countryCodeInput: string, province?: string, district?: string): Promise<ProductionLocationSuggestion[]> {
  const { data, error } = await supabase.rpc('list_public_production_locations_v1', {
    p_country_code: countryCode(countryCodeInput),
    p_province: boundedText(province, 'İl/bölge', 100) || null,
    p_district: boundedText(district, 'İlçe/şehir', 100) || null,
    p_limit: 100,
  });
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows)) throw new Error('Üretim yeri önerileri geçersiz.');
  return rows.map(item => {
    const row = asRecord(item, 'Üretim yeri önerisi');
    return {
      country_code: countryCode(row.country_code ?? countryCodeInput),
      province: minBoundedText(row.province, 'İl/bölge', 2, 100),
      district: minBoundedText(row.district, 'İlçe/şehir', 2, 100),
      village: minBoundedText(row.village, 'Köy/mezra', 2, 160),
    };
  });
}
