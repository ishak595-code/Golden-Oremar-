import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { AwsClient } from "npm:aws4fetch@1.0.20";

// Copies public images from Supabase Storage to Cloudflare R2 and removes
// copies whose source is gone. Called only by the pg_cron job
// golden-oremar-media-cdn-sync (see migration add_media_cdn_mirror_v1), which
// sends the vault secret in x-golden-worker-secret.
//
// Every decision about WHAT to copy is made by the database (plan, budget,
// reservation). This function only moves bytes, and it re-checks the bytes
// themselves: an object whose content is not really the image type it claims
// is refused, so R2 never hosts anything but images.
//
// Secrets: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (Edge Function secrets).
// Account id and bucket name are not secret and come from the plan.

const IMMUTABLE = "public, max-age=31536000, immutable";
const DEADLINE_MS = 45_000;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function text(value: unknown, max = 1024) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
function equal(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}
// Same magic-byte rules as catalog-media-verify.
export function detectMime(bytes: Uint8Array) {
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

const BUCKETS = new Set(["catalog-public", "content-public", "event-public"]);
// Mirrors private.media_cdn_sources_v1: never a name that could leave its prefix.
export function safeObjectName(name: string) {
  return name.length >= 1 && name.length <= 1024 && !/(^\/|\/\/|\/$|(^|\/)\.{1,2}(\/|$)|[\\\u0000-\u001f\u007f])/.test(name);
}
export function r2Key(bucket: string, name: string) {
  if (!BUCKETS.has(bucket) || !safeObjectName(name)) throw new Error("media_cdn_key_invalid");
  return `${bucket}/${name}`.split("/").map(encodeURIComponent).join("/");
}

type Upload = { bucket: string; name: string; etag: string; size: number; contentType: string };
type Removal = { bucket: string; name: string };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const started = Date.now();
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return json(500, { ok: false, error: "service_runtime_credentials_missing" });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const secret = text(req.headers.get("x-golden-worker-secret"), 256);
  const { data: valid, error: validError } = await service.rpc("service_validate_media_cdn_worker_v1", { p_secret: secret });
  if (validError || valid !== true) return json(401, { ok: false, error: "worker_secret_invalid" });

  const finish = async (status: string, detail: Record<string, unknown>, httpStatus = 200) => {
    await service.rpc("service_media_cdn_finish_v1", { p_status: status, p_detail: detail });
    return json(httpStatus, { ok: httpStatus < 400, status, ...detail });
  };

  const accessKeyId = text(Deno.env.get("R2_ACCESS_KEY_ID"), 256);
  const secretAccessKey = text(Deno.env.get("R2_SECRET_ACCESS_KEY"), 256);
  if (!accessKeyId || !secretAccessKey) return finish("not_configured", { error: "r2_credentials_missing" }, 503);

  const { data: plan, error: planError } = await service.rpc("service_media_cdn_plan_v1", { p_limit: null });
  if (planError || !plan || typeof plan !== "object") return finish("plan_failed", { error: planError?.message || "plan_invalid" }, 500);
  if (plan.enabled !== true) return json(200, { ok: true, status: "disabled" });
  const accountId = text(plan.accountId, 64), bucketName = text(plan.bucket, 63);
  if (!/^[0-9a-f]{32}$/.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName)) return finish("not_configured", { error: "r2_target_invalid" }, 503);

  // R2_ENDPOINT exists only so the function can be tested against a local
  // server. Production uses the account's S3 endpoint.
  const endpoint = (text(Deno.env.get("R2_ENDPOINT"), 512) || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const objectUrl = (bucket: string, name: string) => `${endpoint}/${bucketName}/${r2Key(bucket, name)}`;

  const result = { uploaded: 0, uploadedBytes: 0, deleted: 0, failed: 0, refused: 0, skippedForTime: 0, errors: [] as string[] };
  const note = (message: string) => { if (result.errors.length < 10) result.errors.push(message.slice(0, 200)); };

  for (const item of (Array.isArray(plan.deletes) ? plan.deletes : []) as Removal[]) {
    try {
      const response = await r2.fetch(objectUrl(item.bucket, item.name), { method: "DELETE" });
      if (response.ok || response.status === 404) {
        await service.rpc("service_media_cdn_forget_v1", { p_bucket: item.bucket, p_name: item.name });
        result.deleted++;
      } else {
        result.failed++;
        note(`delete ${item.bucket}/${item.name}: ${response.status}`);
      }
      await response.body?.cancel();
    } catch (error) {
      result.failed++;
      note(`delete ${item.bucket}/${item.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const item of (Array.isArray(plan.uploads) ? plan.uploads : []) as Upload[]) {
    if (Date.now() - started > DEADLINE_MS) { result.skippedForTime++; continue; }
    const fail = async (reason: string) => {
      result.failed++;
      note(`${item.bucket}/${item.name}: ${reason}`);
      await service.rpc("service_media_cdn_fail_v1", { p_bucket: item.bucket, p_name: item.name, p_etag: item.etag, p_reason: reason });
      await service.rpc("service_media_cdn_forget_v1", { p_bucket: item.bucket, p_name: item.name });
    };
    try {
      if (!BUCKETS.has(item.bucket) || !safeObjectName(item.name)) { result.refused++; continue; }
      const { data: reserved, error: reserveError } = await service.rpc("service_media_cdn_reserve_v1", {
        p_bucket: item.bucket, p_name: item.name, p_etag: item.etag, p_size: item.size, p_content_type: item.contentType,
      });
      if (reserveError) { note(`reserve ${item.name}: ${reserveError.message}`); result.failed++; continue; }
      if (reserved !== true) { result.refused++; continue; }

      const { data: blob, error: downloadError } = await service.storage.from(item.bucket).download(item.name);
      if (downloadError || !blob) { await fail("source_download_failed"); continue; }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength !== item.size) { await fail("source_size_changed"); continue; }
      const detected = detectMime(bytes);
      if (!detected || detected !== item.contentType) { await fail(`binary_type_mismatch:${detected || "unknown"}`); continue; }

      const response = await r2.fetch(objectUrl(item.bucket, item.name), {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": detected, "Cache-Control": IMMUTABLE, "Content-Length": String(bytes.byteLength) },
      });
      await response.body?.cancel();
      if (!response.ok) { await fail(`r2_put_${response.status}`); continue; }
      const { data: confirmed } = await service.rpc("service_media_cdn_confirm_v1", { p_bucket: item.bucket, p_name: item.name, p_etag: item.etag });
      if (confirmed !== true) note(`confirm ${item.name}: source changed during copy, will retry`);
      result.uploaded++;
      result.uploadedBytes += bytes.byteLength;
    } catch (error) {
      await fail(error instanceof Error ? error.message : "upload_failed").catch(() => undefined);
    }
  }

  const status = result.failed ? "partial" : "ok";
  return finish(status, { ...result, budgetBlocked: plan.budgetBlocked ?? 0, mirroredBytesBefore: plan.mirroredBytes ?? 0, ms: Date.now() - started });
});
