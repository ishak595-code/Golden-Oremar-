// Every customer-facing button goes where it says, for a signed-out visitor.
//
// Also checks the address bar, not only the screen: a tab link built from the
// current href once left /urun/<slug> in the address while the app showed the
// categories tab, so a refresh or a shared link reached the wrong page. Each
// destination here is compared exactly, and one is reloaded to prove the
// address alone reproduces the screen. See lib.mjs for setup.

import { BASE, launch, routeSupabase } from './lib.mjs';

const browser = await launch();
const results = [];
const addressOf = page => { const url = new URL(page.url()); return url.pathname + url.search; };
const tabOf = page => page.evaluate(() => document.documentElement.dataset.appTab || '');
const loginShown = async page => (await page.locator('text=/giriş yap/i').count()) > 0;

async function step(label, path, act, verify) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'tr-TR' });
  const page = await context.newPage();
  await routeSupabase(page);
  try {
    await page.goto(BASE + path);
    await page.waitForTimeout(2300);
    await act(page);
    await page.waitForTimeout(1200);
    const { ok, detail } = await verify(page);
    results.push([ok, `${label} -> ${detail}`]);
  } catch (error) {
    results.push([false, `${label} -> ${String(error).split('\n')[0].slice(0, 140)}`]);
  }
  await context.close();
}

const PRODUCT = '/urun/daglica-karakovan-petek-bali-101';

// Visitors fill a guest cart and stay where they are; the account is asked
// for at checkout (see checkout-check.mjs).
const guestLines = page => page.evaluate(() => JSON.parse(localStorage.getItem('golden_oremar_guest_cart_v1') || '[]').length);
await step('category page: add to cart, signed out', '/kategori/bal-sifa', p => p.locator('button[aria-label$="sepete ekle"], button:has-text("Sepete Ekle")').first().click(), async p => ({ ok: (await guestLines(p)) === 1 && addressOf(p) === '/kategori/bal-sifa', detail: `${addressOf(p)}, guest cart lines=${await guestLines(p)}` }));
await step('category page: favourite, signed out', '/kategori/bal-sifa', p => p.locator('button[aria-label="Favorilere ekle"]').first().click(), async p => ({ ok: await loginShown(p), detail: `${addressOf(p)}, sign-in shown=${await loginShown(p)}` }));
await step('category page: product card', '/kategori/bal-sifa', p => p.locator('.go-product-card__media > button').first().click(), async p => ({ ok: addressOf(p).startsWith('/urun/'), detail: addressOf(p) }));
await step('product page: add to cart, signed out', PRODUCT, async p => { const b = p.locator('button', { hasText: /Sepete ekle/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); }, async p => ({ ok: (await guestLines(p)) === 1 && addressOf(p) === PRODUCT, detail: `${addressOf(p)}, guest cart lines=${await guestLines(p)}` }));
await step('product page: category chip', PRODUCT, p => p.locator('button', { hasText: /Bal & Dağ Bitkileri/i }).first().click(), async p => ({ ok: addressOf(p) === '/kategori/bal-sifa', detail: addressOf(p) }));
await step('categories: a category row, then reload', '/?tab=categories', async p => { await p.locator('.go-cat-row').first().click(); await p.waitForTimeout(1200); await p.reload(); await p.waitForTimeout(2300); }, async p => ({ ok: /^\/\?tab=categories&category=[a-z0-9-]+$/.test(addressOf(p)) && await tabOf(p) === 'categories' && await p.locator('.go-cat-back').count() === 1, detail: `${addressOf(p)}, tab after reload=${await tabOf(p)}` }));
await step('product page: back button', '/', async p => { await p.locator('[data-product-link="true"]').first().click(); await p.waitForTimeout(1200); await p.locator('button[aria-label*="Geri"], button[aria-label*="geri"]').first().click(); }, async p => ({ ok: addressOf(p) === '/' || addressOf(p).startsWith('/?'), detail: addressOf(p) }));
await step('home: category card', '/', p => p.locator('.go-category-card').first().click(), async p => ({ ok: addressOf(p) === '/?tab=categories&category=bal-sifa', detail: addressOf(p) }));
await step('home: product row', '/', p => p.locator('[data-product-link="true"]').first().click(), async p => ({ ok: addressOf(p).startsWith('/urun/'), detail: addressOf(p) }));
// The product page swaps the tab bar for its purchase dock (it has its own
// back button). The address-bar regression is checked from a category page,
// which has a clean path (/kategori/<slug>) just like a product page.
await step('product page: purchase dock replaces the tab bar', PRODUCT, async () => {}, async p => {
  const navVisible = await p.locator('nav[aria-label="Ana gezinme"]').isVisible().catch(() => false);
  // Editorial page: the buttons sit in the buy box; the phone's calm bottom bar is fixed.
  const dock = await p.locator('.go-sticky-buy').evaluate(el => getComputedStyle(el).position).catch(() => '');
  return { ok: !navVisible && dock === 'fixed' && await tabOf(p) === 'product-detail', detail: `tab bar visible=${navVisible}, dock=${dock}, tab=${await tabOf(p)}` };
});
for (const [tab, expected] of [['Kategoriler', '/?tab=categories'], ['Favoriler', '/?tab=account&view=favorites'], ['Sepet', '/?tab=cart'], ['Hesabım', '/?tab=account'], ['Ana Sayfa', '/?tab=home']]) {
  await step(`bottom navigation from a category page: ${tab}`, '/kategori/bal-sifa', p => p.locator(`nav[aria-label="Ana gezinme"] button[aria-label^="${tab}"]`).click(), async p => ({ ok: addressOf(p) === expected, detail: addressOf(p) }));
}
await browser.close();

const failed = results.filter(([ok]) => !ok).length;
for (const [ok, label] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(failed ? `\n${failed} navigation check(s) failed.` : `\nAll ${results.length} navigation checks passed.`);
process.exit(failed ? 1 : 0);
