// Opens every storefront page and every product the way production serves
// it today (Supabase answering 402, so the shipped offline catalogue is used)
// and reports any emoji visible on screen or in accessible labels.
import fs from 'node:fs';
import { BASE, launch } from './lib.mjs';
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}\u{1F000}-\u{1F2FF}]/u;
const slugs = fs.readdirSync('public/offline-catalog/product').map(f => f.replace(/\.json$/, ''));
const pages = ['/', '/?tab=categories', '/kategori/bal-sifa', '/?tab=cart', '/?tab=account', '/?tab=events', '/kullanim-sartlari', ...slugs.map(s => `/urun/${s}`)];
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 402, contentType: 'application/json', body: '{"message":"quota"}' }));
const page = await ctx.newPage();
const hits = [];
for (const path of pages) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(700);
  const text = await page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label],[title],[alt]')].map(e => (e.getAttribute('aria-label') || '') + (e.getAttribute('title') || '') + (e.getAttribute('alt') || '')).join(' '));
  const found = [...new Set(text.match(new RegExp(EMOJI.source, 'gu')) || [])];
  if (found.length) hits.push(`${path}: ${found.join(' ')}`);
}
await browser.close();
console.log(`Scanned ${pages.length} pages.`);
if (hits.length) { console.log('Emoji found:'); hits.forEach(h => console.log('- ' + h)); process.exit(1); }
console.log('No emoji on any page.');
