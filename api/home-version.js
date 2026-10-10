import { CORS, json, rpc, unavailable } from './_supabase.js';

export const config = { runtime: 'edge' };

/**
 * GET /api/home-version -> {"version":123,"updatedAt":"..."}
 * A few bytes, cached one second at the edge: every visitor in a region shares
 * one database read per second, and an admin edit is seen within ~1-2 s.
 */
export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const data = await rpc('get_home_content_version_v1', {}, 3000);
    const version = Number(data?.version);
    if (!Number.isSafeInteger(version) || version < 1) return unavailable({ status: 502 });
    return json({ version, updatedAt: String(data.updatedAt || '') }, 200, 'public, max-age=0, s-maxage=1, stale-while-revalidate=5', { 'X-Home-Version': String(version) });
  } catch (error) {
    return unavailable(error);
  }
}
