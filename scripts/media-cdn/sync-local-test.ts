// Runs supabase/functions/media-cdn-sync against local fakes of Supabase and
// R2: adopting files that still landed in Supabase Storage, deleting the
// Supabase copies once R2 has them, and collecting garbage from R2.
//
//   deno run -A --no-config scripts/media-cdn/sync-local-test.ts
// (Deno without root: npm i deno, then node_modules/.bin/deno)

import { bundleFunction, startFakeR2 } from "./fakes.ts";

const SUPA_PORT = 54891, R2_PORT = 54892, FN_PORT = 8000; // Deno.serve default port
const WORKER_SECRET = "a".repeat(64);
const enc = new TextEncoder();

function png(width: number, height: number) {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...enc.encode("IHDR")]);
  new DataView(b.buffer).setUint32(16, width); new DataView(b.buffer).setUint32(20, height);
  return b;
}
const good = png(1600, 1200);
const disguised = enc.encode("<html>" + "x".repeat(60) + "</html>");
const files: Record<string, Uint8Array> = {
  "catalog-public/p1/products/a.png": good,
  "catalog-public/p1/products/fake.png": disguised,
};

type Scenario = { enabled: boolean; offloadSources?: boolean; stagingSweepDue?: boolean };
let scenario: Scenario = { enabled: true };
const OLD_STAGING = "_incoming/0b8c4c3e-3f55-4b8a-9a55-2a4e5b8d9f10", FRESH_STAGING = "_incoming/7d1e2f30-4a5b-4c6d-8e7f-901a2b3c4d5e";
const ABANDONED_STAGING = "_incoming/5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const rpcCalls: { name: string; body: Record<string, any> }[] = [];
const storageRemovals: { bucket: string; names: string[] }[] = [];

function plan() {
  return {
    enabled: scenario.enabled, accountId: "05764c9f34befd8e71cffca80a56d26b", bucket: "golden-oremar-media", mirroredBytes: 100, budgetBytes: 8589934592, budgetBlocked: 0,
    offloadSources: scenario.offloadSources ?? true, stagingSweepDue: scenario.stagingSweepDue ?? true,
    uploads: [
      { bucket: "catalog-public", name: "p1/products/a.png", etag: "e1", size: good.length, contentType: "image/png" },
      { bucket: "catalog-public", name: "p1/products/fake.png", etag: "e2", size: disguised.length, contentType: "image/png" },
      { bucket: "catalog-public", name: "p1/products/refused.png", etag: "e3", size: 10, contentType: "image/png" },
      { bucket: "catalog-public", name: "../escape.png", etag: "e4", size: 10, contentType: "image/png" },
    ],
    offloads: [{ bucket: "event-public", name: "p1/events/already-in-r2.png" }],
    deletes: [{ bucket: "catalog-public", name: "legacy/mirror-copy.png" }],
  };
}

Deno.serve({ port: SUPA_PORT, onListen() {} }, async req => {
  const url = new URL(req.url);
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
  if (rpc) {
    const body = await req.json().catch(() => ({}));
    rpcCalls.push({ name: rpc, body });
    if (rpc === "service_validate_media_cdn_worker_v1") return reply(body.p_secret === WORKER_SECRET);
    if (rpc === "service_media_cdn_plan_v1") return reply(plan());
    if (rpc === "service_media_adopt_reserve_v1") return reply(body.p_name !== "p1/products/refused.png");
    if (rpc === "service_media_adopt_confirm_v1") return reply(true);
    if (rpc === "service_media_gc_candidates_v2") return reply({ delete: [{ bucket: "catalog-public", name: "u1/products/abandoned.png", staging: ABANDONED_STAGING }] });
    if (rpc === "service_media_cdn_forget_v1") return reply(true);
    return reply(null);
  }
  const remove = req.method === "DELETE" && url.pathname.match(/^\/storage\/v1\/object\/([a-z-]+)$/);
  if (remove) {
    const body = await req.json().catch(() => ({}));
    storageRemovals.push({ bucket: remove[1], names: body.prefixes || [] });
    return reply((body.prefixes || []).map((name: string) => ({ name })));
  }
  const object = url.pathname.match(/\/storage\/v1\/object\/(?:authenticated\/)?(.+)$/)?.[1];
  if (object) {
    const bytes = files[decodeURIComponent(object)];
    return bytes ? new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } }) : reply({}, 404);
  }
  return reply({}, 404);
});

