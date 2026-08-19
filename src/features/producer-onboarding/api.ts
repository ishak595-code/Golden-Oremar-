import { supabase } from '../../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELLER_CLASSES = new Set(['individual_non_merchant','tax_exempt_artisan','artisan','sole_proprietor','company','cooperative']);
const DOCUMENT_TYPES = new Set(['identity','cks','organic_certificate','business_registration','tax_certificate','bank_proof','food_business_registration','food_business_approval','tax_exemption_certificate','mersis_record','cooperative_registration','residence_proof','other']);
const SOURCE_MODELS = new Set(['own_production','family_production','cooperative_production']);
const ACTIVITY_TYPES = new Set(['beekeeping','livestock','dairy','poultry','field_farming','fruit_growing','vegetable_growing','wild_harvest','fishing','food_processing','beverage_production','natural_materials']);
const FULFILLMENT_METHODS = new Set(['cargo','local_delivery','pickup']);
const DOCUMENT_MIME_EXTENSIONS = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function optionalUuid(value: unknown, label: string) {
  const normalized = String(value ?? '').trim();
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
  const normalized = String(value ?? '').trim();
  if (required && !normalized) throw new Error(`${label} zorunludur.`);
  if (normalized.length > max) throw new Error(`${label} en fazla ${max} karakter olabilir.`);
  return normalized;
}

function countryCode(value: unknown) {
  const normalized = String(value || 'TR').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Ülke kodu iki harfli ISO kodu olmalıdır.');
  return normalized;
}

