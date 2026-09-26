import { supabase } from './supabase';

/**
 * Product videos go straight from the device to Cloudflare R2 through a
 * short-lived signed URL from the media-video-upload edge function. They never
 * pass through, or are stored in, Supabase: a 50 MB video would otherwise eat
 * the Supabase storage and download allowance that the rest of the app needs.
 *
 * Flow: start (the server checks who you are and reserves room in the budget)
 * -> PUT the file to R2 -> finish (the server checks size, type and the file's
 * own first bytes). Any failure after start cancels the upload, so nothing is
 * left half-way.
 */

export type DirectVideoScope = { scope: 'producer'; producerId: string } | { scope: 'admin' };

const VIDEO_EXTENSION = /\.(mp4|webm|mov)$/i;
export const DIRECT_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const MESSAGES: Record<string, string> = {
  video_storage_not_configured: 'Video yükleme henüz açılmadı. Şimdilik bir YouTube bağlantısı kullanabilirsiniz.',
  video_type_invalid: 'Ürün videosu MP4, WebM veya MOV olmalıdır.',
  video_size_invalid: 'Ürün videosu en fazla 50 MB olabilir.',
  video_size_invalid_reserved: 'Ürün videosu en fazla 50 MB olabilir.',
  video_budget_full: 'Video depolama alanı şu anda dolu. Lütfen videoyu YouTube\'a yükleyip bağlantısını ekleyin veya destek ile iletişime geçin.',
  video_too_many_pending: 'Tamamlanmamış çok fazla video yüklemesi var. Birkaç dakika sonra tekrar deneyin.',
  video_owner_required: 'Bu mağazaya video yükleme yetkiniz doğrulanamadı.',
  video_owner_permission_required: 'Video yüklemek için yayın yetkisi gerekiyor.',
  video_owner_mismatch: 'Bu mağazaya video yükleme yetkiniz doğrulanamadı.',
  video_content_invalid: 'Dosya bir video gibi görünmüyor. Lütfen telefonunuzdaki orijinal video dosyasını seçin.',
  video_not_uploaded: 'Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
  authentication_required: 'Oturumunuz doğrulanamadı. Lütfen tekrar giriş yapın.',
};

export function isDirectVideoPath(path: string): boolean {
  return VIDEO_EXTENSION.test(path);
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('media-video-upload', { body });
  if (error) {
    let code = '';
    try {
      const context = (error as { context?: Response }).context;
      const payload = context ? await context.clone().json() : null;
      code = typeof payload?.error === 'string' ? payload.error : '';
    } catch {
      code = '';
    }
    throw new Error(MESSAGES[code] || 'Video yüklenemedi. Lütfen tekrar deneyin.');
  }
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
    const code = typeof (data as { error?: unknown } | null)?.error === 'string' ? String((data as { error: string }).error) : '';
    throw new Error(MESSAGES[code] || 'Video yüklenemedi. Lütfen tekrar deneyin.');
  }
  return data as Record<string, unknown>;
}

export async function uploadDirectVideo(target: DirectVideoScope, file: File): Promise<string> {
  if (!(file instanceof File) || !DIRECT_VIDEO_TYPES.has(file.type)) throw new Error(MESSAGES.video_type_invalid);
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) throw new Error(MESSAGES.video_size_invalid);
  const started = await call({ action: 'start', ...target, contentType: file.type, size: file.size });
  const path = String(started.path || '');
  const uploadUrl = String(started.uploadUrl || '');
  if (!isDirectVideoPath(path)) throw new Error('Video yükleme adresi doğrulanamadı.');
  try {
    if (!/^https:\/\//.test(uploadUrl)) throw new Error('Video yükleme adresi doğrulanamadı.');
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!response.ok) throw new Error(MESSAGES.video_not_uploaded);
    const finished = await call({ action: 'finish', path });
    if (finished.path !== path) throw new Error('Video yükleme sonucu doğrulanamadı.');
    return path;
  } catch (error) {
    await call({ action: 'cancel', path }).catch(() => undefined);
    // A network or CORS failure surfaces as a TypeError with an English text.
    throw error instanceof Error && !(error instanceof TypeError) ? error : new Error(MESSAGES.video_not_uploaded);
  }
}

/** Remove videos the caller uploaded but that no product uses. Used videos are kept. */
export async function cancelDirectVideos(paths: string[]): Promise<void> {
  for (const path of paths) {
    if (isDirectVideoPath(path)) await call({ action: 'cancel', path }).catch(() => undefined);
  }
}
