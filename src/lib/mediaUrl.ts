import { supabase } from './supabase';

/**
 * The one place that turns a public storage path into an image or video URL.
 *
 * Cloudflare R2 is the home of every public image and video (migration
 * r2_single_home_for_public_media_v1): new uploads go there directly through
 * the media-upload edge function, and anything that still lands in a public
 * Supabase bucket is adopted into R2 by the media-cdn-sync worker. R2 does not
 * charge for downloads, which keeps customer traffic off the Supabase egress
 * quota that took the whole project offline in September 2026.
 *
 * Rules, each matching the server exactly:
 *   - the three public buckets (catalog-public, content-public, event-public)
 *     are namespaces inside the R2 bucket: key "<bucket>/<name>";
 *   - images and, in catalog-public, videos are served from R2;
 *   - a name that could escape its prefix is never used;
 *   - each key segment is URL-encoded.
 *
 * When no CDN base is configured, or a path is not eligible, the Supabase URL
 * is returned exactly as before. An image that is not in R2 yet (adopted a few
 * minutes after an old app version uploaded it to Supabase) is retried from
 * Supabase by installCatalogMediaFallback, using mediaOriginUrl below.
 */

// Filled in once the R2 public address exists. Native builds read this
// constant, so they do not depend on a build-time variable being set.
const CANONICAL_MEDIA_CDN_BASE = '';

export const MIRRORED_BUCKETS = ['catalog-public', 'content-public', 'event-public'] as const;
type MirroredBucket = (typeof MIRRORED_BUCKETS)[number];
const MIRRORED = new Set<string>(MIRRORED_BUCKETS);
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif)$/i;
// Product videos live only in R2 (media-upload), never in Supabase.
const VIDEO_EXTENSION = /\.(mp4|webm|mov)$/i;
const UNSAFE_NAME = /(^\/|\/\/|\/$|(^|\/)\.{1,2}(\/|$)|[\\\u0000-\u001f\u007f])/;

function readBase(): string {
  const raw = String(import.meta.env.VITE_MEDIA_CDN_BASE || CANONICAL_MEDIA_CDN_BASE).trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) return '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export const MEDIA_CDN_BASE = readBase();

export function isMirrorableMediaPath(bucket: string, path: string): boolean {
  return MIRRORED.has(bucket) && path.length > 0 && path.length <= 1024 && !UNSAFE_NAME.test(path) && IMAGE_EXTENSION.test(path);
}

function isCdnVideoPath(bucket: string, path: string): boolean {
  return bucket === 'catalog-public' && path.length > 0 && path.length <= 1024 && !UNSAFE_NAME.test(path) && VIDEO_EXTENSION.test(path);
}

/** The Supabase Storage URL, always. Use for videos and anything not mirrored. */
export function storageOriginUrl(bucket: string, path: string): string {
  try {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch {
    return '';
  }
}

/** CDN URL when the image is mirrorable and a CDN is configured, else Supabase. */
export function publicMediaUrl(bucket: MirroredBucket | string, path: string, base: string = MEDIA_CDN_BASE): string {
  if (!path) return '';
  if (base && (isMirrorableMediaPath(bucket, path) || isCdnVideoPath(bucket, path))) {
    return `${base}/${`${bucket}/${path}`.split('/').map(encodeURIComponent).join('/')}`;
  }
  return storageOriginUrl(bucket, path);
}

/**
 * For an image URL served by the CDN, the same image on Supabase. Returns ''
 * for anything else, so callers can tell "not a CDN URL" apart.
 */
export function mediaOriginUrl(src: string, base: string = MEDIA_CDN_BASE): string {
  if (!base || !src.startsWith(`${base}/`)) return '';
  let segments: string[];
  try {
    segments = src.slice(base.length + 1).split(/[?#]/)[0].split('/').map(decodeURIComponent);
  } catch {
    return '';
  }
  const [bucket, ...rest] = segments;
  const path = rest.join('/');
  return isMirrorableMediaPath(bucket, path) ? storageOriginUrl(bucket, path) : '';
}
