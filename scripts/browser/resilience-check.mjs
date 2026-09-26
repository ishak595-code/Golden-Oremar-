// Partial-outage behaviour of the customer screens.
//
// Each scenario fails one backend call and checks what a customer sees. The
// rule: a secondary call failing must never take the primary content with it,
// and when everything fails the customer gets a Turkish message with a retry,
// never a blank page or a raw English error. See lib.mjs for setup.

import { BASE, launch, routeSupabase } from './lib.mjs';

const scenarios = [
  { name: 'home: all data available', path: '/', fail: {}, expect: { cards: '>0', error: 0 } },
  { name: 'home: composition fails, catalogue works', path: '/', fail: { get_public_home_experience_v1: 'fail' }, expect: { cards: '>0', error: 0 } },
  { name: 'home: catalogue fails, composition works', path: '/', fail: { get_public_home_catalog_v3: 'fail' }, expect: { cards: '>0', error: 0 } },
  { name: 'home: both fail', path: '/', fail: { get_public_home_experience_v1: 'fail', get_public_home_catalog_v3: 'fail' }, expect: { cards: 0, error: 1 } },
  { name: 'category: all data available', path: '/kategori/bal-sifa', fail: {}, expect: { cards: '>0', error: 0 } },
  { name: 'category: filter counts fail', path: '/kategori/bal-sifa', fail: { catalog_search_facets_v1: 'fail' }, expect: { cards: '>0', error: 0 } },
  { name: 'category: search fails', path: '/kategori/bal-sifa', fail: { search_catalog_v3: 'fail' }, expect: { cards: 0, error: 1 } },
];
const ERROR_TEXT = /Ana sayfayı yenileyemedik|Arama sonuçları şu anda gösterilemiyor/;
const ENGLISH_LEAK = /Service for this project|restricted|exceed_|Failed to fetch|TypeError/;

const browser = await launch();
let failed = 0;
for (const scenario of scenarios) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page, scenario.fail);
  await page.goto(BASE + scenario.path);
  await page.waitForTimeout(3000);
  const cards = await page.locator('[data-product-reference], .go-product-card__media > button').count();
  const body = await page.locator('body').innerText();
  const error = ERROR_TEXT.test(body) ? 1 : 0;
  const leak = ENGLISH_LEAK.test(body);
  const ok = (scenario.expect.cards === '>0' ? cards > 0 : cards === scenario.expect.cards) && error === scenario.expect.error && !leak;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${scenario.name.padEnd(44)} cards=${cards} errorShown=${error}${leak ? ' ENGLISH/RAW ERROR LEAKED' : ''}`);
  await context.close();
}
await browser.close();
console.log(failed ? `\n${failed} scenario(s) failed.` : `\nAll ${scenarios.length} scenarios behave correctly.`);
process.exit(failed ? 1 : 0);
