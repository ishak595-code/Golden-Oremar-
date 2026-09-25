// Public route contract audit.
//
// Unlike most audits in this directory, which assert on the *shape* of source
// code with regular expressions, this one executes the real routing module and
// checks its *behaviour*. It exists because the move to clean, path-based
// addresses (/urun/<slug>) is exactly the kind of change where a regex can
// pass while the behaviour is wrong - an address that is generated correctly
// but no longer parses back, or an old shared link that silently stops
// resolving.
//
// It transpiles src/features/navigation/appUrl.ts on the fly with the
// esbuild transform that Vite already ships, so it adds no dependency.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const source = fs.readFileSync('src/features/navigation/appUrl.ts', 'utf8');
const { code } = await transformWithEsbuild(source, 'appUrl.ts', {
  loader: 'ts',
  format: 'esm',
  // Only the share helpers read this, and they are not exercised here.
  define: { 'import.meta.env.VITE_PUBLIC_APP_ORIGIN': '""' },
});
const tempFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'go-route-')), 'appUrl.mjs');
fs.writeFileSync(tempFile, code);
const nav = await import(pathToFileURL(tempFile).href);

const BASE = 'https://goldenoremar.com/';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const route = (href) => nav.parsePublicRoute(href);

// 1. Generated addresses use the canonical Turkish paths.
check(nav.buildProductUrl('hakkari-bali', BASE) === `${BASE}urun/hakkari-bali`, 'Product addresses must be /urun/<slug>.');
check(nav.buildProducerUrl('oremar-koyu', BASE) === `${BASE}uretici/oremar-koyu`, 'Producer addresses must be /uretici/<slug>.');
check(nav.buildEventUrl('bal-hasadi', BASE) === `${BASE}etkinlikler/bal-hasadi`, 'Event addresses must be /etkinlikler/<slug>.');
check(nav.buildSearchUrl({ categorySlug: 'bal' }, BASE) === `${BASE}kategori/bal`, 'A bare category must get its own /kategori/<slug> address.');
check(nav.buildSearchUrl({ query: 'bal' }, BASE).startsWith(`${BASE}ara?`), 'Free-text search must live under /ara.');
check(nav.buildSearchUrl({ query: 'x', categorySlug: 'bal' }, BASE).includes('/ara?'), 'Category plus text is a transient search and must live under /ara.');

// 2. Every generated address parses back to the same screen.
let r = route(nav.buildProductUrl('hakkari-bali', BASE));
check(r.tab === 'product-detail' && r.productReference === 'hakkari-bali', 'A generated product address must parse back to that product.');
r = route(nav.buildProducerUrl('oremar-koyu', BASE));
check(r.tab === 'producer-profile' && r.producerReference === 'oremar-koyu', 'A generated producer address must parse back to that producer.');
r = route(nav.buildSearchUrl({ categorySlug: 'bal' }, BASE));
check(r.tab === 'search-results' && r.categorySlug === 'bal', 'A generated category address must parse back to that category.');
r = route(nav.buildEventUrl('bal-hasadi', BASE));
check(r.tab === 'events' && r.eventReference === 'bal-hasadi', 'A generated event address must parse back to that event.');

// 3. Slugs may contain dots; a dot-excluding rewrite or parser would 404 them.
check(route(nav.buildProductUrl('bal-1.5kg', BASE)).productReference === 'bal-1.5kg', 'Slugs containing a dot must round-trip.');

// 4. Backward compatibility: links already shared or saved must keep working.
r = route(`${BASE}?tab=product-detail&product=hakkari-bali`);
check(r.tab === 'product-detail' && r.productReference === 'hakkari-bali', 'Legacy ?tab=product-detail links must still resolve.');
r = route(`${BASE}product/hakkari-bali`);
check(r.tab === 'product-detail' && r.productReference === 'hakkari-bali', 'Legacy English /product/ links must still resolve.');
check(route(`${BASE}producer/oremar-koyu`).tab === 'producer-profile', 'Legacy English /producer/ links must still resolve.');
r = route(`${BASE}?tab=account&view=orders`);
check(r.tab === 'account' && r.accountView === 'orders', 'Legacy account links must still resolve.');
r = route(`${BASE}producer/dashboard`);
check(r.tab === 'account' && r.accountView === 'seller:dashboard', 'The seller dashboard path must not be captured by public producer routing.');

