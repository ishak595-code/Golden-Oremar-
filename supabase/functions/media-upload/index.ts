import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { AwsClient } from "npm:aws4fetch@1.0.20";
import {
  detectImageMime, dimensionProblem, extensionMatches, IMAGE_TYPES, imageDimensions, type MediaKind, sha256Hex, VIDEO_TYPES, videoMagicMatches,
} from "../_shared/media_binary.ts";

// Every public image and video goes straight from the uploader's device to
// Cloudflare R2; Supabase only records it (migration
// r2_single_home_for_public_media_v1).
//
//   POST { action: "start", kind, producerId?, contentType, size }
//     -> { ok, bucket, path, uploadUrl, headers }   signed PUT, 10 minutes
//   POST { action: "finish", kind, path }
//     -> { ok, path, detectedMime, byteSize, width?, height?, assetKind? }
//        after the file was read back from R2: exact size, real type from its
//        bytes, extension, and the dimension rules of its kind
//   POST { action: "cancel", kind, path }
//     -> { ok }   removes the caller's upload if nothing uses it
//
// The signed URL never points at the public name. The device uploads to a
// random staging key (_incoming/<uuid>); finish reads that, checks it, and
// writes the checked bytes themselves to the public name. So nothing that was
// not verified is ever served under a product, and a second PUT to the staging
// URL after the check changes nothing. Staging keys are deleted here, by the
// garbage collector, or by the staging sweep of media-cdn-sync.
//
// Deleting is two-phase (media_direct_begin_release_v1 marks the row, R2 is
// cleared, media_direct_finish_release_v1 drops it), so the ledger always
// lists at least what is in R2.
//
// Permissions mirror catalog-media-verify: staff folders need the matching
// permission here; producer folders are owned-checked by the database when it
// reserves the bytes (media_direct_reserve_v2), which also enforces the size
// limits, the per-user daily limit and both R2 budgets.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-golden-device-id", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UPLOAD_URL_SECONDS = 600;
const IMMUTABLE = "public, max-age=31536000, immutable";
const STAGING_RE = new RegExp(`^_incoming/${UUID}$`);
const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export const KINDS: Record<MediaKind, { bucket: string; video: boolean; producer: boolean; pattern: RegExp; types: Set<string> }> = {
  "product-image": { bucket: "catalog-public", video: false, producer: true, pattern: new RegExp(`^${UUID}/products/${UUID}\\.(jpg|png|webp|avif)$`), types: IMAGE_TYPES },
  "product-video": { bucket: "catalog-public", video: true, producer: true, pattern: new RegExp(`^${UUID}/products/${UUID}\\.(mp4|webm|mov)$`), types: VIDEO_TYPES },
  "official-image": { bucket: "catalog-public", video: false, producer: false, pattern: new RegExp(`^admin/${UUID}/official-products/${UUID}\\.(jpg|png|webp|avif)$`), types: IMAGE_TYPES },
  "official-video": { bucket: "catalog-public", video: true, producer: false, pattern: new RegExp(`^admin/${UUID}/official-products/${UUID}\\.(mp4|webm|mov)$`), types: VIDEO_TYPES },
  "category-image": { bucket: "catalog-public", video: false, producer: false, pattern: new RegExp(`^admin/${UUID}/categories/${UUID}\\.(jpg|png|webp|avif)$`), types: IMAGE_TYPES },
  "brand-logo": { bucket: "catalog-public", video: false, producer: true, pattern: new RegExp(`^${UUID}/profile/logo-${UUID}\\.(jpg|png|webp)$`), types: new Set(["image/jpeg", "image/png", "image/webp"]) },
  "brand-cover": { bucket: "catalog-public", video: false, producer: true, pattern: new RegExp(`^${UUID}/profile/cover-${UUID}\\.(jpg|png|webp)$`), types: new Set(["image/jpeg", "image/png", "image/webp"]) },
  "event-image": { bucket: "event-public", video: false, producer: true, pattern: new RegExp(`^${UUID}/events/${UUID}\\.(jpg|png|webp|avif)$`), types: IMAGE_TYPES },
};

