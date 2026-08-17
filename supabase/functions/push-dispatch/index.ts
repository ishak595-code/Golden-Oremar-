import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type Provider = "fcm" | "apns";
type Delivery = {
  delivery_id: number;
  provider: Provider;
  platform: string;
  environment: string;
  push_token: string;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
};

type SendResult = { ok: boolean; error?: string; disableToken?: boolean };

const MAX_BATCH = 100;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_ENDPOINT = (projectId: string) => `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
const APNS_PRODUCTION = "https://api.push.apple.com";
const APNS_DEVELOPMENT = "https://api.development.push.apple.com";

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value ? value : null;
}

function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function base64UrlBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlJson(value: unknown) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToBytes(pem: string) {
  const body = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signJwt(algorithm: "RS256" | "ES256", privateKeyPem: string, payload: Record<string, unknown>, headerExtra: Record<string, unknown> = {}) {
  const header = { alg: algorithm, typ: "JWT", ...headerExtra };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const keyBytes = pemToBytes(normalizePem(privateKeyPem));
  const key = algorithm === "RS256"
    ? await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
    : await crypto.subtle.importKey("pkcs8", keyBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = algorithm === "RS256"
    ? await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput))
    : await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlBytes(new Uint8Array(signature))}`;
}

let cachedGoogleToken: { value: string; expiresAt: number } | null = null;
async function getGoogleAccessToken() {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) return cachedGoogleToken.value;
  const email = requiredEnv("FCM_SERVICE_ACCOUNT_EMAIL");
  const privateKey = requiredEnv("FCM_PRIVATE_KEY");
  if (!email || !privateKey) throw new Error("fcm_credentials_missing");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt("RS256", privateKey, {
    iss: email,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!response.ok || !accessToken) throw new Error(`fcm_oauth_failed:${response.status}`);
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cachedGoogleToken = { value: accessToken, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000 };
  return accessToken;
}

function stringMetadata(metadata: Record<string, unknown> | null, actionUrl: string | null) {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value == null) continue;
    data[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  if (actionUrl) data.action_url = actionUrl;
  return data;
}

async function sendFcm(delivery: Delivery): Promise<SendResult> {
  const projectId = requiredEnv("FCM_PROJECT_ID");
  if (!projectId) return { ok: false, error: "fcm_project_id_missing" };
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(FCM_ENDPOINT(projectId), {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: delivery.push_token,
        notification: { title: delivery.title, body: delivery.body },
        data: stringMetadata(delivery.metadata, delivery.action_url),
        android: { priority: "high", notification: { channel_id: "golden-oremar-updates" } },
      },
    }),
  });
  if (response.ok) return { ok: true };
  const text = await response.text();
  const disable = response.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(text);
  return { ok: false, error: `fcm_${response.status}:${text.slice(0, 800)}`, disableToken: disable };
}

let cachedApnsToken: { value: string; expiresAt: number } | null = null;
async function getApnsProviderToken() {
  if (cachedApnsToken && cachedApnsToken.expiresAt > Date.now() + 60_000) return cachedApnsToken.value;
  const teamId = requiredEnv("APNS_TEAM_ID");
  const keyId = requiredEnv("APNS_KEY_ID");
  const privateKey = requiredEnv("APNS_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) throw new Error("apns_credentials_missing");
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt("ES256", privateKey, { iss: teamId, iat: now }, { kid: keyId });
  cachedApnsToken = { value: token, expiresAt: Date.now() + 50 * 60_000 };
  return token;
}

async function sendApns(delivery: Delivery): Promise<SendResult> {
  const bundleId = requiredEnv("APNS_BUNDLE_ID") || "com.goldenoremar.app";
  const authToken = await getApnsProviderToken();
  const base = delivery.environment === "development" ? APNS_DEVELOPMENT : APNS_PRODUCTION;
  const response = await fetch(`${base}/3/device/${encodeURIComponent(delivery.push_token)}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${authToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: { alert: { title: delivery.title, body: delivery.body }, sound: "default" },
      action_url: delivery.action_url,
      metadata: delivery.metadata || {},
    }),
  });
  if (response.ok) return { ok: true };
  const text = await response.text();
  const disable = response.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/i.test(text);
  return { ok: false, error: `apns_${response.status}:${text.slice(0, 800)}`, disableToken: disable };
}

function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (requiredEnv("FCM_PROJECT_ID") && requiredEnv("FCM_SERVICE_ACCOUNT_EMAIL") && requiredEnv("FCM_PRIVATE_KEY")) providers.push("fcm");
  if (requiredEnv("APNS_TEAM_ID") && requiredEnv("APNS_KEY_ID") && requiredEnv("APNS_PRIVATE_KEY")) providers.push("apns");
  return providers;
}

async function dispatchOne(delivery: Delivery): Promise<SendResult> {
  try {
    if (delivery.provider === "fcm") return await sendFcm(delivery);
    if (delivery.provider === "apns") return await sendApns(delivery);
    return { ok: false, error: `unsupported_provider:${String(delivery.provider)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    const providers = configuredProviders();
    if (!providers.length) {
      return Response.json({ ok: false, status: "not_configured", providers: [] }, { status: 503 });
    }

    const requestBody = await req.json().catch(() => ({})) as Record<string, unknown>;
    const requestedLimit = Number(requestBody.limit ?? 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(MAX_BATCH, Math.max(1, Math.trunc(requestedLimit))) : 50;
    const workerId = `edge:${Deno.env.get("DENO_DEPLOYMENT_ID") || "push-dispatch"}:${crypto.randomUUID()}`.slice(0, 120);

    const { data, error } = await ctx.supabaseAdmin.rpc("claim_push_deliveries_v2", {
      p_limit: limit,
      p_worker_id: workerId,
      p_providers: providers,
    });
    if (error) return Response.json({ ok: false, error: "claim_failed", detail: error.message }, { status: 500 });

    const deliveries = (Array.isArray(data) ? data : []) as Delivery[];
    let sent = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      const result = await dispatchOne(delivery);
      const { error: completeError } = await ctx.supabaseAdmin.rpc("complete_push_delivery_v1", {
        p_delivery_id: delivery.delivery_id,
        p_success: result.ok,
        p_error: result.ok ? null : (result.error || "push_delivery_failed"),
        p_disable_token: result.disableToken === true,
      });
      if (completeError) {
        console.error("push_delivery_completion_failed", delivery.delivery_id, completeError.message);
        failed += 1;
        continue;
      }
      if (result.ok) sent += 1;
      else failed += 1;
    }

    return Response.json({ ok: true, claimed: deliveries.length, sent, failed, providers });
  }),
};
