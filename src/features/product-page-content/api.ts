import { supabase } from '../../lib/supabase';

/**
 * Product page content ("Ürün sayfası içeriği"): the per-product texts and the
 * shipping rule the product page shows. Read and saved through two RPCs that
 * check on the server who may edit: the super admin every product, a seller
 * only the products of the store they own (get/save_product_page_content_v1).
 */
export type ShippingMode = 'default' | 'free' | 'paid';
export type ProductPageContent = {
  prestige: string; pack: string; about: string; origin: string; production: string; packaging: string;
  returnText: string; dispatchText: string; coldChain: boolean; shippingNote: string; priceNote: string;
  shippingMode: ShippingMode; shippingFeeMinor: number | null;
};
/** priceNote is kept only by databases with 20261009090000_product_price_note_v1; until then the field stays hidden in the editor. */
export type ProductPageContentRecord = { productId: string; slug: string; name: string; updatedAt: string; role: 'admin' | 'producer'; content: ProductPageContent; defaultShippingFeeMinor: number | null; priceNoteSupported: boolean };

/** Character limits, the same on the server and on the page. */
export const PAGE_CONTENT_LIMITS = { prestige: 120, pack: 80, about: 1200, origin: 120, production: 160, packaging: 120, returnText: 200, dispatchText: 160, shippingNote: 80, priceNote: 120 } as const;
export type PageTextKey = keyof typeof PAGE_CONTENT_LIMITS;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown, max: number) => (typeof value === 'string' ? value : '').slice(0, max);
const fee = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);

function normalize(value: unknown): ProductPageContentRecord {
  if (!record(value) || !UUID_RE.test(String(value.productId || '')) || !record(value.content)) throw new Error('Ürün sayfası içeriği doğrulanamadı.');
  const c = value.content;
  const mode: ShippingMode = c.shippingMode === 'free' || c.shippingMode === 'paid' ? c.shippingMode : 'default';
  return {
    productId: String(value.productId), slug: str(value.slug, 220), name: str(value.name, 300), updatedAt: str(value.updatedAt, 60),
    role: value.role === 'producer' ? 'producer' : 'admin',
    defaultShippingFeeMinor: fee(value.defaultShippingFeeMinor),
    priceNoteSupported: typeof c.priceNote === 'string',
    content: {
      prestige: str(c.prestige, 400), pack: str(c.pack, 400), about: str(c.about, 2000), origin: str(c.origin, 400),
      production: str(c.production, 400), packaging: str(c.packaging, 400), returnText: str(c.returnText, 400),
      dispatchText: str(c.dispatchText, 400), coldChain: c.coldChain === true, shippingNote: str(c.shippingNote, 400), priceNote: str(c.priceNote, 400),
      shippingMode: mode, shippingFeeMinor: fee(c.shippingFeeMinor),
    },
  };
}

export async function getProductPageContent(productId: string) {
  if (!UUID_RE.test(productId)) throw new Error('Ürün kimliği doğrulanamadı.');
  const { data, error } = await supabase.rpc('get_product_page_content_v1', { p_product_id: productId });
  if (error) throw error;
  return normalize(data);
}

/** Client-side check before saving; the server checks the same again. */
export function validatePageContent(content: ProductPageContent): string {
  for (const [key, max] of Object.entries(PAGE_CONTENT_LIMITS) as Array<[PageTextKey, number]>) {
    const value = content[key].trim();
    if (value.length > max) return `${PAGE_FIELD_LABELS[key]} en fazla ${max} karakter olabilir.`;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) || /<[a-zA-Z/!]/.test(value)) return `${PAGE_FIELD_LABELS[key]} geçersiz karakter içeriyor.`;
  }
  if (content.prestige.split('·').filter(part => part.trim()).length > 3) return 'Fotoğraf altı satırı en fazla üç parçadan oluşabilir (· ile ayırın).';
  if (content.shippingMode === 'paid') {
    if (content.shippingFeeMinor === null || content.shippingFeeMinor < 100) return 'Ücretli kargo için en az 1 TL kargo ücreti yazın.';
    if (content.shippingFeeMinor > 1_000_000) return 'Kargo ücreti en fazla 10.000 TL olabilir.';
  }
  return '';
}

export async function saveProductPageContent(productId: string, content: ProductPageContent, expectedUpdatedAt: string | null) {
  const issue = validatePageContent(content);
  if (issue) throw new Error(issue);
  const payload: Record<string, unknown> = { coldChain: content.coldChain, shippingMode: content.shippingMode, shippingFeeMinor: content.shippingMode === 'paid' ? content.shippingFeeMinor : null };
  for (const key of Object.keys(PAGE_CONTENT_LIMITS) as PageTextKey[]) payload[key] = content[key].trim().replace(/[ \t]+/g, ' ');
  const { data, error } = await supabase.rpc('save_product_page_content_v1', { p_product_id: productId, p_content: payload, p_expected_updated_at: expectedUpdatedAt || null });
  if (error) throw error;
  return normalize(data);
}

export const PAGE_FIELD_LABELS: Record<PageTextKey, string> = {
  prestige: 'Fotoğraf altı satırı', pack: 'Paket satırı', about: 'Ürün bilgileri', origin: 'Kökeni', production: 'Üretim',
  packaging: 'Ambalaj', returnText: 'İade', dispatchText: 'Teslimat', shippingNote: 'Kargo satırı', priceNote: 'Fiyat gerekçesi',
};

export function pageContentError(error: unknown) {
  const message = String((error as any)?.message || '').trim();
  const map: Array<[string, string]> = [
    ['product_page_edit_forbidden', 'Bu ürünün sayfasını düzenleme yetkiniz yok.'],
    ['authentication_required', 'Oturumunuz kapanmış. Lütfen yeniden giriş yapın.'],
    ['product_page_stale', 'Ürün bu arada başka bir yerden güncellendi. Sayfayı yenileyip tekrar deneyin.'],
    ['page_text_health_claim', 'Metinlerde sağlık beyanı olamaz (ör. "hastalığı önler"). Lütfen ifadeyi değiştirin.'],
    ['page_text_too_long', 'Metinlerden biri izin verilen uzunluğu aşıyor.'],
    ['invalid_page_text', 'Metinlerden biri geçersiz karakter içeriyor.'],
    ['prestige_too_many_parts', 'Fotoğraf altı satırı en fazla üç parçadan oluşabilir.'],
    ['shipping_fee_out_of_range', 'Kargo ücreti 1 TL ile 10.000 TL arasında olmalıdır.'],
    ['invalid_shipping_fee', 'Kargo ücretini TL olarak yazın.'],
    ['official_store_product_management_requires_admin', 'Resmi mağaza ürünlerini yalnız Süper Yönetici düzenleyebilir.'],
    ['verified_active_producer_required', 'Bu işlem için doğrulanmış ve aktif bir mağaza gerekir.'],
    ['product_not_found', 'Ürün bulunamadı.'],
    ['402', 'Sunucu şu anda yanıt vermiyor (Supabase kotası). Değişiklik kaydedilemedi; lütfen daha sonra tekrar deneyin.'],
  ];
  for (const [code, text] of map) if (message.includes(code)) return text;
  if (/failed to fetch|network/i.test(message)) return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  return message && /[ğüşöçıİĞÜŞÖÇ]/.test(message) ? message : 'Ürün sayfası içeriği kaydedilemedi. Lütfen tekrar deneyin.';
}
