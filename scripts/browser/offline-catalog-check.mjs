// The storefront stays open when the backend is down.
//
// Reproduces the September 2026 outage (every Supabase call answers 402) and
// checks that the home page, a category page, search and a product page are
// still drawn from the catalogue copy shipped with the app
// (src/lib/offlineCatalog.ts), with a calm notice and no raw error text.
// The copy is served from ./fixtures here, so the check does not depend on
// the data exported into public/offline-catalog. See lib.mjs for setup.

import fs from 'node:fs';
import path from 'node:path';
import { BASE, FIXTURES, launch, routeSupabase } from './lib.mjs';

const detail = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'detail.json'), 'utf8'));
const home = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'home.json'), 'utf8'));
const category = home.items[0].category.slug;
const RAW = /Service for this project|restricted|exceeded usage|Failed to fetch|TypeError|402/;
const NOTICE = /Üyelik kısa bir bakımda/;

const results = [];
const check = (ok, label) => results.push([ok, label]);
const browser = await launch();

async function open(pathname, options = { quota: true, offlineCatalog: 'fixtures' }) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page, {}, options);
  await page.goto(BASE + pathname);
  await page.waitForTimeout(3500);
  return { context, page, body: await page.locator('body').innerText() };
}
const cards = page => page.locator('[data-product-reference], .go-product-card__media > button').count();

let view = await open('/');
check(await cards(view.page) > 0, `home: products drawn from the shipped copy (${await cards(view.page)} cards)`);
check(!NOTICE.test(view.body), 'home: no maintenance banner pushes the page down');
check(!RAW.test(view.body), 'home: no raw error text');
await view.context.close();

view = await open(`/kategori/${category}`);
check(await cards(view.page) > 0, `category ${category}: products listed (${await cards(view.page)})`);
check(!RAW.test(view.body), 'category: no raw error text');
await view.context.close();

view = await open(`/ara?q=${encodeURIComponent(home.items[0].name.split(' ')[0])}`);
check(await cards(view.page) > 0, `search "${home.items[0].name.split(' ')[0]}": results found (${await cards(view.page)})`);
await view.context.close();

view = await open(`/urun/${detail.slug}`);
check(view.body.includes(detail.name), `product page: "${detail.name}" is shown`);
check(!RAW.test(view.body), 'product page: no raw error text');
await view.context.close();

// Without a copy, the old behaviour stays: a Turkish message, not a blank page.
view = await open('/', { quota: true, offlineCatalog: 'absent' });
check(!RAW.test(view.body) && /yenileyemedik|yüklenemedi|kullanılamıyor/i.test(view.body), 'no copy available: a Turkish message, no raw error text');
check(!NOTICE.test(view.body), 'no copy available: the maintenance notice is not claimed');
await view.context.close();

// Healthy backend: the copy is never used and no notice appears.
view = await open('/', { offlineCatalog: 'fixtures' });
check(!NOTICE.test(view.body) && await cards(view.page) > 0, 'backend healthy: live data, no notice');
await view.context.close();

// The real exported copy in public/offline-catalog, as shipped.
const shipped = { quota: true, offlineCatalog: 'shipped' };
const realHome = JSON.parse(fs.readFileSync('public/offline-catalog/home_catalog.json', 'utf8'));
const realProduct = realHome.items.find(item => item.slug === 'daglica-karakovan-petek-bali-101') || realHome.items[0];
view = await open('/', shipped);
const realCards = await cards(view.page);
check(realCards >= 12, `shipped copy, home: showcases filled (${realCards} cards)`);
check(!NOTICE.test(view.body) && !RAW.test(view.body), 'shipped copy, home: no banner, no raw error text');
for (let i = 0; i < 8; i++) { await view.page.mouse.wheel(0, 1200); await view.page.waitForTimeout(400); }
const homeText = await view.page.locator('body').innerText();
const shownSections = ['Sofranın imza parçaları', 'Beklemeye değen lezzetler', 'Vitrine yeni düşenler', 'Değeri fiyatından önce gelenler', 'Bugünün Önerisi'].filter(title => homeText.toLocaleLowerCase('tr-TR').includes(title.toLocaleLowerCase('tr-TR')));
check(shownSections.length >= 5 && homeText.toLocaleLowerCase('tr-TR').includes('seçkisi'), `shipped copy, home: showcase sections visible (${shownSections.join(', ')})`);
await view.context.close();

view = await open('/kategori/bal-sifa', shipped);
check(await cards(view.page) >= 4, `shipped copy, category bal-sifa: ${await cards(view.page)} products`);
await view.context.close();

view = await open(`/urun/${realProduct.slug}`, shipped);
check(view.body.includes(realProduct.name), `shipped copy, product page: "${realProduct.name}"`);
check(!RAW.test(view.body), 'shipped copy, product page: no raw error text');
await view.context.close();

view = await open('/uretici/golden-oremar', shipped);
check(/Golden Oremar/.test(view.body) && !RAW.test(view.body), 'shipped copy, store page opens');
await view.context.close();

await browser.close();
const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} offline catalogue checks passed.`);
process.exit(failed ? 1 : 0);
