// Runs supabase/functions/media-video-upload against local fakes of Supabase
// and R2, uploading real bytes through the signed URL it hands out.
//
// The fake R2 checks every signature itself (header-signed and query-signed
// AWS SigV4), so a signing mistake fails here instead of in production.
//
//   deno run -A --no-config scripts/media-cdn/video-upload-local-test.ts

const SUPA_PORT = 54881, R2_PORT = 54882, FN_PORT = 8000; // Deno.serve default port
const ACCESS = "test-access-key-id", SECRET = "test-secret-access-key";
const ACCOUNT = "05764c9f34befd8e71cffca80a56d26b", BUCKET = "golden-oremar-media";
const USER = "11111111-1111-4111-8111-111111111111", PRODUCER = "22222222-2222-4222-8222-222222222222";
const OTHER_PRODUCER = "33333333-3333-4333-8333-333333333333";

const enc = new TextEncoder();
const mp4 = new Uint8Array([0, 0, 0, 24, ...enc.encode("ftypisom"), 0, 0, 2, 0, ...enc.encode("isomiso2"), ...new Uint8Array(200).fill(7)]);
const fakeMp4 = new Uint8Array([...enc.encode("<html>not a video</html>"), ...new Uint8Array(100)]);

let isAdmin = false;
let targetEnabled = true;
let reserveResult = "reserved";
const rpcCalls: { name: string; body: Record<string, unknown> }[] = [];
const objects = new Map<string, { body: Uint8Array; type: string }>();
const r2Log: { method: string; path: string; ok: boolean; detail: string }[] = [];

Deno.serve({ port: SUPA_PORT, onListen() {} }, async req => {
  const url = new URL(req.url);
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (url.pathname === "/auth/v1/user") {
    return req.headers.get("authorization") === "Bearer good-user-jwt" ? reply({ id: USER, aud: "authenticated", role: "authenticated" }) : reply({ message: "invalid" }, 401);
  }
  if (url.pathname === "/rest/v1/producers") {
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const owner = url.searchParams.get("owner_user_id")?.replace(/^eq\./, "");
    const rows = id === PRODUCER && owner === USER ? [{ id: PRODUCER }] : [];
    const wantsObject = (req.headers.get("accept") || "").includes("vnd.pgrst.object");
    if (wantsObject) return rows.length ? reply(rows[0]) : reply({ code: "PGRST116", message: "0 rows" }, 406);
    return reply(rows);
  }
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
  if (rpc) {
    const body = await req.json().catch(() => ({}));
    rpcCalls.push({ name: rpc, body });
    if (rpc === "authorization_has_permission_v1") return reply(isAdmin);
    if (rpc === "service_media_cdn_target_v1") return reply({ enabled: targetEnabled, accountId: ACCOUNT, bucket: BUCKET, publicBaseUrl: "https://pub-test.r2.dev", maxVideoBytes: 52428800 });
    if (rpc === "service_media_video_reserve_v1") return reply(reserveResult);
    if (rpc === "service_media_video_confirm_v1") return reply(body.p_size === mp4.length);
    if (rpc === "service_media_video_releasable_v1" || rpc === "service_media_video_release_v1") return reply(true);
    return reply(null);
  }
  return reply({}, 404);
});

