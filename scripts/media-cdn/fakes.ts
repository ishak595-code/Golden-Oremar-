// Shared fakes for the local edge function tests in this folder.
//
// startFakeR2 is an S3-compatible stand-in that verifies AWS Signature V4 with
// its own code (header form and presigned query form), so the tests prove the
// signatures, not just that aws4fetch was called.

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (data: Uint8Array | string) => hex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
async function hmac(key: ArrayBuffer | Uint8Array, data: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export type R2Log = { method: string; path: string; ok: boolean; detail: string; fromFunction: boolean };

export function startFakeR2(port: number, bucket = "golden-oremar-media") {
  const access = "test-access-key-id", secret = "test-secret-access-key";
  const objects = new Map<string, { body: Uint8Array; type: string; cacheControl: string; modified: number }>();
  const log: R2Log[] = [];

  async function signature(date: string, amzDate: string, canonical: string, key = secret) {
    const toSign = ["AWS4-HMAC-SHA256", amzDate, `${date}/auto/s3/aws4_request`, await sha256(canonical)].join("\n");
    let k = await hmac(enc.encode("AWS4" + key), date);
    k = await hmac(k, "auto"); k = await hmac(k, "s3"); k = await hmac(k, "aws4_request");
    return hex(await hmac(k, toSign));
  }
  async function verify(req: Request, body: Uint8Array) {
    const url = new URL(req.url);
    const m = (req.headers.get("authorization") || "").match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/);
    if (m) {
      const [, key, date, signed, sig] = m;
      const payload = req.headers.get("x-amz-content-sha256") || "";
      if (key !== access || (payload !== await sha256(body) && payload !== "UNSIGNED-PAYLOAD")) return { ok: false, detail: "header scope/payload", header: true };
      const headers = signed.split(";").map(h => `${h}:${(req.headers.get(h) || "").trim().replace(/\s+/g, " ")}\n`).join("");
      const query = [...url.searchParams.entries()].map(([k, v]) => [rfc3986(k), rfc3986(v)])
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
      const canonical = [req.method, url.pathname, query, headers, signed, payload].join("\n");
      const ok = await signature(date, req.headers.get("x-amz-date") || "", canonical) === sig;
      return { ok, detail: ok ? "header signature valid" : "header signature mismatch", header: true };
    }
    const q = url.searchParams;
    const cred = (q.get("X-Amz-Credential") || "").match(/^([^/]+)\/(\d{8})\/auto\/s3\/aws4_request$/);
    if (!cred || cred[1] !== access) return { ok: false, detail: "no or foreign credential", header: false };
    const amzDate = q.get("X-Amz-Date") || "", expires = Number(q.get("X-Amz-Expires"));
    const issued = Date.UTC(+amzDate.slice(0, 4), +amzDate.slice(4, 6) - 1, +amzDate.slice(6, 8), +amzDate.slice(9, 11), +amzDate.slice(11, 13), +amzDate.slice(13, 15));
    if (!(expires > 0 && expires <= 604800) || Date.now() > issued + expires * 1000) return { ok: false, detail: "expired", header: false };
    const signed = q.get("X-Amz-SignedHeaders") || "";
    const params = [...q.entries()].filter(([k]) => k !== "X-Amz-Signature").map(([k, v]) => [rfc3986(k), rfc3986(v)])
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
    const headers = signed.split(";").map(h => `${h}:${(req.headers.get(h) || "").trim()}\n`).join("");
    const canonical = [req.method, url.pathname, params, headers, signed, q.get("X-Amz-Content-Sha256") || "UNSIGNED-PAYLOAD"].join("\n");
    const ok = await signature(cred[2], amzDate, canonical) === q.get("X-Amz-Signature");
    return { ok, detail: ok ? `query signature valid (signed: ${signed})` : "query signature mismatch", header: false };
  }

  Deno.serve({ port, onListen() {} }, async req => {
    const body = new Uint8Array(await req.arrayBuffer());
    const { ok, detail, header } = await verify(req, body);
    const path = decodeURIComponent(new URL(req.url).pathname);
    log.push({ method: req.method, path, ok, detail, fromFunction: header });
    if (!ok) return new Response("SignatureDoesNotMatch", { status: 403 });
    if (req.method === "GET" && path === `/${bucket}` && new URL(req.url).searchParams.get("list-type") === "2") {
      const q = new URL(req.url).searchParams, prefix = q.get("prefix") || "", max = Number(q.get("max-keys") || 1000);
      const keys = [...objects.keys()].filter(k => k.startsWith(prefix)).sort();
      const from = q.get("continuation-token") ? keys.indexOf(q.get("continuation-token")!) : 0;
      const page = keys.slice(Math.max(0, from), Math.max(0, from) + max), rest = keys[Math.max(0, from) + max];
      const xml = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${bucket}</Name><Prefix>${prefix}</Prefix>`
        + page.map(k => `<Contents><Key>${k}</Key><LastModified>${new Date(objects.get(k)!.modified).toISOString()}</LastModified><Size>${objects.get(k)!.body.length}</Size></Contents>`).join("")
        + `<IsTruncated>${rest ? "true" : "false"}</IsTruncated>${rest ? `<NextContinuationToken>${rest}</NextContinuationToken>` : ""}</ListBucketResult>`;
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml" } });
    }
    const key = path.replace(`/${bucket}/`, "");
    if (req.method === "PUT") {
      objects.set(key, { body, type: req.headers.get("content-type") || "", cacheControl: req.headers.get("cache-control") || "", modified: Date.now() });
      return new Response(null, { status: 200 });
    }
    if (req.method === "DELETE") { objects.delete(key); return new Response(null, { status: 204 }); }
    const object = objects.get(key);
    if (!object) return new Response(null, { status: 404 });
    if (req.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": String(object.body.length), "content-type": object.type } });
    const range = (req.headers.get("range") || "").match(/^bytes=(\d+)-(\d+)$/);
    const part = range ? object.body.slice(+range[1], +range[2] + 1) : object.body;
    return new Response(part, { status: range ? 206 : 200, headers: { "content-type": object.type } });
  });
  return { access, secret, objects, log };
}

/**
 * Copy an edge function and the shared module it imports into a temp folder
 * with the same layout, dropping the type-only jsr: import (jsr.io is not
 * reachable from every sandbox and carries no runtime code).
 */
export async function bundleFunction(name: string) {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(`${root}/${name}`, { recursive: true });
  await Deno.mkdir(`${root}/_shared`, { recursive: true });
  const source = await Deno.readTextFile(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url));
  await Deno.writeTextFile(`${root}/${name}/index.ts`, source.replace(/^import "jsr:[^"]+";\n/m, ""));
  await Deno.copyFile(new URL("../../supabase/functions/_shared/media_binary.ts", import.meta.url), `${root}/_shared/media_binary.ts`);
  return `${root}/${name}/index.ts`;
}
