// Runs supabase/functions/media-cdn-sync against local fakes of Supabase and
// R2, and checks every byte and header that would reach Cloudflare.
//
// The fake R2 verifies each request's AWS Signature V4 with its own
// implementation (not aws4fetch), so a signing mistake fails here instead of
// as a 403 in production.
//
//   deno run -A --no-config scripts/media-cdn/sync-local-test.ts
//
// (Deno can be installed without root: npm i deno, then node_modules/.bin/deno)

const SUPA_PORT = 54891, R2_PORT = 54892, FN_PORT = 8000; // Deno.serve default port
const ACCESS = "test-access-key-id", SECRET = "test-secret-access-key";
const WORKER_SECRET = "a".repeat(64);
const ACCOUNT = "05764c9f34befd8e71cffca80a56d26b", BUCKET = "golden-oremar-media";

const webp = new Uint8Array([...new TextEncoder().encode("RIFF"), 30, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 "), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...new TextEncoder().encode("IHDR"), 0, 0, 0, 1, 0, 0, 0, 1, 8, 6]);
const files: Record<string, Uint8Array> = {
  "catalog-public/p1/products/a.webp": webp,
  "catalog-public/p1/products/fake.webp": png, // PNG bytes wearing a .webp label
};

type Scenario = { enabled: boolean; reserveRefuse?: string[] };
let scenario: Scenario = { enabled: true };
const rpcCalls: { name: string; body: Record<string, unknown> }[] = [];
const r2Requests: { method: string; path: string; headers: Headers; body: Uint8Array; signatureOk: boolean; detail: string }[] = [];

function plan() {
  return {
    enabled: scenario.enabled, accountId: ACCOUNT, bucket: BUCKET, mirroredBytes: 100, budgetBytes: 8589934592, budgetBlocked: 0,
    uploads: [
      { bucket: "catalog-public", name: "p1/products/a.webp", etag: "e1", size: webp.length, contentType: "image/webp" },
      { bucket: "catalog-public", name: "p1/products/fake.webp", etag: "e2", size: png.length, contentType: "image/webp" },
      { bucket: "catalog-public", name: "p1/products/refused.webp", etag: "e3", size: 10, contentType: "image/webp" },
      { bucket: "catalog-public", name: "../escape.webp", etag: "e4", size: 10, contentType: "image/webp" },
    ],
    deletes: [{ bucket: "event-public", name: "p1/events/old.webp" }],
  };
}

Deno.serve({ port: SUPA_PORT, onListen() {} }, async req => {
  const url = new URL(req.url);
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
  if (rpc) {
    const body = await req.json().catch(() => ({}));
    rpcCalls.push({ name: rpc, body });
    const reply = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
    if (rpc === "service_validate_media_cdn_worker_v1") return reply(body.p_secret === WORKER_SECRET);
    if (rpc === "service_media_cdn_plan_v1") return reply(plan());
    if (rpc === "service_media_cdn_reserve_v1") return reply(!(scenario.reserveRefuse || []).includes(body.p_name));
    if (rpc === "service_media_cdn_confirm_v1" || rpc === "service_media_cdn_forget_v1") return reply(true);
    return reply(null);
  }
  const object = url.pathname.match(/\/storage\/v1\/object\/(?:authenticated\/)?(.+)$/)?.[1];
  if (object) {
    const bytes = files[decodeURIComponent(object)];
    return bytes ? new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } }) : new Response("{}", { status: 404 });
  }
  return new Response("not found", { status: 404 });
});

// --- independent SigV4 verification -------------------------------------
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (data: Uint8Array | string) => hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
async function verifySigV4(req: Request, body: Uint8Array) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/);
  if (!m) return { ok: false, detail: `bad authorization header: ${auth}` };
  const [, key, date, region, service, signedHeaders, signature] = m;
  if (key !== ACCESS || region !== "auto" || service !== "s3") return { ok: false, detail: `scope ${key}/${region}/${service}` };
  const amzDate = req.headers.get("x-amz-date") || "";
  const payloadHash = req.headers.get("x-amz-content-sha256") || "";
  if (payloadHash !== await sha256(body) && payloadHash !== "UNSIGNED-PAYLOAD") return { ok: false, detail: "payload hash mismatch" };
  const url = new URL(req.url);
  const canonicalHeaders = signedHeaders.split(";").map(h => `${h}:${(req.headers.get(h) || "").trim().replace(/\s+/g, " ")}\n`).join("");
  const canonical = [req.method, url.pathname, url.search.slice(1), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, `${date}/${region}/${service}/aws4_request`, await sha256(canonical)].join("\n");
  let k = await hmac(enc.encode("AWS4" + SECRET), date);
  k = await hmac(k, region); k = await hmac(k, service); k = await hmac(k, "aws4_request");
  const expected = hex(await hmac(k, toSign));
  return { ok: expected === signature, detail: expected === signature ? "signature valid" : "signature mismatch" };
}

Deno.serve({ port: R2_PORT, onListen() {} }, async req => {
  const body = new Uint8Array(await req.arrayBuffer());
  const { ok, detail } = await verifySigV4(req, body);
  r2Requests.push({ method: req.method, path: new URL(req.url).pathname, headers: req.headers, body, signatureOk: ok, detail });
  if (!ok) return new Response("SignatureDoesNotMatch", { status: 403 });
  return new Response(null, { status: req.method === "DELETE" ? 204 : 200 });
});

