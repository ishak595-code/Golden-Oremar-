// Build-time SEO prerender.
//
// Runs after `vite build`. Writes a static HTML page for every public product,
// category and producer, plus sitemap.xml and robots.txt, so that:
//
//   - link-preview bots (WhatsApp, Facebook, Instagram, X, LinkedIn), which do
//     NOT execute JavaScript, see the real product name, description and image
//     instead of the generic site defaults
//   - search engines get a correct title, canonical and Product structured
//     data in the first response, without depending on client rendering
//
// Each generated page is the normal app shell with a page-specific <head>.
// The app then boots and takes over exactly as before, and replaces the
// build-time metadata with live data via the same builder (seoModel.ts).
//
// This step must NEVER fail the build. If the catalogue cannot be fetched -
// network down, Supabase quota restricted, bad response - it logs a warning,
// still writes a valid robots.txt and a home-only sitemap, and exits 0. A
// deploy without prerendered pages is a lost optimisation; a deploy that
// cannot ship because of it would be an outage.
//
// Environment:
//   SITE_ORIGIN                     explicit public origin (highest priority)
//   VERCEL_PROJECT_PRODUCTION_URL   set by Vercel; follows the custom domain
//                                   automatically once goldenoremar.com is
//                                   connected
//   VITE_SUPABASE_URL / _PUBLISHABLE_KEY  as used by the app
//   SEO_PRERENDER_FIXTURE           path to a JSON fixture, for offline tests

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const DIST = 'dist';
const CANONICAL_SUPABASE_URL = 'https://rmfcziawxjgcnxexbrvw.supabase.co';
const CANONICAL_PUBLISHABLE_KEY = 'sb_publishable_n4P4WYheJjOzgjO90Ko_jA_vh3CS8Vg';
const FALLBACK_IMAGE = '/brand/golden-oremar-official-store-cover.webp';
const MAX_PAGES = 5000;

const log = (message) => console.log(`[seo-prerender] ${message}`);
const warn = (message) => console.warn(`[seo-prerender] WARNING: ${message}`);

