import { supabase } from './supabase';

/**
 * Every public image and video goes straight from the device to Cloudflare
 * R2 through a short-lived signed URL from the media-upload edge function.
 * Supabase stores only the path and the facts about the file, never the file.
 *
 * Flow: start (the server checks who you are and reserves room in the budget)
 * -> PUT the file to R2 -> finish (the server reads it back: real type from its
 * bytes, size, and the dimension rules of its kind). Any failure after start
 * cancels the upload, so nothing is left half-way.
 *
 * Deleting: an upload that is not used anywhere can be cancelled at once by
 * its uploader. Everything else is removed automatically by the media worker
 * 72 hours after nothing refers to it any more, so no screen has to delete
 * files itself and a file still in use can never be deleted by mistake.
 */

export type DirectMediaKind =
  | 'product-image' | 'product-video' | 'official-image' | 'official-video'
  | 'category-image' | 'brand-logo' | 'brand-cover' | 'event-image';

export type DirectMediaResult = {
  bucket: string;
  path: string;
  detectedMime: string;
  byteSize: number;
  width?: number;
  height?: number;
  assetKind?: 'logo' | 'cover';
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const TYPES: Record<DirectMediaKind, string[]> = {
  'product-image': IMAGE_TYPES,
  'official-image': IMAGE_TYPES,
  'category-image': IMAGE_TYPES,
  'event-image': IMAGE_TYPES,
  'brand-logo': ['image/jpeg', 'image/png', 'image/webp'],
  'brand-cover': ['image/jpeg', 'image/png', 'image/webp'],
  'product-video': VIDEO_TYPES,
  'official-video': VIDEO_TYPES,
};
export const DIRECT_MEDIA_MAX_BYTES: Record<DirectMediaKind, number> = {
  'product-image': 10 * 1024 * 1024,
  'official-image': 10 * 1024 * 1024,
  'category-image': 10 * 1024 * 1024,
  'event-image': 10 * 1024 * 1024,
  'brand-logo': 5 * 1024 * 1024,
  'brand-cover': 5 * 1024 * 1024,
  'product-video': 50 * 1024 * 1024,
  'official-video': 50 * 1024 * 1024,
};

const MESSAGES: Record<string, string> = {
  media_storage_not_configured: 'Görsel ve video yükleme şu anda hazırlanıyor. Lütfen biraz sonra tekrar deneyin.',
  media_type_invalid: 'Bu dosya türü burada kabul edilmiyor.',
  media_size_invalid: 'Dosya boyutu sınırın üzerinde.',
  media_size_invalid_reserved: 'Dosya boyutu sınırın üzerinde.',
  media_budget_full: 'Medya depolama alanı şu anda dolu. Lütfen destek ile iletişime geçin.',
  media_too_many_pending: 'Tamamlanmamış çok fazla yükleme var. Birkaç dakika sonra tekrar deneyin.',
  media_owner_mismatch: 'Bu mağaza için yükleme yetkiniz doğrulanamadı.',
  media_permission_required: 'Bu yükleme için yetkiniz yok.',
  media_content_invalid: 'Dosya seçilen türde görünmüyor. Lütfen cihazınızdaki orijinal dosyayı seçin.',
  media_dimensions_unreadable: 'Görselin boyutları okunamadı. Lütfen başka bir görsel deneyin.',
  media_dimensions_invalid: 'Görsel çok büyük. En fazla 25 megapiksel olabilir.',
  catalog_media_dimensions_invalid: 'Ürün ve kategori görsellerinin iki kenarı da en az 1200 piksel olmalıdır.',
  store_branding_logo_dimensions_invalid: 'Logo kare olmalı ve en az 512 piksel olmalıdır.',
  store_branding_cover_dimensions_invalid: 'Kapak görseli 2,5:1 oranında ve en az 1200x480 piksel olmalıdır.',
  media_reservation_mismatch: 'Yüklenen dosya beklenen boyutta değil. Lütfen tekrar deneyin.',
  media_not_uploaded: 'Dosya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
  media_daily_limit: 'Bugünkü yükleme sınırınıza ulaştınız. Yarın tekrar deneyebilirsiniz.',
  media_not_reserved: 'Yükleme süresi doldu. Lütfen dosyayı yeniden seçin.',
  media_already_finished: 'Bu dosya zaten yüklendi. Lütfen sayfayı yenileyip tekrar deneyin.',
  producer_invalid: 'Mağaza bilgisi doğrulanamadı.',
  authentication_required: 'Oturumunuz doğrulanamadı. Lütfen tekrar giriş yapın.',
};
const FALLBACK = 'Dosya yüklenemedi. Lütfen tekrar deneyin.';

export function directMediaMessage(code: string): string {
  return MESSAGES[code] || FALLBACK;
}

/** Which upload kind a stored path belongs to, or null (never a staff guess). */
export function directMediaKindOfPath(path: string): DirectMediaKind | null {
  const id = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const rules: Array<[DirectMediaKind, RegExp]> = [
    ['product-image', new RegExp(`^${id}/products/${id}\\.(jpg|png|webp|avif)$`)],
    ['product-video', new RegExp(`^${id}/products/${id}\\.(mp4|webm|mov)$`)],
    ['official-image', new RegExp(`^admin/${id}/official-products/${id}\\.(jpg|png|webp|avif)$`)],
    ['official-video', new RegExp(`^admin/${id}/official-products/${id}\\.(mp4|webm|mov)$`)],
    ['category-image', new RegExp(`^admin/${id}/categories/${id}\\.(jpg|png|webp|avif)$`)],
    ['brand-logo', new RegExp(`^${id}/profile/logo-${id}\\.(jpg|png|webp)$`)],
    ['brand-cover', new RegExp(`^${id}/profile/cover-${id}\\.(jpg|png|webp)$`)],
    ['event-image', new RegExp(`^${id}/events/${id}\\.(jpg|png|webp|avif)$`)],
  ];
  return rules.find(([, pattern]) => pattern.test(path))?.[0] ?? null;
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('media-upload', { body });
  if (error) {
    let code = '';
    try {
      const context = (error as { context?: Response }).context;
      const payload = context ? await context.clone().json() : null;
      code = typeof payload?.error === 'string' ? payload.error : '';
    } catch {
      code = '';
    }
    throw new Error(directMediaMessage(code));
  }
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
    const code = typeof (data as { error?: unknown } | null)?.error === 'string' ? String((data as { error: string }).error) : '';
    throw new Error(directMediaMessage(code));
  }
  return data as Record<string, unknown>;
}