// 5. Hostile references are rejected rather than routed.
let rejected = false;
try { nav.buildProductUrl('../../admin', BASE); } catch { rejected = true; }
check(rejected, 'Path-traversal references must be rejected when building addresses.');
check(route(`${BASE}urun/%3Cscript%3E`).productReference === null, 'Encoded markup in a path must not become a product reference.');

// 6. Native deep links: only this app's public https links are claimed.
const deep = (url) => nav.resolveDeepLinkTarget(url);
let d = deep('https://goldenoremar.com/urun/hakkari-bali');
check(d?.kind === 'product' && d.reference === 'hakkari-bali', 'A product link on the custom domain must open that product.');
check(deep('https://www.goldenoremar.com/uretici/oremar')?.kind === 'producer', 'The www host must be accepted.');
check(deep('https://golden-oremar.vercel.app/kategori/bal')?.kind === 'category', 'The Vercel host must be accepted, so links work before the domain is connected.');
check(deep('https://goldenoremar.com/ara?q=bal')?.kind === 'search', 'A search link must open search.');
check(deep('https://evil.example/urun/hakkari-bali') === null, 'Links on foreign hosts must be ignored.');
check(deep('http://goldenoremar.com/urun/hakkari-bali') === null, 'Non-https links must be ignored.');
check(deep('com.goldenoremar.app://auth/callback?code=x') === null, 'Auth callbacks must be left to the auth listener, not claimed here.');
check(deep('https://goldenoremar.com/?tab=account&view=orders')?.kind === 'home', 'A link must never drop someone into a signed-in account screen.');
check(deep('https://goldenoremar.com/admin/users')?.kind === 'home', 'A link must never open the admin console.');
check(deep('not a url') === null && deep('') === null, 'Malformed input must be ignored.');

// 7. The three places that define claimed links must agree, or deep links
//    break silently: a host or path added to one but not the others either
//    fails OS verification or opens the browser instead of the app.
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const appLinkFilter = manifest.match(/<intent-filter android:autoVerify="true">([\s\S]*?)<\/intent-filter>/)?.[1] || '';
const manifestHosts = new Set([...appLinkFilter.matchAll(/android:host="([^"]+)"/g)].map(m => m[1]));
const manifestPaths = new Set([...appLinkFilter.matchAll(/android:pathPrefix="([^"]+)"/g)].map(m => m[1]));
const codeHosts = [...nav.DEEP_LINK_HOSTS];
check(codeHosts.length === manifestHosts.size && codeHosts.every(h => manifestHosts.has(h)), 'DEEP_LINK_HOSTS must match the hosts in the Android App Links intent filter.');
const wellKnown = fs.readFileSync('scripts/write-well-known.mjs', 'utf8');
const applePaths = new Set([...wellKnown.matchAll(/'(\/[a-z]+\/)\*'/g)].map(m => m[1]));
const routedPaths = new Set(Object.values(nav.PUBLIC_PATH).filter(segment => segment !== nav.PUBLIC_PATH.search).map(segment => `/${segment}/`));
check([...routedPaths].every(p => manifestPaths.has(p)) && manifestPaths.size === routedPaths.size, 'Android pathPrefix entries must match the public detail paths in PUBLIC_PATH.');
check([...routedPaths].every(p => applePaths.has(p)) && applePaths.size === routedPaths.size, 'Apple association paths must match the public detail paths in PUBLIC_PATH.');

// 8. Hosting config. vite preview resolves a SPA fallback differently from
//    Vercel, so this failure passed every local test and shipped: with
//    cleanUrls enabled, index.html is addressed as "/", and a catch-all whose
//    destination is "/index.html" no longer resolves - every clean product URL
//    returned 404 in production. Lock the shape so it cannot regress.
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const catchAll = (vercel.rewrites || []).find(rule => rule.source === '/(.*)');
check(Boolean(catchAll), 'vercel.json must keep a /(.*) SPA fallback so clean URLs do not 404 on direct load or refresh.');
if (catchAll && vercel.cleanUrls) check(!/\.html$/i.test(catchAll.destination), 'With cleanUrls enabled the SPA fallback must target "/", not an .html path, or clean URLs 404 in production.');
check(vercel.rewrites?.[vercel.rewrites.length - 1]?.source === '/(.*)', 'The SPA fallback must be the last rewrite so explicit rules above it still apply.');

fs.rmSync(path.dirname(tempFile), { recursive: true, force: true });

if (failures.length) {
  console.error('Public route contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Public route contract audit passed: canonical Turkish paths, round-trip parsing, dotted slugs, legacy link compatibility, hostile-reference rejection, native deep-link scoping and manifest/association consistency are locked in.');