// --- run the real function in a child process ----------------------------
// The jsr: type-only import is dropped from a temporary copy: it carries no
// runtime code, and jsr.io is not reachable from every sandbox.
const source = await Deno.readTextFile(new URL("../../supabase/functions/media-cdn-sync/index.ts", import.meta.url));
const fnPath = await Deno.makeTempFile({ suffix: ".ts" });
await Deno.writeTextFile(fnPath, source.replace(/^import "jsr:[^"]+";\n/m, ""));
async function startFunction(env: Record<string, string>) {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--no-check", "--no-config", "--node-modules-dir=none", fnPath],
    env: { SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`, SUPABASE_SERVICE_ROLE_KEY: "service", R2_ENDPOINT: `http://127.0.0.1:${R2_PORT}`, PORT: String(FN_PORT), ...env },
    stdout: "null", stderr: "piped",
  }).spawn();
  for (let i = 0; i < 200; i++) {
    try { await fetch(`http://127.0.0.1:${FN_PORT}/`, { method: "GET" }).then(r => r.body?.cancel()); return child; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error("function did not start");
}
const call = (secret: string) => fetch(`http://127.0.0.1:${FN_PORT}/`, { method: "POST", headers: { "x-golden-worker-secret": secret }, body: "{}" }).then(async r => ({ status: r.status, body: await r.json() }));

const results: [boolean, string][] = [];
const check = (ok: boolean, label: string) => results.push([ok, label]);
const reset = (s: Scenario) => { scenario = s; rpcCalls.length = 0; r2Requests.length = 0; };

let child = await startFunction({ R2_ACCESS_KEY_ID: ACCESS, R2_SECRET_ACCESS_KEY: SECRET });

reset({ enabled: true });
let res = await call("wrong".repeat(10));
check(res.status === 401 && r2Requests.length === 0 && rpcCalls.length === 1, `wrong worker secret -> 401, nothing touched (status ${res.status}, r2 ${r2Requests.length}, rpc ${rpcCalls.length})`);

reset({ enabled: false });
res = await call(WORKER_SECRET);
check(res.status === 200 && res.body.status === "disabled" && r2Requests.length === 0, `disabled -> no R2 traffic (${res.body.status})`);

reset({ enabled: true, reserveRefuse: ["p1/products/refused.webp"] });
res = await call(WORKER_SECRET);
const puts = r2Requests.filter(r => r.method === "PUT"), dels = r2Requests.filter(r => r.method === "DELETE");
check(r2Requests.every(r => r.signatureOk), `every R2 request carries a valid SigV4 signature (${r2Requests.map(r => r.detail).join(", ")})`);
check(puts.length === 1 && puts[0].path === `/${BUCKET}/catalog-public/p1/products/a.webp`, `exactly one PUT, to the bucket-prefixed key (${puts.map(p => p.path).join(", ")})`);
check(puts.length === 1 && puts[0].headers.get("content-type") === "image/webp" && puts[0].headers.get("cache-control") === "public, max-age=31536000, immutable", `PUT has image content type and a one-year immutable cache header`);
check(puts.length === 1 && puts[0].body.length === webp.length && puts[0].body.every((b, i) => b === webp[i]), "PUT body is byte-identical to the source");
check(dels.length === 1 && dels[0].path === `/${BUCKET}/event-public/p1/events/old.webp`, `orphan copy deleted (${dels.map(d => d.path).join(", ")})`);
const names = (rpc: string) => rpcCalls.filter(c => c.name === rpc).map(c => String(c.body.p_name));
check(names("service_media_cdn_confirm_v1").join() === "p1/products/a.webp", `only the good image confirmed (${names("service_media_cdn_confirm_v1")})`);
check(names("service_media_cdn_fail_v1").join() === "p1/products/fake.webp" && names("service_media_cdn_forget_v1").includes("p1/products/fake.webp"), "PNG disguised as WebP refused, recorded as failure, reservation released");
check(!names("service_media_cdn_reserve_v1").includes("../escape.webp"), "path-escaping name never even reserved");
check(names("service_media_cdn_forget_v1").includes("p1/events/old.webp"), "deleted copy forgotten in the ledger");
check(res.body.uploaded === 1 && res.body.refused === 2 && res.body.failed === 1 && res.body.deleted === 1 && res.body.status === "partial", `run summary ${JSON.stringify({ u: res.body.uploaded, r: res.body.refused, f: res.body.failed, d: res.body.deleted, s: res.body.status })}`);
check(rpcCalls.some(c => c.name === "service_media_cdn_finish_v1"), "run recorded with finish");
child.kill(); await child.status;

// The verifier itself must be able to say no: a wrong secret has to fail.
child = await startFunction({ R2_ACCESS_KEY_ID: ACCESS, R2_SECRET_ACCESS_KEY: "wrong-secret" });
reset({ enabled: true });
res = await call(WORKER_SECRET);
check(r2Requests.length > 0 && r2Requests.every(r => !r.signatureOk) && res.body.uploaded === 0 && names("service_media_cdn_confirm_v1").length === 0, `wrong R2 secret -> fake R2 rejects every signature, nothing confirmed (${r2Requests.map(r => r.detail).join(", ")})`);
child.kill(); await child.status;

child = await startFunction({ R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "" });
reset({ enabled: true });
res = await call(WORKER_SECRET);
check(res.status === 503 && res.body.status === "not_configured" && r2Requests.length === 0, `missing R2 keys -> 503 not_configured, no R2 traffic (${res.status})`);
child.kill(); await child.status;

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} media-cdn-sync checks passed.`);
Deno.exit(failed ? 1 : 0);
