// Runs supabase/functions/media-upload against local fakes of Supabase and
// R2, uploading real bytes through the signed URLs it hands out, for every
// kind of public media: product, official, category, brand logo/cover, event
// images and product videos.
//
// The fake R2 checks every signature itself (header-signed and query-signed
// AWS SigV4), so a signing mistake fails here instead of in production.
//
//   deno run -A --no-config scripts/media-cdn/media-upload-local-test.ts

import { bundleFunction, startFakeR2, type R2Log } from "./fakes.ts";

const SUPA_PORT = 54871, R2_PORT = 54872, FN_PORT = 8000; // Deno.serve default port
const USER = "11111111-1111-4111-8111-111111111111", PRODUCER = "22222222-2222-4222-8222-222222222222", OFFICIAL = "44444444-4444-4444-8444-444444444444";

const enc = new TextEncoder();
// Minimal PNG: signature + IHDR with the given size. Enough for type and
// dimension detection, which is all the function reads.
function png(width: number, height: number) {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...enc.encode("IHDR")]);
  new DataView(b.buffer).setUint32(16, width); new DataView(b.buffer).setUint32(20, height);
  return b;
}
const mp4 = new Uint8Array([0, 0, 0, 24, ...enc.encode("ftypisom"), 0, 0, 2, 0, ...enc.encode("isomiso2"), ...new Uint8Array(200).fill(7)]);
const html = enc.encode("<html>" + "x".repeat(100) + "</html>");

const perms = new Set<string>();
let targetEnabled = true;
let reserveResult = "reserved";
type Row = { size: number; contentType: string; staging: string; confirmed: boolean; deleting: boolean };
const ledger = new Map<string, Row>();
const rpcCalls: { name: string; body: Record<string, any> }[] = [];

Deno.serve({ port: SUPA_PORT, onListen() {} }, async req => {
  const url = new URL(req.url);
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (url.pathname === "/auth/v1/user") {
    return req.headers.get("authorization") === "Bearer good-user-jwt" ? reply({ id: USER, aud: "authenticated", role: "authenticated" }) : reply({ message: "invalid" }, 401);
  }
  if (url.pathname === "/rest/v1/producers") {
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const row = id === OFFICIAL ? { store_kind: "official" } : id === PRODUCER ? { store_kind: "independent" } : null;
    const wantsObject = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
    if (wantsObject) return row ? reply(row) : reply({ code: "PGRST116" }, 406);
    return reply(row ? [row] : []);
  }
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
  if (rpc) {
    const body = await req.json().catch(() => ({}));
    rpcCalls.push({ name: rpc, body });
    if (rpc === "authorization_has_permission_v1") return reply(perms.has(body.p_permission_key));
    if (rpc === "service_media_cdn_target_v1") return reply({ enabled: targetEnabled, accountId: "05764c9f34befd8e71cffca80a56d26b", bucket: "golden-oremar-media", publicBaseUrl: "https://pub-test.r2.dev", maxVideoBytes: 52428800 });
    const row = ledger.get(body.p_name);
    if (rpc === "service_media_direct_reserve_v2") {
      if (reserveResult !== "reserved") return reply({ status: reserveResult });
      const staging = `_incoming/${crypto.randomUUID()}`;
      ledger.set(body.p_name, { size: body.p_size, contentType: body.p_content_type, staging, confirmed: false, deleting: false });
      return reply({ status: "reserved", staging });
    }
    if (rpc === "service_media_direct_reservation_v1") return reply(row ? { size: row.size, contentType: row.contentType, staging: row.staging || null, confirmed: row.confirmed, deleting: row.deleting } : null);
    if (rpc === "service_media_direct_confirm_v1") {
      const ok = !!row && !row.confirmed && !row.deleting && row.size === body.p_size && row.contentType === body.p_content_type && /^[0-9a-f]{64}$/.test(body.p_sha256);
      if (ok) { row!.confirmed = true; row!.staging = ""; }
      return reply(ok);
    }
    if (rpc === "service_media_direct_begin_release_v1") {
      if (!row) return reply(null);
      row.deleting = true; row.confirmed = false;
      return reply({ bucket: body.p_bucket, name: body.p_name, staging: row.staging || null });
    }
    if (rpc === "service_media_direct_finish_release_v1") return reply(row?.deleting ? ledger.delete(body.p_name) : false);
    return reply(null);
  }
  return reply({}, 404);
});

