/**
 * Keeps the storefront open when the backend is not.
 *
 * In September 2026 the Supabase project hit its free-plan quota and every
 * API call answered HTTP 402 for weeks: the home page, categories and product
 * pages were empty although the catalogue itself was fine. This module sits in
 * front of the Supabase client's fetch. When a public, read-only catalogue
 * call fails with 402, a 5xx or a network error, it answers from the last
 * known good copy that ships with the app (public/offline-catalog/). Nothing
 * that writes (cart, orders, sign-in, messages) is ever answered from here;
 * those keep failing with a clear Turkish message.
 *
 * The copy is exported from the live database by scripts/offline-catalog/.
 * Search, category pages, filters, suggestions, recommendations, handling
 * profiles and follow counts are derived from the home catalogue, so only the
 * home, product and safety documents need to be shipped.
 */

export const OFFLINE_CATALOG_BASE = '/offline-catalog/';
export const SNAPSHOT_MODE_EVENT = 'golden-oremar:snapshot-mode';

type Json = Record<string, any>;
type Args = Record<string, any>;

let snapshotMode = false;
const cache = new Map<string, Promise<unknown | null>>();

export function isSnapshotMode() {
  return snapshotMode;
}

function markSnapshotMode() {
  if (snapshotMode) return;
  snapshotMode = true;
  try { window.dispatchEvent(new CustomEvent(SNAPSHOT_MODE_EVENT)); } catch { /* not in a browser */ }
}

async function load(file: string): Promise<any | null> {
  if (!cache.has(file)) {
    cache.set(file, (async () => {
      try {
        const response = await fetch(`${OFFLINE_CATALOG_BASE}${file}`, { cache: 'no-cache' });
        // A host that answers a missing file with the app shell (200, HTML)
        // must read as "no copy", not as a parse error further up.
        if (!response.ok || /text\/html/i.test(response.headers.get('content-type') || '')) return null;
        return await response.json();
      } catch {
        return null;
      }
    })());
  }
  return cache.get(file)!;
}

const trLower = (value: unknown) => String(value ?? '').toLocaleLowerCase('tr-TR');
const safeFile = (value: unknown) => /^[a-z0-9][a-z0-9._-]{0,219}$/i.test(String(value ?? '')) ? String(value) : '';

/** Brand images live in the app too; use them while Supabase Storage is closed. */
const LOCAL_BRAND_IMAGES: Record<string, string> = {
  'brand/official-store/golden-oremar-profile.webp': 'brand/golden-oremar-official-store-profile.webp',
  'brand/official-store/golden-oremar-cover.webp': 'brand/golden-oremar-official-store-cover.webp',
};
function localizeImages<T>(value: T): T {
  let origin = '';
  try { origin = window.location.origin; } catch { return value; }
  if (!/^https:\/\//.test(origin)) return value;
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return typeof node === 'string' && LOCAL_BRAND_IMAGES[node] ? `${origin}/${LOCAL_BRAND_IMAGES[node]}` : node;
    const out: Json = {};
    for (const [key, child] of Object.entries(node)) out[key] = walk(child);
    return out;
  };
  return walk(value);
}

/** The shipped home catalogue, or null when the copy is missing (then the original error stands). */
async function catalogItems(): Promise<Json[] | null> {
  const home = await load('home_catalog.json');
  return Array.isArray(home?.items) ? home.items : null;
}

async function slugFor(reference: unknown): Promise<string> {
  const ref = String(reference ?? '').trim();
  if (!ref) return '';
  const items = await catalogItems();
  const hit = items?.find(item => item.slug === ref || item.id === ref || String(item.legacyId ?? '') === ref);
  return safeFile(hit?.slug || '');
}

function originParts(origin: unknown) {
  const parts = String(origin ?? '').split(',').map(part => part.trim()).filter(Boolean);
  const province = parts.length >= 1 ? parts[parts.length - 1] : '';
  const district = parts.length >= 2 ? parts[parts.length - 2] : '';
  const villageRaw = parts.length >= 3 ? parts[0] : '';
  const village = villageRaw.includes(' - ') ? villageRaw.split(' - ').pop()!.trim() : villageRaw;
  return { province, district, village };
}

