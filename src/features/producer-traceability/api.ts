import { supabase } from '../../lib/supabase';

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

export async function getProducerTraceabilityDashboard() {
  const { data, error } = await supabase.rpc('get_my_producer_dashboard_v1');
  return unwrap<any>(data, error);
}

export async function getBatchEditor(batchId: string) {
  const { data, error } = await supabase.rpc('get_my_product_batch_editor_v1', {
    p_batch_id: batchId,
  });
  return unwrap<any>(data, error);
}

export async function saveBatch(input: {
  batchId?: string | null;
  productReference: string;
  variantId?: string | null;
  batchCode: string;
  harvestDate?: string | null;
  productionDate?: string | null;
  packagingDate?: string | null;
  bestBeforeDate?: string | null;
  originCountryCode?: string | null;
  originProvince?: string | null;
  originDistrict?: string | null;
  originVillage?: string | null;
  productionMethod?: string | null;
  initialQuantity?: number | null;
  quantityUnit?: string | null;
  publicNotes?: string | null;
}) {
  const { data, error } = await supabase.rpc('producer_save_product_batch_v1', {
    p_batch_id: input.batchId ?? null,
    p_product_reference: input.productReference,
    p_variant_id: input.variantId ?? null,
    p_batch_code: input.batchCode.trim(),
    p_harvest_date: input.harvestDate || null,
    p_production_date: input.productionDate || null,
    p_packaging_date: input.packagingDate || null,
    p_best_before_date: input.bestBeforeDate || null,
    p_origin_country_code: input.originCountryCode?.trim().toUpperCase() || null,
    p_origin_province: input.originProvince?.trim() || null,
    p_origin_district: input.originDistrict?.trim() || null,
    p_origin_village: input.originVillage?.trim() || null,
    p_origin_latitude: null,
    p_origin_longitude: null,
    p_production_method: input.productionMethod?.trim() || null,
    p_initial_quantity: input.initialQuantity ?? null,
    p_quantity_unit: input.quantityUnit?.trim() || null,
    p_public_notes: input.publicNotes?.trim() || null,
  });
  return unwrap<any>(data, error);
}

export async function addBatchEvent(input: {
  batchId: string;
  eventType: string;
  eventAt: string;
  locationLabel?: string | null;
  publicNote?: string | null;
  visibility: 'public' | 'private';
}) {
  const { data, error } = await supabase.rpc('producer_add_product_batch_event_v1', {
    p_batch_id: input.batchId,
    p_event_type: input.eventType.trim(),
    p_event_at: input.eventAt,
    p_location_label: input.locationLabel?.trim() || null,
    p_public_note: input.publicNote?.trim() || null,
    p_visibility: input.visibility,
  });
  return unwrap<number>(data, error);
}

export async function setBatchCertification(batchId: string, certificationId: string, enabled: boolean) {
  const { data, error } = await supabase.rpc('producer_set_product_batch_certification_v1', {
    p_batch_id: batchId,
    p_certification_id: certificationId,
    p_enabled: enabled,
  });
  return unwrap<boolean>(data, error);
}

export async function submitBatch(batchId: string) {
  const { data, error } = await supabase.rpc('producer_submit_product_batch_v1', {
    p_batch_id: batchId,
  });
  return unwrap<any>(data, error);
}
