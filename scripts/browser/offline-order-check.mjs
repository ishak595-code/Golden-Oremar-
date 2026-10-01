// Ordering without online payment, as a customer meets it.
//
// 1. A guest on the product page taps "Hemen Satın Al": the order sheet opens
//    right there (no sign-up), validates the form, needs consent, sends only
//    variant/quantity (no prices), shows the order code and a prefilled
//    WhatsApp link. A double tap sends one request.
// 2. Bank transfer: the IBAN, the order code to write in the description and
//    the payment window are shown; copy buttons work.
// 3. A guest cart offers the same; the cart empties only after the receipt
//    is closed.
// 4. A member cart with payment off: "Siparişi tamamla" opens the sheet with
//    the saved address prefilled; payment on keeps the card flow.
// Every screen runs axe in dark and light.
//
//   npm run build && npx vite preview --port 4173 --strictPort &
//   BROWSER_TOOLS=... node scripts/browser/offline-order-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { BASE, FIXTURES, axeSource, launch, routeSupabase, signedIn } from './lib.mjs';

const detail = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'detail.json'), 'utf8'));
const variant = detail.variants[0];
const results = [];
const check = (ok, label) => { results.push([Boolean(ok), label]); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); };
const axe = axeSource();
const browser = await launch();

const CONFIG = {
  whatsapp: { enabled: true, number: '905379594851' },
  bankTransfer: { enabled: true, paymentWindowHours: 48, accounts: [{ bankName: 'Ziraat Bankası', accountHolder: 'İshak Örnek', iban: 'TR33 0006 1005 1978 6457 8413 26', branch: 'Yüksekova' }] },
  note: null,
};

async function orderRoutes(page, state) {
  await page.route('**/rpc/get_public_offline_ordering_v1', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.config) }));
  await page.route('**/rpc/submit_order_request_v1', async route => {
    const body = route.request().postDataJSON() || {};
    state.submits.push(body);
    await new Promise(resolve => setTimeout(resolve, 250));
    const items = (body.p_items || []).map(item => ({ variantId: item.variantId, productId: detail.id, slug: detail.slug, productName: detail.name, variantName: variant.name, quantity: item.quantity, unitPriceMinor: variant.priceMinor, lineTotalMinor: variant.priceMinor * item.quantity, options: null }));
    const subtotal = items.reduce((t, i) => t + i.lineTotalMinor, 0);
    const receipt = { reference: 'GO-261001-AB7K', method: body.p_method, status: 'new', items, currency: 'TRY', subtotalMinor: subtotal, shippingMinor: 0, totalMinor: subtotal, customerName: body.p_customer?.name, createdAt: new Date().toISOString(), whatsappNumber: '905379594851', bankTransfer: body.p_method === 'bank_transfer' ? CONFIG.bankTransfer : null };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(receipt) });
  });
}

