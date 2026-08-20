import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { iyzicoError, iyzicoRequest, iyzicoScalar, type IyzicoJson } from "../_shared/iyzico.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type RecordValue = Record<string, unknown>;

function json(status: number, body: RecordValue) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeText(value: unknown, max = 500) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return "";
  return normalized;
}

function safeApprovalPayload(data: IyzicoJson) {
  const result: RecordValue = {};
  for (const key of ["status", "locale", "systemTime", "conversationId", "paymentTransactionId"]) {
    if (data[key] != null) result[key] = data[key];
  }
  return result;
}

async function markFailed(service: any, actorUserId: string, orderId: string, errorCode: string) {
  await service.rpc("fail_order_settlement_for_service_v1", {
    p_actor_user_id: actorUserId,
    p_order_id: orderId,
    p_error: errorCode.slice(0, 500),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  let actorUserId = "";
  let orderId = "";
  let service: any = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authorization = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return json(401, { ok: false, error: "authentication_required" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    actorUserId = userData.user?.id || "";
    if (userError || !UUID_RE.test(actorUserId)) return json(401, { ok: false, error: "authentication_required" });

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return json(400, { ok: false, error: "invalid_request" });
    orderId = safeText(body.orderId, 80);
    if (!UUID_RE.test(orderId)) return json(400, { ok: false, error: "order_id_required" });

    const { data: preparedRaw, error: prepareError } = await service.rpc("prepare_order_settlement_for_service_v1", {
      p_actor_user_id: actorUserId,
      p_order_id: orderId,
    });
    if (prepareError) throw prepareError;
    if (!isRecord(preparedRaw)) throw new Error("settlement_prepare_invalid");

    if (preparedRaw.action === "terminal") {
      return json(200, { ok: true, released: preparedRaw.released === true, orderId, state: preparedRaw.state ?? null });
    }
    if (preparedRaw.action !== "approve" || !Array.isArray(preparedRaw.items) || preparedRaw.items.length < 1 || preparedRaw.items.length > 200) {
      throw new Error("settlement_prepare_invalid");
    }

    let lastResult: RecordValue | null = null;
    for (const rawItem of preparedRaw.items) {
      if (!isRecord(rawItem)) throw new Error("settlement_item_invalid");
      const provider = safeText(rawItem.provider, 40).toLowerCase();
      const paymentTransactionId = safeText(rawItem.paymentTransactionId, 220);
      if (provider !== "iyzico" || !paymentTransactionId) throw new Error("settlement_item_invalid");

      let providerResponse: Awaited<ReturnType<typeof iyzicoRequest>>;
      try {
        providerResponse = await iyzicoRequest("/payment/iyzipos/item/approve", "POST", {
          locale: "tr",
          conversationId: orderId,
          paymentTransactionId,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "settlement_provider_unavailable";
        await markFailed(service, actorUserId, orderId, code || "settlement_provider_unavailable");
        const status = code.includes("credentials") ? 503 : 502;
        return json(status, { ok: false, error: code.includes("credentials") ? "payment_provider_credentials_missing" : "settlement_provider_unavailable" });
      }

      const { response, data } = providerResponse;
      if (!response.ok || data.status !== "success") {
        const providerError = iyzicoError(data, "settlement_provider_approval_failed");
        await markFailed(service, actorUserId, orderId, providerError.code);
        return json(502, { ok: false, error: "settlement_provider_approval_failed" });
      }
      if (iyzicoScalar(data.paymentTransactionId, 220) !== paymentTransactionId) {
        await markFailed(service, actorUserId, orderId, "settlement_provider_transaction_mismatch");
        return json(502, { ok: false, error: "settlement_provider_transaction_mismatch" });
      }

      const { data: completedRaw, error: completeError } = await service.rpc("complete_order_settlement_item_for_service_v1", {
        p_actor_user_id: actorUserId,
        p_order_id: orderId,
        p_payment_transaction_id: paymentTransactionId,
        p_provider_payload: safeApprovalPayload(data),
      });
      if (completeError) throw completeError;
      if (!isRecord(completedRaw) || completedRaw.ok !== true) throw new Error("settlement_finalize_invalid");
      lastResult = completedRaw;
    }

    return json(200, {
      ok: true,
      released: lastResult?.released === true,
      orderId,
      remaining: typeof lastResult?.remaining === "number" ? lastResult.remaining : null,
      state: lastResult?.state ?? null,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "settlement_failed";
    const code = raw.split(":")[0].trim();
    if (service && actorUserId && orderId) await markFailed(service, actorUserId, orderId, code || "settlement_failed").catch(() => undefined);
    const status = code.includes("authentication_required") ? 401
      : code.includes("super_admin_required") ? 403
      : code.includes("not_releasable") || code.includes("open_return") || code.includes("refund") ? 409
      : code.includes("credentials") ? 503
      : 400;
    const allowed = new Set([
      "authentication_required", "super_admin_required", "order_not_found", "settlement_not_releasable",
      "settlement_provider_unavailable", "settlement_provider_approval_failed", "payment_provider_credentials_missing",
      "settlement_provider_transaction_mismatch", "settlement_prepare_invalid", "settlement_finalize_invalid",
    ]);
    return json(status, { ok: false, error: allowed.has(code) ? code : "settlement_failed" });
  }
});