export function pathFor(kind: MediaKind, userId: string, producerId: string, contentType: string, id: string) {
  const ext = EXTENSION[contentType];
  switch (kind) {
    case "product-image": case "product-video": return `${producerId}/products/${id}.${ext}`;
    case "official-image": case "official-video": return `admin/${userId}/official-products/${id}.${ext}`;
    case "category-image": return `admin/${userId}/categories/${id}.${ext}`;
    case "brand-logo": return `${producerId}/profile/logo-${id}.${ext}`;
    case "brand-cover": return `${producerId}/profile/cover-${id}.${ext}`;
    case "event-image": return `${producerId}/events/${id}.${ext}`;
  }
}
function contentTypeFor(path: string) {
  const lower = path.toLowerCase();
  return lower.endsWith(".jpg") ? "image/jpeg" : lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : lower.endsWith(".avif") ? "image/avif"
    : lower.endsWith(".mp4") ? "video/mp4" : lower.endsWith(".webm") ? "video/webm" : lower.endsWith(".mov") ? "video/quicktime" : "";
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function text(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  try {
    const url = Deno.env.get("SUPABASE_URL") || "", anon = Deno.env.get("SUPABASE_ANON_KEY") || "", serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = req.headers.get("Authorization") || "";
    if (!url || !anon || !serviceKey || !authorization) return json(401, { ok: false, error: "authentication_required" });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const userId = (userData.user?.id || "").toLowerCase();
    if (userError || !UUID_RE.test(userId)) return json(401, { ok: false, error: "authentication_required" });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const action = text(body?.action, 20);
    const kind = text(body?.kind, 30) as MediaKind;
    const rule = KINDS[kind];
    if (!rule) return json(400, { ok: false, error: "media_kind_invalid" });

    const { data: target, error: targetError } = await service.rpc("service_media_cdn_target_v1");
    if (targetError || !target || target.enabled !== true || !target.publicBaseUrl) return json(503, { ok: false, error: "media_storage_not_configured" });
    const accessKeyId = text(Deno.env.get("R2_ACCESS_KEY_ID"), 256), secretAccessKey = text(Deno.env.get("R2_SECRET_ACCESS_KEY"), 256);
    const accountId = text(target.accountId, 64), bucketName = text(target.bucket, 63);
    if (!accessKeyId || !secretAccessKey || !/^[0-9a-f]{32}$/.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName)) {
      return json(503, { ok: false, error: "media_storage_not_configured" });
    }
    // R2_ENDPOINT exists only for the local test; production uses the account endpoint.
    const endpoint = (text(Deno.env.get("R2_ENDPOINT"), 512) || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
    const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const objectUrl = (path: string) => `${endpoint}/${bucketName}/${rule.bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const stagingUrl = (key: string) => {
      if (!STAGING_RE.test(key)) throw new Error("media_staging_key_invalid");
      return `${endpoint}/${bucketName}/${key}`;
    };
    const can = async (permission: string) => {
      const { data, error } = await userClient.rpc("authorization_has_permission_v1", { p_permission_key: permission });
      return !error && data === true;
    };

    if (action === "start") {
      const contentType = text(body?.contentType, 40), size = Number(body?.size);
      if (!rule.types.has(contentType)) return json(400, { ok: false, error: "media_type_invalid" });
      if (!Number.isSafeInteger(size) || size < 1) return json(400, { ok: false, error: "media_size_invalid" });
      let producerId = "";
      if (rule.producer) {
        producerId = text(body?.producerId, 64).toLowerCase();
        if (!UUID_RE.test(producerId)) return json(400, { ok: false, error: "producer_invalid" });
      }
      // Staff folders: the permission the matching save RPC requires.
      if (kind === "official-image" || kind === "official-video") {
        if (!(await can("admin.access")) || !(await can("product.publish"))) return json(403, { ok: false, error: "media_permission_required" });
      } else if (kind === "category-image") {
        if (!(await can("content.update"))) return json(403, { ok: false, error: "media_permission_required" });
      } else if (kind === "brand-logo" || kind === "brand-cover") {
        const { data: producer } = await service.from("producers").select("store_kind").eq("id", producerId).is("deleted_at", null).maybeSingle();
        if (producer?.store_kind === "official" && !(await can("product.publish"))) return json(403, { ok: false, error: "media_permission_required" });
      }
      const path = pathFor(kind, userId, producerId, contentType, crypto.randomUUID());
      const { data: reserved, error: reserveError } = await service.rpc("service_media_direct_reserve_v2", {
        p_user: userId, p_bucket: rule.bucket, p_name: path, p_size: size, p_content_type: contentType,
      });
      if (reserveError) throw reserveError;
      const status = text(reserved?.status, 40) || "invalid_name";
      if (status !== "reserved") {
        const code = status === "budget_full" ? 507 : status === "too_many_pending" || status === "daily_limit" ? 429
          : status === "owner_mismatch" ? 403 : status === "not_configured" ? 503 : 400;
        return json(code, { ok: false, error: status === "not_configured" ? "media_storage_not_configured" : `media_${status}` });
      }
      const signUrl = new URL(stagingUrl(text(reserved?.staging, 80)));
      signUrl.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_SECONDS));
      const signed = await r2.sign(new Request(signUrl, { method: "PUT", headers: { "Content-Type": contentType } }), { aws: { signQuery: true, allHeaders: true } });
      return json(200, { ok: true, bucket: rule.bucket, path, uploadUrl: signed.url, headers: { "Content-Type": contentType }, expiresIn: UPLOAD_URL_SECONDS });
    }

    const path = text(body?.path, 400);
    if (!rule.pattern.test(path)) return json(400, { ok: false, error: "media_path_invalid" });
    const contentType = contentTypeFor(path);

    const removeFromR2 = async (target: string) => {
      const response = await r2.fetch(target, { method: "DELETE" });
      await response.body?.cancel();
      return response.ok || response.status === 404;
    };
    // Two-phase: mark (the row then no longer counts as a usable file), clear
    // R2, drop the row. If R2 fails the marked row stays and the garbage
    // collector finishes the job, so R2 never holds a file the ledger forgot.
    const release = async () => {
      const { data: marked } = await service.rpc("service_media_direct_begin_release_v1", { p_user: userId, p_bucket: rule.bucket, p_name: path });
      if (!marked || typeof marked !== "object") return false;
      const staging = text(marked.staging, 80);
      const cleared = await removeFromR2(objectUrl(path)) && (!staging || await removeFromR2(stagingUrl(staging)));
      if (!cleared) return false;
      await service.rpc("service_media_direct_finish_release_v1", { p_user: userId, p_bucket: rule.bucket, p_name: path });
      return true;
    };

    if (action === "cancel") {
      return (await release()) ? json(200, { ok: true }) : json(409, { ok: false, error: "media_in_use_or_not_owned" });
    }

    if (action === "finish") {
      const reject = async (error: string, status = 400, extra: Record<string, unknown> = {}) => {
        await release().catch(() => false);
        return json(status, { ok: false, error, ...extra });
      };
      const { data: reservation, error: reservationError } = await service.rpc("service_media_direct_reservation_v1", {
        p_user: userId, p_bucket: rule.bucket, p_name: path,
      });
      if (reservationError) throw reservationError;
      if (!reservation || typeof reservation !== "object") return json(404, { ok: false, error: "media_not_reserved" });
      if (reservation.confirmed === true) return json(409, { ok: false, error: "media_already_finished" });
      const staging = text(reservation.staging, 80);
      if (reservation.deleting === true || !STAGING_RE.test(staging)) return json(409, { ok: false, error: "media_reservation_mismatch" });
      const reservedSize = Number(reservation.size);

      // Size first, from the headers only, so an oversized upload is never read.
      const head = await r2.fetch(stagingUrl(staging), { method: "HEAD" });
      await head.body?.cancel();
      if (head.status === 404) return json(404, { ok: false, error: "media_not_uploaded" });
      if (!head.ok) return json(502, { ok: false, error: `media_check_failed_${head.status}` });
      if (Number(head.headers.get("content-length")) !== reservedSize) return reject("media_reservation_mismatch", 409);

      const response = await r2.fetch(stagingUrl(staging), { method: "GET" });
      if (!response.ok) { await response.body?.cancel(); return json(502, { ok: false, error: `media_check_failed_${response.status}` }); }
      const storedType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== reservedSize) return reject("media_reservation_mismatch", 409);
      if (storedType !== contentType || reservation.contentType !== contentType || !extensionMatches(path, contentType)) return reject("media_type_invalid");
      let width: number | null = null, height: number | null = null;
      if (rule.video) {
        if (!videoMagicMatches(bytes.subarray(0, 64), contentType)) return reject("media_content_invalid");
      } else {
        const detected = detectImageMime(bytes);
        if (!detected || detected !== contentType) return reject("media_content_invalid");
        const dimensions = imageDimensions(bytes, detected);
        if (!dimensions) return reject("media_dimensions_unreadable");
        const problem = dimensionProblem(kind, dimensions.width, dimensions.height);
        if (problem) return reject(problem, 400, { width: dimensions.width, height: dimensions.height });
        width = dimensions.width; height = dimensions.height;
      }
      const sha256 = await sha256Hex(bytes);
      // Publish exactly the bytes that were checked, never the staging object itself.
      const put = await r2.fetch(objectUrl(path), {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE, "Content-Length": String(bytes.byteLength) },
      });
      await put.body?.cancel();
      if (!put.ok) return json(502, { ok: false, error: `media_store_failed_${put.status}` });
      await removeFromR2(stagingUrl(staging)).catch(() => false);
      const { data: confirmed, error: confirmError } = await service.rpc("service_media_direct_confirm_v1", {
        p_user: userId, p_bucket: rule.bucket, p_name: path, p_size: bytes.byteLength, p_content_type: contentType,
        p_sha256: sha256, p_width: width, p_height: height,
      });
      if (confirmError) throw confirmError;
      // A size that differs from the reservation (or a too-large file) is refused here.
      if (confirmed !== true) return reject("media_reservation_mismatch", 409);
      return json(200, {
        ok: true, bucket: rule.bucket, path, detectedMime: contentType, byteSize: bytes.byteLength,
        ...(width !== null ? { width, height } : {}),
        ...(kind === "brand-logo" ? { assetKind: "logo" } : kind === "brand-cover" ? { assetKind: "cover" } : {}),
      });
    }

    return json(400, { ok: false, error: "action_invalid" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "media_upload_failed";
    return json(500, { ok: false, error: message.length <= 200 ? message : "media_upload_failed" });
  }
});