const r2 = startFakeR2(R2_PORT);
const fnPath = await bundleFunction("media-upload");
const child = new Deno.Command(Deno.execPath(), {
  args: ["run", "-A", "--no-check", "--no-config", "--node-modules-dir=none", fnPath],
  env: { SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`, SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", R2_ENDPOINT: `http://127.0.0.1:${R2_PORT}`, R2_ACCESS_KEY_ID: r2.access, R2_SECRET_ACCESS_KEY: r2.secret },
  stdout: "null", stderr: "inherit",
}).spawn();
for (let i = 0; i < 300; i++) {
  try { await fetch(`http://127.0.0.1:${FN_PORT}/`, { method: "OPTIONS" }).then(r => r.body?.cancel()); break; } catch { await new Promise(r => setTimeout(r, 100)); }
}

const call = (payload: Record<string, unknown>, jwt = "good-user-jwt") => fetch(`http://127.0.0.1:${FN_PORT}/`, {
  method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
}).then(async r => ({ status: r.status, body: await r.json() }));
async function upload(kind: string, bytes: Uint8Array, contentType: string, extra: Record<string, unknown> = {}, putBytes = bytes) {
  const start = await call({ action: "start", kind, contentType, size: bytes.length, ...extra });
  if (start.status !== 200) return { start, finish: null as any };
  const put = await fetch(start.body.uploadUrl, { method: "PUT", headers: start.body.headers, body: putBytes });
  await put.body?.cancel();
  const finish = await call({ action: "finish", kind, path: start.body.path });
  return { start, finish, put };
}

const results: [boolean, string][] = [];
const check = (ok: boolean, label: string) => results.push([ok, label]);
const last = (rpc: string) => rpcCalls.filter(c => c.name === rpc).at(-1)?.body || {};

let res = await call({ action: "start", kind: "product-image", producerId: PRODUCER, contentType: "image/png", size: 10 }, "bad");
check(res.status === 401, `no session -> 401 (${res.status})`);
res = await call({ action: "start", kind: "anything", contentType: "image/png", size: 10 });
check(res.status === 400 && res.body.error === "media_kind_invalid", "unknown kind refused");
res = await call({ action: "start", kind: "brand-logo", producerId: PRODUCER, contentType: "image/avif", size: 10 });
check(res.status === 400 && res.body.error === "media_type_invalid", "AVIF refused for brand assets (same rule as before)");

// Product image: happy path, real signed PUT, verified by its bytes.
let u = await upload("product-image", png(1600, 1200), "image/png", { producerId: PRODUCER });
check(u.start.status === 200 && new RegExp(`^${PRODUCER}/products/[0-9a-f-]{36}\\.png$`).test(u.start.body.path) && u.start.body.bucket === "catalog-public", `product image path in the store's folder (${u.start.body.path})`);
check(last("service_media_direct_reserve_v2").p_user === USER && last("service_media_direct_reserve_v2").p_bucket === "catalog-public", "reserved for this user in catalog-public");
check(u.finish?.status === 200 && u.finish.body.width === 1600 && u.finish.body.height === 1200 && u.finish.body.detectedMime === "image/png", `finish reports real dimensions (${JSON.stringify(u.finish?.body)})`);
check(/^[0-9a-f]{64}$/.test(last("service_media_direct_confirm_v1").p_sha256) && last("service_media_direct_confirm_v1").p_width === 1600, "confirm carries SHA-256 and dimensions");
check(new URL(u.start.body.uploadUrl).pathname.startsWith("/golden-oremar-media/_incoming/") && !u.start.body.uploadUrl.includes(u.start.body.path), "the signed URL points at a staging key, never at the public name");
check(r2.log.some((l: R2Log) => l.method === "PUT" && !l.fromFunction && l.path.startsWith("/golden-oremar-media/_incoming/") && l.detail.includes("content-type;host")), "device upload lands on the staging key, content type signed");
const stored = r2.objects.get(`catalog-public/${u.start.body.path}`);
check(!!stored && stored.cacheControl === "public, max-age=31536000, immutable" && stored.type === "image/png", "checked bytes written to <bucket>/catalog-public/<path>, cacheable for a year");
check(![...r2.objects.keys()].some(k => k.startsWith("_incoming/")), "staging key deleted after finish");
check(ledger.get(u.start.body.path)?.confirmed === true && ledger.get(u.start.body.path)?.staging === "", "ledger confirmed, staging key cleared");

// Swapping the file after the check: the signed URL still works for a few
// minutes, but only reaches the staging key, never the public file.
const swap = await fetch(u.start.body.uploadUrl, { method: "PUT", headers: u.start.body.headers, body: html });
await swap.body?.cancel();
check(r2.objects.get(`catalog-public/${u.start.body.path}`)?.body.length === 64 && r2.objects.get(`catalog-public/${u.start.body.path}`)?.body[0] === 0x89, "a second PUT after finish cannot change the published file");
res = await call({ action: "finish", kind: "product-image", path: u.start.body.path });
check(res.status === 409 && res.body.error === "media_already_finished", "finish twice -> 409, nothing re-read");
// That late PUT left a staging object; the media-cdn-sync staging sweep deletes it
// (sync-local-test). Remove it here so the leftover check below is about refusals.
const swapKey = decodeURIComponent(new URL(u.start.body.uploadUrl).pathname).replace("/golden-oremar-media/", "");
check(r2.objects.has(swapKey), "the late PUT only created a staging object");
r2.objects.delete(swapKey);

// Too small for a product image: refused and removed.
u = await upload("product-image", png(1000, 1000), "image/png", { producerId: PRODUCER });
check(u.finish?.status === 400 && u.finish.body.error === "catalog_media_dimensions_invalid" && !r2.objects.has(`catalog-public/${u.start.body.path}`), `1000x1000 product image refused and deleted (${u.finish?.body.error})`);

// Disguised file.
u = await upload("product-image", html, "image/png", { producerId: PRODUCER });
check(u.finish?.status === 400 && u.finish.body.error === "media_content_invalid" && !r2.objects.has(`catalog-public/${u.start.body.path}`), "HTML disguised as PNG refused and deleted");

// Uploading more bytes than reserved.
u = await upload("product-image", png(1600, 1200), "image/png", { producerId: PRODUCER }, new Uint8Array([...png(1600, 1200), 1, 2, 3]));
check(u.finish?.status === 409 && u.finish.body.error === "media_reservation_mismatch" && !r2.objects.has(`catalog-public/${u.start.body.path}`), "a file larger than reserved is refused and deleted");

// Wrong content type at PUT time.
const start = await call({ action: "start", kind: "product-image", producerId: PRODUCER, contentType: "image/png", size: 64 });
const put = await fetch(start.body.uploadUrl, { method: "PUT", headers: { "Content-Type": "text/html" }, body: html });
await put.body?.cancel();
check(put.status === 403, `PUT with another content type rejected by the signature (${put.status})`);

// Official product image needs admin.access + product.publish.
res = await call({ action: "start", kind: "official-image", contentType: "image/webp", size: 10 });
check(res.status === 403, `official image without permission -> 403 (${res.status})`);
perms.add("admin.access"); perms.add("product.publish");
u = await upload("official-image", png(2000, 1500), "image/png");
check(u.finish?.status === 200 && new RegExp(`^admin/${USER}/official-products/`).test(u.start.body.path), `official image in the caller's admin folder (${u.start.body.path})`);

// Category image needs content.update; path under admin/<uid>/categories.
res = await call({ action: "start", kind: "category-image", contentType: "image/png", size: 64 });
check(res.status === 403, "category image without content.update -> 403");
perms.add("content.update");
u = await upload("category-image", png(1400, 1400), "image/png");
check(u.finish?.status === 200 && new RegExp(`^admin/${USER}/categories/`).test(u.start.body.path), `category image accepted (${u.start.body.path})`);

// Brand logo for the official store requires product.publish; square rule.
perms.delete("product.publish");
res = await call({ action: "start", kind: "brand-logo", producerId: OFFICIAL, contentType: "image/png", size: 64 });
check(res.status === 403, "official store logo without product.publish -> 403");
perms.add("product.publish");
u = await upload("brand-logo", png(1024, 1024), "image/png", { producerId: OFFICIAL });
check(u.finish?.status === 200 && u.finish.body.assetKind === "logo" && new RegExp(`^${OFFICIAL}/profile/logo-`).test(u.start.body.path), `logo accepted with assetKind=logo (${u.start.body.path})`);
u = await upload("brand-logo", png(1024, 1000), "image/png", { producerId: PRODUCER });
check(u.finish?.status === 400 && u.finish.body.error === "store_branding_logo_dimensions_invalid", "non-square logo refused");
u = await upload("brand-cover", png(1500, 600), "image/png", { producerId: PRODUCER });
check(u.finish?.status === 200 && u.finish.body.assetKind === "cover", "1500x600 cover accepted");
u = await upload("brand-cover", png(1500, 700), "image/png", { producerId: PRODUCER });
check(u.finish?.status === 400 && u.finish.body.error === "store_branding_cover_dimensions_invalid", "cover with the wrong ratio refused");

// Event image lives in event-public.
u = await upload("event-image", png(1920, 1080), "image/png", { producerId: PRODUCER });
check(u.finish?.status === 200 && u.start.body.bucket === "event-public" && r2.objects.has(`event-public/${u.start.body.path}`), `event image stored under event-public (${u.start.body.path})`);

// Videos.
u = await upload("product-video", mp4, "video/mp4", { producerId: PRODUCER });
check(u.finish?.status === 200 && u.finish.body.width === undefined && /\.mp4$/.test(u.start.body.path), "product video accepted");
u = await upload("product-video", html, "video/mp4", { producerId: PRODUCER });
check(u.finish?.status === 400 && u.finish.body.error === "media_content_invalid", "HTML disguised as MP4 refused");

// Database refusals come back as clear codes.
reserveResult = "budget_full";
res = await call({ action: "start", kind: "product-video", producerId: PRODUCER, contentType: "video/mp4", size: 100 });
check(res.status === 507 && res.body.error === "media_budget_full", "budget full -> 507");
reserveResult = "owner_mismatch";
res = await call({ action: "start", kind: "product-image", producerId: PRODUCER, contentType: "image/png", size: 100 });
check(res.status === 403 && res.body.error === "media_owner_mismatch", "not the store owner (database check) -> 403");
reserveResult = "daily_limit";
res = await call({ action: "start", kind: "product-image", producerId: PRODUCER, contentType: "image/png", size: 100 });
check(res.status === 429 && res.body.error === "media_daily_limit", "daily upload limit -> 429");
reserveResult = "reserved";

// Finish before the upload arrived: nothing to check, reservation kept for a retry.
res = await call({ action: "start", kind: "product-image", producerId: PRODUCER, contentType: "image/png", size: 64 });
const early = await call({ action: "finish", kind: "product-image", path: res.body.path });
check(early.status === 404 && early.body.error === "media_not_uploaded" && ledger.has(res.body.path), "finish before upload -> 404, reservation kept");
const cancelEarly = await call({ action: "cancel", kind: "product-image", path: res.body.path });
check(cancelEarly.status === 200 && !ledger.has(res.body.path), "cancel with nothing uploaded releases the reservation");

// Someone else's path.
res = await call({ action: "finish", kind: "product-image", path: `${PRODUCER}/products/${crypto.randomUUID()}.png` });
check(res.status === 404 && res.body.error === "media_not_reserved", "finish on a path with no reservation -> 404");

// Paths the function did not create are refused.
res = await call({ action: "cancel", kind: "product-image", path: "../x.png" });
check(res.status === 400 && res.body.error === "media_path_invalid", "path traversal refused");
res = await call({ action: "finish", kind: "event-image", path: `${PRODUCER}/products/${crypto.randomUUID()}.png` });
check(res.status === 400, "a product path cannot be finished as an event image");

// Cancel.
u = await upload("product-image", png(1600, 1200), "image/png", { producerId: PRODUCER });
res = await call({ action: "cancel", kind: "product-image", path: u.start.body.path });
check(res.status === 200 && !r2.objects.has(`catalog-public/${u.start.body.path}`) && !ledger.has(u.start.body.path), "cancel removes the caller's unused upload, R2 first, then the ledger");
const leftovers = [...r2.objects.keys()].filter(k => k.startsWith("_incoming/"));
check(leftovers.length === 0, `no staging key left behind by any refusal or cancel (${leftovers.join(", ") || "none"})`);

check(r2.log.filter(l => l.fromFunction).every(l => l.ok), `every request the function made was correctly signed (${[...new Set(r2.log.map(l => l.detail))].join(", ")})`);

targetEnabled = false;
res = await call({ action: "start", kind: "product-image", producerId: PRODUCER, contentType: "image/png", size: 10 });
check(res.status === 503 && res.body.error === "media_storage_not_configured", "not configured -> 503");

child.kill(); await child.status;
const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} media-upload checks passed.`);
Deno.exit(failed ? 1 : 0);
