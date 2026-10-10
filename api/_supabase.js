// Shared by the home edge endpoints. The URL and publishable key are public
// client configuration (the same values the browser bundle carries).
export const SUPABASE_URL = String(process.env.VITE_SUPABASE_URL || 'https://rmfcziawxjgcnxexbrvw.supabase.co').trim();
export const SUPABASE_KEY = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_n4P4WYheJjOzgjO90Ko_jA_vh3CS8Vg').trim();

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'If-None-Match',
  'Access-Control-Expose-Headers': 'ETag, X-Home-Version',
};

export async function rpc(name, args = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`${name} HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function json(body, status, cacheControl, extra = {}) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl, ...CORS, ...extra },
  });
}

/** Backend down or over quota: say so without caching, the app then uses its own copy. */
export function unavailable(error) {
  return json({ error: 'backend_unavailable', status: Number(error?.status) || 0 }, 503, 'no-store');
}
