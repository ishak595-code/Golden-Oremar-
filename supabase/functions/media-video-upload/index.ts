import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { AwsClient } from "npm:aws4fetch@1.0.20";

// Product videos go straight from the uploader's device to Cloudflare R2 and
// never touch Supabase Storage (migration direct_r2_product_video_v1).
//
//   POST { action: "start", scope: "producer", producerId, contentType, size }
//   POST { action: "start", scope: "admin", contentType, size }
//     -> { ok, path, uploadUrl, headers }   (signed PUT, valid 10 minutes)
//   POST { action: "finish", path }
//     -> { ok, path }   after size, type and magic bytes were checked in R2
//   POST { action: "cancel", path }
//     -> { ok }         removes an unused upload of the caller
//
// Who may upload is decided exactly like catalog-media-verify: the verified,
// active owner of a producer store for its own folder, or a staff member with
// admin.access and product.publish for their own admin folder. The database
// re-checks ownership and the budget when it reserves the bytes.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-golden-device-id", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTENSION: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const UPLOAD_URL_SECONDS = 600;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function text(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
// What the first bytes of each allowed container look like.
export function videoMagicMatches(bytes: Uint8Array, contentType: string) {
  if (contentType === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (bytes.length < 8) return false;
  const box = ascii(bytes, 4, 4);
  if (contentType === "video/mp4") return box === "ftyp";
  if (contentType === "video/quicktime") return ["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"].includes(box);
  return false;
}
export function directVideoPathOk(path: string) {
  return /^([0-9a-f-]{36}\/products|admin\/[0-9a-f-]{36}\/official-products)\/[0-9a-f-]{36}\.(mp4|webm|mov)$/.test(path);
}
function contentTypeFor(path: string) {
  return path.endsWith(".mp4") ? "video/mp4" : path.endsWith(".webm") ? "video/webm" : path.endsWith(".mov") ? "video/quicktime" : "";
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

    const { data: target, error: targetError } = await service.rpc("service_media_cdn_target_v1");
    if (targetError || !target || target.enabled !== true || !target.publicBaseUrl) return json(503, { ok: false, error: "video_storage_not_configured" });
    const accessKeyId = text(Deno.env.get("R2_ACCESS_KEY_ID"), 256), secretAccessKey = text(Deno.env.get("R2_SECRET_ACCESS_KEY"), 256);
    const accountId = text(target.accountId, 64), bucketName = text(target.bucket, 63);
    if (!accessKeyId || !secretAccessKey || !/^[0-9a-f]{32}$/.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName)) {
      return json(503, { ok: false, error: "video_storage_not_configured" });
    }
    // R2_ENDPOINT exists only for the local test; production uses the account endpoint.
    const endpoint = (text(Deno.env.get("R2_ENDPOINT"), 512) || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
    const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const objectUrl = (path: string) => `${endpoint}/${bucketName}/catalog-public/${path.split("/").map(encodeURIComponent).join("/")}`;

    if (action === "start") {
      const contentType = text(body?.contentType, 40), size = Number(body?.size);
      const extension = EXTENSION[contentType];
      if (!extension) return json(400, { ok: false, error: "video_type_invalid" });
      if (!Number.isSafeInteger(size) || size < 1 || size > Number(target.maxVideoBytes || 0)) return json(400, { ok: false, error: "video_size_invalid", maxBytes: target.maxVideoBytes });
      let path = "";
      if (body?.scope === "producer") {
        const producerId = text(body?.producerId, 64).toLowerCase();
        if (!UUID_RE.test(producerId)) return json(400, { ok: false, error: "producer_invalid" });
        const { data: producer, error: producerError } = await service.from("producers").select("id").eq("id", producerId).eq("owner_user_id", userId)
          .eq("status", "active").eq("is_verified", true).eq("origin_verified", true).is("deleted_at", null).maybeSingle();
        if (producerError || !producer) return json(403, { ok: false, error: "video_owner_required" });
        path = `${producerId}/products/${crypto.randomUUID()}.${extension}`;
      } else if (body?.scope === "admin") {
        const [{ data: adminAccess, error: adminError }, { data: publishAccess, error: publishError }] = await Promise.all([
          userClient.rpc("authorization_has_permission_v1", { p_permission_key: "admin.access" }),
          userClient.rpc("authorization_has_permission_v1", { p_permission_key: "product.publish" }),
        ]);
        if (adminError || publishError || adminAccess !== true || publishAccess !== true) return json(403, { ok: false, error: "video_owner_permission_required" });
        path = `admin/${userId}/official-products/${crypto.randomUUID()}.${extension}`;
      } else {
        return json(400, { ok: false, error: "video_scope_invalid" });
      }
      const { data: reserved, error: reserveError } = await service.rpc("service_media_video_reserve_v1", { p_user: userId, p_name: path, p_size: size, p_content_type: contentType });
      if (reserveError) throw reserveError;
      if (reserved !== "reserved") return json(reserved === "budget_full" ? 507 : reserved === "too_many_pending" ? 429 : 400, { ok: false, error: `video_${reserved}` });
      const signUrl = new URL(objectUrl(path));
      signUrl.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_SECONDS));
      const signed = await r2.sign(new Request(signUrl, { method: "PUT", headers: { "Content-Type": contentType } }), { aws: { signQuery: true, allHeaders: true } });
      return json(200, { ok: true, path, uploadUrl: signed.url, headers: { "Content-Type": contentType }, expiresIn: UPLOAD_URL_SECONDS });
    }

    const path = text(body?.path, 300);
    if (!directVideoPathOk(path)) return json(400, { ok: false, error: "video_path_invalid" });
    const contentType = contentTypeFor(path);

    const removeFromR2 = async () => {
      const response = await r2.fetch(objectUrl(path), { method: "DELETE" });
      await response.body?.cancel();
      return response.ok || response.status === 404;
    };

    if (action === "cancel") {
      const { data: releasable } = await service.rpc("service_media_video_releasable_v1", { p_user: userId, p_name: path });
      if (releasable !== true) return json(409, { ok: false, error: "video_in_use_or_not_owned" });
      if (!(await removeFromR2())) return json(502, { ok: false, error: "video_delete_failed" });
      await service.rpc("service_media_video_release_v1", { p_user: userId, p_name: path });
      return json(200, { ok: true });
    }

    if (action === "finish") {
      const reject = async (error: string, status = 400) => {
        const { data: releasable } = await service.rpc("service_media_video_releasable_v1", { p_user: userId, p_name: path });
        if (releasable === true && await removeFromR2()) await service.rpc("service_media_video_release_v1", { p_user: userId, p_name: path });
        return json(status, { ok: false, error });
      };
      const head = await r2.fetch(objectUrl(path), { method: "HEAD" });
      await head.body?.cancel();
      if (head.status === 404) return json(404, { ok: false, error: "video_not_uploaded" });
      if (!head.ok) return json(502, { ok: false, error: `video_check_failed_${head.status}` });
      const size = Number(head.headers.get("content-length"));
      const storedType = (head.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!Number.isSafeInteger(size) || size < 1 || size > Number(target.maxVideoBytes || 0)) return reject("video_size_invalid");
      if (storedType !== contentType) return reject("video_type_invalid");
      const range = await r2.fetch(objectUrl(path), { method: "GET", headers: { Range: "bytes=0-63" } });
      const first = new Uint8Array(await range.arrayBuffer());
      if (!range.ok || !videoMagicMatches(first, contentType)) return reject("video_content_invalid");
      const { data: confirmed, error: confirmError } = await service.rpc("service_media_video_confirm_v1", { p_user: userId, p_name: path, p_size: size, p_content_type: contentType });
      if (confirmError) throw confirmError;
      if (confirmed !== true) return reject("video_reservation_mismatch", 409);
      return json(200, { ok: true, path, byteSize: size });
    }

    return json(400, { ok: false, error: "action_invalid" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "video_upload_failed";
    return json(500, { ok: false, error: message.length <= 200 ? message : "video_upload_failed" });
  }
});