function resolveOrigin() {
  const explicit = String(process.env.SITE_ORIGIN || '').trim();
  if (/^https:\/\/[^/]+$/i.test(explicit.replace(/\/+$/, ''))) return explicit.replace(/\/+$/, '');
  const vercel = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (/^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
  return 'https://golden-oremar.vercel.app';
}

async function loadSeoModel() {
  const source = fs.readFileSync('src/features/seo/seoModel.ts', 'utf8');
  const { code } = await transformWithEsbuild(source, 'seoModel.ts', { loader: 'ts', format: 'esm' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-seo-'));
  const file = path.join(dir, 'seoModel.mjs');
  fs.writeFileSync(file, code);
  const model = await import(pathToFileURL(file).href);
  fs.rmSync(dir, { recursive: true, force: true });
  return model;
}

async function rpc(name, body) {
  const base = String(process.env.VITE_SUPABASE_URL || CANONICAL_SUPABASE_URL).replace(/\/+$/, '');
  const key = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || CANONICAL_PUBLISHABLE_KEY);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadCatalogue() {
  const fixture = String(process.env.SEO_PRERENDER_FIXTURE || '').trim();
  if (fixture) {
    log(`using fixture ${fixture}`);
    return JSON.parse(fs.readFileSync(fixture, 'utf8'));
  }
  const [home, categories, producers] = await Promise.all([
    rpc('get_public_home_catalog_v3', {}),
    rpc('list_public_categories_v3', {}),
    rpc('list_public_producers_v1', {
      p_query: null, p_province: null, p_district: null, p_village: null, p_limit: 50, p_offset: 0,
    }),
  ]);
  return { home, categories, producers };
}

// Same rule as src/lib/mediaUrl.ts: product images are served from the R2 CDN
// once a base is configured (build variable, else the constant in that file).
function mediaCdnBase() {
  let raw = String(process.env.VITE_MEDIA_CDN_BASE || '').trim();
  if (!raw) {
    try {
      const source = fs.readFileSync(new URL('../src/lib/mediaUrl.ts', import.meta.url), 'utf8');
      raw = (source.match(/const CANONICAL_MEDIA_CDN_BASE = '([^']*)';/) || [])[1] || '';
    } catch {
      raw = '';
    }
  }
  raw = raw.replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) return '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}
const MEDIA_CDN_BASE = mediaCdnBase();

function storageImageUrl(imagePath) {
  const value = String(imagePath || '').trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const clean = value.replace(/^\/+/, '');
  if (!clean || clean.split('/').some(part => !part || part === '.' || part === '..')) return null;
  const encoded = clean.split('/').map(encodeURIComponent).join('/');
  if (MEDIA_CDN_BASE && clean.length <= 1024 && !/[\\\u0000-\u001f\u007f]/.test(clean) && /\.(jpe?g|png|webp|avif)$/i.test(clean)) {
    return `${MEDIA_CDN_BASE}/catalog-public/${encoded}`;
  }
  const base = String(process.env.VITE_SUPABASE_URL || CANONICAL_SUPABASE_URL).replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/catalog-public/${encoded}`;
}

// Remove the template's own SEO tags so each page carries exactly one set.
function stripSeoTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+(?:name|property)="(?:title|description|og:[^"]+|twitter:[^"]+)"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');
}

function renderPage(template, headTags) {
  const stripped = stripSeoTags(template);
  if (!stripped.includes('</head>')) throw new Error('template has no </head>');
  return stripped.replace('</head>', `    ${headTags}\n  </head>`);
}

// Pages are written as <path>.html, not <path>/index.html. Static hosts do not
// reliably resolve an extensionless request to a directory index: a request
// for /urun/x without a trailing slash falls through to the SPA fallback and
// the prerendered head is never served - which silently defeats the whole
// step. Vercel's cleanUrls resolves /urun/x to urun/x.html deterministically,
// and vercel.json enables it.
function writePage(relativeDir, html) {
  const target = path.join(DIST, `${relativeDir}.html`);
  // Defence in depth on top of isSafeSlug: the resolved path must stay inside
  // dist, whatever the slug turned out to be.
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(DIST) + path.sep)) throw new Error(`refusing to write outside dist: ${target}`);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, html);
}

function productInput(item, isSafeSlug) {
  if (!item || !isSafeSlug(item.slug)) return null;
  const variant = item.variant && typeof item.variant === 'object' ? item.variant : null;
  const stockMode = String(item.stockMode || '');
  const available = typeof item.availableQuantity === 'number' ? item.availableQuantity : null;
  const availability = stockMode === 'preorder' ? 'preorder'
    : available !== null && available <= 0 ? 'out_of_stock' : 'in_stock';
  return {
    slug: item.slug,
    name: String(item.name || '').trim() || 'Ürün',
    description: String(item.shortDescription || '').trim(),
    imageUrl: storageImageUrl(item.imagePath),
    priceMinor: typeof variant?.priceMinor === 'number' ? variant.priceMinor : null,
    currency: String(item.currency || 'TRY'),
    availability,
    brandName: item.producer?.name ? String(item.producer.name) : null,
    categoryName: item.category?.name ? String(item.category.name) : null,
    categorySlug: item.category?.slug ? String(item.category.slug) : null,
    ratingAverage: typeof item.averageRating === 'number' ? item.averageRating : Number(item.averageRating) || null,
    ratingCount: Number(item.reviewCount) || 0,
  };
}

function writeSitemap(origin, urls) {
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

function writeRobots(origin) {
  // Account, cart, admin and seller screens are private per-user state. They
  // are reached through ?tab= and ?view= parameters, so they are excluded by
  // parameter pattern; Google honours the * wildcard in robots.txt.
  fs.writeFileSync(path.join(DIST, 'robots.txt'), [
    'User-agent: *',
    'Allow: /',
    'Disallow: /*?tab=account',
    'Disallow: /*?tab=cart',
    'Disallow: /*?tab=admin',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /orders',
    'Disallow: /messages',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n'));
}

async function main() {
  const templatePath = path.join(DIST, 'index.html');
  if (!fs.existsSync(templatePath)) {
    warn('dist/index.html not found; run after vite build. Skipping.');
    return;
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const origin = resolveOrigin();
  const model = await loadSeoModel();
  log(`origin ${origin}`);

  // Home page: adds og:image and Organization data the template lacks.
  //
  // It deliberately carries NO canonical and NO og:url. index.html is not only
  // the home page: the vercel.json catch-all serves it for every path that has
  // no prerendered file - a product added since the last deploy, or every
  // product while the catalogue fetch is failing. A home canonical here would
  // tell crawlers that each of those product URLs is really the home page,
  // inviting Google to fold them into it. Without a canonical, the initial
  // HTML makes no claim, and the app sets the correct canonical once it runs
  // (applySeo / App.tsx). Serving the fallback from a separate file was
  // considered and rejected: if that file were ever missing, every clean URL
  // would 404, which is exactly the outage fixed in 17a993c.
  const homeHead = model.renderHeadTags(model.homeSeo(origin, FALLBACK_IMAGE))
    .replace(/<link rel="canonical"[^>]*>\s*/g, '')
    .replace(/<meta property="og:url"[^>]*>\s*/g, '');
  fs.writeFileSync(templatePath, renderPage(template, homeHead));
  const urls = [`${origin}/`];

  let data;
  try {
    data = await loadCatalogue();
  } catch (error) {
    warn(`catalogue unavailable (${error?.message || error}); shipping without product pages.`);
    writeSitemap(origin, urls);
    writeRobots(origin);
    return;
  }

  let written = 0;
  const items = Array.isArray(data?.home?.items) ? data.home.items : [];
  for (const item of items.slice(0, MAX_PAGES)) {
    const input = productInput(item, model.isSafeSlug);
    if (!input) continue;
    writePage(`urun/${input.slug}`, renderPage(template, model.renderHeadTags(model.productSeo(input, origin, FALLBACK_IMAGE))));
    urls.push(`${origin}/urun/${encodeURIComponent(input.slug)}`);
    written++;
  }

  const categories = Array.isArray(data?.categories) ? data.categories : [];
  for (const category of categories.slice(0, MAX_PAGES)) {
    if (!category || !model.isSafeSlug(category.slug)) continue;
    const page = model.categorySeo({ slug: category.slug, name: String(category.name || category.slug), description: category.description }, origin, FALLBACK_IMAGE);
    writePage(`kategori/${category.slug}`, renderPage(template, model.renderHeadTags(page)));
    urls.push(`${origin}/kategori/${encodeURIComponent(category.slug)}`);
    written++;
  }

  const producers = Array.isArray(data?.producers?.items) ? data.producers.items : [];
  for (const producer of producers.slice(0, MAX_PAGES)) {
    if (!producer || !model.isSafeSlug(producer.slug)) continue;
    const page = model.producerSeo({ slug: producer.slug, name: String(producer.display_name || producer.slug), description: producer.description, location: producer.location_label }, origin, FALLBACK_IMAGE);
    writePage(`uretici/${producer.slug}`, renderPage(template, model.renderHeadTags(page)));
    urls.push(`${origin}/uretici/${encodeURIComponent(producer.slug)}`);
    written++;
  }

  writeSitemap(origin, urls);
  writeRobots(origin);
  log(`wrote ${written} pages and a sitemap of ${urls.length} URLs.`);
}

main().catch(error => {
  // Last line of defence: an unexpected bug here must not block a deploy.
  warn(`prerender aborted: ${error?.stack || error}`);
  process.exitCode = 0;
});
