// Shared helpers for the headless-browser checks in this folder.
//
// These checks run the BUILT app (vite preview) in a real Chromium, with every
// Supabase RPC answered from fixtures captured from production. They are not
// part of `npm run audit:all`: they need a browser, which is deliberately not a
// project dependency (it would add a large download to every CI install).
//
// Setup, once per machine or sandbox:
//   mkdir -p /tmp/go-browser && cd /tmp/go-browser
//   npm i @sparticuz/chromium@131 playwright-core@1.56.0 axe-core@4
// Then, from the repo root:
//   npm run build && npx vite preview --port 4173 --strictPort &
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/responsive-check.mjs
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/resilience-check.mjs
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/a11y-check.mjs
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/navigation-check.mjs
//   (media-cdn-check.mjs needs its own build, see the top of that file)
//
// Why @sparticuz/chromium: in restricted sandboxes `playwright install` is
// blocked, while the npm registry is reachable. The two arguments removed in
// launch() make that build crash as soon as a second browser context opens.
//
// Fixtures live in ./fixtures and were captured with the Supabase MCP as the
// anon role on 2026-09-26. Refresh them when an RPC's shape changes.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(here, 'fixtures');
export const BASE = process.env.APP_URL || 'http://localhost:4173';

function tools() {
  const dir = process.env.BROWSER_TOOLS;
  if (!dir) throw new Error('Set BROWSER_TOOLS to the folder where @sparticuz/chromium, playwright-core and axe-core are installed (see lib.mjs).');
  return createRequire(path.join(dir, 'package.json'));
}

async function load(name) {
  const mod = await import(pathToFileURL(tools().resolve(name)).href);
  return mod.default ?? mod;
}

export async function launch() {
  const chromium = await load('@sparticuz/chromium');
  const { chromium: pw } = await load('playwright-core');
  const args = chromium.args.filter(arg => arg !== '--single-process' && arg !== '--no-zygote');
  return pw.launch({ executablePath: await chromium.executablePath(), args, headless: true });
}

export function axeSource() {
  return fs.readFileSync(tools().resolve('axe-core/axe.min.js'), 'utf8');
}

const fixture = name => fs.readFileSync(path.join(FIXTURES, name));

/**
 * Answer Supabase from fixtures. `overrides` maps an RPC name to a fixture
 * file name, or to 'fail' for a 503. search_catalog_v3 echoes the requested
 * limit and offset, because the client rejects a page that does not match its
 * own request.
 */
export async function routeSupabase(page, overrides = {}) {
  const defaults = {
    get_public_brand_appearance_v1: 'brand.json',
    get_public_home_experience_v1: 'home_experience.json',
    get_public_home_catalog_v3: 'home.json',
    list_public_categories_v2: 'categories.json',
    catalog_search_facets_v1: 'facets.json',
    get_public_product_detail_v6: 'detail.json',
    search_catalog_v3: 'search.json',
    catalog_search_suggestions_v1: 'suggestions.json',
  };
  const map = { ...defaults, ...overrides };
  await page.route('**/*', route => {
    const url = route.request().url();
    const rpc = url.match(/\/rpc\/([a-z0-9_]+)/)?.[1];
    if (rpc && map[rpc] === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"upstream timeout"}' });
    if (rpc === 'search_catalog_v3') {
      const request = route.request().postDataJSON() || {};
      const base = JSON.parse(fixture(map.search_catalog_v3));
      const limit = request.p_limit ?? 20, offset = request.p_offset ?? 0;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, items: offset === 0 ? base.items.slice(0, limit) : [], limit, offset, total: base.items.length }) });
    }
    if (rpc && map[rpc]) return route.fulfill({ status: 200, contentType: 'application/json', body: fixture(map[rpc]) });
    if (url.includes('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fixture('product.jpg') });
    if (url.includes('.supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: rpc ? 'null' : '[]' });
    if (url.startsWith(BASE)) return route.continue();
    return route.abort();
  });
}
