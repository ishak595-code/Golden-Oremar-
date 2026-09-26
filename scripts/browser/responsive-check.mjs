// Six customer screens x six widths, real production fixtures.
//
// Fails on: horizontal page overflow; visible elements past the right edge
// (outside horizontal scrollers); text clipped without a working ellipsis
// (text-overflow never works on flex or grid containers, which is how the home
// row badge ended up reading "İmza s"); touch targets under 24x24 px (a
// checkbox counts its whole label); and a product card that does not open its
// product page. Screen-reader-only elements are ignored: they are hidden on
// purpose. Run with FIXTURE=search_stress.json for the longest names and
// 7-digit prices. See lib.mjs for setup.

import { BASE, launch, routeSupabase } from './lib.mjs';

const sizes = [[320, 640], [360, 800], [390, 844], [412, 915], [768, 1024], [1280, 800]];
const screens = [
  ['kategori', '/kategori/bal-sifa'],
  ['urun', '/urun/daglica-karakovan-petek-bali-101'],
  ['anasayfa', '/'],
  ['kategoriler', '/?tab=categories'],
  ['sepet', '/?tab=cart'],
  ['hesap', '/?tab=account'],
];
const searchFixture = process.env.FIXTURE || 'search.json';

const browser = await launch();
const rows = [];
for (const [width, height] of sizes) for (const [name, path] of screens) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page, { search_catalog_v3: searchFixture });
  await page.goto(BASE + path);
  await page.waitForTimeout(2200);
  const found = await page.evaluate(() => {
    const vw = innerWidth;
    const srHidden = el => { for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.display === 'none' || cs.visibility === 'hidden') return true; } return false; };
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).opacity !== '0' && !srHidden(el); };
    const label = el => (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50);
    const inScroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const problems = [];
    const overflow = document.documentElement.scrollWidth - vw;
    if (overflow > 1) problems.push(`page scrolls sideways by ${overflow}px`);
    for (const el of document.querySelectorAll('body *')) if (visible(el) && el.getBoundingClientRect().right > vw + 1 && !inScroller(el)) { problems.push(`past right edge: ${el.tagName.toLowerCase()} "${label(el)}"`); break; }
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,strong,div,li,label')) {
      if (!visible(el) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      const ellipsisWorks = cs.textOverflow === 'ellipsis' && !cs.display.includes('flex') && !cs.display.includes('grid');
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      const cutX = ['hidden', 'clip'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && !ellipsisWorks;
      const cutY = ['hidden', 'clip'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && !clamp;
      if (cutX || cutY) problems.push(`clipped text: "${label(el)}"`);
    }
    for (const el of document.querySelectorAll('a[href],button,[role="button"],input,select,textarea,summary')) {
      if (!visible(el)) continue;
      const own = el.tagName === 'INPUT' ? (el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))) : null;
      const r = (own || el).getBoundingClientRect();
      if (r.width < 24 || r.height < 24) problems.push(`small target: "${label(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return problems.slice(0, 6);
  });
  if (name === 'kategori') {
    const card = page.locator('.go-product-card__media > button').first();
    if (!(await card.count())) found.push('no product card rendered');
    else { await card.click(); await page.waitForTimeout(900); const now = new URL(page.url()).pathname; if (!now.startsWith('/urun/')) found.push(`card opened ${now}, not a product page`); }
  }
  rows.push({ width, name, found });
  await context.close();
}
await browser.close();

let failed = 0;
for (const { width, name, found } of rows) {
  if (found.length) failed++;
  console.log(`${found.length ? 'FAIL' : 'ok  '} ${String(width).padStart(4)}px ${name}`);
  for (const problem of found) console.log(`       ${problem}`);
}
console.log(failed ? `\n${failed}/${rows.length} screens have problems.` : `\nAll ${rows.length} screens clean (fixture ${searchFixture}).`);
process.exit(failed ? 1 : 0);