function matches(item: Json, args: Args) {
  const query = trLower(args.p_query).trim();
  if (query) {
    // formerName: the product's earlier display name, so old searches still find it.
    const haystack = trLower([item.name, item.formerName, item.shortDescription, item.category?.name, item.producer?.name, item.origin].join(' '));
    if (!query.split(/\s+/).every(word => haystack.includes(word))) return false;
  }
  if (args.p_category_slug && item.category?.slug !== args.p_category_slug) return false;
  if (args.p_producer_id && item.producer?.id !== args.p_producer_id) return false;
  const place = originParts(item.origin);
  if (args.p_province && trLower(place.province) !== trLower(args.p_province)) return false;
  if (args.p_district && trLower(place.district) !== trLower(args.p_district)) return false;
  if (args.p_village && !trLower(place.village).includes(trLower(args.p_village))) return false;
  const price = Number(item.variant?.priceMinor ?? NaN);
  if (args.p_min_price_minor != null && !(price >= args.p_min_price_minor)) return false;
  if (args.p_max_price_minor != null && !(price <= args.p_max_price_minor)) return false;
  if (args.p_in_stock === true && item.stockMode !== 'untracked' && !(Number(item.availableQuantity) > 0)) return false;
  if (args.p_featured === true && item.featured !== true) return false;
  return true;
}

function sortItems(items: Json[], sort: unknown) {
  const copy = [...items];
  const price = (item: Json) => Number(item.variant?.priceMinor ?? 0);
  if (sort === 'price_asc') copy.sort((a, b) => price(a) - price(b));
  else if (sort === 'price_desc') copy.sort((a, b) => price(b) - price(a));
  else if (sort === 'rating') copy.sort((a, b) => Number(b.averageRating ?? 0) - Number(a.averageRating ?? 0) || Number(b.reviewCount ?? 0) - Number(a.reviewCount ?? 0));
  else copy.sort((a, b) => Number(b.featured === true) - Number(a.featured === true));
  return copy;
}

function withoutHomeSection(item: Json) {
  const { homeSection: _ignored, ...rest } = item;
  return rest;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'tr'));
}

type Resolver = (args: Args) => Promise<unknown | undefined>;

