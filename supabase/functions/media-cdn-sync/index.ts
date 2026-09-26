import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { detectImageMime, imageDimensions, sha256Hex } from "../_shared/media_binary.ts";

// Keeps Cloudflare R2 the only home of public media. Called by the pg_cron
// job golden-oremar-media-cdn-sync with the vault secret in
// x-golden-worker-secret, only when the database says there is work.
//
// Each run:
//   1. adopt   - images that still landed in a public Supabase bucket (older
//                app versions, tests) are copied to R2, with their real type,
//                dimensions and SHA-256 recorded;
//   2. offload - once the R2 copy is confirmed, the Supabase copy is deleted;
//   3. collect - unfinished uploads (1 h) and files nothing refers to (seen
//                unreferenced in two scans 72 h apart) are deleted from R2,
//                with their staging key, then from the ledger;
//   4. sweep   - every 6 hours, staging keys (_incoming/<uuid>) older than
//                2 hours are deleted, so a device that uploaded and never
//                called finish cannot leave bytes behind.
// What to do is decided by the database (plan, budget, reference scan); this
// function moves bytes and refuses anything that is not really an image.

const IMMUTABLE = "public, max-age=31536000, immutable";
const DEADLINE_MS = 45_000;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function text(value: unknown, max = 1024) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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
type Ref = { bucket: string; name: string; staging?: string | null };

