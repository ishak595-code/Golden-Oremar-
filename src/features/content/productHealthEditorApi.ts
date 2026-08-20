import { supabase } from '../../lib/supabase';

export type ProductHealthWarning = { severity: 'info' | 'low' | 'medium' | 'high'; text: string };
export type ProductNutrition = {
  servingSize?: string;
  energyKcal?: number;
  proteinG?: number;
  carbohydrateG?: number;
  sugarsG?: number;
  fatG?: number;
  saturatedFatG?: number;
  fiberG?: number;
  saltG?: number;
};
export type ProductHealthPayload = {
  summary: string;
  productInfo: { ingredients: string[]; usageNotes: string[]; nutrition: ProductNutrition };
  safety: {
    storage: string[];
    preparation: string[];
    warnings: ProductHealthWarning[];
    allergens: string[];
    allergenNote: string;
    verificationNeeded: string[];
    claimPolicy: string;
  };
  recipe: {
    enabled: boolean;
    title: string;
    servings?: number;
    prepMinutes?: number;
    cookMinutes?: number;
    ingredients: string[];
    steps: string[];
  };
};
export type PublishedProductHealth = {
  contentId: string;
  summary: string;
  productInfo: ProductHealthPayload['productInfo'];
  safety: Record<string, unknown>;
  recipe: ProductHealthPayload['recipe'];
  updatedAt: string;
};
export type SellerProductHealthEditor = {
  productId: string;
  productName: string;
  productStatus: string;
  canEdit: boolean;
  published: PublishedProductHealth | null;
  pending: { requestId: string; payload: ProductHealthPayload; status: 'pending'; updatedAt: string } | null;
};
export type AdminProductHealthRequest = {
  requestId: string;
  productId: string;
  productName: string;
  productSlug: string;
  producerId: string;
  producerName: string;
  proposedBy: string;
  payload: ProductHealthPayload;
  status: 'pending';
  createdAt: string;
  updatedAt: string;
};
export type AdminProductHealthEditor = {
  productId: string;
  productName: string;
  productStatus: string;
  producerId: string;
  producerName: string;
  canPublish: true;
  published: PublishedProductHealth | null;
  requests: Array<{
    requestId: string;
    proposedBy: string;
    payload: ProductHealthPayload;
    status: 'pending';
    createdAt: string;
    updatedAt: string;
  }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITIES = new Set<ProductHealthWarning['severity']>(['info', 'low', 'medium', 'high']);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, label: string, max: number, required = false) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const out = value.trim();
  if ((required && !out) || out.length > max || /[\u0000-\u001F\u007F]/.test(out)) throw new Error(`${label} doğrulanamadı.`);
  return out;
}
function uuid(value: unknown, label: string) {
  const out = text(value, label, 36, true);
  if (!UUID_RE.test(out)) throw new Error(`${label} doğrulanamadı.`);
  return out;
}
function bool(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}
function dateTime(value: unknown, label: string) {
  const out = text(value, label, 80, true);
  if (Number.isNaN(Date.parse(out))) throw new Error(`${label} doğrulanamadı.`);
  return out;
}
function strings(value: unknown, label: string, maxItems: number, maxLen: number) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} doğrulanamadı.`);
  return value.map((item, index) => text(item, `${label} ${index + 1}`, maxLen, true));
}
function numberValue(value: unknown, label: string, max = 1_000_000) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} doğrulanamadı.`);
  return value;
}
function integerValue(value: unknown, label: string, max = 10_000) {
  const n = numberValue(value, label, max);
  if (n == null) return undefined;
  if (!Number.isSafeInteger(n)) throw new Error(`${label} doğrulanamadı.`);
  return n;
}
function nutrition(value: unknown): ProductNutrition {
  if (value == null) return {};
  if (!record(value)) throw new Error('Besin bilgileri doğrulanamadı.');
  const out: ProductNutrition = {};
  const serving = text(value.servingSize, 'Porsiyon', 120);
  if (serving) out.servingSize = serving;
  for (const key of ['energyKcal', 'proteinG', 'carbohydrateG', 'sugarsG', 'fatG', 'saturatedFatG', 'fiberG', 'saltG'] as const) {
    const n = numberValue(value[key], key);
    if (n != null) out[key] = n;
  }
  return out;
}
function warningRows(value: unknown): ProductHealthWarning[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error('Uyarılar doğrulanamadı.');
  return value.map((item, index) => {
    if (!record(item)) throw new Error(`${index + 1}. uyarı doğrulanamadı.`);
    const severity = text(item.severity, 'Uyarı seviyesi', 20, true) as ProductHealthWarning['severity'];
    if (!SEVERITIES.has(severity)) throw new Error('Uyarı seviyesi doğrulanamadı.');
    return { severity, text: text(item.text, 'Uyarı metni', 1000, true) };
  });
}
function normalizePayload(value: unknown): ProductHealthPayload {
  if (!record(value)) throw new Error('Ürün bilgi paketi doğrulanamadı.');
  const info = record(value.productInfo) ? value.productInfo : {};
  const safety = record(value.safety) ? value.safety : {};
  const recipe = record(value.recipe) ? value.recipe : {};
  return {
    summary: text(value.summary, 'Özet', 2000),
    productInfo: {
      ingredients: strings(info.ingredients, 'İçindekiler', 60, 240),
      usageNotes: strings(info.usageNotes, 'Kullanım notları', 30, 500),
      nutrition: nutrition(info.nutrition),
    },
    safety: {
      storage: strings(safety.storage, 'Saklama', 30, 500),
      preparation: strings(safety.preparation, 'Hazırlama', 30, 500),
      warnings: warningRows(safety.warnings),
      allergens: strings(safety.allergens, 'Alerjenler', 30, 160),
      allergenNote: text(safety.allergenNote, 'Alerjen notu', 1000),
      verificationNeeded: strings(safety.verificationNeeded, 'Doğrulama notları', 30, 500),
      claimPolicy: text(safety.claimPolicy, 'Beyan politikası', 1000),
    },
    recipe: {
      enabled: recipe.enabled === true,
      title: text(recipe.title, 'Tarif başlığı', 240),
      servings: integerValue(recipe.servings, 'Porsiyon', 1000),
      prepMinutes: integerValue(recipe.prepMinutes, 'Hazırlık süresi'),
      cookMinutes: integerValue(recipe.cookMinutes, 'Pişirme süresi'),
      ingredients: strings(recipe.ingredients, 'Tarif malzemeleri', 60, 300),
      steps: strings(recipe.steps, 'Tarif adımları', 40, 1000),
    },
  };
}
function published(value: unknown): PublishedProductHealth | null {
  if (value == null) return null;
  if (!record(value)) throw new Error('Yayınlanmış ürün bilgisi doğrulanamadı.');
  const rawSafety = record(value.safety) ? value.safety : {};
  const safetyForEdit = {
    storage: record(rawSafety.storage) ? rawSafety.storage.items : [],
    preparation: record(rawSafety.preparation) ? rawSafety.preparation.items : [],
    warnings: rawSafety.warnings,
    allergens: record(rawSafety.allergens) ? rawSafety.allergens.known : [],
    allergenNote: record(rawSafety.allergens) ? rawSafety.allergens.text : '',
    verificationNeeded: rawSafety.verificationNeeded,
    claimPolicy: rawSafety.claimPolicy,
  };
  const payload = normalizePayload({ summary: value.summary, productInfo: value.productInfo, safety: safetyForEdit, recipe: value.recipe });
  return {
    contentId: uuid(value.contentId, 'İçerik kimliği'),
    summary: payload.summary,
    productInfo: payload.productInfo,
    safety: rawSafety,
    recipe: payload.recipe,
    updatedAt: dateTime(value.updatedAt, 'Ürün bilgisi güncelleme tarihi'),
  };
}

