import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import {
  iyzicoError,
  iyzicoRequest,
  verifyIyzicoNon3dResponseSignature,
  type IyzicoJson,
} from "../_shared/iyzico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_CURRENCIES = new Set(["TRY", "USD", "EUR", "GBP", "NOK", "CHF"]);

type RecordValue = Record<string, unknown>;
type PaymentState = "captured" | "authorized" | "failed";
type BuyerIdentityType = "tc_identity" | "passport";

function json(status: number, body: RecordValue) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return "";
  return normalized;
}

function uuid(value: unknown) {
  const normalized = text(value, 80);
  return UUID_RE.test(normalized) ? normalized : "";
}

function integer(value: unknown, min = 0) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min ? value : null;
}

function minorToMajor(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid_money");
  return (value / 100).toFixed(2);
}

function decimalToMinor(value: unknown) {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value) : text(value, 80);
  if (!raw || !/^[0-9]+(?:\.[0-9]+)?$/.test(raw)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

function validEmail(value: unknown) {
  const email = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function validPhone(value: unknown) {
  const phone = text(value, 40);
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 20 ? phone : "";
}

function requestIp(req: Request) {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0] || null,
  ];
  for (const candidate of candidates) {
    const normalized = (candidate || "").trim();
    if (normalized && normalized.length <= 64 && /^[0-9a-fA-F:.]+$/.test(normalized)) return normalized;
  }
  throw new Error("payment_request_ip_required");
}

function fullNameParts(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const normalized = text(candidate, 240);
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        fullName: normalized,
        name: parts.slice(0, -1).join(" "),
        surname: parts[parts.length - 1],
      };
    }
  }
  throw new Error("payment_profile_full_name_required");
}

