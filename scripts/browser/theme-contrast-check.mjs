// Every theme, every main screen: no serious or critical axe issue.
//
// a11y-check.mjs runs the default theme. The app offers five (dark, light,
// emerald, ruby, champagne) and the light ones had unreadable tab bar labels
// (2.4:1) and muted text under 4.5:1 that no check saw. This walks the main
// customer screens, signed out and signed in, in each theme.
//
//   BROWSER_TOOLS=... node scripts/browser/theme-contrast-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { BASE, FIXTURES, axeSource, launch, routeSupabase, signedIn } from './lib.mjs';

const detail = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'detail.json'), 'utf8'));
const themes = ['dark', 'light', 'emerald', 'ruby', 'champagne'];
const screens = [
  ['ana sayfa', '/', 'out'],
  ['kategori', '/kategori/bal-sifa', 'out'],
  ['arama', '/ara?q=bal', 'out'],
  ['ürün', `/urun/${detail.slug}`, 'out'],
  ['mağaza', '/uretici/golden-oremar', 'out'],
  ['misafir sepeti', '/?tab=cart', 'guest'],
  ['hesabım', '/?tab=account', 'in'],
  ['ayarlar', '/settings', 'in'],
  ['sepet', '/?tab=cart', 'in'],
];
const axe = axeSource();
const browser = await launch();
let failures = 0, total = 0;
for (const theme of themes) for (const [name, url, mode] of screens) {
  total++;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await page.addInitScript(value => localStorage.setItem('golden-oremar:appearance-theme:v2', value), theme);
  if (mode === 'in') await signedIn(page, { cart: [{ variantId: detail.variants[0].id, quantity: 1 }] });
  else await routeSupabase(page);
  if (mode === 'guest') await page.addInitScript(line => localStorage.setItem('golden_oremar_guest_cart_v1', JSON.stringify([line])), { key: `${detail.variants[0].id}|[]`, variantId: detail.variants[0].id, quantity: 1, selectedOptions: {}, productSlug: detail.slug, productName: detail.name, variantName: detail.variants[0].name, producerName: detail.producer.name, priceMinor: detail.variants[0].priceMinor, currency: 'TRY', imagePath: null, addedAt: Date.now() });
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  await page.addScriptTag({ content: axe });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 90)}`));
  if (violations.length) failures++;
  console.log(`${violations.length ? 'FAIL' : 'ok  '} ${theme.padEnd(9)} ${name}${violations.length ? `\n       ${violations.join('\n       ')}` : ''}`);
  await context.close();
}
await browser.close();
console.log(failures ? `\n${failures}/${total} screens have accessibility issues.` : `\nAll ${total} screens pass axe in every theme.`);
process.exit(failures ? 1 : 0);
