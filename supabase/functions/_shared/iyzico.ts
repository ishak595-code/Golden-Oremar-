export type IyzicoJson = Record<string, unknown>;

function nonEmpty(value: unknown, max = 500) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return "";
  return normalized;
}

function safeBaseUrl(value: string) {
  const normalized = value.replace(/\/$/, "");
  if (normalized !== "https://api.iyzipay.com" && normalized !== "https://sandbox-api.iyzipay.com") {
    throw new Error("invalid_iyzico_base_url");
  }
  return normalized;
}

export function getIyzicoConfig() {
  const apiKey = Deno.env.get("IYZICO_API_KEY")?.trim() || "";
  const secretKey = Deno.env.get("IYZICO_SECRET_KEY")?.trim() || "";
  const baseUrlRaw = Deno.env.get("IYZICO_BASE_URL")?.trim() || "";
  if (!apiKey || !secretKey || !baseUrlRaw) throw new Error("payment_provider_credentials_missing");
  return { apiKey, secretKey, baseUrl: safeBaseUrl(baseUrlRaw) };
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(signature).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeHexEqual(left: string, right: string) {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function iyzicoRequest(
  path: string,
  method: "POST" | "DELETE",
  payload: IyzicoJson,
  timeoutMs = 15000,
) {
  if (!path.startsWith("/") || path.length > 240) throw new Error("invalid_iyzico_path");
  const { apiKey, secretKey, baseUrl } = getIyzicoConfig();
  const requestBody = JSON.stringify(payload);
  const randomKey = `${Date.now()}${crypto.randomUUID().replaceAll("-", "")}`;
  const signature = await hmacHex(secretKey, randomKey + path + requestBody);
  const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  const authorization = `IYZWSv2 ${btoa(authorizationString)}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Authorization": authorization,
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: requestBody,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let data: IyzicoJson = {};
  try {
    const parsed = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("payment_provider_invalid_response");
    data = parsed as IyzicoJson;
  } catch (error) {
    if (error instanceof Error && error.message === "payment_provider_invalid_response") throw error;
    throw new Error("payment_provider_invalid_response");
  }
  return { response, data };
}

function decimalSignatureValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const fixed = value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
    return fixed || "0";
  }
  const raw = nonEmpty(value, 80);
  if (!raw || !/^-?[0-9]+(?:\.[0-9]+)?$/.test(raw)) return "";
  if (!raw.includes(".")) return raw;
  return raw.replace(/0+$/, "").replace(/\.$/, "");
}

export async function verifyIyzicoNon3dResponseSignature(data: IyzicoJson) {
  const { secretKey } = getIyzicoConfig();
  const paymentId = nonEmpty(data.paymentId, 120);
  const currency = nonEmpty(data.currency, 3).toUpperCase();
  const basketId = nonEmpty(data.basketId, 180);
  const conversationId = nonEmpty(data.conversationId, 180);
  const paidPrice = decimalSignatureValue(data.paidPrice);
  const price = decimalSignatureValue(data.price);
  const received = nonEmpty(data.signature, 256).toLowerCase();
  if (!paymentId || !/^[A-Z]{3}$/.test(currency) || !basketId || !conversationId || !paidPrice || !price || !received) return false;
  const expected = await hmacHex(secretKey, [paymentId, currency, basketId, conversationId, paidPrice, price].join(":"));
  return safeHexEqual(expected, received);
}

export async function verifyIyzicoWebhookV3(data: IyzicoJson, signatureHeader: string | null) {
  const received = nonEmpty(signatureHeader, 256).toLowerCase();
  if (!received) return false;
  const { secretKey } = getIyzicoConfig();
  const eventType = nonEmpty(data.iyziEventType, 120);
  const paymentId = nonEmpty(data.paymentId, 120) || nonEmpty(data.iyziPaymentId, 120);
  const conversationId = nonEmpty(data.paymentConversationId, 180);
  const status = nonEmpty(data.status, 80);
  if (!eventType || !paymentId || !conversationId || !status) return false;
  const message = secretKey + eventType + paymentId + conversationId + status;
  const expected = await hmacHex(secretKey, message);
  return safeHexEqual(expected, received);
}

export function iyzicoError(data: IyzicoJson, fallback = "provider_request_failed") {
  const code = nonEmpty(data.errorCode, 120) || fallback;
  const message = nonEmpty(data.errorMessage, 400);
  return { code, message };
}