const r2 = startFakeR2(R2_PORT);
const seed = () => {
  const now = Date.now();
  r2.objects.set("catalog-public/legacy/mirror-copy.png", { body: good, type: "image/png", cacheControl: "", modified: now });
  r2.objects.set("catalog-public/u1/products/abandoned.png", { body: good, type: "image/png", cacheControl: "", modified: now });
  r2.objects.set(ABANDONED_STAGING, { body: good, type: "image/png", cacheControl: "", modified: now - 90 * 60_000 });
  r2.objects.set(OLD_STAGING, { body: good, type: "image/png", cacheControl: "", modified: now - 3 * 3600_000 });
  r2.objects.set(FRESH_STAGING, { body: good, type: "image/png", cacheControl: "", modified: now - 10 * 60_000 });
};
seed();
const fnPath = await bundleFunction("media-cdn-sync");
async function startFunction(env: Record<string, string>) {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--no-check", "--no-config", "--node-modules-dir=none", fnPath],
    env: { SUPABASE_URL: `http://127.0.0.1:${SUPA_PORT}`, SUPABASE_SERVICE_ROLE_KEY: "service", R2_ENDPOINT: `http://127.0.0.1:${R2_PORT}`, ...env },
    stdout: "null", stderr: "piped",
  }).spawn();
  for (let i = 0; i < 300; i++) {
    try { await fetch(`http://127.0.0.1:${FN_PORT}/`, { method: "GET" }).then(r => r.body?.cancel()); return child; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error("function did not start");
}
const call = (secret: string) => fetch(`http://127.0.0.1:${FN_PORT}/`, { method: "POST", headers: { "x-golden-worker-secret": secret }, body: "{}" }).then(async r => ({ status: r.status, body: await r.json() }));

const results: [boolean, string][] = [];
const check = (ok: boolean, label: string) => results.push([ok, label]);
const reset = (s: Scenario) => { scenario = s; rpcCalls.length = 0; r2.log.length = 0; storageRemovals.length = 0; };
const names = (rpc: string) => rpcCalls.filter(c => c.name === rpc).map(c => String(c.body.p_name));

let child = await startFunction({ R2_ACCESS_KEY_ID: r2.access, R2_SECRET_ACCESS_KEY: r2.secret });

reset({ enabled: true });
let res = await call("wrong".repeat(10));
check(res.status === 401 && r2.log.length === 0 && rpcCalls.length === 1, `wrong worker secret -> 401, nothing touched (${res.status})`);

reset({ enabled: false });
res = await call(WORKER_SECRET);
check(res.status === 200 && res.body.status === "disabled" && r2.log.length === 0 && storageRemovals.length === 0, "disabled -> nothing moves");

reset({ enabled: true });
res = await call(WORKER_SECRET);
const puts = r2.log.filter(l => l.method === "PUT");
check(r2.log.every(l => l.ok), `every R2 request correctly signed (${[...new Set(r2.log.map(l => l.detail))].join(", ")})`);
check(puts.length === 1 && puts[0].path === "/golden-oremar-media/catalog-public/p1/products/a.png", `exactly one PUT, the real image (${puts.map(p => p.path).join(", ")})`);
const stored = r2.objects.get("catalog-public/p1/products/a.png");
check(Boolean(stored) && stored!.type === "image/png" && stored!.cacheControl === "public, max-age=31536000, immutable" && stored!.body.length === good.length, "stored byte-identical, image type, one-year immutable cache");
const confirm = rpcCalls.find(c => c.name === "service_media_adopt_confirm_v1")?.body || {};
check(confirm.p_name === "p1/products/a.png" && confirm.p_width === 1600 && confirm.p_height === 1200 && /^[0-9a-f]{64}$/.test(confirm.p_sha256), "adoption records real dimensions and SHA-256");
check(names("service_media_cdn_fail_v1").join() === "p1/products/fake.png", "HTML disguised as PNG refused and recorded as failure");
check(!names("service_media_adopt_reserve_v1").includes("../escape.png"), "path-escaping name never reserved");
const removed = storageRemovals.flatMap(r => r.names.map(n => `${r.bucket}/${n}`)).sort();
check(JSON.stringify(removed) === JSON.stringify(["catalog-public/p1/products/a.png", "event-public/p1/events/already-in-r2.png"]), `Supabase copies deleted only once R2 has them (${removed.join(", ")})`);
check(!r2.objects.has("catalog-public/legacy/mirror-copy.png") && names("service_media_cdn_forget_v1").includes("legacy/mirror-copy.png"), "legacy mirror copy deleted from R2 and ledger");
check(!r2.objects.has("catalog-public/u1/products/abandoned.png") && !r2.objects.has(ABANDONED_STAGING) && names("service_media_cdn_forget_v1").includes("u1/products/abandoned.png"), "garbage deleted from R2 with its staging key, then from the ledger");
const forgetIndex = r2.log.findIndex(l => l.method === "DELETE" && l.path.endsWith(ABANDONED_STAGING));
check(forgetIndex >= 0 && r2.log.some(l => l.method === "GET" && l.path === "/golden-oremar-media"), "staging sweep listed the _incoming/ prefix");
check(!r2.objects.has(OLD_STAGING) && r2.objects.has(FRESH_STAGING), "sweep deletes staging keys older than 2 hours, keeps an upload in progress");
check(rpcCalls.some(c => c.name === "service_media_staging_swept_v1"), "a complete sweep is recorded");
check(res.body.adopted === 1 && res.body.offloaded === 2 && res.body.collected === 1 && res.body.deleted === 1 && res.body.swept === 1 && res.body.refused === 2 && res.body.failed === 1 && res.body.status === "partial",
  `run summary ${JSON.stringify({ a: res.body.adopted, o: res.body.offloaded, c: res.body.collected, d: res.body.deleted, sw: res.body.swept, r: res.body.refused, f: res.body.failed, s: res.body.status })}`);
check(rpcCalls.some(c => c.name === "service_media_cdn_finish_v1"), "run recorded");

// Default: Supabase copies are kept until offloading is switched on.
reset({ enabled: true, offloadSources: false, stagingSweepDue: false });
res = await call(WORKER_SECRET);
check(storageRemovals.length === 0 && res.body.adopted === 1, "offloadSources off: adopted into R2, the Supabase copy is kept");
check(!rpcCalls.some(c => c.name === "service_media_staging_swept_v1") && !r2.log.some(l => l.method === "GET" && l.path === "/golden-oremar-media"), "no sweep when it is not due");
child.kill(); await child.status;

// A wrong R2 secret must make the fake refuse, proving the verifier can say no.
child = await startFunction({ R2_ACCESS_KEY_ID: r2.access, R2_SECRET_ACCESS_KEY: "wrong-secret" });
reset({ enabled: true });
r2.objects.clear();
res = await call(WORKER_SECRET);
check(r2.log.length > 0 && r2.log.every(l => !l.ok) && res.body.adopted === 0 && storageRemovals.every(r => !r.names.includes("p1/products/a.png")),
  "wrong R2 secret: every signature refused, nothing adopted, the Supabase copy is kept");
check(names("service_media_cdn_fail_v1").includes("p1/products/a.png") && !names("service_media_cdn_forget_v1").includes("p1/products/a.png"),
  "a failed R2 PUT is recorded but its reservation is kept, so the garbage collector can clear whatever landed");
check(!rpcCalls.some(c => c.name === "service_media_staging_swept_v1"), "a sweep that could not list is not recorded as done");
child.kill(); await child.status;

child = await startFunction({ R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "" });
reset({ enabled: true });
res = await call(WORKER_SECRET);
check(res.status === 503 && res.body.status === "not_configured" && r2.log.length === 0, "missing R2 keys -> 503, nothing touched");
child.kill(); await child.status;

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} media-cdn-sync checks passed.`);
Deno.exit(failed ? 1 : 0);
