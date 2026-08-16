import { supabase } from '../lib/supabase';

export type ProducerApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'needs_information' | 'approved' | 'rejected' | 'withdrawn';

export type ProducerApplicationDocument = {
  id: string;
  document_type: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
};

export type AdminProducerApplication = {
  id: string;
  applicant_user_id: string;
  applicant_type: string;
  seller_classification: string | null;
  brand_name: string;
  public_name: string | null;
  description: string | null;
  production_location: string | null;
  product_categories: string[];
  food_compliance_status: string | null;
  fulfillment_methods: string[];
  average_dispatch_days: number | null;
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
  address: string | null;
  tax_office: string | null;
  identifier_masked: string | null;
  mersis_masked: string | null;
  food_registration_masked: string | null;
  iban_masked: string | null;
  documents: ProducerApplicationDocument[];
  planned_products: string[];
  sourcing_models: string[];
  organic_claim_status: string | null;
  organic_certifier_name: string | null;
  organic_certificate_expires_on: string | null;
  village_product_commitment: boolean;
  traceability_commitment: boolean;
  product_truth_commitment: boolean;
  production_practice_notes: string | null;
};

export type SensitiveProducerApplication = {
  application_id: string;
  legal_name: string | null;
  national_id: string | null;
  tax_number: string | null;
  tax_office: string | null;
  mersis_number: string | null;
  tax_exemption_number: string | null;
  food_registration_number: string | null;
  organic_certificate_number: string | null;
  iban: string | null;
  bank_account_holder: string | null;
  phone: string | null;
  contact_email: string | null;
  address: string | null;
  consent_version: string | null;
  consented_at: string | null;
};

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export async function adminListProducerApplications(): Promise<AdminProducerApplication[]> {
  const { data, error } = await supabase.rpc('admin_list_producer_applications_v3');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    id: String(row.id),
    applicant_user_id: String(row.applicant_user_id),
    brand_name: String(row.brand_name || 'İsimsiz mağaza'),
    email: String(row.email || ''),
    product_categories: stringArray(row.product_categories),
    fulfillment_methods: stringArray(row.fulfillment_methods),
    planned_products: stringArray(row.planned_products),
    sourcing_models: stringArray(row.sourcing_models),
    documents: Array.isArray(row.documents) ? row.documents.map((doc: any) => ({
      ...doc,
      id: String(doc.id),
      document_type: String(doc.document_type || ''),
      storage_path: String(doc.storage_path || ''),
      size_bytes: doc.size_bytes == null ? null : Number(doc.size_bytes),
      verification_status: String(doc.verification_status || 'pending'),
    })) : [],
    average_dispatch_days: row.average_dispatch_days == null ? null : Number(row.average_dispatch_days),
    cold_chain_capable: row.cold_chain_capable === true,
    village_product_commitment: row.village_product_commitment === true,
    traceability_commitment: row.traceability_commitment === true,
    product_truth_commitment: row.product_truth_commitment === true,
  }));
}

export async function adminGetProducerApplicationSensitive(applicationId: string, purpose: string): Promise<SensitiveProducerApplication> {
  const normalizedPurpose = purpose.trim();
  if (normalizedPurpose.length < 10 || normalizedPurpose.length > 200) {
    throw new Error('Hassas veri erişim amacı 10 ile 200 karakter arasında olmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_get_producer_application_sensitive_v3', {
    p_application_id: applicationId,
    p_purpose: normalizedPurpose,
  });
  return unwrap<SensitiveProducerApplication>(data, error);
}

export async function adminReviewProducerApplication(input: {
  applicationId: string;
  status: 'under_review' | 'needs_information' | 'approved' | 'rejected';
  reason?: string;
  commissionPercent: number;
}) {
  const reason = input.reason?.trim() || null;
  if ((input.status === 'needs_information' || input.status === 'rejected') && (!reason || reason.length < 10 || reason.length > 1000)) {
    throw new Error('Bilgi talebi veya ret için 10 ile 1000 karakter arasında gerekçe yazılmalıdır.');
  }
  if (!Number.isFinite(input.commissionPercent) || input.commissionPercent < 0 || input.commissionPercent > 30) {
    throw new Error('Platform komisyonu %0 ile %30 arasında olmalıdır.');
  }
  const { data, error } = await supabase.rpc('admin_review_producer_application_v3', {
    p_application_id: input.applicationId,
    p_status: input.status,
    p_reason: reason,
    p_commission_basis_points: Math.round(input.commissionPercent * 100),
  });
  return unwrap<any>(data, error);
}

export function producerApplicationErrorMessage(error: unknown, fallback = 'Satıcı başvurusu işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['producer_application_not_found', 'Başvuru artık bulunamadı. Listeyi yenileyin.'],
    ['producer_application_already_final', 'Bu başvuru daha önce kesin sonuca bağlanmış.'],
    ['producer_application_not_ready', 'Başvuru onaylanmaya hazır durumda değil.'],
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
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 260 ? message : fallback;
}
