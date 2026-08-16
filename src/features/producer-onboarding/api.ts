import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getMyProducerApplicationDraft(applicationId?: string | null) {
  const { data, error } = await supabase.rpc('get_my_producer_application_draft_v4', {
    p_application_id: applicationId ?? null,
  });
  return unwrap<any>(data, error);
}

export async function listOnboardingCategories() {
  const { data, error } = await supabase.rpc('list_public_categories_v1');
  return unwrap<any[]>(data, error);
}

export async function saveProducerApplicationDraft(input: any) {
  const { data, error } = await supabase.rpc('save_producer_application_draft_v4', {
    p_application_id: input.applicationId || null,
    p_seller_classification: input.sellerClassification,
    p_brand_name: input.brandName || null,
    p_public_name: input.publicName,
    p_description: input.description,
    p_production_country_code: input.countryCode,
    p_production_province: input.province,
    p_production_district: input.district,
    p_production_village: input.village,
    p_production_village_is_custom: !!input.villageIsCustom,
    p_production_latitude: input.latitude ?? null,
    p_production_longitude: input.longitude ?? null,
    p_product_categories: input.productCategories,
    p_legal_name: input.legalName,
    p_identifier: input.identifier,
    p_tax_office: input.taxOffice || null,
    p_mersis_number: input.mersisNumber || null,
    p_tax_exemption_number: input.taxExemptionNumber || null,
    p_iban: input.iban,
    p_phone: input.phone,
    p_contact_email: input.contactEmail,
    p_address: input.address,
    p_food_compliance_status: input.foodComplianceStatus,
    p_food_registration_number: input.foodRegistrationNumber || null,
    p_fulfillment_methods: input.fulfillmentMethods,
    p_average_dispatch_days: input.averageDispatchDays,
    p_cold_chain_capable: !!input.coldChainCapable,
    p_planned_products: input.plannedProducts,
    p_sourcing_models: input.sourcingModels,
    p_organic_claim_status: input.organicClaimStatus,
    p_organic_certifier_name: input.organicCertifierName || null,
    p_organic_certificate_number: input.organicCertificateNumber || null,
    p_organic_certificate_expires_on: input.organicCertificateExpiresOn || null,
    p_village_product_commitment: !!input.villageProductCommitment,
    p_traceability_commitment: !!input.traceabilityCommitment,
    p_product_truth_commitment: !!input.productTruthCommitment,
    p_production_practice_notes: input.productionPracticeNotes || null,
    p_consent_version: 'producer-onboarding-v1-2026-08-14',
  });
  return unwrap<any>(data, error);
}

export type PendingDocument = {
  file: File;
  documentType: string;
};

export async function uploadProducerDocuments(userId: string, applicationId: string, documents: PendingDocument[]) {
  if (documents.length > 6) throw new Error('En fazla 6 belge yükleyebilirsiniz.');
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const uploaded: { storage_path: string; document_type: string }[] = [];

  try {
    for (const document of documents) {
      if (!allowedTypes.includes(document.file.type)) throw new Error('Belgeler PDF, JPEG, PNG veya WebP olmalıdır.');
      if (document.file.size <= 0 || document.file.size > 20 * 1024 * 1024) throw new Error('Her belge en fazla 20 MB olabilir.');
      const originalExt = document.file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const path = `${userId}/${applicationId}/${document.documentType}-${crypto.randomUUID()}.${originalExt}`;
      const { error } = await supabase.storage.from('producer-documents').upload(path, document.file, {
        contentType: document.file.type,
        upsert: false,
        cacheControl: '3600',
      });
      if (error) throw error;
      uploaded.push({ storage_path: path, document_type: document.documentType });
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
  const { data, error } = await supabase.rpc('submit_producer_application_v3', {
    p_application_id: applicationId,
    p_documents: documents,
  });
  return unwrap<any>(data, error);
}

export async function removeProducerUploadedDocuments(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from('producer-documents').remove(paths);
  if (error) throw error;
}

export async function listProductionLocationSuggestions(countryCode: string, province?: string, district?: string) {
  const { data, error } = await supabase.rpc('list_public_production_locations_v1', {
    p_country_code: countryCode || 'TR',
    p_province: province?.trim() || null,
    p_district: district?.trim() || null,
    p_limit: 100,
  });
  return unwrap<any[]>(data, error);
}
