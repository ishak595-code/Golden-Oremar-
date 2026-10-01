// Cart and checkout as a customer meets them, signed in and as a guest.
//
// Signed in (lib.mjs signedIn: a real session shape and an in-memory cart
// behind the same RPCs production uses), with payment switched off as it is
// until the provider is connected, and switched on to check the payment form:
// steps, free-shipping line, stock flags, quantity changes, coupons (good,
// bad, removed), the "online payment soon" state with order-by-WhatsApp, the
// fixed checkout bar replacing the tab bar, identity number checks, and axe.
//
// As a guest: add from the product page without an account, the badge and
// guest cart follow, "Siparişi tamamla" asks for an account, and signing in
// moves the guest cart into the account cart, adding to what was there.
//
//   npm run build && npx vite preview --port 4173 --strictPort &
//   BROWSER_TOOLS=... node scripts/browser/checkout-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { BASE, FIXTURES, axeSource, launch, routeSupabase, signedIn } from './lib.mjs';

const detail = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'detail.json'), 'utf8'));
const variant = detail.variants[0];
const results = [];
const check = (ok, label) => { results.push([Boolean(ok), label]); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); };
const axe = axeSource();
const browser = await launch();

async function open(setup, url = '/?tab=cart', colorScheme = 'dark') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', colorScheme });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource: net::ERR_FAILED/.test(message.text())) errors.push(message.text().slice(0, 160)); });
  const state = await setup(page);
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { context, page, state, errors };
}
async function axeRun(page) {
  await page.addScriptTag({ content: axe });
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`));
}
const cartText = page => page.locator('.go-cart').innerText();

// 1. Signed in, one item, payment not connected yet.
{
  const { context, page, state, errors } = await open(page => signedIn(page, { cart: [{ variantId: variant.id, quantity: 1 }] }));
  const text = await cartText(page);
  check(/Sepet\s*\(tamamlandı\)/.test(text) && /Teslimat\s*\(şu anki adım\)/.test(text), 'steps show the cart done and delivery as the current step');
  check(/Kargo bedava/.test(text) || /Kargo bedava için/.test(text), 'the shipping line explains free shipping');
  check(/1-7 iş günü içinde teslimat/.test(text), 'delivery estimate comes from the shipping zone');
  check(/Son 5 adet/.test(text), 'low stock is flagged on the item');
  check(/Kartla online ödeme çok yakında açılıyor/.test(text), 'payment off: an honest "coming soon" message, no fake payment');
  const whatsapp = page.locator('a.go-cart-contact[href^="https://wa.me/905379594851?text="]');
  check(await whatsapp.count() === 1 && decodeURIComponent(await whatsapp.getAttribute('href')).includes(`1 x ${detail.name}`), 'payment off: order by WhatsApp with the cart prefilled');
  const primary = page.locator('section[aria-labelledby="cart-summary-title"] button').last();
  check(await primary.isDisabled() && /Online ödeme yakında/.test(await primary.innerText()), 'payment off: the order button says so and is disabled');
  check(await page.locator('.go-cart-dock').isVisible() && !(await page.locator('nav[aria-label="Ana gezinme"]').isVisible()), 'the checkout bar replaces the tab bar on a phone');
  const dockBox = await page.locator('.go-cart-dock').boundingBox();
  const fabBox = await page.locator('.go-safety-fab').boundingBox().catch(() => null);
  check(!fabBox || fabBox.y + fabBox.height <= dockBox.y, 'the safety button sits above the checkout bar, not on it');

  // Quantity up, then the total follows.
  await page.locator('button[aria-label$="adet artır"]').first().click();
  await page.waitForTimeout(900);
  const setCall = state.calls.filter(c => c.rpc === 'set_my_cart_item_v1').pop();
  check(setCall?.body?.p_quantity === 2, 'plus sends quantity 2 to the server');
  check((await page.locator('.go-cart-dock__total strong').innerText()).includes('6.400'), 'the checkout bar total follows the new quantity');

  // A wrong coupon can be removed (it used to block checkout with no way out).
  await page.locator('input[placeholder="Kupon kodunuz"]').fill('YANLIS');
  await page.getByRole('button', { name: 'Uygula' }).click();
  await page.waitForTimeout(900);
  check(/YANLIS\s*bu sepete uygulanamıyor/.test(await cartText(page)), 'a wrong coupon says it does not apply');
  await page.locator('button[aria-label="YANLIS kuponunu kaldır"]').click();
  await page.waitForTimeout(900);
  check(await page.locator('input[placeholder="Kupon kodunuz"]').count() === 1 && !/uygulanamıyor/.test(await cartText(page)), 'the wrong coupon is removed and the field is back');
  await page.locator('input[placeholder="Kupon kodunuz"]').fill('HOSGELDIN');
  await page.locator('input[placeholder="Kupon kodunuz"]').press('Enter');
  await page.waitForTimeout(900);
  check(/HOSGELDIN\s*uygulandı/.test(await cartText(page)) && /Hoş geldin indirimi/.test(await cartText(page)), 'a good coupon shows its discount in the summary');

  // The item opens its product page.
  const violations = await axeRun(page);
  check(!violations.length, `axe signed-in cart: ${violations.join(' | ') || 'no serious or critical issues'}`);
  await page.getByRole('button', { name: `${detail.name} ürün sayfasını aç` }).click();
  await page.waitForTimeout(700);
  check(new URL(page.url()).pathname === `/urun/${detail.slug}`, 'tapping the item opens its product page');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 2. An item that is no longer sold blocks the order with a clear reason.
{
  const { context, page, errors } = await open(page => signedIn(page, { cart: [{ variantId: variant.id, quantity: 1, available: false }], payments: { hostedCheckout: true, savedCardPayment: false, cardEnrollment: false } }));
  const text = await cartText(page);
  check(/Bu ürün şu anda satışta değil/.test(text), 'an unavailable item is flagged on its row');
  check(/Sepet\s*2/.test(text.replace(/\n/g, ' ')) || !/Sepet\s*\(tamamlandı\)/.test(text), 'the cart step is not marked done while an item is unavailable');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 3. Payment switched on: address and identity checks before anything is sent.
{
  const { context, page, state, errors } = await open(page => signedIn(page, { cart: [{ variantId: variant.id, quantity: 1 }], payments: { hostedCheckout: true, savedCardPayment: false, cardEnrollment: false } }));
  check(/Tek seferlik güvenli ödeme/.test(await cartText(page)), 'payment on: the iyzico option appears');
  check(await page.locator('select[name="country_code"]').inputValue() === 'TR', 'the country defaults to Türkiye');
  await page.locator('input[name="phone"]').fill('0555 111 22 33');
  await page.locator('input[name="province"]').fill('Hakkari');
  await page.locator('input[name="district"]').fill('Merkez');
  await page.locator('input[name="postal_code"]').fill('30000abc');
  check(await page.locator('input[name="postal_code"]').inputValue() === '30000', 'a Turkish postal code keeps digits only');
  await page.locator('textarea[name="address_line"]').fill('Bahçelievler Mah. Gül Sok. No 4');
  await page.locator('section[aria-labelledby="cart-payment-title"] select').selectOption('tc_identity');
  await page.locator('input[name="identity_number"]').fill('12345678901');
  await page.locator('section[aria-labelledby="cart-summary-title"] button').last().click();
  await page.waitForTimeout(600);
  check(/T\.C\. kimlik numarası geçerli görünmüyor/.test(await page.locator('[role="alert"]').first().innerText()), 'a T.C. number with wrong check digits is caught before payment');
  check(!state.calls.some(c => c.rpc === 'create_customer_order_v5'), 'no order is created while the form has an error');
  check(/Teslimat\s*\(tamamlandı\)/.test(await cartText(page)), 'a complete address marks the delivery step done');
  const violations = await axeRun(page);
  check(!violations.length, `axe cart with payment form: ${violations.join(' | ') || 'no serious or critical issues'}`);
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 4. A guest fills a cart without an account, then signs in.
{
  const { context, page, errors } = await open(page => routeSupabase(page), `/urun/${detail.slug}`);
  await page.locator('.product-detail-commerce-cart').first().click();
  await page.waitForTimeout(700);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('golden_oremar_guest_cart_v1') || '[]'));
  check(stored.length === 1 && stored[0].variantId === variant.id, 'a guest can add to cart from the product page');
  await page.goto(BASE + '/?tab=cart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const badge = await page.locator('nav[aria-label="Ana gezinme"]').innerText();
  check(/1/.test(badge), 'the tab bar badge counts the guest cart');
  check(new RegExp(detail.name).test(await page.locator('.go-cart').innerText()), 'the guest cart lists the item');
  const violations = await axeRun(page);
  check(!violations.length, `axe guest cart: ${violations.join(' | ') || 'no serious or critical issues'}`);
  await page.getByRole('button', { name: 'Siparişi tamamla' }).click();
  await page.waitForTimeout(900);
  check(await page.locator('input[type="email"]').count() > 0, '"Siparişi tamamla" asks for an account');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}
{
  const guestLine = { key: `${variant.id}|[]`, variantId: variant.id, quantity: 2, selectedOptions: {}, productSlug: detail.slug, productName: detail.name, variantName: variant.name, producerName: detail.producer.name, priceMinor: variant.priceMinor, currency: 'TRY', imagePath: null, addedAt: Date.now() };
  const { context, page, state, errors } = await open(async page => {
    await page.addInitScript(line => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('golden_oremar_guest_cart_v1', JSON.stringify([line])); sessionStorage.setItem('seeded', '1'); } }, guestLine);
    return signedIn(page, { cart: [{ variantId: variant.id, quantity: 1, selectedOptions: {} }] });
  });
  await page.waitForTimeout(800);
  const merged = state.calls.find(c => c.rpc === 'set_my_cart_item_v1');
  check(merged?.body?.p_quantity === 3, `signing in adds the guest quantity to the account cart (sent ${merged?.body?.p_quantity})`);
  check(await page.evaluate(() => localStorage.getItem('golden_oremar_guest_cart_v1')) === null, 'the guest cart is emptied once moved');
  check(/3 ürün/.test(await page.locator('.go-cart').innerText().catch(() => '')), 'the account cart shows the merged quantity');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 5. The same screens in the light theme.
for (const [name, setup] of [
  ['signed-in cart', page => signedIn(page, { cart: [{ variantId: variant.id, quantity: 1 }] })],
  ['cart with payment form', page => signedIn(page, { cart: [{ variantId: variant.id, quantity: 1 }], payments: { hostedCheckout: true, savedCardPayment: false, cardEnrollment: false } })],
]) {
  const { context, page } = await open(setup, '/?tab=cart', 'light');
  const violations = await axeRun(page);
  check(!violations.length, `axe ${name} (light theme): ${violations.join(' | ') || 'no serious or critical issues'}`);
  await context.close();
}

await browser.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(failed ? `\n${failed}/${results.length} checkout checks failed.` : `\nAll ${results.length} checkout checks passed.`);
process.exit(failed ? 1 : 0);
