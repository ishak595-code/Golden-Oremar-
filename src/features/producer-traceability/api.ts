import { supabase } from '../../lib/supabase';

const BATCH_STATUSES = new Set(['draft', 'review', 'released', 'rejected', 'recalled', 'archived']);
const BATCH_EVENT_TYPES = new Set(['harvested', 'produced', 'packed', 'quality_checked', 'stored', 'correction']);

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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function safeInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function finiteNumber(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function optionalFiniteNumber(value: unknown, label: string, min: number, max: number) {
  if (value == null) return null;
  return finiteNumber(value, label, min, max);
}

function safeBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function currency(value: unknown) {
  const code = requiredText(value, 'Para birimi', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('Para birimi doğrulanamadı.');
  return code;
}

function country(value: unknown) {
  const code = requiredText(value, 'Menşe ülke kodu', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Menşe ülke kodu iki harfli ISO kodu olmalıdır.');
  return code;
}

function dateOnly(value: unknown, label: string, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function dateTime(value: unknown, label: string, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function batchStatus(value: unknown) {
  const status = requiredText(value, 'Lot durumu', 40);
  if (!BATCH_STATUSES.has(status)) throw new Error('Lot durumu doğrulanamadı.');
  return status;
}

function normalizeInventory(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. stok kaydı doğrulanamadı.`);
  const availableQuantity = safeInteger(value.availableQuantity, 'Mevcut stok', 0, 1_000_000_000);
  const reservedQuantity = safeInteger(value.reservedQuantity, 'Rezerve stok', 0, 1_000_000_000);
  const sellableQuantity = safeInteger(value.sellableQuantity, 'Satılabilir stok', 0, 1_000_000_000);
  if (sellableQuantity !== Math.max(0, availableQuantity - reservedQuantity)) throw new Error(`${index + 1}. stok miktarı tutarsız.`);
  return {
    productId: uuid(value.productId, 'Ürün kimliği'),
    productName: requiredText(value.productName, 'Ürün adı', 300),
    productStatus: requiredText(value.productStatus, 'Ürün durumu', 60),
    stockMode: requiredText(value.stockMode, 'Stok modeli', 60),
    variantId: uuid(value.variantId, 'Varyant kimliği'),
    variantName: requiredText(value.variantName, 'Varyant adı', 240),
    sku: optionalText(value.sku, 'SKU', 160),
    priceMinor: safeInteger(value.priceMinor, 'Varyant fiyatı'),
    currency: currency(value.currency),
    availableQuantity,
    reservedQuantity,
    sellableQuantity,
    reorderLevel: safeInteger(value.reorderLevel, 'Yeniden sipariş seviyesi', 0, 1_000_000_000),
    version: safeInteger(value.version, 'Stok sürümü', 1, 1_000_000_000),
    weightGrams: value.weightGrams == null ? null : safeInteger(value.weightGrams, 'Varyant ağırlığı', 1, 10_000_000),
  };
}

function normalizeBatchSummary(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. lot özeti doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Lot kimliği'),
    traceCode: optionalText(value.traceCode, 'Trace kodu', 80),
    batchCode: requiredText(value.batchCode, 'Lot kodu', 80),
    productId: uuid(value.productId, 'Ürün kimliği'),
    productName: requiredText(value.productName, 'Ürün adı', 300),
    variantId: value.variantId == null ? null : uuid(value.variantId, 'Varyant kimliği'),
    status: batchStatus(value.status),
    harvestDate: dateOnly(value.harvestDate, 'Hasat tarihi'),
    productionDate: dateOnly(value.productionDate, 'Üretim tarihi'),
    packagingDate: dateOnly(value.packagingDate, 'Paketleme tarihi'),
    bestBeforeDate: dateOnly(value.bestBeforeDate, 'Tavsiye edilen tüketim tarihi'),
    reviewReason: optionalText(value.reviewReason, 'İnceleme notu', 1500),
    submittedAt: dateTime(value.submittedAt, 'Gönderim tarihi'),
    reviewedAt: dateTime(value.reviewedAt, 'İnceleme tarihi'),
    releasedAt: dateTime(value.releasedAt, 'Yayın tarihi'),
    updatedAt: dateTime(value.updatedAt, 'Lot güncelleme tarihi', true) as string,
  };
}

function normalizeEvent(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. izlenebilirlik olayı doğrulanamadı.`);
  const eventType = requiredText(value.eventType, 'Olay türü', 40);
  if (!BATCH_EVENT_TYPES.has(eventType)) throw new Error(`${index + 1}. izlenebilirlik olay türü doğrulanamadı.`);
  const visibility = requiredText(value.visibility, 'Olay görünürlüğü', 20);
  if (visibility !== 'public' && visibility !== 'private') throw new Error(`${index + 1}. olay görünürlüğü doğrulanamadı.`);
  return {
    id: safeInteger(value.id, 'İzlenebilirlik olayı kimliği', 1),
    eventType,
    eventAt: dateTime(value.eventAt, 'Olay tarihi', true) as string,
    locationLabel: optionalText(value.locationLabel, 'Olay konumu', 200),
    publicNote: optionalText(value.publicNote, 'Olay notu', 1500),
    visibility: visibility as 'public' | 'private',
    createdAt: dateTime(value.createdAt, 'Olay oluşturulma tarihi', true) as string,
  };
}

function normalizeCertification(value: unknown, index: number) {
  if (!isRecord(value)) throw new Error(`${index + 1}. sertifika kaydı doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Sertifika kimliği'),
    type: requiredText(value.type, 'Sertifika türü', 120),
    issuer: requiredText(value.issuer, 'Sertifika kurumu', 240),
    certificateNumber: optionalText(value.certificateNumber, 'Sertifika numarası', 160),
    issuedAt: dateOnly(value.issuedAt, 'Sertifika düzenleme tarihi'),
    expiresAt: dateOnly(value.expiresAt, 'Sertifika bitiş tarihi'),
    status: requiredText(value.status, 'Sertifika durumu', 40),
    linked: safeBoolean(value.linked, 'Sertifika bağlantı durumu'),
  };
}

function normalizeBatchEditor(value: unknown) {
  if (!isRecord(value) || !isRecord(value.origin)) throw new Error('Lot ayrıntısı doğrulanamadı.');
  if (!Array.isArray(value.events) || value.events.length > 1000) throw new Error('Lot olayları doğrulanamadı.');
  if (!Array.isArray(value.certifications) || value.certifications.length > 500) throw new Error('Lot sertifikaları doğrulanamadı.');
  const initialQuantity = value.initialQuantity == null ? null : finiteNumber(value.initialQuantity, 'Başlangıç miktarı', Number.EPSILON, 1_000_000_000_000);
  const quantityUnit = optionalText(value.quantityUnit, 'Miktar birimi', 30);
  if ((initialQuantity == null) !== (quantityUnit == null)) throw new Error('Lot miktarı ve birimi birlikte doğrulanmalıdır.');
  return {
    id: uuid(value.id, 'Lot kimliği'),
    traceCode: optionalText(value.traceCode, 'Trace kodu', 80),
    batchCode: requiredText(value.batchCode, 'Lot kodu', 80),
    status: batchStatus(value.status),
    productId: uuid(value.productId, 'Ürün kimliği'),
    productSlug: requiredText(value.productSlug, 'Ürün bağlantısı', 220),
    productName: requiredText(value.productName, 'Ürün adı', 300),
    variantId: value.variantId == null ? null : uuid(value.variantId, 'Varyant kimliği'),
    harvestDate: dateOnly(value.harvestDate, 'Hasat tarihi'),
    productionDate: dateOnly(value.productionDate, 'Üretim tarihi'),
    packagingDate: dateOnly(value.packagingDate, 'Paketleme tarihi'),
    bestBeforeDate: dateOnly(value.bestBeforeDate, 'Tavsiye edilen tüketim tarihi'),
    origin: {
      countryCode: country(value.origin.countryCode),
      province: requiredText(value.origin.province, 'Menşe il/bölge', 100),
      district: requiredText(value.origin.district, 'Menşe ilçe', 100),
      village: requiredText(value.origin.village, 'Menşe köy/mezra', 160),
      latitude: optionalFiniteNumber(value.origin.latitude, 'Menşe enlem', -90, 90),
      longitude: optionalFiniteNumber(value.origin.longitude, 'Menşe boylam', -180, 180),
    },
    productionMethod: requiredText(value.productionMethod, 'Üretim yöntemi', 500),
    initialQuantity,
    quantityUnit,
    publicNotes: optionalText(value.publicNotes, 'Herkese açık lot notu', 1500),
    reviewReason: optionalText(value.reviewReason, 'İnceleme notu', 1500),
    submittedAt: dateTime(value.submittedAt, 'Gönderim tarihi'),
    reviewedAt: dateTime(value.reviewedAt, 'İnceleme tarihi'),
    releasedAt: dateTime(value.releasedAt, 'Yayın tarihi'),
    createdAt: dateTime(value.createdAt, 'Lot oluşturulma tarihi', true) as string,
    updatedAt: dateTime(value.updatedAt, 'Lot güncelleme tarihi', true) as string,
    events: value.events.map(normalizeEvent),
    certifications: value.certifications.map(normalizeCertification),
  };
}

export async function getProducerTraceabilityDashboard() {
  const { data, error } = await supabase.rpc('get_my_producer_dashboard_v1');
  const payload = unwrap<unknown>(data, error);
  if (!isRecord(payload) || !isRecord(payload.profile)) throw new Error('Satıcı izlenebilirlik özeti doğrulanamadı.');
  if (!Array.isArray(payload.inventory) || payload.inventory.length > 5000) throw new Error('Satıcı stok listesi doğrulanamadı.');
  if (!Array.isArray(payload.batches) || payload.batches.length > 20) throw new Error('Satıcı lot listesi doğrulanamadı.');
  return {
    ...payload,
    inventory: payload.inventory.map(normalizeInventory),
    batches: payload.batches.map(normalizeBatchSummary),
  };
}

export async function getBatchEditor(batchId: string) {
  const id = uuid(batchId, 'Lot kimliği');
  const { data, error } = await supabase.rpc('get_my_product_batch_editor_v1', {
    p_batch_id: id,
  });
  const batch = normalizeBatchEditor(unwrap<unknown>(data, error));
  if (batch.id !== id) throw new Error('Lot ayrıntısı istekle eşleşmiyor.');
  return batch;
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
  const batchId = input.batchId == null ? null : uuid(input.batchId, 'Lot kimliği');
  const productReference = requiredText(input.productReference, 'Ürün referansı', 220);
  const variantId = input.variantId == null ? null : uuid(input.variantId, 'Varyant kimliği');
  const batchCode = requiredText(input.batchCode, 'Lot kodu', 80).toUpperCase();
  if (!/^[A-Z0-9._/-]{3,80}$/.test(batchCode)) throw new Error('Lot kodu 3-80 karakter olmalı ve yalnız harf, rakam, nokta, alt çizgi, eğik çizgi veya tire içermelidir.');
  const harvestDate = dateOnly(input.harvestDate, 'Hasat tarihi');
  const productionDate = dateOnly(input.productionDate, 'Üretim tarihi');
  const packagingDate = dateOnly(input.packagingDate, 'Paketleme tarihi');
  const bestBeforeDate = dateOnly(input.bestBeforeDate, 'Tavsiye edilen tüketim tarihi');
  if (!harvestDate && !productionDate) throw new Error('Hasat tarihi veya üretim tarihi zorunludur.');
  const today = new Date().toISOString().slice(0, 10);
  if ((harvestDate && harvestDate > today) || (productionDate && productionDate > today) || (packagingDate && packagingDate > today)) throw new Error('Hasat, üretim ve paketleme tarihi gelecekte olamaz.');
  if (packagingDate && harvestDate && packagingDate < harvestDate) throw new Error('Paketleme tarihi hasat tarihinden önce olamaz.');
  if (packagingDate && productionDate && packagingDate < productionDate) throw new Error('Paketleme tarihi üretim tarihinden önce olamaz.');
  if (bestBeforeDate && packagingDate && bestBeforeDate < packagingDate) throw new Error('Tavsiye edilen tüketim tarihi paketleme tarihinden önce olamaz.');
  const originCountryCode = country(input.originCountryCode);
  const originProvince = requiredText(input.originProvince, 'Menşe il/bölge', 100);
  const originDistrict = requiredText(input.originDistrict, 'Menşe ilçe', 100);
  const originVillage = requiredText(input.originVillage, 'Menşe köy/mezra', 160);
  const productionMethod = requiredText(input.productionMethod, 'Üretim yöntemi', 500);
  if (productionMethod.length < 2) throw new Error('Üretim yöntemi en az 2 karakter olmalıdır.');
  const initialQuantity = input.initialQuantity == null ? null : finiteNumber(input.initialQuantity, 'Başlangıç miktarı', Number.EPSILON, 1_000_000_000_000);
  const quantityUnit = optionalText(input.quantityUnit, 'Miktar birimi', 30);
  if ((initialQuantity == null) !== (quantityUnit == null)) throw new Error('Miktar ve birim birlikte girilmelidir.');
  const publicNotes = optionalText(input.publicNotes, 'Herkese açık lot notu', 1500);

  const { data, error } = await supabase.rpc('producer_save_product_batch_v1', {
    p_batch_id: batchId,
    p_product_reference: productReference,
    p_variant_id: variantId,
    p_batch_code: batchCode,
    p_harvest_date: harvestDate,
    p_production_date: productionDate,
    p_packaging_date: packagingDate,
    p_best_before_date: bestBeforeDate,
    p_origin_country_code: originCountryCode,
    p_origin_province: originProvince,
    p_origin_district: originDistrict,
    p_origin_village: originVillage,
    p_origin_latitude: null,
    p_origin_longitude: null,
    p_production_method: productionMethod,
    p_initial_quantity: initialQuantity,
    p_quantity_unit: quantityUnit,
    p_public_notes: publicNotes,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result)) throw new Error('Kaydedilen lot cevabı doğrulanamadı.');
  const savedId = uuid(result.batch_id, 'Kaydedilen lot kimliği');
  if (batchId && savedId !== batchId) throw new Error('Kaydedilen lot cevabı istekle eşleşmiyor.');
  const status = batchStatus(result.status);
  if (status !== 'draft') throw new Error('Kaydedilen lot beklenmeyen durumda döndü.');
  return {
    batchId: savedId,
    traceCode: requiredText(result.trace_code, 'Trace kodu', 80),
    batchCode: requiredText(result.batch_code, 'Lot kodu', 80),
    status,
  };
}

export async function addBatchEvent(input: {
  batchId: string;
  eventType: string;
  eventAt: string;
  locationLabel?: string | null;
  publicNote?: string | null;
  visibility: 'public' | 'private';
}) {
  const batchId = uuid(input.batchId, 'Lot kimliği');
  const eventType = requiredText(input.eventType, 'Olay türü', 40);
  if (!BATCH_EVENT_TYPES.has(eventType)) throw new Error('İzlenebilirlik olay türü doğrulanamadı.');
  const eventAt = dateTime(input.eventAt, 'Olay tarihi', true) as string;
  if (new Date(eventAt).getTime() > Date.now() + 5 * 60_000) throw new Error('İzlenebilirlik olayı gelecekte olamaz.');
  const locationLabel = optionalText(input.locationLabel, 'Olay konumu', 200);
  const publicNote = optionalText(input.publicNote, 'Olay notu', 1500);
  if (input.visibility !== 'public' && input.visibility !== 'private') throw new Error('Olay görünürlüğü doğrulanamadı.');
  const { data, error } = await supabase.rpc('producer_add_product_batch_event_v1', {
    p_batch_id: batchId,
    p_event_type: eventType,
    p_event_at: eventAt,
    p_location_label: locationLabel,
    p_public_note: publicNote,
    p_visibility: input.visibility,
  });
  return safeInteger(unwrap<unknown>(data, error), 'Yeni izlenebilirlik olayı kimliği', 1);
}

export async function setBatchCertification(batchId: string, certificationId: string, enabled: boolean) {
  const normalizedBatchId = uuid(batchId, 'Lot kimliği');
  const normalizedCertificationId = uuid(certificationId, 'Sertifika kimliği');
  if (typeof enabled !== 'boolean') throw new Error('Sertifika bağlantı durumu doğrulanamadı.');
  const { data, error } = await supabase.rpc('producer_set_product_batch_certification_v1', {
    p_batch_id: normalizedBatchId,
    p_certification_id: normalizedCertificationId,
    p_enabled: enabled,
  });
  const result = unwrap<unknown>(data, error);
  if (result !== true) throw new Error('Sertifika bağlantısı sunucudan doğrulanamadı.');
  return true;
}

export async function submitBatch(batchId: string) {
  const id = uuid(batchId, 'Lot kimliği');
  const { data, error } = await supabase.rpc('producer_submit_product_batch_v1', {
    p_batch_id: id,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result)) throw new Error('Lot inceleme cevabı doğrulanamadı.');
  const returnedId = uuid(result.batch_id, 'İncelemeye gönderilen lot kimliği');
  const status = batchStatus(result.status);
  if (returnedId !== id || status !== 'review') throw new Error('Lot inceleme cevabı istekle eşleşmiyor.');
  return { batchId: returnedId, status };
}
