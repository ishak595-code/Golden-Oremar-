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
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasEnv(...keys: string[]) {
  return keys.every((key) => Boolean(Deno.env.get(key)?.trim()));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authorization = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !anonKey || !authorization) return json(401, { ok: false, error: "authentication_required" });

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user?.id) return json(401, { ok: false, error: "authentication_required" });

    const { data: configRaw, error: configError } = await client.rpc("super_admin_get_payment_control_v1");
    if (configError) throw configError;
    if (!isRecord(configRaw)) throw new Error("payment_config_invalid");

    const google = isRecord(configRaw.google_pay) ? configRaw.google_pay : {};
    const apple = isRecord(configRaw.apple_pay) ? configRaw.apple_pay : {};
    const carrier = isRecord(configRaw.carrier_billing) ? configRaw.carrier_billing : {};

    const iyzicoSecretsConfigured = hasEnv("IYZICO_API_KEY", "IYZICO_SECRET_KEY", "IYZICO_BASE_URL");
    const bokuSecretsConfigured = hasEnv("BOKU_API_KEY", "BOKU_API_SECRET", "BOKU_BASE_URL");
    const provider = typeof configRaw.provider === "string" ? configRaw.provider : null;
    const liveCardsEnabled = configRaw.live_card_payments_enabled === true;
    const savedCardsEnabled = configRaw.card_enrollment_enabled === true;
    const pwiEnabled = configRaw.pay_with_iyzico_enabled === true;
    const googleEnabled = google.enabled === true;
    const appleEnabled = apple.enabled === true;
    const carrierEnabled = carrier.enabled === true;

    return json(200, {
      ok: true,
      provider,
      runtime: {
        iyzicoSecretsConfigured,
        bokuSecretsConfigured,
      },
      methods: {
        card: {
          enabled: liveCardsEnabled,
          ready: liveCardsEnabled && provider === "iyzico" && iyzicoSecretsConfigured,
        },
        savedCard: {
          enabled: savedCardsEnabled,
          ready: savedCardsEnabled && provider === "iyzico" && iyzicoSecretsConfigured,
        },
        payWithIyzico: {
          enabled: pwiEnabled,
          ready: pwiEnabled && provider === "iyzico" && iyzicoSecretsConfigured,
        },
        googlePay: {
          enabled: googleEnabled,
          ready: googleEnabled && google.requires_gateway_approval === false && Boolean(google.merchant_id) && Boolean(google.gateway),
        },
        applePay: {
          enabled: appleEnabled,
          ready: appleEnabled && apple.requires_processor_approval === false && Boolean(apple.merchant_id),
        },
        carrierBilling: {
          enabled: carrierEnabled,
          ready: carrierEnabled && carrier.provider === "boku" && carrier.requires_commercial_contract === false && carrier.physical_goods_eligibility_confirmed === true && bokuSecretsConfigured,
        },
        bankTransfer: {
          enabled: configRaw.bank_transfer_enabled === true,
          ready: configRaw.bank_transfer_enabled === true,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment_health_failed";
    const status = message.includes("super_admin_required") ? 403 : 400;
    return json(status, { ok: false, error: message.length <= 240 ? message : "payment_health_failed" });
  }
});