// --- independent SigV4 verification, header and query form ---------------
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (data: Uint8Array | string) => hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
async function signature(date: string, amzDate: string, canonical: string) {
  const toSign = ["AWS4-HMAC-SHA256", amzDate, `${date}/auto/s3/aws4_request`, await sha256(canonical)].join("\n");
  let k = await hmac(enc.encode("AWS4" + SECRET), date);
  k = await hmac(k, "auto"); k = await hmac(k, "s3"); k = await hmac(k, "aws4_request");
  return hex(await hmac(k, toSign));
}
async function verify(req: Request, body: Uint8Array) {
  const url = new URL(req.url);
  const headerSig = (req.headers.get("authorization") || "").match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/);
  if (headerSig) {
    const [, key, date, signed, sig] = headerSig;
    const payload = req.headers.get("x-amz-content-sha256") || "";
    if (key !== ACCESS || (payload !== await sha256(body) && payload !== "UNSIGNED-PAYLOAD")) return { ok: false, detail: "header scope/payload" };
    const headers = signed.split(";").map(h => `${h}:${(req.headers.get(h) || "").trim()}\n`).join("");
    const canonical = [req.method, url.pathname, url.search.slice(1), headers, signed, payload].join("\n");
    const ok = await signature(date, req.headers.get("x-amz-date") || "", canonical) === sig;
    return { ok, detail: ok ? "header signature valid" : "header signature mismatch" };
  }
  const q = url.searchParams;
  const cred = (q.get("X-Amz-Credential") || "").match(/^([^/]+)\/(\d{8})\/auto\/s3\/aws4_request$/);
  if (!cred || cred[1] !== ACCESS) return { ok: false, detail: "no or foreign credential" };
  const amzDate = q.get("X-Amz-Date") || "", expires = Number(q.get("X-Amz-Expires"));
  const issued = Date.UTC(+amzDate.slice(0, 4), +amzDate.slice(4, 6) - 1, +amzDate.slice(6, 8), +amzDate.slice(9, 11), +amzDate.slice(11, 13), +amzDate.slice(13, 15));
  if (!(expires > 0 && expires <= 604800) || Date.now() > issued + expires * 1000) return { ok: false, detail: "expired" };
  const signed = q.get("X-Amz-SignedHeaders") || "";
  const params = [...q.entries()].filter(([k]) => k !== "X-Amz-Signature").map(([k, v]) => [rfc3986(k), rfc3986(v)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
  const headers = signed.split(";").map(h => `${h}:${(req.headers.get(h) || "").trim()}\n`).join("");
  const canonical = [req.method, url.pathname, params, headers, signed, q.get("X-Amz-Content-Sha256") || "UNSIGNED-PAYLOAD"].join("\n");
  const ok = await signature(cred[2], amzDate, canonical) === q.get("X-Amz-Signature");
  return { ok, detail: ok ? `query signature valid (signed: ${signed})` : "query signature mismatch" };
}

Deno.serve({ port: R2_PORT, onListen() {} }, async req => {
  const body = new Uint8Array(await req.arrayBuffer());
  const { ok, detail } = await verify(req, body);
  const path = decodeURIComponent(new URL(req.url).pathname);
  r2Log.push({ method: req.method, path, ok, detail });
  if (!ok) return new Response("SignatureDoesNotMatch", { status: 403 });
  const key = path.replace(`/${BUCKET}/`, "");
  if (req.method === "PUT") { objects.set(key, { body, type: req.headers.get("content-type") || "" }); return new Response(null, { status: 200 }); }
  if (req.method === "DELETE") { objects.delete(key); return new Response(null, { status: 204 }); }
  const object = objects.get(key);
  if (!object) return new Response(null, { status: 404 });
  if (req.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": String(object.body.length), "content-type": object.type } });
  const m = (req.headers.get("range") || "").match(/^bytes=(\d+)-(\d+)$/);
  const part = m ? object.body.slice(+m[1], +m[2] + 1) : object.body;
  return new Response(part, { status: m ? 206 : 200, headers: { "content-type": object.type } });
});

const source = await Deno.readTextFile(new URL("../../supabase/functions/media-video-upload/index.ts", import.meta.url));
const fnPath = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(fnPath, source.replace(/^import "jsr:[^"]+";\n/m, ""));
async function startFunction(env: Record<string, string>) {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--no-check", "--no-config", "--node-modules-dir=none", fnPath],
    env: { SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`, SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", R2_ENDPOINT: `http://127.0.0.1:${R2_PORT}`, ...env },
    stdout: "null", stderr: "piped",
  }).spawn();
  for (let i = 0; i < 300; i++) {
    try { await fetch(`http://127.0.0.1:${FN_PORT}/`, { method: "OPTIONS" }).then(r => r.body?.cancel()); return child; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error("function did not start");
}
const call = (payload: Record<string, unknown>, jwt = "good-user-jwt") => fetch(`http://127.0.0.1:${FN_PORT}/`, {
  method: "POST", headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
}).then(async r => ({ status: r.status, body: await r.json() }));

const results: [boolean, string][] = [];
const check = (ok: boolean, label: string) => results.push([ok, label]);
const names = (rpc: string) => rpcCalls.filter(c => c.name === rpc);

const child = await startFunction({ R2_ACCESS_KEY_ID: ACCESS, R2_SECRET_ACCESS_KEY: SECRET });

let res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: mp4.length }, "bad-jwt");
check(res.status === 401, `no valid session -> 401 (${res.status})`);

res = await call({ action: "start", scope: "producer", producerId: OTHER_PRODUCER, contentType: "video/mp4", size: mp4.length });
check(res.status === 403 && names("service_media_video_reserve_v1").length === 0, `someone else's store -> 403, nothing reserved (${res.status})`);

res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/avi", size: 10 });
check(res.status === 400 && res.body.error === "video_type_invalid", `unsupported type refused (${res.body.error})`);

res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: 52428801 });
check(res.status === 400 && res.body.error === "video_size_invalid", `over 50 MB refused before any upload (${res.body.error})`);