const RESOLVERS: Record<string, Resolver> = {
  get_public_brand_appearance_v1: () => load('brand.json'),
  get_public_home_catalog_v3: () => load('home_catalog.json'),
  list_public_categories_v2: () => load('categories.json'),
  get_public_home_experience_v1: () => load('home_experience.json'),
  get_public_home_section_v1: args => load(`sections/${safeFile(args.p_key)}.json`),
  get_public_storefront_config_v2: () => load('storefront_config.json'),
  get_public_contact_config_v1: () => load('contact_config.json'),
  // While the backend is down, ordering still works: the shipped copy of the
  // ordering channels (WhatsApp number, bank accounts) answers, and without
  // it the WhatsApp number from the shipped contact details.
  get_public_offline_ordering_v1: async () => {
    const shipped = await load('offline_ordering.json');
    if (shipped && typeof shipped === 'object' && shipped.whatsapp && shipped.bankTransfer) return shipped;
    const contact = await load('contact_config.json');
    const digits = String(contact?.whatsapp ?? '').replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(digits)) return undefined;
    return { whatsapp: { enabled: true, number: digits }, bankTransfer: { enabled: false, accounts: [], paymentWindowHours: 48 }, note: null };
  },
  list_public_events_v1: args => load(args.p_include_past === true ? 'events_all.json' : 'events_upcoming.json'),
  get_public_producer_profile_v3: async args => {
    const index = await load('producers.json');
    const ref = String(args.p_reference ?? '').trim();
    const hit = Array.isArray(index) ? index.find((row: Json) => row.slug === ref || row.id === ref) : null;
    return hit ? load(`producer/${safeFile(hit.slug)}.json`) : undefined;
  },
  get_public_product_detail_v6: async args => {
    const slug = await slugFor(args.p_reference);
    return slug ? load(`product/${slug}.json`) : undefined;
  },
  get_public_product_safety_v3: async args => {
    const slug = await slugFor(args.p_reference);
    return slug ? load(`safety/${slug}.json`) : undefined;
  },
  // The home catalogue is already in the server's order (featured, newest, name).
  get_public_product_context_v1: async args => {
    const items = await catalogItems();
    if (!items) return undefined;
    const ref = String(args.p_reference ?? '').trim();
    const limit = Math.min(12, Math.max(1, Number(args.p_limit) || 8));
    const product = items.find(item => item.slug === trLower(ref) || item.id === ref || String(item.legacyId ?? '') === ref);
    if (!product) return { product: null, sameCategory: [], sameStore: [] };
    const others = items.filter(item => item.id !== product.id);
    return {
      product,
      sameCategory: others.filter(item => item.category?.id === product.category?.id).slice(0, limit),
      sameStore: others.filter(item => item.producer?.id === product.producer?.id && item.category?.id !== product.category?.id).slice(0, limit),
    };
  },
  get_product_reviews_v1: async () => (await catalogItems()) ? ({ items: [], summary: { count: 0, rating1: 0, rating2: 0, rating3: 0, rating4: 0, rating5: 0, averageRating: 0 } }) : undefined,
  get_public_product_handling_profiles_v1: async args => {
    const wanted = new Set<string>(Array.isArray(args.p_product_ids) ? args.p_product_ids : []);
    const items = await catalogItems();
    if (!items) return undefined;
    return items.filter(item => wanted.has(item.id) && item.handlingProfile).map(item => ({ productId: item.id, profile: item.handlingProfile }));
  },
  get_public_producer_follow_metrics_v1: async args => {
    const wanted = new Set<string>(Array.isArray(args.p_producer_ids) ? args.p_producer_ids : []);
    const seen = new Map<string, Json>();
    const items = await catalogItems();
    if (!items) return undefined;
    for (const item of items) {
      const producer = item.producer;
      if (!producer || !wanted.has(producer.id) || seen.has(producer.id)) continue;
      seen.set(producer.id, {
        producerId: producer.id, followerCount: Number(producer.followerCount ?? 0), following: false,
        verified: producer.verified === true, originVerified: producer.originVerified === true,
        storeKind: producer.storeKind, storefrontTier: producer.storefrontTier, badgeTone: producer.badgeTone,
      });
    }
    return [...seen.values()];
  },
  search_catalog_v3: async args => {
    const limit = Math.min(100, Math.max(1, Number(args.p_limit) || 20)), offset = Math.max(0, Number(args.p_offset) || 0);
    const items = await catalogItems();
    if (!items) return undefined;
    const hits = sortItems(items.filter(item => matches(item, args)), args.p_sort).map(item => ({ ...withoutHomeSection(item), relevance: 1 }));
    return { items: hits.slice(offset, offset + limit), total: hits.length, limit, offset, query: args.p_query ?? null };
  },
  catalog_search_facets_v1: async args => {
    const items = await catalogItems();
    if (!items) return undefined;
    const hits = items.filter(item => matches(item, args));
    const prices = hits.map(item => Number(item.variant?.priceMinor)).filter(Number.isSafeInteger);
    const categories = new Map<string, Json>(), producers = new Map<string, Json>();
    for (const item of hits) {
      if (item.category?.slug) categories.set(item.category.slug, { slug: item.category.slug, name: item.category.name, count: (categories.get(item.category.slug)?.count || 0) + 1 });
      if (item.producer?.id) producers.set(item.producer.id, { id: item.producer.id, name: item.producer.name, count: (producers.get(item.producer.id)?.count || 0) + 1 });
    }
    const places = hits.map(item => originParts(item.origin));
    return {
      total: hits.length,
      inStockCount: hits.filter(item => item.stockMode === 'untracked' || Number(item.availableQuantity) > 0).length,
      price: { minMinor: prices.length ? Math.min(...prices) : null, maxMinor: prices.length ? Math.max(...prices) : null },
      categories: [...categories.values()], producers: [...producers.values()],
      provinces: countBy(places.map(place => place.province)), districts: countBy(places.map(place => place.district)), villages: countBy(places.map(place => place.village)),
    };
  },
  catalog_search_suggestions_v1: async args => {
    const query = trLower(args.p_query).trim();
    const limit = Math.min(20, Math.max(1, Number(args.p_limit) || 10));
    const items = await catalogItems();
    if (!items) return undefined;
    if (!query) return [];
    const out: Json[] = [];
    const seenCategories = new Set<string>();
    for (const item of items) {
      if (item.category && trLower(item.category.name).includes(query) && !seenCategories.has(item.category.slug)) {
        seenCategories.add(item.category.slug);
        out.push({ id: item.category.id, kind: 'category', label: item.category.name, value: item.category.slug });
      }
    }
    for (const item of items) if (trLower(item.name).includes(query) || (item.formerName && trLower(item.formerName).includes(query))) out.push({ id: item.id, kind: 'product', label: item.name, value: item.slug });
    return out.slice(0, limit);
  },
  public_product_recommendations_v1: async args => {
    const items = await catalogItems();
    if (!items) return undefined;
    const ref = String(args.p_reference ?? '').trim();
    const source = items.find(item => item.slug === ref || item.id === ref || String(item.legacyId ?? '') === ref);
    if (!source) return undefined;
    const limit = Math.min(24, Math.max(1, Number(args.p_limit) || 12));
    const sourcePrice = Number(source.variant?.priceMinor ?? 0);
    const picked = items
      .filter(item => item.id !== source.id)
      .sort((a, b) => Number(b.category?.slug === source.category?.slug) - Number(a.category?.slug === source.category?.slug) || Number(b.featured === true) - Number(a.featured === true))
      .slice(0, limit)
      .map(item => {
        const sameCategory = item.category?.slug === source.category?.slug;
        const price = Number(item.variant?.priceMinor ?? 0);
        return {
          id: item.id, legacyId: item.legacyId ?? null, slug: item.slug, name: item.name, shortDescription: item.shortDescription ?? null,
          origin: item.origin ?? null, unitLabel: item.unitLabel ?? null, category: item.category,
          producer: { id: item.producer?.id, name: item.producer?.name, storeKind: item.producer?.storeKind, storefrontTier: item.producer?.storefrontTier },
          variant: { id: item.variant?.id, name: item.variant?.name, sku: item.variant?.sku ?? null, priceMinor: price, compareAtPriceMinor: item.variant?.compareAtPriceMinor ?? null },
          currency: item.currency, stockMode: item.stockMode, availableQuantity: item.availableQuantity ?? null, featured: item.featured === true,
          imagePath: item.imagePath ?? null, averageRating: Number(item.averageRating ?? 0), reviewCount: Number(item.reviewCount ?? 0),
          reason: sameCategory ? 'same_category' : 'discovery', score: sameCategory ? 1 : 0,
          signals: { sameCategory, relatedCategory: false, sameCollection: false, tagOverlapCount: 0, cheaper: price < sourcePrice, priceDifferenceMinor: Math.abs(sourcePrice - price), sales30d: 0, salesAll: 0, favoriteCount: 0, reviewCount: Number(item.reviewCount ?? 0), averageRating: Number(item.averageRating ?? 0) },
        };
      });
    const home = await load('home_catalog.json');
    return { productId: source.id, generatedAt: home?.generatedAt || new Date().toISOString(), items: picked };
  },
};