function finiteCoordinate(value: unknown, min: number, max: number, label: string) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} geçersiz.`);
  return number;
}

function stringArray(value: unknown, label: string, maxItems: number, allowed?: Set<string>, minItems = 0) {
  if (!Array.isArray(value)) throw new Error(`${label} geçersiz.`);
  if (value.length < minItems || value.length > maxItems) throw new Error(`${label} ${minItems} ile ${maxItems} öğe arasında olmalıdır.`);
  const normalized = Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)));
  if (normalized.length !== value.length) throw new Error(`${label} boş veya tekrar eden değer içeremez.`);
  if (allowed && normalized.some(item => !allowed.has(item))) throw new Error(`${label} desteklenmeyen bir değer içeriyor.`);
  return normalized;
}

function normalizePlannedProducts(value: unknown, allowedCategories: Set<string>) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new Error('Planlanan ürün sayısı 1 ile 30 arasında olmalıdır.');
  return value.map((item: any) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') throw new Error('Planlanan ürün bilgisi geçersiz.');
    const sourceModel = boundedText(item.source_model, 'Ürün kaynağı', 80, true);
    if (!SOURCE_MODELS.has(sourceModel)) throw new Error('Golden Oremar satıcı hesabı aracılık için kullanılamaz. Ürün size, ailenize veya onaylı kooperatifinize ait üretim olmalıdır.');
    const category = boundedText(item.category, 'Ürün kategorisi', 80, true);
    if (!allowedCategories.has(category)) throw new Error('Planlanan ürün, seçtiğiniz üretim kategorilerinin dışında olamaz.');
    const quantity = Number(item.estimated_quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error('Tahmini ürün miktarı geçersiz.');
    return {
      name: boundedText(item.name, 'Ürün adı', 120, true),
      category,
      source_model: sourceModel,
      unit: boundedText(item.unit, 'Ürün birimi', 30, true),
      estimated_quantity: quantity,
    };
  });
}

export async function getMyProducerApplicationDraft(applicationId?: string | null) {
  const { data, error } = await supabase.rpc('get_my_producer_application_draft_v5', {
    p_application_id: optionalUuid(applicationId, 'Başvuru kimliği'),
  });
  return unwrap<any>(data, error);
}

export async function listOnboardingCategories() {
  const { data, error } = await supabase.rpc('list_public_categories_v1');
  return unwrap<any[]>(data, error);
}

export async function saveProducerApplicationDraft(input: any) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Satıcı başvurusu geçersiz.');
  const sellerClassification = boundedText(input.sellerClassification, 'Satıcı türü', 80, true);
  if (!SELLER_CLASSES.has(sellerClassification)) throw new Error('Satıcı türü desteklenmiyor.');
  const activityTypes = stringArray(input.activityTypes, 'Üretim faaliyetleri', 12, ACTIVITY_TYPES, 1);
  const dispatchDays = Number(input.averageDispatchDays);
  if (!Number.isInteger(dispatchDays) || dispatchDays < 1 || dispatchDays > 30) throw new Error('Ortalama gönderim süresi 1 ile 30 gün arasında olmalıdır.');
  const productCategories = stringArray(input.productCategories, 'Ürün kategorileri', 30, undefined, 1);
  const categoryScope = new Set(productCategories);
  const fulfillmentMethods = stringArray(input.fulfillmentMethods, 'Teslimat yöntemleri', 3, FULFILLMENT_METHODS, 1);
  const sourcingModels = stringArray(input.sourcingModels, 'Üretim kaynağı', 3, SOURCE_MODELS, 1);
  const plannedProducts = normalizePlannedProducts(input.plannedProducts, categoryScope);
  const address = input.address && !Array.isArray(input.address) && typeof input.address === 'object' ? input.address : {};

  const { data, error } = await supabase.rpc('save_producer_application_draft_v5', {
    p_application_id: optionalUuid(input.applicationId, 'Başvuru kimliği'),
    p_seller_classification: sellerClassification,
    p_activity_types: activityTypes,
    p_brand_name: boundedText(input.brandName, 'Marka adı', 160) || null,
    p_public_name: boundedText(input.publicName, 'Üretici adı', 160, true),
    p_description: boundedText(input.description, 'Üretici açıklaması', 4000, true),
    p_production_country_code: countryCode(input.countryCode),
    p_production_province: boundedText(input.province, 'İl/bölge', 100, true),
    p_production_district: boundedText(input.district, 'İlçe/şehir', 100, true),
    p_production_village: boundedText(input.village, 'Köy/mezra', 160, true),
    p_production_village_is_custom: !!input.villageIsCustom,
    p_production_latitude: finiteCoordinate(input.latitude, -90, 90, 'Enlem'),
    p_production_longitude: finiteCoordinate(input.longitude, -180, 180, 'Boylam'),
    p_product_categories: productCategories,
    p_legal_name: boundedText(input.legalName, 'Yasal ad/unvan', 240, true),
    p_identifier: boundedText(input.identifier, 'Kimlik/vergi numarası', 32, true),
    p_tax_office: boundedText(input.taxOffice, 'Vergi dairesi', 160) || null,
    p_mersis_number: boundedText(input.mersisNumber, 'MERSİS numarası', 32) || null,
    p_tax_exemption_number: boundedText(input.taxExemptionNumber, 'Vergi muafiyet numarası', 80) || null,
    p_iban: boundedText(input.iban, 'IBAN', 34, true).replace(/\s/g, '').toUpperCase(),
    p_phone: boundedText(input.phone, 'Telefon', 40, true),
    p_contact_email: boundedText(input.contactEmail, 'E-posta', 254, true).toLowerCase(),
    p_address: {
      country_code: countryCode(address.country_code ?? input.countryCode),
      province: boundedText(address.province ?? input.province, 'Adres il/bölge', 100, true),
      district: boundedText(address.district ?? input.district, 'Adres ilçe/şehir', 100, true),
      settlement_type: boundedText(address.settlement_type || 'village', 'Yerleşim türü', 40, true),
      settlement_name: boundedText(address.settlement_name ?? input.village, 'Yerleşim adı', 160, true),
      address_line: boundedText(address.address_line, 'Açık adres', 500, true),
      postal_code: boundedText(address.postal_code, 'Posta kodu', 24) || null,
    },
    p_food_compliance_status: boundedText(input.foodComplianceStatus, 'Gıda uygunluk durumu', 80, true),
    p_food_registration_number: boundedText(input.foodRegistrationNumber, 'Gıda kayıt/onay numarası', 120) || null,
    p_fulfillment_methods: fulfillmentMethods,
    p_average_dispatch_days: dispatchDays,
    p_cold_chain_capable: !!input.coldChainCapable,
    p_planned_products: plannedProducts,
    p_sourcing_models: sourcingModels,
    p_organic_claim_status: boundedText(input.organicClaimStatus, 'Organik beyan durumu', 80, true),
    p_organic_certifier_name: boundedText(input.organicCertifierName, 'Organik sertifika kuruluşu', 160) || null,
    p_organic_certificate_number: boundedText(input.organicCertificateNumber, 'Organik sertifika numarası', 100) || null,
    p_organic_certificate_expires_on: boundedText(input.organicCertificateExpiresOn, 'Organik sertifika tarihi', 16) || null,
    p_village_product_commitment: !!input.villageProductCommitment,
    p_traceability_commitment: !!input.traceabilityCommitment,
    p_product_truth_commitment: !!input.productTruthCommitment,
    p_production_practice_notes: boundedText(input.productionPracticeNotes, 'Üretim uygulamaları', 2000) || null,
    p_consent_version: 'producer-onboarding-v2-2026-08-19',
  });
  return unwrap<any>(data, error);
}

export type PendingDocument = {
  file: File;
  documentType: string;
};

export async function uploadProducerDocuments(userId: string, applicationId: string, documents: PendingDocument[]) {
  const safeUserId = requiredUuid(userId, 'Kullanıcı kimliği');
  const safeApplicationId = requiredUuid(applicationId, 'Başvuru kimliği');
  if (!Array.isArray(documents)) throw new Error('Belge listesi geçersiz.');
  if (documents.length > 6) throw new Error('En fazla 6 belge yükleyebilirsiniz.');
  const uploaded: { storage_path: string; document_type: string }[] = [];

  try {
    for (const document of documents) {
      if (!document?.file || !(document.file instanceof File)) throw new Error('Belge dosyası geçersiz.');
      const documentType = boundedText(document.documentType, 'Belge türü', 80, true);
      if (!DOCUMENT_TYPES.has(documentType)) throw new Error('Belge türü desteklenmiyor.');
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

export async function submitProducerApplication(applicationId: string, documents: { storage_path: string; document_type: string }[]) {
  const safeApplicationId = requiredUuid(applicationId, 'Başvuru kimliği');
  if (!Array.isArray(documents) || documents.length > 6) throw new Error('Belge listesi geçersiz.');
  const safeDocuments = documents.map(item => {
    const storagePath = String(item?.storage_path || '').trim();
    const documentType = boundedText(item?.document_type, 'Belge türü', 80, true);
    if (!DOCUMENT_TYPES.has(documentType)) throw new Error('Belge türü desteklenmiyor.');
    if (!storagePath || storagePath.length > 500 || storagePath.includes('..') || storagePath.startsWith('/') || /[\\\u0000-\u001f]/.test(storagePath)) throw new Error('Belge yolu geçersiz.');
    return { storage_path: storagePath, document_type: documentType };
  });
  const { data, error } = await supabase.rpc('submit_producer_application_v4', {
    p_application_id: safeApplicationId,
    p_documents: safeDocuments,
  });
  return unwrap<any>(data, error);
}

export async function removeProducerUploadedDocuments(paths: string[]) {
  if (!Array.isArray(paths) || !paths.length) return;
  if (paths.length > 6) throw new Error('Belge silme listesi geçersiz.');
  const safePaths = paths.map(path => {
    const normalized = String(path || '').trim();
    if (!normalized || normalized.length > 500 || normalized.includes('..') || normalized.startsWith('/') || /[\\\u0000-\u001f]/.test(normalized)) throw new Error('Belge yolu geçersiz.');
    return normalized;
  });
  const { error } = await supabase.storage.from('producer-documents').remove(safePaths);
  if (error) throw error;
}

export async function listProductionLocationSuggestions(countryCodeInput: string, province?: string, district?: string) {
  const { data, error } = await supabase.rpc('list_public_production_locations_v1', {
    p_country_code: countryCode(countryCodeInput),
    p_province: boundedText(province, 'İl/bölge', 100) || null,
    p_district: boundedText(district, 'İlçe/şehir', 100) || null,
    p_limit: 100,
  });
  return unwrap<any[]>(data, error);
}