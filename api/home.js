import { CORS, json, rpc, unavailable } from './_supabase.js';

export const config = { runtime: 'edge' };

const LOCALES = new Set(['tr', 'en', 'de', 'fr', 'ku', 'ar']);

/**
 * GET /api/home?v=<version>&locale=tr
 * The whole home page in one answer: the composition plus every showcase with
 * its products, so the page needs no further requests. Keyed by the content
 * version in the URL, so a new version is a new edge entry (fresh at once);
 * the same version is served from the edge. The 60 s edge lifetime only
 * covers campaigns that start or end on a schedule. ETag/304 for revisits.
 */
export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const localeRaw = String(url.searchParams.get('locale') || 'tr').toLowerCase();
  const locale = LOCALES.has(localeRaw) ? localeRaw : 'tr';
  try {
    const [versionData, experience] = await Promise.all([
      rpc('get_home_content_version_v1', {}, 3000).catch(() => null),
      rpc('get_public_home_experience_v1', { p_locale: locale }),
    ]);
    if (!experience || typeof experience !== 'object' || !Array.isArray(experience.sections)) return unavailable({ status: 502 });
    const keys = experience.sections.map(section => section?.key).filter(key => typeof key === 'string' && key);
    const loaded = await Promise.all(keys.map(key => rpc('get_public_home_section_v1', { p_key: key, p_locale: locale }).catch(() => undefined)));
    const sections = {};
    keys.forEach((key, index) => { if (loaded[index] !== undefined) sections[key] = loaded[index]; });
    const version = Number(versionData?.version) || 0;
    const etag = `"home-${version}-${locale}-${keys.length}-${Object.keys(sections).length}"`;
    const headers = { ETag: etag, 'X-Home-Version': String(version) };
    const cache = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
    if (version && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { 'Cache-Control': cache, ...CORS, ...headers } });
    return json({ version, locale, experience, sections }, 200, cache, headers);
  } catch (error) {
    return unavailable(error);
  }
}
