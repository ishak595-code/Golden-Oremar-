import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`), {
  timeoutDuration: 5000,
  cooldownDuration: 30_000,
  cacheMaxAge: 10 * 60_000,
});
const EXPECTED_AUDIENCE = "golden-oremar-ci-e2e";
const EXPECTED_REPOSITORY = "ishak595-code/Golden-Oremar-";
const EXPECTED_REPOSITORY_ID = "1335636205";
const EXPECTED_OWNER_ID = "233486723";
const EXPECTED_WORKFLOW = "Mobile Quality Gate";
const EXPECTED_WORKFLOW_PATH = `${EXPECTED_REPOSITORY}/.github/workflows/mobile-quality.yml@`;
const TRUSTED_BRANCH_REFS = new Set([
  "refs/heads/main",
  "refs/heads/integration/full-consolidation-2026-08",
]);
const PULL_REQUEST_REF_RE = /^refs\/pull\/\d{1,12}\/merge$/;
const RUN_ID_RE = /^\d{1,24}$/;
const PASSWORD_RE = /^[^\u0000-\u001F\u007F]{12,72}$/;
const PHONE_RE = /^\+[1-9][0-9]{9,14}$/;

type Action = "provision" | "confirm" | "delete";
type GithubClaims = {
  repository?: string;
  repository_id?: string;
  repository_owner_id?: string;
  workflow?: string;
  workflow_ref?: string;
  job_workflow_ref?: string;
  event_name?: string;
  ref?: string;
  run_id?: string;
  runner_environment?: string;
};
type Body = {
  action?: unknown;
  runId?: unknown;
  password?: unknown;
  displayName?: unknown;
  phone?: unknown;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function bearerToken(req: Request) {
  const value = String(req.headers.get("authorization") || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
}

function emailForRun(runId: string) {
  return `goldenoremar+ci-e2e-${runId}@gmail.com`;
}

function cleanDisplayName(value: unknown) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 120 || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error("invalid_display_name");
  return normalized;
}

function cleanPassword(value: unknown) {
  const password = typeof value === "string" ? value : "";
  if (!PASSWORD_RE.test(password)) throw new Error("invalid_password");
  return password;
}

function cleanPhone(value: unknown) {
  const phone = String(value || "").trim();
  if (!PHONE_RE.test(phone)) throw new Error("invalid_phone");
  return phone;
}

function verifyEventAndRef(payload: GithubClaims) {
  const eventName = String(payload.event_name || "");
  const ref = String(payload.ref || "");
  if (eventName === "pull_request") {
    if (!PULL_REQUEST_REF_RE.test(ref)) throw new Error("github_ref_not_allowed");
    return;
  }
  if (eventName === "push" || eventName === "workflow_dispatch") {
    if (!TRUSTED_BRANCH_REFS.has(ref)) throw new Error("github_ref_not_allowed");
    return;
  }
  throw new Error("github_event_not_allowed");
}

async function verifyGithubOidc(req: Request, runId: string) {
  const token = bearerToken(req);
  if (!token) throw new Error("github_oidc_token_required");
  const { payload } = await jwtVerify<GithubClaims>(token, GITHUB_JWKS, {
    issuer: GITHUB_ISSUER,
    audience: EXPECTED_AUDIENCE,
    algorithms: ["RS256"],
    clockTolerance: 5,
  });
  const workflowRef = String(payload.workflow_ref || payload.job_workflow_ref || "");
  if (String(payload.repository || "") !== EXPECTED_REPOSITORY) throw new Error("github_repository_not_allowed");
  if (String(payload.repository_id || "") !== EXPECTED_REPOSITORY_ID) throw new Error("github_repository_id_not_allowed");
  if (String(payload.repository_owner_id || "") !== EXPECTED_OWNER_ID) throw new Error("github_owner_not_allowed");
  if (String(payload.workflow || "") !== EXPECTED_WORKFLOW) throw new Error("github_workflow_not_allowed");
  if (!workflowRef.includes(EXPECTED_WORKFLOW_PATH)) throw new Error("github_workflow_ref_not_allowed");
  verifyEventAndRef(payload);
  if (String(payload.run_id || "") !== runId) throw new Error("github_run_id_mismatch");
  if (String(payload.runner_environment || "") !== "github-hosted") throw new Error("github_runner_not_allowed");
}

async function findUserByEmail(supabaseUrl: string, serviceRole: string, email: string) {
  const endpoint = new URL(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/admin/users`);
  endpoint.searchParams.set("filter", email);
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("per_page", "50");
  const response = await fetch(endpoint, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`auth_admin_lookup_failed_${response.status}`);
  const body = await response.json().catch(() => ({}));
  const users = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : [];
  return users.find((user: any) => String(user?.email || "").toLowerCase() === email.toLowerCase()) || null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => null) as Body | null;
    const action = String(body?.action || "") as Action;
    const runId = String(body?.runId || "").trim();
    if (!(["provision", "confirm", "delete"] as string[]).includes(action)) return json({ ok: false, error: "invalid_action" }, 400);
    if (!RUN_ID_RE.test(runId)) return json({ ok: false, error: "invalid_run_id" }, 400);
    await verifyGithubOidc(req, runId);

    const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
    const serviceRole = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    if (!supabaseUrl || !serviceRole) throw new Error("supabase_admin_runtime_missing");
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const email = emailForRun(runId);
    const existing = await findUserByEmail(supabaseUrl, serviceRole, email);

    if (action === "delete") {
      if (!existing?.id) return json({ ok: true, deleted: false, alreadyAbsent: true });
      const { error } = await admin.auth.admin.deleteUser(String(existing.id), false);
      if (error) throw error;
      return json({ ok: true, deleted: true });
    }

    if (action === "provision") {
      const password = cleanPassword(body?.password);
      const displayName = cleanDisplayName(body?.displayName);
      const phone = cleanPhone(body?.phone);
      if (existing?.id) {
        const { error } = await admin.auth.admin.deleteUser(String(existing.id), false);
        if (error) throw error;
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          phone,
          locale: "tr",
          e2e_run_id: runId,
          source: "github-actions-e2e",
        },
      });
      if (error) throw error;
      if (!data.user?.id) throw new Error("e2e_user_provision_failed");
      return json({ ok: true, provisioned: true, emailConfirmed: Boolean(data.user.email_confirmed_at) });
    }

    if (!existing?.id) return json({ ok: false, error: "e2e_user_not_found" }, 404);
    if (!existing.email_confirmed_at) {
      const { error } = await admin.auth.admin.updateUserById(String(existing.id), { email_confirm: true });
      if (error) throw error;
    }
    return json({ ok: true, confirmed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("ci-e2e-user", message);
    const status = message.startsWith("github_") ? 403 : message.startsWith("invalid_") ? 400 : 500;
    return json({ ok: false, error: message }, status);
  }
});