export function emptyProductHealthPayload(): ProductHealthPayload {
  return {
    summary: '',
    productInfo: { ingredients: [], usageNotes: [], nutrition: {} },
    safety: { storage: [], preparation: [], warnings: [], allergens: [], allergenNote: '', verificationNeeded: [], claimPolicy: '' },
    recipe: { enabled: false, title: '', ingredients: [], steps: [] },
  };
}
export function normalizeProductHealthPayload(value: unknown) {
  return normalizePayload(value);
}
export function editorPayloadFromPublished(value: PublishedProductHealth | null): ProductHealthPayload {
  if (!value) return emptyProductHealthPayload();
  const safety = value.safety;
  return normalizePayload({
    summary: value.summary,
    productInfo: value.productInfo,
    safety: {
      storage: record(safety.storage) ? safety.storage.items : [],
      preparation: record(safety.preparation) ? safety.preparation.items : [],
      warnings: safety.warnings,
      allergens: record(safety.allergens) ? safety.allergens.known : [],
      allergenNote: record(safety.allergens) ? safety.allergens.text : '',
      verificationNeeded: safety.verificationNeeded,
      claimPolicy: safety.claimPolicy,
    },
    recipe: value.recipe,
  });
}

export async function getSellerProductHealthEditor(productId: string): Promise<SellerProductHealthEditor> {
  const id = uuid(productId, 'Ürün kimliği');
  const { data, error } = await supabase.rpc('get_my_product_health_editor_v1', { p_product_id: id });
  if (error) throw error;
  if (!record(data)) throw new Error('Ürün bilgi editörü doğrulanamadı.');
  const pending = data.pending;
  if (pending != null && !record(pending)) throw new Error('Bekleyen ürün bilgisi doğrulanamadı.');
  return {
    productId: uuid(data.productId, 'Ürün kimliği'),
    productName: text(data.productName, 'Ürün adı', 300, true),
    productStatus: text(data.productStatus, 'Ürün durumu', 40, true),
    canEdit: bool(data.canEdit, 'Düzenleme yetkisi'),
    published: published(data.published),
    pending: pending
      ? { requestId: uuid(pending.requestId, 'Talep kimliği'), payload: normalizePayload(pending.payload), status: 'pending', updatedAt: dateTime(pending.updatedAt, 'Talep tarihi') }
      : null,
  };
}
export async function saveSellerProductHealthChange(productId: string, payload: ProductHealthPayload) {
  const id = uuid(productId, 'Ürün kimliği');
  const clean = normalizePayload(payload);
  const { data, error } = await supabase.rpc('save_my_product_health_change_v1', { p_product_id: id, p_payload: clean });
  if (error) throw error;
  if (!record(data) || uuid(data.productId, 'Ürün kimliği') !== id || text(data.status, 'Talep durumu', 20, true) !== 'pending') throw new Error('Ürün bilgisi talebi doğrulanamadı.');
  return { requestId: uuid(data.requestId, 'Talep kimliği'), updatedAt: dateTime(data.updatedAt, 'Talep tarihi') };
}
export async function cancelSellerProductHealthChange(requestId: string) {
  const id = uuid(requestId, 'Talep kimliği');
  const { data, error } = await supabase.rpc('cancel_my_product_health_change_v1', { p_request_id: id });
  if (error) throw error;
  if (data !== true) throw new Error('Talep iptal sonucu doğrulanamadı.');
}
export async function listAdminProductHealthChanges(): Promise<AdminProductHealthRequest[]> {
  const { data, error } = await supabase.rpc('super_admin_list_product_health_changes_v1');
  if (error) throw error;
  if (!Array.isArray(data) || data.length > 10000) throw new Error('Ürün bilgi kuyruğu doğrulanamadı.');
  return data.map((row, index) => {
    if (!record(row)) throw new Error(`${index + 1}. ürün bilgi talebi doğrulanamadı.`);
    return {
      requestId: uuid(row.requestId, 'Talep kimliği'),
      productId: uuid(row.productId, 'Ürün kimliği'),
      productName: text(row.productName, 'Ürün adı', 300, true),
      productSlug: text(row.productSlug, 'Ürün bağlantısı', 220, true),
      producerId: uuid(row.producerId, 'Satıcı kimliği'),
      producerName: text(row.producerName, 'Satıcı adı', 240, true),
      proposedBy: uuid(row.proposedBy, 'Talep sahibi'),
      payload: normalizePayload(row.payload),
      status: 'pending' as const,
      createdAt: dateTime(row.createdAt, 'Talep oluşturma tarihi'),
      updatedAt: dateTime(row.updatedAt, 'Talep güncelleme tarihi'),
    };
  });
}
export async function getAdminProductHealthEditor(productId: string): Promise<AdminProductHealthEditor> {
  const id = uuid(productId, 'Ürün kimliği');
  const { data, error } = await supabase.rpc('super_admin_get_product_health_editor_v1', { p_product_id: id });
  if (error) throw error;
  if (!record(data) || !Array.isArray(data.requests)) throw new Error('Super Admin ürün bilgi editörü doğrulanamadı.');
  if (data.canPublish !== true) throw new Error('Super Admin yayın yetkisi doğrulanamadı.');
  return {
    productId: uuid(data.productId, 'Ürün kimliği'),
    productName: text(data.productName, 'Ürün adı', 300, true),
    productStatus: text(data.productStatus, 'Ürün durumu', 40, true),
    producerId: uuid(data.producerId, 'Satıcı kimliği'),
    producerName: text(data.producerName, 'Satıcı adı', 240, true),
    canPublish: true,
    published: published(data.published),
    requests: data.requests.map((row, index) => {
      if (!record(row)) throw new Error(`${index + 1}. ürün bilgi talebi doğrulanamadı.`);
      return {
        requestId: uuid(row.requestId, 'Talep kimliği'),
        proposedBy: uuid(row.proposedBy, 'Talep sahibi'),
        payload: normalizePayload(row.payload),
        status: 'pending' as const,
        createdAt: dateTime(row.createdAt, 'Talep tarihi'),
        updatedAt: dateTime(row.updatedAt, 'Talep güncelleme tarihi'),
      };
    }),
  };
}
export async function publishAdminProductHealth(productId: string, payload: ProductHealthPayload, reviewNote: string, requestId?: string | null) {
  const id = uuid(productId, 'Ürün kimliği');
  const note = reviewNote.trim();
  if (note.length > 2000) throw new Error('İnceleme notu en fazla 2000 karakter olabilir.');
  const request = requestId ? uuid(requestId, 'Talep kimliği') : null;
  const { data, error } = await supabase.rpc('super_admin_publish_product_health_v1', { p_product_id: id, p_payload: normalizePayload(payload), p_review_note: note || null, p_request_id: request });
  if (error) throw error;
  if (!record(data) || uuid(data.productId, 'Ürün kimliği') !== id || text(data.status, 'Yayın durumu', 20, true) !== 'published') throw new Error('Ürün bilgi yayın sonucu doğrulanamadı.');
  return data;
}
export async function rejectAdminProductHealthChange(requestId: string, reviewNote: string) {
  const id = uuid(requestId, 'Talep kimliği');
  const note = reviewNote.trim();
  if (note.length < 10 || note.length > 2000) throw new Error('Ret gerekçesi 10 ile 2000 karakter arasında olmalıdır.');
  const { data, error } = await supabase.rpc('super_admin_reject_product_health_change_v1', { p_request_id: id, p_review_note: note });
  if (error) throw error;
  if (data !== true) throw new Error('Ürün bilgi ret sonucu doğrulanamadı.');
}
export function productHealthErrorMessage(error: unknown, fallback = 'Ürün bilgisi işlemi tamamlanamadı.') {
  const message = String((error as { message?: unknown } | null)?.message || '').trim();
  const map: Array<[string, string]> = [
    ['super_admin_required', 'Bu işlem yalnız Super Admin tarafından yapılabilir.'],
    ['producer_product_owner_required', 'Yalnız kendi ürününüzün bilgilerini düzenleyebilirsiniz.'],
    ['active_verified_producer_required', 'Ürün bilgisi göndermek için aktif ve doğrulanmış satıcı hesabı gerekir.'],
    ['unsupported_product_health_claim', 'Tedavi veya doğrulanmamış sağlık iddiası ürün bilgisine eklenemez.'],
    ['product_health_request_not_found', 'Bekleyen ürün bilgisi talebi artık bulunamadı.'],
    ['product_not_found', 'Ürün artık bulunamadı.'],
  ];
  for (const [key, label] of map) if (message.includes(key)) return label;
  return message || fallback;
}
