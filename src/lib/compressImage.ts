/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * Why this exists: product photos come straight from phone cameras at 3-8 MB
 * and 4000+ pixels wide, and the upload paths stored them untouched. Every
 * customer who opened a product page then downloaded those megabytes. On a
 * 5 GB monthly egress allowance that is roughly a thousand product views; even
 * a 250 GB paid allowance would go in about fifty thousand. The photos are
 * displayed at a few hundred pixels, so almost all of those bytes were wasted.
 *
 * Resizing so the short edge sits at 1200 px (the verifier's floor) and
 * re-encoding as WebP typically lands at 200-400 KB - a 15-30x reduction - with no visible loss at the sizes the
 * app renders, including the fullscreen viewer on a phone.
 *
 * The resize never goes below 1200 px on the short edge: see minShortEdge.
 *
 * Guarantees:
 *   - never blocks an upload. Any failure (unsupported format, decode error,
 *     no canvas) returns the original file unchanged, and the caller's
 *     existing validation decides as before
 *   - never makes a file bigger. If the re-encoded result is not smaller and
 *     no resize was needed, the original is kept
 *   - keeps camera orientation. createImageBitmap is asked to apply EXIF
 *     orientation, so a portrait phone photo does not arrive sideways
 *   - keeps transparency. WebP has an alpha channel; if the browser cannot
 *     encode WebP, a PNG source stays PNG rather than falling to JPEG, which
 *     would turn transparent areas black
 */

export type CompressOptions = {
  /** Target ceiling for the longest edge, in pixels. */
  maxLongEdge: number;
  /**
   * Floor for the shortest edge, in pixels. Takes precedence over maxLongEdge.
   *
   * This is not cosmetic. The catalog-media-verify edge function rejects any
   * catalogue image whose width OR height is below MIN_PRODUCT_IMAGE_EDGE
   * (1200). Shrinking only by the long edge would take a tall 9:16 phone photo
   * to 1125 px wide and the server would refuse the upload. The resize
   * therefore stops as soon as the short edge reaches this floor, even if the
   * long edge is still above maxLongEdge.
   */
  minShortEdge: number;
  /** WebP/JPEG quality, 0-1. */
  quality?: number;
  /** Files already under this size that need no resize are left alone. */
  skipBelowBytes?: number;
};

// Both values must stay in step with MIN_PRODUCT_IMAGE_EDGE in
// supabase/functions/catalog-media-verify. Category uploads go through the
// same verifier, so they share the product rule.
export const PRODUCT_IMAGE_COMPRESSION: CompressOptions = { maxLongEdge: 2000, minShortEdge: 1200, quality: 0.82, skipBelowBytes: 400 * 1024 };
export const CATEGORY_IMAGE_COMPRESSION: CompressOptions = PRODUCT_IMAGE_COMPRESSION;

/** Scale factor for a given size: shrink toward maxLongEdge, never below the
 *  short-edge floor, never enlarge. Exported for the contract audit. */
export function resizeScale(width: number, height: number, options: Pick<CompressOptions, 'maxLongEdge' | 'minShortEdge'>): number {
  const longest = Math.max(width, height);
  const shortest = Math.min(width, height);
  if (!(longest > 0) || !(shortest > 0)) return 1;
  let scale = longest > options.maxLongEdge ? options.maxLongEdge / longest : 1;
  if (shortest * scale < options.minShortEdge) scale = options.minShortEdge / shortest;
  return Math.min(1, scale);
}

const EXTENSION: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      // Older engines reject the options bag; orientation then follows their
      // default, which for modern mobile browsers is already from-image.
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(blob => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

export async function compressImageForUpload(file: File, options: CompressOptions): Promise<File> {
  try {
    if (!(file instanceof File) || !file.type.startsWith('image/') || typeof document === 'undefined') return file;

    const bitmap = await decode(file);
    if (!bitmap) return file;

    const scale = resizeScale(bitmap.width, bitmap.height, options);
    if (scale === 1 && file.size <= (options.skipBelowBytes ?? 0)) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close?.();
      return file;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const quality = options.quality ?? 0.82;
    let blob = await encode(canvas, 'image/webp', quality);
    // Browsers that cannot encode WebP silently return PNG. Detect that rather
    // than trusting the requested type.
    if (!blob || blob.type !== 'image/webp') {
      blob = file.type === 'image/png'
        ? await encode(canvas, 'image/png', quality)
        : await encode(canvas, 'image/jpeg', quality);
    }
    if (!blob || !EXTENSION[blob.type]) return file;
    if (scale === 1 && blob.size >= file.size) return file;

    const base = (file.name || 'gorsel').replace(/\.[^.]+$/, '') || 'gorsel';
    return new File([blob], `${base}.${EXTENSION[blob.type]}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