export async function uploadDirectMedia(kind: DirectMediaKind, file: File, options: { producerId?: string } = {}): Promise<DirectMediaResult> {
  if (!(file instanceof File) || !TYPES[kind]?.includes(file.type)) throw new Error(MESSAGES.media_type_invalid);
  if (file.size <= 0 || file.size > DIRECT_MEDIA_MAX_BYTES[kind]) throw new Error(MESSAGES.media_size_invalid);
  const started = await call({ action: 'start', kind, producerId: options.producerId, contentType: file.type, size: file.size });
  const path = String(started.path || '');
  const uploadUrl = String(started.uploadUrl || '');
  if (directMediaKindOfPath(path) !== kind) throw new Error('Yükleme adresi doğrulanamadı.');
  try {
    if (!/^https:\/\//.test(uploadUrl)) throw new Error('Yükleme adresi doğrulanamadı.');
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!response.ok) throw new Error(MESSAGES.media_not_uploaded);
    const finished = await call({ action: 'finish', kind, path });
    if (finished.path !== path) throw new Error('Yükleme sonucu doğrulanamadı.');
    return {
      bucket: String(finished.bucket || started.bucket || ''),
      path,
      detectedMime: String(finished.detectedMime || ''),
      byteSize: Number(finished.byteSize) || 0,
      ...(typeof finished.width === 'number' && typeof finished.height === 'number' ? { width: finished.width, height: finished.height } : {}),
      ...(finished.assetKind === 'logo' || finished.assetKind === 'cover' ? { assetKind: finished.assetKind } : {}),
    };
  } catch (error) {
    await call({ action: 'cancel', kind, path }).catch(() => undefined);
    // A network or CORS failure surfaces as a TypeError with an English text.
    throw error instanceof Error && !(error instanceof TypeError) ? error : new Error(MESSAGES.media_not_uploaded);
  }
}

/**
 * Remove uploads the caller made that nothing uses. Paths still in use, or
 * uploaded by someone else, are left for the worker; that is not an error.
 */
export async function cancelDirectMedia(paths: string[]): Promise<void> {
  for (const path of paths) {
    const kind = directMediaKindOfPath(path);
    if (kind) await call({ action: 'cancel', kind, path }).catch(() => undefined);
  }
}