res = await call({ action: "start", scope: "admin", contentType: "video/mp4", size: 100 });
check(res.status === 403, `admin scope without permission -> 403 (${res.status})`);

reserveResult = "budget_full";
res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: mp4.length });
check(res.status === 507 && res.body.error === "video_budget_full", `database says budget full -> 507, no upload URL (${res.body.error})`);
reserveResult = "reserved";

// Happy path: start, upload the real bytes to the signed URL, finish.
res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: mp4.length });
const path = String(res.body.path || "");
check(res.status === 200 && new RegExp(`^${PRODUCER}/products/[0-9a-f-]{36}\\.mp4$`).test(path), `start returns a path in the store's own folder (${path})`);
const reserveCall = names("service_media_video_reserve_v1").at(-1)?.body || {};
check(reserveCall.p_user === USER && reserveCall.p_name === path && reserveCall.p_size === mp4.length && reserveCall.p_content_type === "video/mp4", "the exact path, size and type were reserved for this user");
const upload = new URL(String(res.body.uploadUrl));
check(upload.searchParams.get("X-Amz-Expires") === "600" && upload.pathname === `/${BUCKET}/catalog-public/${path}`, `signed URL is short-lived and points at catalog-public/<path> (${upload.pathname})`);
let put = await fetch(upload, { method: "PUT", headers: { "Content-Type": "video/webm" }, body: mp4 });
await put.body?.cancel();
check(put.status === 403, `uploading with a different content type is rejected by the signature (${put.status})`);
put = await fetch(upload, { method: "PUT", headers: res.body.headers, body: mp4 });
await put.body?.cancel();
check(put.status === 200 && r2Log.at(-1)?.ok === true, `browser-style PUT with the signed URL accepted (${r2Log.at(-1)?.detail})`);
res = await call({ action: "finish", path });
check(res.status === 200 && res.body.ok === true && res.body.byteSize === mp4.length, `finish confirms after checking size, type and ftyp box (${JSON.stringify(res.body)})`);
check(names("service_media_video_confirm_v1").length === 1, "confirmed exactly once");

// A file that is not a video, uploaded under a video type.
res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: fakeMp4.length });
const badPath = String(res.body.path);
put = await fetch(String(res.body.uploadUrl), { method: "PUT", headers: res.body.headers, body: fakeMp4 });
await put.body?.cancel();
res = await call({ action: "finish", path: badPath });
check(res.status === 400 && res.body.error === "video_content_invalid" && !objects.has(`catalog-public/${badPath}`), `HTML disguised as MP4 refused and deleted from R2 (${res.body.error})`);

// Finish without uploading.
res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: 100 });
res = await call({ action: "finish", path: String(res.body.path) });
check(res.status === 404 && res.body.error === "video_not_uploaded", `finish before upload -> 404 (${res.body.error})`);

// Paths the function did not create are never touched.
res = await call({ action: "cancel", path: "../etc/passwd" });
check(res.status === 400 && res.body.error === "video_path_invalid", "path traversal refused");
res = await call({ action: "finish", path: `${PRODUCER}/products/x.exe` });
check(res.status === 400, "non-video path refused");

// Cancel removes the caller's unused upload.
res = await call({ action: "cancel", path });
check(res.status === 200 && !objects.has(`catalog-public/${path}`) && names("service_media_video_release_v1").length >= 1, "cancel deletes from R2, then releases the ledger");

check(r2Log.filter(r => r.method !== "PUT" || r.ok).every(r => r.ok), `every request the function itself made was correctly signed (${[...new Set(r2Log.map(r => r.detail))].join(", ")})`);

// Not configured: no URL is handed out.
targetEnabled = false;
res = await call({ action: "start", scope: "producer", producerId: PRODUCER, contentType: "video/mp4", size: 100 });
check(res.status === 503 && res.body.error === "video_storage_not_configured", `CDN switched off -> 503 (${res.body.error})`);

child.kill(); await child.status;
const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} media-video-upload checks passed.`);
Deno.exit(failed ? 1 : 0);
