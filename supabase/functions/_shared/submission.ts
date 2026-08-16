const encoder = new TextEncoder();

const defaultAllowedOrigins = [
  'https://goldenoremar.com',
  'https://www.goldenoremar.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'capacitor://localhost',
];

const allowedOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') || defaultAllowedOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export function requestCorsHeaders(request: Request): HeadersInit | null {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin || defaultAllowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit): Response {
  return Response.json(body, { status, headers: { ...corsHeaders, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function readJsonBody(request: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new SubmissionError(413, 'payload_too_large');
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) throw new SubmissionError(413, 'payload_too_large');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_shape');
    return parsed as Record<string, unknown>;
  } catch { throw new SubmissionError(400, 'invalid_json'); }
}

export const cleanString = (value: unknown, maxLength: number): string => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function requestIpHash(request: Request): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new SubmissionError(500, 'server_configuration_error');
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ipAddress = request.headers.get('cf-connecting-ip') || forwardedFor || 'unknown';
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ipAddress));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function idempotencyKey(request: Request, body: Record<string, unknown>, scope: string): string {
  const raw = cleanString(request.headers.get('x-idempotency-key') || body.idempotencyKey, 160);
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(raw)) throw new SubmissionError(400, 'invalid_idempotency_key');
  return `${scope}:${raw}`;
}
export class SubmissionError extends Error { constructor(public readonly status: number, public readonly code: string) { super(code); } }
export function databaseErrorResponse(error: { message?: string; code?: string }, corsHeaders: HeadersInit): Response {
  const message = String(error.message || 'submission_failed');
  const code = message.includes('rate_limit_exceeded') ? 'rate_limit_exceeded'
    : message.includes('duplicate_reservation') ? 'duplicate_reservation'
    : message.includes('event_not_available') ? 'event_not_available'
    : message.includes('reservation_deadline_passed') ? 'reservation_deadline_passed'
    : message.includes('idempotency_key_reused') || message.includes('request_in_progress') ? 'request_conflict'
    : message.startsWith('invalid_') ? message.match(/invalid_[a-z_]+/)?.[0] || 'invalid_submission' : 'submission_failed';
  const status = code === 'rate_limit_exceeded' ? 429 : ['duplicate_reservation','event_not_available','reservation_deadline_passed','request_conflict'].includes(code) ? 409 : code.startsWith('invalid_') ? 400 : 500;
  if (status === 500) console.error('Submission database error', { code: error.code, message: error.message });
  return jsonResponse({ ok: false, error: code }, status, corsHeaders);
}
export function unexpectedErrorResponse(error: unknown, corsHeaders: HeadersInit): Response {
  if (error instanceof SubmissionError) return jsonResponse({ ok: false, error: error.code }, error.status, corsHeaders);
  console.error('Unexpected submission error', error instanceof Error ? error.message : String(error));
  return jsonResponse({ ok: false, error: 'internal_error' }, 500, corsHeaders);
}