async function open({ member = false, cart = [], addresses = [], payments, url, colorScheme = 'dark', guestCart = null }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', colorScheme, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text().slice(0, 160)); });
  const state = { config: CONFIG, submits: [] };
  if (guestCart) await page.addInitScript(value => { try { localStorage.setItem('golden_oremar_guest_cart_v1', value); } catch {} }, JSON.stringify(guestCart));
  if (member) Object.assign(state, { member: await signedIn(page, { cart, addresses, ...(payments ? { payments } : {}) }) });
  else await routeSupabase(page);
  await orderRoutes(page, state);
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { context, page, state, errors };
}
async function axeRun(page) {
  await page.addScriptTag({ content: axe });
  return page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`));
}
const sheet = page => page.locator('.go-order-sheet');
async function fill(page, values = {}) {
  const v = { name: 'Zeynep Kaya', phone: '0532 123 45 67', province: 'Van', district: 'İpekyolu', address: 'Cumhuriyet Mah. 12. Sokak No 4 Daire 3', ...values };
  const s = sheet(page);
  await s.getByLabel('Ad soyad').fill(v.name);
  await s.getByLabel('Telefon').fill(v.phone);
  await s.getByLabel('İl', { exact: true }).fill(v.province);
  await s.getByLabel('İlçe').fill(v.district);
  await s.getByLabel('Açık adres').fill(v.address);
}

// 1. Guest, product page, WhatsApp.
for (const colorScheme of ['dark', 'light']) {
  const { context, page, state, errors } = await open({ url: `/urun/${detail.slug}`, colorScheme });
  await page.locator('.product-detail-commerce-buy').first().click();
  await page.waitForTimeout(700);
  check(await sheet(page).isVisible(), `${colorScheme}: "Hemen Satın Al" opens the order sheet for a guest`);
  const text = await sheet(page).innerText();
  check(/WhatsApp ile sipariş/.test(text) && /Havale \/ EFT/.test(text), `${colorScheme}: both methods are offered`);
  check(new RegExp(detail.name).test(text), `${colorScheme}: the sheet lists the product`);
  check(!/[☀-➿\u{1F300}-\u{1FAFF}]/u.test(text), `${colorScheme}: no emojis in the sheet`);
  let violations = await axeRun(page);
  check(!violations.length, `${colorScheme}: axe order form: ${violations.join(' | ') || 'no serious or critical issues'}`);

  if (colorScheme === 'dark') {
    await sheet(page).getByRole('button', { name: /Siparişi oluştur/ }).click();
    await page.waitForTimeout(300);
    check(/Adınızı ve soyadınızı yazın/.test(await sheet(page).innerText()) && state.submits.length === 0, 'an empty form is stopped with clear messages');
    await fill(page, { phone: '123' });
    await sheet(page).getByRole('button', { name: /Siparişi oluştur/ }).click();
    await page.waitForTimeout(300);
    check(/Geçerli bir telefon numarası/.test(await sheet(page).innerText()) && state.submits.length === 0, 'a wrong phone number is caught before sending');
    await sheet(page).getByLabel('Telefon').fill('0532 123 45 67');
    await sheet(page).getByRole('button', { name: /Siparişi oluştur/ }).click();
    await page.waitForTimeout(300);
    check(/ön bilgilendirme onay kutusunu/.test(await sheet(page).innerText()) && state.submits.length === 0, 'consent is required');
  } else {
    await fill(page);
  }
  await sheet(page).locator('.go-order-consent input').check();
  const submit = sheet(page).getByRole('button', { name: /Siparişi oluştur/ });
  await submit.click();
  await submit.click({ timeout: 500 }).catch(() => {});
  await page.waitForTimeout(900);
  check(state.submits.length === 1, `${colorScheme}: one tap, one order request (double tap ignored)`);
  const sent = state.submits[0] || {};
  check(sent.p_method === 'whatsapp' && sent.p_source === 'product' && sent.p_consent === true, `${colorScheme}: method, source and consent are sent`);
  check(Array.isArray(sent.p_items) && sent.p_items.length === 1 && sent.p_items[0].variantId === variant.id && !('priceMinor' in sent.p_items[0]) && !JSON.stringify(sent.p_items).includes('Minor'), `${colorScheme}: only variant and quantity are sent, never a price`);
  check(sent.p_customer?.phone === '+905321234567', `${colorScheme}: the phone is sent in international form`);
  const done = await sheet(page).innerText();
  check(/Siparişiniz alındı/.test(done) && /GO-261001-AB7K/.test(done), `${colorScheme}: the order code is shown`);
  const wa = sheet(page).locator('a[href^="https://wa.me/905379594851?text="]');
  const href = decodeURIComponent(await wa.getAttribute('href') || '');
  check(await wa.count() === 1 && href.includes('GO-261001-AB7K') && href.includes(detail.name), `${colorScheme}: WhatsApp opens with the code and the product prefilled`);
  violations = await axeRun(page);
  check(!violations.length, `${colorScheme}: axe receipt: ${violations.join(' | ') || 'no serious or critical issues'}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(!(await sheet(page).isVisible()), `${colorScheme}: Escape closes the sheet`);
  check(!errors.length, `${colorScheme}: no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 2. Guest, product page, bank transfer.
{
  const { context, page, state, errors } = await open({ url: `/urun/${detail.slug}` });
  await page.locator('.product-detail-commerce-buy').first().click();
  await page.waitForTimeout(600);
  await sheet(page).getByText('Havale / EFT').click();
  await fill(page);
  await sheet(page).locator('.go-order-consent input').check();
  await sheet(page).getByRole('button', { name: /IBAN/ }).click();
  await page.waitForTimeout(800);
  const text = await sheet(page).innerText();
  check(state.submits[0]?.p_method === 'bank_transfer', 'bank transfer is sent as the method');
  check(/TR33 0006 1005 1978 6457 8413 26/.test(text) && /İshak Örnek/.test(text) && /Ziraat Bankası/.test(text), 'the IBAN, account holder and bank are shown');
  check(/Açıklama alanına yalnız\s*GO-261001-AB7K/.test(text) && /48 saat/.test(text), 'the code for the description and the payment window are shown');
  await sheet(page).getByRole('button', { name: 'IBAN kopyala' }).click();
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check(clip === 'TR330006100519786457841326', 'copying the IBAN gives it without spaces');
  check(await sheet(page).locator('a[href^="https://wa.me/"]').count() === 1, 'the receipt can be sent on WhatsApp');
  const violations = await axeRun(page);
  check(!violations.length, `axe bank receipt: ${violations.join(' | ') || 'no serious or critical issues'}`);
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 3. Guest cart.
{
  const guestCart = [{ key: `${variant.id}:{}`, variantId: variant.id, quantity: 2, selectedOptions: {}, productSlug: detail.slug, productName: detail.name, variantName: variant.name, producerName: detail.producer.name, priceMinor: variant.priceMinor, currency: 'TRY', imagePath: null, addedAt: Date.now() }];
  const { context, page, state, errors } = await open({ url: '/?tab=cart', guestCart, colorScheme: 'light' });
  const summary = page.locator('section[aria-labelledby="guest-cart-summary"]');
  check(/Üye olmadan sipariş verebilirsiniz/.test(await summary.innerText()), 'the guest cart says an account is not needed');
  await summary.getByRole('button', { name: 'Siparişi tamamla' }).click();
  await page.waitForTimeout(600);
  await fill(page);
  await sheet(page).locator('.go-order-consent input').check();
  await sheet(page).getByRole('button', { name: /Siparişi oluştur/ }).click();
  await page.waitForTimeout(900);
  check(state.submits[0]?.p_source === 'cart' && state.submits[0]?.p_items?.[0]?.quantity === 2, 'the guest cart sends its lines');
  const stillThere = await page.evaluate(() => JSON.parse(localStorage.getItem('golden_oremar_guest_cart_v1') || '[]').length);
  check(stillThere === 1 && await sheet(page).isVisible(), 'the receipt stays on screen and the cart is kept until it is closed');
  await sheet(page).getByRole('button', { name: 'Alışverişe dön' }).click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('golden_oremar_guest_cart_v1') || '[]').length);
  check(after === 0, 'closing the receipt empties the guest cart');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('golden-oremar:order-contact:v1') || '{}'));
  check(saved.name === 'Zeynep Kaya' && !('note' in saved), 'delivery details are remembered on this device (without the note)');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 4. Member cart: payment off opens the sheet with the address prefilled;
//    payment on keeps the card flow.
{
  const address = { id: 'ad000000-0000-4000-8000-000000000001', label: 'Ev', recipient_name: 'Ayşe Yılmaz', phone: '05551112233', country_code: 'TR', province: 'Hakkari', district: 'Yüksekova', neighborhood: 'Merkez Mah.', address_line: 'Atatürk Cad. No 10 Daire 2', postal_code: '30300', is_default: true };
  const { context, page, state, errors } = await open({ member: true, cart: [{ variantId: variant.id, quantity: 1 }], addresses: [address], url: '/?tab=cart' });
  const text = await page.locator('.go-cart').innerText();
  check(/WhatsApp veya Havale\/EFT ile sipariş/.test(text), 'payment off: the cart offers WhatsApp or bank transfer');
  const primary = page.locator('section[aria-labelledby="cart-summary-title"] button').last();
  check(!(await primary.isDisabled()) && /Siparişi tamamla/.test(await primary.innerText()), 'payment off: the order button works instead of being disabled');
  await primary.click();
  await page.waitForTimeout(700);
  check(await sheet(page).isVisible() && (await sheet(page).getByLabel('Ad soyad').inputValue()) === 'Ayşe Yılmaz' && /Atatürk Cad/.test(await sheet(page).getByLabel('Açık adres').inputValue()), 'the saved address is prefilled');
  await sheet(page).locator('.go-order-consent input').check();
  await sheet(page).getByRole('button', { name: /Siparişi oluştur/ }).click();
  await page.waitForTimeout(900);
  check(state.submits.length === 1 && /GO-261001-AB7K/.test(await sheet(page).innerText()), 'a member order gets its code');
  check(!state.member.calls.some(call => call.rpc === 'clear_my_cart_v1'), 'the member cart is kept while the receipt is open');
  await sheet(page).getByRole('button', { name: 'Alışverişe dön' }).click();
  await page.waitForTimeout(800);
  check(state.member.calls.some(call => call.rpc === 'clear_my_cart_v1'), 'closing the receipt empties the member cart');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}
{
  const { context, page, errors } = await open({ member: true, cart: [{ variantId: variant.id, quantity: 1 }], payments: { hostedCheckout: true, savedCardPayment: false, cardEnrollment: false }, url: `/urun/${detail.slug}` });
  await page.locator('.product-detail-commerce-buy').first().click();
  await page.waitForTimeout(1200);
  check(!(await sheet(page).isVisible()), 'payment on: "Hemen Satın Al" keeps the card checkout');
  check(!errors.length, `no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

// 5. Backend down (quota/outage): the product page comes from the shipped
//    copy, WhatsApp is still offered from the shipped contact details, and a
//    failed submit turns into a complete order message on WhatsApp.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', colorScheme: 'dark' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await routeSupabase(page, {}, { quota: true, offlineCatalog: 'shipped' });
  await page.goto(BASE + '/urun/avasin-mese-bali-103', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('.product-detail-commerce-buy').first().click();
  await page.waitForTimeout(900);
  const text = await sheet(page).innerText().catch(() => '');
  check(/WhatsApp ile sipariş/.test(text) && !/Havale \/ EFT/.test(text), 'outage: the sheet still opens with WhatsApp (no IBAN without the live settings)');
  await fill(page);
  await sheet(page).locator('.go-order-consent input').check();
  await sheet(page).getByRole('button', { name: /Siparişi oluştur/ }).click();
  await page.waitForTimeout(900);
  const direct = sheet(page).locator('a[href^="https://wa.me/905379594851?text="]');
  const href = decodeURIComponent(await direct.getAttribute('href').catch(() => '') || '');
  check(/yanıt vermiyor/.test(await sheet(page).innerText()) && href.includes('Avaşin') && href.includes('Zeynep Kaya') && href.includes('İpekyolu / Van'), 'outage: a failed submit offers the whole order on WhatsApp');
  check(!errors.length, `outage: no page errors (${errors.join(' | ') || 'none'})`);
  await context.close();
}

await browser.close();
const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} offline order checks passed.`);
if (failed.length) process.exit(1);
