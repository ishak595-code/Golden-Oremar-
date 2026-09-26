// Accessibility and product-page behaviour, in a real browser.
//
// 1. A full axe-core run (all rules, including colour contrast) on six customer
//    screens with the production brand theme. Serious or critical findings fail.
//    The brand appearance fixture matters: without it the fallback palette is
//    used and the contrast results describe a theme customers never see.
// 2. The product page: YouTube video stays unloaded until play (no request to
//    YouTube before the tap), Shorts render in a vertical frame, the player can
//    go full screen, and the right-of-withdrawal notice matches the product.
// See lib.mjs for setup.

import { BASE, axeSource, launch, routeSupabase } from './lib.mjs';

const screens = [
  ['product with video', '/urun/daglica-karakovan-petek-bali-101', {}],
  ['perishable product', '/urun/daglica-karakovan-petek-bali-101', { get_public_product_detail_v6: 'detail_perishable.json' }],
  ['home', '/', {}],
  ['category', '/kategori/bal-sifa', {}],
  ['cart (signed out)', '/?tab=cart', {}],
  ['account (signed out)', '/?tab=account', {}],
];
const results = [];
const record = (ok, label) => results.push([ok, label]);
const source = axeSource();
const browser = await launch();

for (const [name, path, overrides] of screens) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page, overrides);
  await page.goto(BASE + path);
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: source });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 90)}`));
  record(violations.length === 0, `axe ${name}: ${violations.length ? violations.join(' | ') : 'no serious or critical issues'}`);
  await context.close();
}

{
  // Search with the suggestions panel open: the field must be a valid
  // combobox that reports its expanded state, and the open panel must pass axe.
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page);
  await page.goto(BASE + '/');
  await page.waitForTimeout(2200);
  const field = page.locator('input[aria-label="Ürün, üretici veya köy ara"]').first();
  const closed = await field.getAttribute('aria-expanded');
  await field.click();
  await field.fill('bal');
  await page.waitForTimeout(1200);
  const role = await field.getAttribute('role');
  const open = await field.getAttribute('aria-expanded');
  const panel = page.locator('#catalog-search-suggestions');
  record(role === 'combobox' && closed === 'false' && open === 'true', `search field is a combobox reporting collapsed then expanded (role=${role}, before=${closed}, after=${open})`);
  record(await panel.count() === 1 && /öneri bulundu/.test(await panel.innerText().catch(() => '') + (await page.locator('#catalog-search-suggestions [aria-live]').innerText().catch(() => ''))), 'open panel announces how many suggestions were found');
  await page.addScriptTag({ content: source });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 90)}`));
  record(violations.length === 0, `axe search with suggestions open: ${violations.length ? violations.join(' | ') : 'no serious or critical issues'}`);
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  const youtube = [];
  page.on('request', request => { if (/youtube(-nocookie)?\.com/.test(request.url())) youtube.push(request.url()); });
  await routeSupabase(page);
  await page.goto(BASE + '/urun/daglica-karakovan-petek-bali-101');
  await page.waitForTimeout(2200);
  record(await page.locator('#product-video-heading').count() === 1, 'video section present');
  record(await page.locator('iframe').count() === 0 && youtube.length === 0, 'nothing loaded from YouTube before play');
  record(await page.locator('.aspect-\\[9\\/16\\]').count() === 1, 'Shorts shown in a vertical frame');
  const play = page.locator('button[aria-label*="videosunu oynat"]');
  record(await play.count() === 1, 'play button has an accessible name');
  await play.click();
  const frame = page.locator('iframe');
  await frame.waitFor({ timeout: 5000 }).catch(() => {});
  record(((await frame.getAttribute('src')) || '').startsWith('https://www.youtube-nocookie.com/embed/'), 'privacy-enhanced embed after play');
  record((await frame.getAttribute('allowfullscreen')) !== null && ((await frame.getAttribute('allow')) || '').includes('fullscreen'), 'player allowed to go full screen');
  record((await frame.getAttribute('referrerpolicy')) === 'strict-origin-when-cross-origin', 'referrer policy YouTube requires');
  record(await page.locator('#product-withdrawal-title', { hasText: 'Ambalajı açılmamışsa 14 gün içinde iade' }).count() === 1, 'honey: sealed-packaging withdrawal notice');
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page, { get_public_product_detail_v6: 'detail_perishable.json' });
  await page.goto(BASE + '/urun/daglica-karakovan-petek-bali-101');
  await page.waitForTimeout(2200);
  record(await page.locator('#product-withdrawal-title', { hasText: 'Bu üründe cayma hakkı yoktur' }).count() === 1, 'raw milk: no-withdrawal notice');
  record(await page.locator('#product-video-heading').count() === 0, 'no video section when the product has none');
  await context.close();
}
await browser.close();

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
