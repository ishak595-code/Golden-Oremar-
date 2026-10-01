// Cart and checkout contract audit.
//
// Runs the checkout rules themselves (identity check digits, shipping
// messages, country list, guest cart keys) and locks the behaviours that
// keep a customer from getting stuck: the cart opens even when payment
// options fail to load, a coupon can always be removed, a guest can fill a
// cart, and payment stays honestly switched off until the provider is live.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');

const out = fs.mkdtempSync(path.join('node_modules', '.go-checkout-'));
try {
  const compile = async (source, name) => (await transformWithEsbuild(read(source), name, { loader: 'ts', format: 'esm' })).code;
  fs.writeFileSync(path.join(out, 'helpers.mjs'), await compile('src/features/cart/checkoutHelpers.ts', 'checkoutHelpers.ts'));
  fs.writeFileSync(path.join(out, 'guest.mjs'), await compile('src/features/cart/guestCart.ts', 'guestCart.ts'));
  const helpers = await import(pathToFileURL(path.resolve(out, 'helpers.mjs')).href);
  const guest = await import(pathToFileURL(path.resolve(out, 'guest.mjs')).href);

  check(helpers.isValidTurkishIdentity('10000000146') === true, 'A valid T.C. kimlik number must pass.');
  for (const bad of ['12345678901', '01234567890', '1000000014', '10000000147', 'abcdefghijk']) check(helpers.isValidTurkishIdentity(bad) === false, `T.C. kimlik "${bad}" must fail.`);

  const countries = helpers.countryOptions();
  check(countries.length === 249 && countries[0].code === 'TR' && countries[0].name === 'Türkiye', 'The country list must hold every ISO country with Türkiye first.');
  check(helpers.isKnownCountry('DE') && !helpers.isKnownCountry('XX'), 'Only real country codes are accepted.');

  const base = { available: true, shippingMinor: 4990, minDeliveryDays: 1, maxDeliveryDays: 3, freeShippingThresholdMinor: 50000 };
  const below = helpers.shippingInsight(base, 30000);
  check(below.remainingForFreeMinor === 20000 && Math.abs(below.progress - 0.6) < 1e-9 && below.deliveryText === '1-3 iş günü içinde teslimat', 'Below the threshold the cart says how much more is needed.');
  const above = helpers.shippingInsight({ ...base, shippingMinor: 0 }, 60000);
  check(above.free === true && above.remainingForFreeMinor === null, 'At or above the threshold shipping reads as free.');
  check(helpers.shippingInsight({ available: false, manualQuoteRequired: true }, 1000) === null, 'An unavailable quote makes no shipping claim.');
  check(helpers.shippingInsight({ ...base, publicNote: 'Gerçek taşıyıcı tarifeleri bağlandığında ücret kuralları yönetim panelinden güncellenecektir.' }, 1).note === null, 'Back-office notes are never shown to customers.');

  check(guest.guestLineKey('v1', { b: 1, a: 2 }) === guest.guestLineKey('v1', { a: 2, b: 1 }), 'Guest cart lines must match regardless of option order.');
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}

const flow = read('src/features/cart/CartCheckoutFlow.tsx');
const guestView = read('src/features/cart/GuestCartView.tsx');
const app = read('src/App.tsx');
const product = read('src/features/catalog/ProductDetailScreen.tsx');
check(/Promise\.allSettled\(\[getCart\(\),getCheckoutAccountOverview\(\),loadCapabilities\(\)\]\)/.test(flow), 'The cart must open even when addresses or payment options fail to load.');
check(/function removeCoupon\(\)/.test(flow) && /kuponunu kaldır/.test(flow), 'An applied coupon must always be removable.');
check(/isValidTurkishIdentity\(identity\)/.test(flow), 'T.C. kimlik check digits must be verified before payment.');
check(/Kartla online ödeme çok yakında açılıyor/.test(flow) && !/ödemeniz alındı|ödeme başarılı/i.test(flow.replace(/Ödemeniz başarıyla doğrulandı/, '')), 'With payment off the cart must say so honestly and never imply payment.');
check(!/<main[\s>]/.test(flow) && !/<main[\s>]/.test(guestView), 'Cart screens render inside the app <main>; they must not open a second one.');
check(/GuestCartView/.test(app) && /mergeGuestCartIntoAccount\(/.test(app), 'Visitors must get a cart, merged into the account on sign-in.');
check(/if\(!authenticated\)\{try\{setError\(''\);addToGuestCartFromPage\(\)/.test(product), 'The product page must let a visitor add to cart without an account.');
check(/'freeShippingThresholdMinor',zone\.free_shipping_threshold_minor/.test(read('supabase/migrations/20261001163000_shipping_quote_free_threshold_v1.sql')), 'The shipping quote must carry the free-shipping threshold.');

if (failures.length) { console.error('Checkout contract audit failed:'); for (const f of failures) console.error(`- ${f}`); process.exit(1); }
console.log('Checkout contract audit passed: identity check digits, shipping messages, country list, guest cart and merge, removable coupons, honest payment-off state and a cart that opens when payment options fail.');