function validTurkishIdentity(value: string) {
  if (!/^[1-9][0-9]{10}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = ((odd * 7) - even) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return tenth === digits[9] && eleventh === digits[10];
}

function identityType(value: unknown): BuyerIdentityType {
  const normalized = text(value, 30).toLowerCase();
  if (normalized === "tc_identity" || normalized === "passport") return normalized;
  throw new Error("buyer_identity_type_required");
}

function buyerIdentity(value: unknown, type: BuyerIdentityType) {
  const normalized = text(value, 40).replace(/\s+/g, "").toUpperCase();
  if (type === "tc_identity") {
    if (!validTurkishIdentity(normalized)) throw new Error("payment_turkish_identity_invalid");
    return normalized;
  }
  if (!/^[A-Z0-9-]{5,30}$/.test(normalized)) throw new Error("payment_passport_invalid");
  return normalized;
}

function addressContext(raw: unknown) {
  if (!isRecord(raw)) throw new Error("payment_address_invalid");
  const countryCode = text(raw.country_code ?? raw.countryCode, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("payment_country_invalid");
  const city = text(raw.city ?? raw.district ?? raw.administrative_area ?? raw.province, 160);
  if (!city) throw new Error("payment_city_required");
  const address = [
    text(raw.address_line1 ?? raw.address_line, 1000),
    text(raw.address_line2, 500),
    text(raw.locality ?? raw.neighborhood, 160),
  ].filter(Boolean).join(" ").trim();
  if (address.length < 5 || address.length > 1000) throw new Error("payment_address_invalid");
  const postalCode = text(raw.postal_code ?? raw.postalCode, 30);
  if (!postalCode) throw new Error("payment_postal_code_required");
  const recipientName = text(raw.recipient_name ?? raw.recipientName, 240);
  return { countryCode, city, address, postalCode, recipientName };
}

function classifyPayment(data: IyzicoJson): PaymentState {
  const fraudStatus = Number(data.fraudStatus);
  if (fraudStatus === 1) return "captured";
  if (fraudStatus === 0) return "authorized";
  if (fraudStatus === -1) return "failed";
  throw new Error("payment_fraud_status_invalid");
}

function safeProviderPayload(data: IyzicoJson, signatureVerified: boolean) {
  const allowed = [
    "status", "locale", "systemTime", "conversationId", "paymentId", "price", "paidPrice",
    "installment", "fraudStatus", "merchantCommissionRate", "merchantCommissionRateAmount",
    "iyziCommissionRateAmount", "iyziCommissionFee", "cardType", "cardAssociation", "cardFamily",
    "lastFourDigits", "basketId", "currency", "authCode", "phase", "hostReference", "paymentStatus",
  ];
  const result: RecordValue = { signatureVerified };
  for (const key of allowed) if (data[key] != null) result[key] = data[key];
  if (Array.isArray(data.itemTransactions)) {
    result.itemTransactions = data.itemTransactions.slice(0, 100).map((item) => {
      if (!isRecord(item)) return {};
      return {
        itemId: item.itemId,
        paymentTransactionId: item.paymentTransactionId,
        transactionStatus: item.transactionStatus,
        price: item.price,
        paidPrice: item.paidPrice,
        subMerchantPrice: item.subMerchantPrice,
      };
    });
  }
  return result;
}

function marketplaceBasket(context: RecordValue) {
  const priceMinor = integer(context.priceMinor, 1);
  const splitTotalMinor = integer(context.splitTotalMinor, 1);
  if (priceMinor == null || splitTotalMinor == null || splitTotalMinor > priceMinor) throw new Error("payment_marketplace_totals_invalid");
  if (!Array.isArray(context.items) || context.items.length < 1 || context.items.length > 100) throw new Error("payment_items_invalid");
  let priceSum = 0;
  let splitSum = 0;
  const items = context.items.map((raw) => {
    if (!isRecord(raw)) throw new Error("payment_item_invalid");
    const id = uuid(raw.id);
    const name = text(raw.name, 300);
    const lineTotalMinor = integer(raw.lineTotalMinor, 1);
    const subMerchantKey = text(raw.subMerchantKey, 500);
    const subMerchantPriceMinor = integer(raw.subMerchantPriceMinor, 1);
    if (!id || !name || lineTotalMinor == null || !subMerchantKey || subMerchantPriceMinor == null || subMerchantPriceMinor > lineTotalMinor) {
      throw new Error("payment_marketplace_item_invalid");
    }
    priceSum += lineTotalMinor;
    splitSum += subMerchantPriceMinor;
    if (!Number.isSafeInteger(priceSum) || !Number.isSafeInteger(splitSum)) throw new Error("payment_marketplace_totals_invalid");
    return {
      id,
      name,
      category1: "Köy Ürünleri",
      itemType: "PHYSICAL",
      price: minorToMajor(lineTotalMinor),
      subMerchantKey,
      subMerchantPrice: minorToMajor(subMerchantPriceMinor),
    };
  });
  if (priceSum !== priceMinor || splitSum !== splitTotalMinor) throw new Error("payment_marketplace_totals_mismatch");
  return items;
}

function verifyProviderResponse(data: IyzicoJson, context: RecordValue, intentId: string) {
  const orderNumber = text(context.orderNumber, 160);
  const currency = text(context.currency, 3).toUpperCase();
  const priceMinor = integer(context.priceMinor, 1);
  const amountMinor = integer(context.amountMinor, 1);
  if (!orderNumber || !PAYMENT_CURRENCIES.has(currency) || priceMinor == null || amountMinor == null) throw new Error("payment_context_invalid");
  if (text(data.conversationId, 160) !== intentId) throw new Error("payment_conversation_mismatch");
  if (text(data.basketId, 180) !== orderNumber) throw new Error("payment_basket_mismatch");
  if (text(data.currency, 3).toUpperCase() !== currency) throw new Error("payment_currency_mismatch");
  if (decimalToMinor(data.price) !== priceMinor || decimalToMinor(data.paidPrice) !== amountMinor) throw new Error("payment_amount_mismatch");
  const paymentId = typeof data.paymentId === "number" ? String(data.paymentId) : text(data.paymentId, 220);
  if (!paymentId) throw new Error("payment_provider_reference_missing");
  return paymentId;
}

async function completeOrder(service: any, intentId: string, providerReference: string, state: PaymentState, providerPayload: RecordValue) {
  const { data, error } = await service.rpc("complete_order_payment_for_service_v1", {
    p_intent_id: intentId,
    p_provider_reference: providerReference,
    p_status: state,
    p_provider_payload: providerPayload,
    p_failure_code: state === "failed" ? "provider_fraud_rejected" : null,
    p_failure_message: state === "failed" ? "Ödeme sağlayıcısı işlemi reddetti." : null,
  });
  if (error) throw error;
  if (!isRecord(data) || data.ok !== true) throw new Error("payment_completion_invalid");
  return data;
}

async function failOrder(service: any, intentId: string, providerData: IyzicoJson) {
  const providerError = iyzicoError(providerData, "provider_rejected");
  const safePayload = safeProviderPayload(providerData, false);
  const { data, error } = await service.rpc("fail_order_payment_intent_for_service_v1", {
    p_intent_id: intentId,
    p_failure_code: providerError.code,
    p_failure_message: providerError.message || "Ödeme sağlayıcısı işlemi kabul etmedi.",
    p_provider_payload: safePayload,
  });
  if (error) throw error;
  return { data, providerError };
}

async function reconcile(service: any, context: RecordValue) {
  const intentId = uuid(context.intentId);
  if (!intentId) throw new Error("payment_intent_invalid");
  let providerResponse: Awaited<ReturnType<typeof iyzicoRequest>>;
  try {
    providerResponse = await iyzicoRequest("/payment/detail", "POST", {
      locale: "tr",
      paymentConversationId: intentId,
    });
  } catch {
    return { ok: true, state: "processing", intentId, orderId: context.orderId, reconciliationPending: true };
  }
  const { response, data } = providerResponse;
  if (!response.ok || data.status !== "success") {
    if (response.status >= 500) return { ok: true, state: "processing", intentId, orderId: context.orderId, reconciliationPending: true };
    const failed = await failOrder(service, intentId, data);
    return { ok: false, state: "failed", intentId, orderId: context.orderId, error: failed.providerError.code };
  }
  const signatureVerified = await verifyIyzicoNon3dResponseSignature(data);
  if (!signatureVerified) return { ok: true, state: "processing", intentId, orderId: context.orderId, reconciliationPending: true };
  const providerReference = verifyProviderResponse(data, context, intentId);
  const state = classifyPayment(data);
  const result = await completeOrder(service, intentId, providerReference, state, safeProviderPayload(data, true));
  return { ok: state !== "failed", state, intentId, orderId: context.orderId, result };
}

function publicError(error: unknown) {
  const raw = error instanceof Error ? error.message : "payment_failed";
  const code = raw.split(":")[0].trim();
  const allowed = new Set([
    "authentication_required", "invalid_request", "unsupported_action", "order_id_required",
    "invalid_payment_idempotency_key", "buyer_identity_type_required", "payment_turkish_identity_invalid",
    "payment_passport_invalid", "payment_profile_full_name_required", "payment_postal_code_required",
    "payment_request_ip_required", "payment_provider_not_configured", "payment_method_required",
    "payment_method_not_found", "payment_method_expired", "payment_method_provider_mismatch",
    "producer_payment_account_not_ready", "payment_reservation_expired", "payment_review_pending",
    "payment_provider_credentials_missing", "payment_provider_signature_invalid", "payment_failed",
  ]);
  return allowed.has(code) ? code : "payment_failed";
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
    if (userError || !user?.id) return json(401, { ok: false, error: "authentication_required" });

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return json(400, { ok: false, error: "invalid_request" });
    if (text(body.action, 30) !== "pay_order") return json(400, { ok: false, error: "unsupported_action" });

    const orderId = uuid(body.orderId);
    const idempotencyKey = text(body.idempotencyKey, 120);
    if (!orderId) return json(400, { ok: false, error: "order_id_required" });
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(idempotencyKey)) return json(400, { ok: false, error: "invalid_payment_idempotency_key" });

    const { data: preparedRaw, error: prepareError } = await service.rpc("prepare_order_payment_for_service_v2", {
      p_user_id: user.id,
      p_order_id: orderId,
      p_idempotency_key: idempotencyKey,
    });
    if (prepareError) throw prepareError;
    if (!isRecord(preparedRaw)) throw new Error("payment_context_invalid");
    const prepared = preparedRaw as RecordValue;
    const intentId = uuid(prepared.intentId);

    if (prepared.action === "terminal") {
      const state = text(prepared.status, 40) || text(prepared.intentStatus, 40) || "terminal";
      return json(200, {
        ok: state === "captured",
        state,
        intentId: intentId || null,
        orderId: prepared.orderId,
        orderNumber: prepared.orderNumber,
        paymentStatus: prepared.paymentStatus,
        orderStatus: prepared.orderStatus,
      });
    }

    if (!intentId) throw new Error("payment_intent_invalid");
    if (prepared.action === "reconcile") return json(200, await reconcile(service, prepared));
    if (prepared.action !== "charge") throw new Error("payment_action_invalid");
    if (text(prepared.provider, 40).toLowerCase() !== "iyzico") throw new Error("unsupported_payment_provider");

    const shipping = addressContext(prepared.shippingAddress);
    const buyer = isRecord(prepared.buyer) ? prepared.buyer : {};
    const names = fullNameParts(buyer.displayName, shipping.recipientName);
    const email = validEmail(buyer.email);
    const phone = validPhone(buyer.phone);
    if (!email) throw new Error("payment_buyer_email_invalid");
    if (!phone) throw new Error("payment_buyer_phone_invalid");
    const identityNumber = buyerIdentity(body.buyerIdentityNumber, identityType(body.buyerIdentityType));
    const providerCustomerRef = text(prepared.providerCustomerRef, 500);
    const providerPaymentMethodRef = text(prepared.providerPaymentMethodRef, 500);
    const orderNumber = text(prepared.orderNumber, 180);
    const currency = text(prepared.currency, 3).toUpperCase();
    const amountMinor = integer(prepared.amountMinor, 1);
    const priceMinor = integer(prepared.priceMinor, 1);
    if (!providerCustomerRef || !providerPaymentMethodRef || !orderNumber || !PAYMENT_CURRENCIES.has(currency) || amountMinor == null || priceMinor == null) {
      throw new Error("payment_context_incomplete");
    }

    const basketItems = marketplaceBasket(prepared);
    const paymentPayload = {
      locale: "tr",
      conversationId: intentId,
      price: minorToMajor(priceMinor),
      paidPrice: minorToMajor(amountMinor),
      currency,
      installment: 1,
      basketId: orderNumber,
      paymentChannel: "WEB",
      paymentGroup: "PRODUCT",
      paymentCard: {
        cardUserKey: providerCustomerRef,
        cardToken: providerPaymentMethodRef,
      },
      buyer: {
        id: user.id,
        name: names.name,
        surname: names.surname,
        gsmNumber: phone,
        email,
        identityNumber,
        registrationAddress: shipping.address,
        ip: requestIp(req),
        city: shipping.city,
        country: shipping.countryCode,
        zipCode: shipping.postalCode,
      },
      shippingAddress: {
        contactName: names.fullName,
        city: shipping.city,
        country: shipping.countryCode,
        address: shipping.address,
        zipCode: shipping.postalCode,
      },
      billingAddress: {
        contactName: names.fullName,
        city: shipping.city,
        country: shipping.countryCode,
        address: shipping.address,
        zipCode: shipping.postalCode,
      },
      basketItems,
    };

    let providerResponse: Awaited<ReturnType<typeof iyzicoRequest>>;
    try {
      providerResponse = await iyzicoRequest("/payment/auth", "POST", paymentPayload);
    } catch {
      return json(202, { ok: true, state: "processing", intentId, orderId, reconciliationPending: true });
    }

    const { response, data } = providerResponse;
    if (!response.ok || data.status !== "success") {
      if (response.status >= 500) return json(202, { ok: true, state: "processing", intentId, orderId, reconciliationPending: true });
      const failed = await failOrder(service, intentId, data);
      return json(402, { ok: false, state: "failed", intentId, orderId, error: failed.providerError.code });
    }

    const signatureVerified = await verifyIyzicoNon3dResponseSignature(data);
    if (!signatureVerified) return json(202, { ok: true, state: "processing", intentId, orderId, reconciliationPending: true });

    const providerReference = verifyProviderResponse(data, prepared, intentId);
    const state = classifyPayment(data);
    const result = await completeOrder(service, intentId, providerReference, state, safeProviderPayload(data, true));
    return json(state === "failed" ? 402 : 200, {
      ok: state !== "failed",
      state,
      intentId,
      orderId,
      orderNumber,
      result,
    });
  } catch (error) {
    const code = publicError(error);
    const status = code === "authentication_required" ? 401
      : code === "payment_provider_not_configured" || code === "payment_provider_credentials_missing" ? 503
      : code === "producer_payment_account_not_ready" || code === "payment_review_pending" || code === "payment_reservation_expired" ? 409
      : 400;
    return json(status, { ok: false, error: code });
  }
});
