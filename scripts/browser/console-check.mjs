// Every customer route, three backend states, zero console noise.
//
// Visits each public screen with the API healthy (production fixtures), out
// of quota (402, answered from the shipped catalogue) and failing (5xx with
// no copy), plus a few taps that load more code (search, product sections).
// Fails on: uncaught exceptions and unhandled rejections, console errors,
// React warnings, and same-origin requests that fail or answer 404 (a
// missing chunk, font, icon or catalogue file).
//
// Expected noise is listed explicitly below with the reason, never matched
// loosely, so a new error cannot hide behind an old excuse.
//
//   npm run build && npx vite preview --port 4173 --strictPort &
//   BROWSER_TOOLS=... node scripts/browser/console-check.mjs

import { BASE, launch, routeSupabase } from './lib.mjs';

const routes = [
  ['ana sayfa', '/'],
  ['kategoriler', '/?tab=categories'],
  ['kategori', '/kategori/bal-sifa'],
  ['arama', '/ara?q=bal'],
  ['ürün', '/urun/daglica-karakovan-petek-bali-101'],
  ['mağaza', '/uretici/golden-oremar'],
  ['etkinlikler', '/etkinlikler'],
  ['sepet', '/?tab=cart'],
  ['hesap', '/?tab=account'],
  ['siparişler (giriş yok)', '/orders'],
  ['ayarlar (giriş yok)', '/settings'],
  ['gizlilik', '/gizlilik-politikasi'],
  ['kullanım şartları', '/kullanim-sartlari'],
  ['bilinmeyen adres', '/bu-sayfa-yok'],
  ['bilinmeyen ürün', '/urun/olmayan-urun-999'],
];

const modes = [
  ['canlı', {}, {}],
  ['kota (402)', {}, { quota: true, offlineCatalog: 'shipped' }],
  // Production always ships the catalogue copy, so a failing API is answered
  // from it; resilience-check covers the case where the copy is missing too.
  ['arıza (5xx)', Object.fromEntries(['get_public_brand_appearance_v1', 'get_public_home_experience_v1', 'get_public_home_catalog_v3', 'list_public_categories_v2', 'get_public_product_detail_v6', 'search_catalog_v3', 'catalog_search_facets_v1'].map(k => [k, 'fail'])), { offlineCatalog: 'shipped' }],
];

// Console lines the browser itself prints for responses the scenario
// deliberately produces. Each is tied to the mode that causes it.
const expected = [
  { mode: 'kota (402)', text: /Failed to load resource: the server responded with a status of 402/ },
  { mode: 'arıza (5xx)', text: /Failed to load resource: the server responded with a status of 503/ },
];

const browser = await launch();
let failures = 0;
for (const [modeName, overrides, options] of modes) {
  for (const [name, path] of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
    const page = await context.newPage();
    const problems = [];
    // The harness blocks third-party hosts (YouTube thumbnails, for one), and
    // Chromium logs each block as a console error with no URL attached.
    let thirdPartyBlocked = 0, blockedLogs = 0;
    page.on('pageerror', error => problems.push(`exception: ${error.message.split('\n')[0]}`));
    page.on('console', message => {
      const type = message.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = message.text();
      if (expected.some(e => e.mode === modeName && e.text.test(text))) return;
      if (text === 'Failed to load resource: net::ERR_FAILED') { blockedLogs++; return; }
      if (type === 'warning' && !/react|warning:|deprecated|act\(/i.test(text)) return;
      problems.push(`console.${type}: ${text.slice(0, 160)}`);
    });
    page.on('response', response => {
      const url = response.url();
      if (url.startsWith(BASE) && response.status() >= 400) problems.push(`${response.status()} ${new URL(url).pathname}`);
    });
    page.on('requestfailed', request => {
      const url = request.url();
      if (url.startsWith(BASE)) problems.push(`request failed: ${new URL(url).pathname} (${request.failure()?.errorText})`);
      else if (!/supabase\.co/.test(url)) thirdPartyBlocked++;
    });
    await routeSupabase(page, overrides, options);
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(error => problems.push(`navigation: ${error.message.split('\n')[0]}`));
    await page.waitForTimeout(800);
    if (name === 'ürün') {
      for (const header of await page.locator('.go-detail-accordion__header').all()) { await header.click().catch(() => {}); await page.waitForTimeout(250); }
    }
    if (name === 'ana sayfa') {
      const search = page.locator('input[type="search"]').first();
      if (await search.count()) { await search.fill('bal'); await page.waitForTimeout(700); await search.press('Enter').catch(() => {}); await page.waitForTimeout(900); }
    }
    if (blockedLogs > thirdPartyBlocked) problems.push(`${blockedLogs - thirdPartyBlocked} failed resource(s) beyond the blocked third-party requests`);
    const unique = [...new Set(problems)];
    if (unique.length) failures++;
    console.log(`${unique.length ? 'FAIL' : 'ok  '} ${modeName.padEnd(11)} ${name}`);
    for (const problem of unique.slice(0, 6)) console.log(`       ${problem}`);
    await context.close();
  }
}
await browser.close();
const total = routes.length * modes.length;
console.log(failures ? `\n${failures}/${total} visits produced errors.` : `\nAll ${total} visits clean: no exceptions, console errors, React warnings or broken same-origin requests.`);
process.exit(failures ? 1 : 0);
