// What a stored file really is, decided from its bytes, never from the name
// or the Content-Type a client claims. Shared by media-upload (new uploads to
// R2) and media-cdn-sync (files adopted from Supabase Storage). The rules and
// numbers are the same as catalog-media-verify, which still guards the
// Supabase Storage path; media-upload-contract-audit keeps them in step.

export const MIN_PRODUCT_IMAGE_EDGE = 1200;
export const MAX_PRODUCT_IMAGE_PIXELS = 25_000_000;
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
function equal(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectImageMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && equal(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 24 && equal(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && ascii(bytes, 12, 4) === "IHDR") return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === "ftyp") {
    const brands: string[] = [ascii(bytes, 8, 4)];
    const limit = Math.min(bytes.length, 64);
    for (let offset = 16; offset + 4 <= limit; offset += 4) brands.push(ascii(bytes, offset, 4));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }
  return "";
}

export function videoMagicMatches(bytes: Uint8Array, contentType: string) {
  if (contentType === "video/webm") return bytes.length >= 4 && equal(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (bytes.length < 8) return false;
  const box = ascii(bytes, 4, 4);
  if (contentType === "video/mp4") return box === "ftyp";
  if (contentType === "video/quicktime") return ["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"].includes(box);
  return false;
}

export function extensionMatches(path: string, mime: string) {
  const lower = path.toLowerCase();
  if (mime === "image/jpeg") return /[.](jpg|jpeg)$/.test(lower);
  if (mime === "image/png") return lower.endsWith(".png");
  if (mime === "image/webp") return lower.endsWith(".webp");
  if (mime === "image/avif") return lower.endsWith(".avif");
  if (mime === "video/mp4") return lower.endsWith(".mp4");
  if (mime === "video/webm") return lower.endsWith(".webm");
  if (mime === "video/quicktime") return lower.endsWith(".mov");
  return false;
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (JPEG_SOF.has(marker) && length >= 7) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4], width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width && height ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}
function uint24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
    return { width: 1 + (b0 | ((b1 & 0x3f) << 8)), height: 1 + (((b1 & 0xc0) >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff, height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return width && height ? { width, height } : null;
  }
  return null;
}
function avifDimensions(bytes: Uint8Array) {
  if (bytes.length < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let typeOffset = 4; typeOffset + 16 <= bytes.length; typeOffset++) {
    if (ascii(bytes, typeOffset, 4) !== "ispe") continue;
    const boxStart = typeOffset - 4, boxSize = view.getUint32(boxStart, false);
    if (boxSize < 20 || boxStart + boxSize > bytes.length) continue;
    const width = view.getUint32(typeOffset + 8, false), height = view.getUint32(typeOffset + 12, false);
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}
export function imageDimensions(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") return pngDimensions(bytes);
  if (mime === "image/jpeg") return jpegDimensions(bytes);
  if (mime === "image/webp") return webpDimensions(bytes);
  if (mime === "image/avif") return avifDimensions(bytes);
  return null;
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

export type MediaKind = "product-image" | "official-image" | "category-image" | "brand-logo" | "brand-cover" | "event-image" | "product-video" | "official-video";

/** Dimension rules per kind; null when fine, otherwise the refusal code. */
export function dimensionProblem(kind: MediaKind, width: number, height: number): string | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) return "media_dimensions_unreadable";
  if (width * height > MAX_PRODUCT_IMAGE_PIXELS) return "media_dimensions_invalid";
  if (kind === "product-image" || kind === "official-image" || kind === "category-image") {
    return width >= MIN_PRODUCT_IMAGE_EDGE && height >= MIN_PRODUCT_IMAGE_EDGE ? null : "catalog_media_dimensions_invalid";
  }
  if (kind === "brand-logo") return width === height && width >= 512 && width <= 4096 ? null : "store_branding_logo_dimensions_invalid";
  if (kind === "brand-cover") {
    const ratio = width / height;
    return width >= 1200 && height >= 480 && width <= 6000 && height <= 2400 && Math.abs(ratio - 2.5) <= 0.025 ? null : "store_branding_cover_dimensions_invalid";
  }
  return null;
}