const STAGING_RE = /^_incoming\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STAGING_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Keys and upload times from a ListObjectsV2 answer (only staging keys). */
export function parseStagingList(xml: string) {
  const items: { key: string; modified: number }[] = [];
  for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []) {
    const key = (block.match(/<Key>([^<]*)<\/Key>/) || [])[1] || "";
    const modified = Date.parse((block.match(/<LastModified>([^<]*)<\/LastModified>/) || [])[1] || "");
    if (STAGING_RE.test(key) && Number.isFinite(modified)) items.push({ key, modified });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const next = (xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/) || [])[1] || "";
  return { items, next: truncated ? next.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'") : "" };
}

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

  const stagingUrl = (key: string) => {
    if (!STAGING_RE.test(key)) throw new Error("media_staging_key_invalid");
    return `${endpoint}/${bucketName}/${key}`;
  };

  const result = { adopted: 0, adoptedBytes: 0, offloaded: 0, collected: 0, deleted: 0, swept: 0, failed: 0, refused: 0, skippedForTime: 0, errors: [] as string[] };
  const note = (message: string) => { if (result.errors.length < 10) result.errors.push(message.slice(0, 200)); };

  const deleteUrl = async (target: string) => {
    const response = await r2.fetch(target, { method: "DELETE" });
    await response.body?.cancel();
    if (!response.ok && response.status !== 404) throw new Error(`r2_delete_${response.status}`);
  };
  // The ledger row goes only after R2 is clear, so the ledger always lists at
  // least what R2 holds. forget refuses confirmed rows that were not marked.
  const deleteFromR2 = async (item: Ref) => {
    await deleteUrl(objectUrl(item.bucket, item.name));
    if (item.staging) await deleteUrl(stagingUrl(item.staging));
    await service.rpc("service_media_cdn_forget_v1", { p_bucket: item.bucket, p_name: item.name });
  };

  // Legacy mirror copies whose source is gone.
  for (const item of (Array.isArray(plan.deletes) ? plan.deletes : []) as Ref[]) {
    try { await deleteFromR2(item); result.deleted++; } catch (error) { result.failed++; note(`delete ${item.name}: ${error instanceof Error ? error.message : error}`); }
  }

  // 1. Adopt.
  const adopted: Ref[] = [];
  for (const item of (Array.isArray(plan.uploads) ? plan.uploads : []) as Upload[]) {
    if (Date.now() - started > DEADLINE_MS) { result.skippedForTime++; continue; }
    // Before the PUT nothing is in R2, so the reservation can go. Once a PUT
    // was attempted it may have landed; the unconfirmed row then stays and the
    // garbage collector deletes the key after an hour (or a retry confirms it).
    let putAttempted = false;
    const fail = async (reason: string) => {
      result.failed++;
      note(`${item.bucket}/${item.name}: ${reason}`);
      await service.rpc("service_media_cdn_fail_v1", { p_bucket: item.bucket, p_name: item.name, p_etag: item.etag, p_reason: reason });
      if (!putAttempted) await service.rpc("service_media_cdn_forget_v1", { p_bucket: item.bucket, p_name: item.name });
    };
    try {
      if (!BUCKETS.has(item.bucket) || !safeObjectName(item.name)) { result.refused++; continue; }
      const { data: reserved, error: reserveError } = await service.rpc("service_media_adopt_reserve_v1", {
        p_bucket: item.bucket, p_name: item.name, p_etag: item.etag, p_size: item.size, p_content_type: item.contentType,
      });
      if (reserveError) { note(`reserve ${item.name}: ${reserveError.message}`); result.failed++; continue; }
      if (reserved !== true) { result.refused++; continue; }

      const { data: blob, error: downloadError } = await service.storage.from(item.bucket).download(item.name);
      if (downloadError || !blob) { await fail("source_download_failed"); continue; }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength !== item.size) { await fail("source_size_changed"); continue; }
      const detected = detectImageMime(bytes);
      if (!detected || detected !== item.contentType) { await fail(`binary_type_mismatch:${detected || "unknown"}`); continue; }
      const dimensions = imageDimensions(bytes, detected);
      if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 20000 || dimensions.height > 20000) { await fail("dimensions_unreadable"); continue; }
      const sha256 = await sha256Hex(bytes);

      putAttempted = true;
      const response = await r2.fetch(objectUrl(item.bucket, item.name), {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": detected, "Cache-Control": IMMUTABLE, "Content-Length": String(bytes.byteLength) },
      });
      await response.body?.cancel();
      if (!response.ok) { await fail(`r2_put_${response.status}`); continue; }
      const { data: confirmed } = await service.rpc("service_media_adopt_confirm_v1", {
        p_bucket: item.bucket, p_name: item.name, p_etag: item.etag, p_sha256: sha256, p_width: dimensions.width, p_height: dimensions.height,
      });
      if (confirmed !== true) { note(`confirm ${item.name}: source changed during copy, will retry`); continue; }
      result.adopted++;
      result.adoptedBytes += bytes.byteLength;
      adopted.push({ bucket: item.bucket, name: item.name });
    } catch (error) {
      await fail(error instanceof Error ? error.message : "adopt_failed").catch(() => undefined);
    }
  }

  // 2. Offload: delete Supabase copies that now live in R2 (this run's and earlier ones).
  const offloads = [...adopted, ...((Array.isArray(plan.offloads) ? plan.offloads : []) as Ref[])];
  if (plan.offloadSources !== false) {
    const byBucket = new Map<string, string[]>();
    for (const item of offloads) {
      if (!BUCKETS.has(item.bucket) || !safeObjectName(item.name)) continue;
      const names = byBucket.get(item.bucket) || [];
      if (!names.includes(item.name)) names.push(item.name);
      byBucket.set(item.bucket, names);
    }
    for (const [bucket, names] of byBucket) {
      const { data: removed, error } = await service.storage.from(bucket).remove(names);
      if (error) { result.failed++; note(`offload ${bucket}: ${error.message}`); continue; }
      result.offloaded += Array.isArray(removed) ? removed.length : 0;
    }
  }

  // 3. Collect garbage: unfinished uploads and files nothing refers to.
  if (Date.now() - started < DEADLINE_MS) {
    const { data: gc, error: gcError } = await service.rpc("service_media_gc_candidates_v2", { p_limit: 50 });
    if (gcError) { result.failed++; note(`gc: ${gcError.message}`); }
    for (const item of ((gc && Array.isArray(gc.delete)) ? gc.delete : []) as Ref[]) {
      try { await deleteFromR2(item); result.collected++; } catch (error) { result.failed++; note(`collect ${item.name}: ${error instanceof Error ? error.message : error}`); }
    }
  }

  // 4. Sweep staging keys nobody finished.
  if (plan.stagingSweepDue === true && Date.now() - started < DEADLINE_MS) {
    let token = "", complete = true;
    do {
      const list = new URL(`${endpoint}/${bucketName}`);
      if (token) list.searchParams.set("continuation-token", token);
      list.searchParams.set("list-type", "2");
      list.searchParams.set("max-keys", "1000");
      list.searchParams.set("prefix", "_incoming/");
      const response = await r2.fetch(list.toString(), { method: "GET" });
      if (!response.ok) { await response.body?.cancel(); complete = false; result.failed++; note(`sweep list: ${response.status}`); break; }
      const page = parseStagingList(await response.text());
      for (const item of page.items) {
        if (Date.now() - item.modified < STAGING_MAX_AGE_MS) continue;
        try { await deleteUrl(stagingUrl(item.key)); result.swept++; } catch (error) { complete = false; result.failed++; note(`sweep ${item.key}: ${error instanceof Error ? error.message : error}`); }
      }
      token = page.next;
      if (token && Date.now() - started > DEADLINE_MS) { complete = false; break; }
    } while (token);
    if (complete) await service.rpc("service_media_staging_swept_v1");
  }

  const status = result.failed ? "partial" : "ok";
  return finish(status, { ...result, budgetBlocked: plan.budgetBlocked ?? 0, storedBytesBefore: plan.mirroredBytes ?? 0, ms: Date.now() - started });
});