export const OFFLINE_CATALOG_RPCS = Object.keys(RESOLVERS);

/** The answer for one public RPC from the shipped copy, or undefined. */
export async function resolveFromOfflineCatalog(rpc: string, args: Args): Promise<unknown | undefined> {
  const resolver = RESOLVERS[rpc];
  if (!resolver) return undefined;
  const value = await resolver(args || {});
  return value == null ? undefined : localizeImages(value);
}

function rpcName(input: RequestInfo | URL): string {
  try {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    return url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/)?.[1] || '';
  } catch {
    return '';
  }
}

async function snapshotResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  const rpc = rpcName(input);
  if (!rpc || !RESOLVERS[rpc]) return null;
  let args: Args = {};
  try { args = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : {}; } catch { return null; }
  const value = await resolveFromOfflineCatalog(rpc, args);
  if (value === undefined) return null;
  markSnapshotMode();
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Golden-Offline-Catalog': '1' } });
}

/** A fetch for the Supabase client: live first, the shipped copy when the backend is down. */
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    const fallback = await snapshotResponse(input, init);
    if (fallback) return fallback;
    throw error;
  }
  if (response.status === 402 || response.status >= 500) {
    const fallback = await snapshotResponse(input, init);
    if (fallback) { await response.body?.cancel().catch(() => undefined); return fallback; }
  }
  return response;
}
