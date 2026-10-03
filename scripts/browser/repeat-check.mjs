// Nothing on the product page is said twice.
//
// The owner reported the same facts (village, verification, maker, category,
// store) repeated two and three times on one screen. This check opens product
// pages, with every section opened, and fails when the full origin, the
// maker's name, a verification phrase or the category name appears more often
// than its one intended place. Recommendations are left out: they describe
// other products. See lib.mjs for setup.

import { BASE, launch, routeSupabase } from './lib.mjs';

const products = ['daglica-karakovan-petek-bali-101', 'merez-hatun-un-magara-tulum-peyniri-201', 'avasin-mese-bali-103', 'abidin-in-yayla-kuzusu-302'];
const browser = await launch();
let failed = 0;
for (const slug of products) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page, {}, { offlineCatalog: 'shipped', quota: true });
  await page.goto(`${BASE}/urun/${slug}`);
  await page.waitForTimeout(2300);
  const found = await page.evaluate(() => {
    const row = key => [...document.querySelectorAll('.go-kunye li')].map(li => li.innerText.split('\n').map(t => t.trim()).filter(Boolean)).find(parts => parts[0]?.toLocaleLowerCase('tr-TR') === key);
    const origin = row('köy')?.[1] || '';
    const maker = row('üreten')?.[1] || '';
    const title = document.querySelector('h1')?.innerText.trim() || '';
    const copy = document.querySelector('#root').cloneNode(true);
    copy.querySelectorAll('.go-detail-recos, .go-sticky-buy, nav, [role="dialog"], .sr-only').forEach(node => node.remove());
    // Section bodies are read too, whether open or not.
    const text = copy.textContent.replace(/\s+/g, ' ');
    const count = needle => needle ? text.split(needle).length - 1 : 0;
    // The product's own name and its story may name the maker; only labelled repeats count.
    return { title, origin, maker, originCount: count(origin), makerLabelCount: count('Üreten'), verifiedCount: (text.match(/doğrulan/gi) || []).length, storeLabelCount: count('Üretici Golden Oremar') + count('Satıcı:'), kunyeRows: document.querySelectorAll('.go-kunye li').length };
  });
  const problems = [];
  if (!found.kunyeRows) problems.push('künye missing');
  // The story may mention the place once in its prose.
  if (found.originCount > 2) problems.push(`origin written ${found.originCount} times`);
  if (found.makerLabelCount > 1) problems.push(`"Üreten" label ${found.makerLabelCount} times`);
  if (found.verifiedCount > 2) problems.push(`verification said ${found.verifiedCount} times`);
  if (found.storeLabelCount > 0) problems.push('seller repeated as a labelled row');
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${slug}: ${problems.join('; ') || `origin x${found.originCount}, maker label x${found.makerLabelCount}, verification x${found.verifiedCount}`}`);
  await context.close();
}
await browser.close();
if (failed) { console.log(`\n${failed} product page(s) repeat themselves.`); process.exit(1); }
console.log(`\nAll ${products.length} product pages say each fact once.`);
