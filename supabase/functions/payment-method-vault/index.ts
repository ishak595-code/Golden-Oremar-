import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return "";
  return normalized;
}

function optionalText(value: unknown, max: number) {
  if (value == null || value === "") return null;
  return text(value, max) || null;
}

function validUuid(value: unknown) {
  const normalized = text(value, 160);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ? normalized : "";
}

function luhn(cardNumber: string) {
  let sum = 0;
  let doubleDigit = false;
  for (let i = cardNumber.length - 1; i >= 0; i -= 1) {
    let digit = Number(cardNumber[i]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function normalizeCardNumber(value: unknown) {
  const digits = typeof value === "string" ? value.replace(/[^0-9]/g, "") : "";
  if (digits.length < 12 || digits.length > 19 || !luhn(digits)) throw new Error("invalid_card_number");
  return digits;
}

function normalizeExpiry(monthValue: unknown, yearValue: unknown) {
  const month = Number(monthValue);
  const year = Number(yearValue);
  if (!Number.isSafeInteger(month) || month < 1 || month > 12) throw new Error("invalid_exp_month");
  if (!Number.isSafeInteger(year) || year < new Date().getUTCFullYear() || year > 2200) throw new Error("invalid_exp_year");
  const now = new Date();
  const expiryBoundary = Date.UTC(year, month, 1);
  const currentBoundary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  if (expiryBoundary <= currentBoundary) throw new Error("card_expired");
  return { month, year };
}

function safeBaseUrl(value: string) {
  const normalized = value.replace(/\/$/, "");
  if (normalized !== "https://api.iyzipay.com" && normalized !== "https://sandbox-api.iyzipay.com") {
    throw new Error("invalid_iyzico_base_url");
  }
  return normalized;
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

async function iyzicoRequest(path: string, method: "POST" | "DELETE", payload: Record<string, unknown>) {
  const apiKey = Deno.env.get("IYZICO_API_KEY")?.trim() || "";
  const secretKey = Deno.env.get("IYZICO_SECRET_KEY")?.trim() || "";
  const baseUrlRaw = Deno.env.get("IYZICO_BASE_URL")?.trim() || "";
  if (!apiKey || !secretKey || !baseUrlRaw) throw new Error("payment_provider_credentials_missing");
  const baseUrl = safeBaseUrl(baseUrlRaw);
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
    signal: AbortSignal.timeout(15000),
  });
  let data: Record<string, unknown> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    throw new Error("payment_provider_invalid_response");
  }
  if (!response.ok || data.status !== "success") {
    const code = text(data.errorCode, 80) || "provider_request_failed";
    throw new Error(`payment_provider_error:${code}`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json(401, { ok: false, error: "authentication_required" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user?.id || !user.email) return json(401, { ok: false, error: "authentication_required" });

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: brandData, error: brandError } = await service
      .from("brand_settings")
      .select("public_config")
      .eq("slug", "golden-oremar")
      .maybeSingle();
    if (brandError) throw brandError;
    const publicConfig = brandData?.public_config && typeof brandData.public_config === "object" ? brandData.public_config as Record<string, unknown> : {};
    const payments = publicConfig.payments && typeof publicConfig.payments === "object" && !Array.isArray(publicConfig.payments) ? publicConfig.payments as Record<string, unknown> : {};
    const provider = text(payments.provider, 40).toLowerCase();
    const enrollmentEnabled = payments.card_enrollment_enabled === true;
    if (provider !== "iyzico" || !enrollmentEnabled) return json(503, { ok: false, error: "payment_provider_not_configured" });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { ok: false, error: "invalid_request" });
    const input = body as Record<string, unknown>;
    const action = text(input.action, 20);

    if (action === "add") {
      const cardNumber = normalizeCardNumber(input.cardNumber);
      const cardHolderName = text(input.cardHolderName, 120);
      if (cardHolderName.length < 2) return json(400, { ok: false, error: "invalid_card_holder_name" });
      const { month, year } = normalizeExpiry(input.expMonth, input.expYear);
      const nickname = optionalText(input.nickname, 40);
      const billingCountryCodeRaw = optionalText(input.billingCountryCode, 2);
      const billingCountryCode = billingCountryCodeRaw ? billingCountryCodeRaw.toUpperCase() : null;
      if (billingCountryCode && !/^[A-Z]{2}$/.test(billingCountryCode)) return json(400, { ok: false, error: "invalid_billing_country" });
      const billingPostalCode = optionalText(input.billingPostalCode, 30);
      const makeDefault = input.makeDefault === true;
      const conversationId = crypto.randomUUID();

      const { data: existingCustomerRef, error: customerRefError } = await service.rpc("get_provider_customer_ref_for_service_v1", {
        p_user_id: user.id,
        p_provider: "iyzico",
      });
      if (customerRefError) throw customerRefError;

      const card = {
        cardAlias: nickname || `Golden Oremar ${cardNumber.slice(-4)}`,
        cardNumber,
        expireYear: String(year),
        expireMonth: String(month).padStart(2, "0"),
        cardHolderName,
      };
      const providerPayload: Record<string, unknown> = existingCustomerRef
        ? { locale: "tr", conversationId, cardUserKey: existingCustomerRef, card }
        : { locale: "tr", conversationId, externalId: user.id, email: user.email, card };

      const providerResult = await iyzicoRequest("/cardstorage/card", "POST", providerPayload);
      const cardUserKey = text(providerResult.cardUserKey, 255);
      const cardToken = text(providerResult.cardToken, 255);
      const last4 = text(providerResult.lastFourDigits, 4);
      const association = text(providerResult.cardAssociation, 40) || text(providerResult.cardFamily, 40) || "CARD";
      if (!cardUserKey || !cardToken || !/^[0-9]{4}$/.test(last4)) throw new Error("payment_provider_card_response_invalid");

      const { data: methodId, error: storeError } = await service.rpc("store_verified_provider_payment_method_v1", {
        p_user_id: user.id,
        p_provider: "iyzico",
        p_provider_customer_ref: cardUserKey,
        p_provider_payment_method_ref: cardToken,
        p_brand: association,
        p_last4: last4,
        p_exp_month: month,
        p_exp_year: year,
        p_billing_name: cardHolderName,
        p_nickname: nickname,
        p_billing_country_code: billingCountryCode,
        p_billing_postal_code: billingPostalCode,
        p_make_default: makeDefault,
      });
      if (storeError || !methodId) throw storeError || new Error("payment_method_store_failed");

      return json(201, {
        ok: true,
        method: {
          id: methodId,
          provider: "iyzico",
          brand: association,
          last4,
          expMonth: month,
          expYear: year,
          billingName: cardHolderName,
          nickname,
          billingCountryCode,
          billingPostalCode,
          isDefault: makeDefault,
          status: "active",
        },
      });
    }

    if (action === "remove") {
      const paymentMethodId = validUuid(input.paymentMethodId);
      if (!paymentMethodId) return json(400, { ok: false, error: "payment_method_required" });
      const { data: context, error: contextError } = await service.rpc("get_provider_payment_method_for_service_v1", {
        p_user_id: user.id,
        p_payment_method_id: paymentMethodId,
      });
      if (contextError) throw contextError;
      if (!context || typeof context !== "object" || Array.isArray(context)) throw new Error("payment_method_not_found");
      const providerName = text((context as Record<string, unknown>).provider, 40).toLowerCase();
      const providerCustomerRef = text((context as Record<string, unknown>).providerCustomerRef, 255);
      const providerMethodRef = text((context as Record<string, unknown>).providerPaymentMethodRef, 255);
      if (providerName !== "iyzico" || !providerCustomerRef || !providerMethodRef) throw new Error("payment_provider_method_context_invalid");

      await iyzicoRequest("/cardstorage/card", "DELETE", {
        locale: "tr",
        conversationId: crypto.randomUUID(),
        cardUserKey: providerCustomerRef,
        cardToken: providerMethodRef,
      });

      const { data: removed, error: removeError } = await service.rpc("finalize_provider_payment_method_removal_v1", {
        p_user_id: user.id,
        p_payment_method_id: paymentMethodId,
      });
      if (removeError) throw removeError;
      return json(200, { ok: true, ...(removed && typeof removed === "object" ? removed as Record<string, unknown> : {}) });
    }

    return json(400, { ok: false, error: "unsupported_action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment_method_vault_failed";
    const safeMessage = message.length <= 240 && !/[\u0000-\u001F\u007F]/.test(message) ? message : "payment_method_vault_failed";
    const status = safeMessage.includes("credentials_missing") || safeMessage.includes("provider_not_configured") ? 503 : 400;
    return json(status, { ok: false, error: safeMessage });
  }
});
