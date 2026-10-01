// Shared helpers for the headless-browser checks in this folder.
//
// These checks run the BUILT app (vite preview) in a real Chromium, with every
// Supabase RPC answered from fixtures captured from production. They are not
// part of `npm run audit:all`: they need a browser, which is deliberately not a
// project dependency (it would add a large download to every CI install).
//
// Setup, once per machine or sandbox:
//   mkdir -p /tmp/go-browser && cd /tmp/go-browser
//   npm i @sparticuz/chromium@131 playwright-core@1.56.0 axe-core@4
// Then, from the repo root:
//   npm run build && npx vite preview --port 4173 --strictPort &
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/responsive-check.mjs
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/resilience-check.mjs
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/a11y-check.mjs
//   BROWSER_TOOLS=/tmp/go-browser node scripts/browser/navigation-check.mjs
//   (media-cdn-check.mjs needs its own build, see the top of that file)
//
// Why @sparticuz/chromium: in restricted sandboxes `playwright install` is
// blocked, while the npm registry is reachable. The two arguments removed in
// launch() make that build crash as soon as a second browser context opens.
//
// Fixtures live in ./fixtures and were captured with the Supabase MCP as the
// anon role on 2026-09-26. Refresh them when an RPC's shape changes.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(here, 'fixtures');
export const BASE = process.env.APP_URL || 'http://localhost:4173';

function tools() {
  const dir = process.env.BROWSER_TOOLS;
  if (!dir) throw new Error('Set BROWSER_TOOLS to the folder where @sparticuz/chromium, playwright-core and axe-core are installed (see lib.mjs).');
  return createRequire(path.join(dir, 'package.json'));
}

async function load(name) {
  const mod = await import(pathToFileURL(tools().resolve(name)).href);
  return mod.default ?? mod;
}

export async function launch(extraArgs = []) {
  const chromium = await load('@sparticuz/chromium');
  const { chromium: pw } = await load('playwright-core');
  const args = [...chromium.args.filter(arg => arg !== '--single-process' && arg !== '--no-zygote'), ...extraArgs];
  return pw.launch({ executablePath: await chromium.executablePath(), args, headless: true });
}

export function axeSource() {
  return fs.readFileSync(tools().resolve('axe-core/axe.min.js'), 'utf8');
}

const fixture = name => fs.readFileSync(path.join(FIXTURES, name));

/**
 * Answer Supabase from fixtures. `overrides` maps an RPC name to a fixture
 * file name, or to 'fail' for a 503. search_catalog_v3 echoes the requested
 * limit and offset, because the client rejects a page that does not match its
 * own request.
 */
/**
 * The shipped catalogue copy (public/offline-catalog, src/lib/offlineCatalog.ts)
 * answers when Supabase fails. Checks that test the failure screens hide it
 * (the default); offline-catalog-check.mjs serves it from these fixtures
 * ('fixtures') and from the real exported files ('shipped').
 */
function offlineCatalogFixture(pathname) {
  const file = pathname.replace(/^\/offline-catalog\//, '');
  const detail = JSON.parse(fixture('detail.json'));
  if (file === 'home_catalog.json') return fixture('home.json');
  if (file === 'home_experience.json') return fixture('home_experience.json');
  if (file === 'categories.json') return fixture('categories.json');
  if (file === 'brand.json') return fixture('brand.json');
  if (file === `product/${detail.slug}.json`) return fixture('detail.json');
  return null;
}

export async function routeSupabase(page, overrides = {}, options = {}) {
  const offlineCatalog = options.offlineCatalog || 'absent';
  const defaults = {
    get_public_brand_appearance_v1: 'brand.json',
    get_public_home_experience_v1: 'home_experience.json',
    get_public_home_catalog_v3: 'home.json',
    list_public_categories_v2: 'categories.json',
    catalog_search_facets_v1: 'facets.json',
    get_public_product_detail_v6: 'detail.json',
    search_catalog_v3: 'search.json',
    catalog_search_suggestions_v1: 'suggestions.json',
  };
  const map = { ...defaults, ...overrides };
  const fixtureBody = name => {
    const raw = String(fixture(name));
    return options.photos ? raw.replaceAll('brand/official-store/golden-oremar-profile.webp', '42e1f398-0125-409a-8bc3-040d594d0635/products/fixture-photo.webp') : raw;
  };
  await page.route('**/*', route => {
    const url = route.request().url();
    const rpc = url.match(/\/rpc\/([a-z0-9_]+)/)?.[1];
    // The September 2026 outage: every API call answered 402.
    if (options.quota && (rpc || url.includes('.supabase.co'))) return route.fulfill({ status: 402, contentType: 'application/json', body: '{"message":"Service for this project is restricted due to exceeded usage quota"}' });
    if (rpc && map[rpc] === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"upstream timeout"}' });
    if (rpc === 'search_catalog_v3') {
      const request = route.request().postDataJSON() || {};
      const base = JSON.parse(fixtureBody(map.search_catalog_v3));
      const limit = request.p_limit ?? 20, offset = request.p_offset ?? 0;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, items: offset === 0 ? base.items.slice(0, limit) : [], limit, offset, total: base.items.length }) });
    }
    if (rpc === 'get_public_product_context_v1' && map.get_public_home_catalog_v3 !== 'fail') {
      const request = route.request().postDataJSON() || {};
      const items = JSON.parse(fixtureBody(map.get_public_home_catalog_v3)).items || [];
      const ref = String(request.p_reference || '');
      const product = items.find(item => item.slug === ref || item.id === ref || String(item.legacyId ?? '') === ref) || null;
      const others = product ? items.filter(item => item.id !== product.id) : [];
      const body = { product, sameCategory: product ? others.filter(item => item.category?.id === product.category?.id).slice(0, 8) : [], sameStore: product ? others.filter(item => item.producer?.id === product.producer?.id && item.category?.id !== product.category?.id).slice(0, 8) : [] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    // Fixture products use the store logo, which the app now replaces with
    // drawn artwork. Checks about real photos (media-cdn-check) ask for
    // photo paths instead.
    if (rpc && map[rpc]) return route.fulfill({ status: 200, contentType: 'application/json', body: fixtureBody(map[rpc]) });
    if (url.includes('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fixture('product.jpg') });
    if (url.includes('.supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: rpc ? 'null' : '[]' });
    if (url.startsWith(BASE) && new URL(url).pathname.startsWith('/offline-catalog/')) {
      if (offlineCatalog === 'shipped') return route.continue();
      const body = offlineCatalog === 'fixtures' ? offlineCatalogFixture(new URL(url).pathname) : null;
      return body ? route.fulfill({ status: 200, contentType: 'application/json', body }) : route.fulfill({ status: 404, body: '' });
    }
    if (url.startsWith(BASE)) return route.continue();
    return route.abort();
  });
}

/**
 * A signed-in customer with a working cart, for the cart and checkout checks.
 *
 * Puts a session where supabase-js keeps it, answers the auth endpoints, and
 * keeps a small in-memory cart that the cart RPCs read and change, with the
 * same shapes production returns. Payment stays switched off unless
 * `payments` says otherwise, which is the state the live store is in until
 * the payment provider is connected. Call before routeSupabase (routes added
 * later run first in Playwright, so this must be added after it; signedIn()
 * does that itself by calling routeSupabase).
 */
export async function signedIn(page, { cart = [], addresses = [], payments = { hostedCheckout: false, savedCardPayment: false, cardEnrollment: false }, overrides = {}, options = {} } = {}) {
  const userId = '7d1c3f0a-2b4e-4c6d-8e9f-0a1b2c3d4e5f';
  const now = Math.floor(Date.now() / 1000);
  const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now, email: 'musteri@example.com' })}.signature`;
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'musteri@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
  const session = { access_token: accessToken, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };
  await page.addInitScript(value => { try { localStorage.setItem('sb-rmfcziawxjgcnxexbrvw-auth-token', value); } catch {} }, JSON.stringify(session));

  const detail = JSON.parse(fixture('detail.json'));
  const state = { lines: cart.map((line, index) => ({ cartItemId: `c0000000-0000-4000-8000-00000000000${index + 1}`, ...line })), addresses, calls: [] };
  const snapshot = () => {
    const items = state.lines.map(line => {
      const variant = detail.variants.find(v => v.id === line.variantId) || detail.variants[0];
      return {
        cartItemId: line.cartItemId, quantity: line.quantity, selectedOptions: line.selectedOptions || {}, productId: detail.id, legacyId: detail.legacyId, slug: detail.slug,
        productName: line.productName || detail.name, unitLabel: detail.unitLabel, variantId: variant.id, variantName: variant.name, sku: variant.sku,
        priceMinor: variant.priceMinor, compareAtPriceMinor: line.compareAtPriceMinor ?? variant.compareAtPriceMinor, weightGrams: variant.weightGrams,
        producer: { id: detail.producer.id, name: detail.producer.name }, imagePath: detail.images?.[0]?.path || null, stockMode: detail.stockMode,
        sellableQuantity: line.sellableQuantity ?? variant.availableQuantity ?? null, available: line.available ?? true, lineTotalMinor: variant.priceMinor * line.quantity, handlingProfile: detail.handlingProfile || null,
      };
    });
    return { cartId: items.length ? 'ca000000-0000-4000-8000-000000000001' : null, currency: 'TRY', itemCount: items.reduce((t, i) => t + i.quantity, 0), subtotalMinor: items.reduce((t, i) => t + i.lineTotalMinor, 0), expiresAt: null, items };
  };
  const readiness = { provider: null, mode: 'disabled', cardEnrollmentMode: 'disabled', vaultEdgeFunction: 'payment-method-vault', liveCardPaymentsEnabled: false, savedPaymentMethodsSupported: true, cardEnrollmentEnabled: false, providerHostedCardEntryRequired: false, requiresProviderConfiguration: true, paymentVerificationRequired: true, storesProviderSecretsClientSide: false, storesRawCardData: false, storesCvv: false };
  const handlers = {
    customer_session_status: () => ({ is_authenticated: true, user_id: userId, email: 'musteri@example.com', display_name: 'Ayşe Yılmaz', phone: '+905551112233', locale: 'tr', status: 'active', roles: ['customer'] }),
    get_my_app_preferences_v1: () => ({ theme: null, notificationSound: 'oremar-drop', notificationSoundEnabled: true, updatedAt: null }),
    authorization_context_v1: () => ({ userId, accountStatus: 'active', roles: ['customer'], permissions: [], canAccessAdmin: false, isAdmin: false, isSuperAdmin: false, staffMfaRequired: false, mfaFactorEnrolled: false, mfaSatisfied: true, mfaEnforcementActive: false, staffMfaState: null, staffMfaTransitionPending: false, authenticatorAssuranceLevel: 'aal1' }),
    admin_session_status: () => ({ is_admin: false, roles: [] }),
    list_my_notifications_v1: () => ({ unreadCount: 0, items: [] }),
    get_my_terms_acceptance_v1: () => ({ accepted: true, termsVersion: '2026-09', acceptedAt: new Date().toISOString() }),
    list_customer_favorite_references: () => [],
    get_public_contact_config_v1: () => ({ email: 'goldenoremar@gmail.com', phone: '+90 537 959 48 51', whatsapp: 'https://wa.me/905379594851', address: 'Hakkari, Türkiye', social: {}, supportChannelsReady: true }),
    get_my_cart_v1: () => snapshot(),
    set_my_cart_item_v1: body => {
      const variant = detail.variants.find(v => v.id === body.p_variant_id);
      if (!variant) return { error: { status: 400, body: { code: 'P0002', message: 'variant_not_available' } } };
      const key = JSON.stringify(body.p_selected_options || {});
      const existing = state.lines.find(line => line.variantId === variant.id && JSON.stringify(line.selectedOptions || {}) === key);
      if (existing) existing.quantity = body.p_quantity; else state.lines.push({ cartItemId: `c0000000-0000-4000-8000-0000000000${String(state.lines.length + 10).padStart(2, '0')}`, variantId: variant.id, quantity: body.p_quantity, selectedOptions: body.p_selected_options || {} });
      return snapshot();
    },
    remove_my_cart_item_v1: body => { state.lines = state.lines.filter(line => line.cartItemId !== body.p_cart_item_id); return snapshot(); },
    clear_my_cart_v1: () => { state.lines = []; return snapshot(); },
    get_my_account_overview_v1: () => ({ addresses: state.addresses, profile: { display_name: 'Ayşe Yılmaz', phone: '+905551112233' } }),
    get_checkout_payment_readiness_v3: () => readiness,
    list_my_payment_methods_v1: () => [],
    preview_my_checkout_v1: body => {
      const cartNow = snapshot();
      const blocked = cartNow.items.find(item => !item.available);
      const domestic = (body.p_country_code || 'TR') === 'TR';
      const coupon = body.p_coupon_code;
      const discount = coupon === 'HOSGELDIN' ? Math.round(cartNow.subtotalMinor * 0.1) : 0;
      const couponInvalid = coupon && coupon !== 'HOSGELDIN';
      const shipping = domestic
        ? { available: true, manualQuoteRequired: false, countryCode: 'TR', zoneCode: 'TR_DOMESTIC', zoneName: 'Türkiye', currency: 'TRY', shippingMinor: cartNow.subtotalMinor >= 50000 ? 0 : 4990, weightGrams: 1400, minDeliveryDays: 1, maxDeliveryDays: 7, freeShippingThresholdMinor: 50000, publicNote: null }
        : { available: false, manualQuoteRequired: true, countryCode: body.p_country_code, zoneCode: 'WORLD_MANUAL', reason: 'manual_shipping_quote_required' };
      const shippingMinor = shipping.available ? shipping.shippingMinor : 0;
      const canCheckout = cartNow.items.length > 0 && !blocked && shipping.available && !couponInvalid;
      const blockingReason = !cartNow.items.length ? 'cart_empty' : blocked ? 'product_not_available' : !shipping.available ? shipping.reason : couponInvalid ? 'coupon_invalid_or_unavailable' : null;
      return { canCheckout, blockingReason, countryCode: body.p_country_code || 'TR', currency: 'TRY', itemCount: cartNow.itemCount, subtotalMinor: cartNow.subtotalMinor, shippingMinor, discountMinor: discount, totalMinor: cartNow.subtotalMinor + shippingMinor - discount, shipping, promotion: discount ? { eligible: true, applied: true, title: 'Hoş geldin indirimi', totalDiscountMinor: discount } : { eligible: false, applied: false, totalDiscountMinor: 0 }, previewOnly: true };
    },
  };
  await routeSupabase(page, overrides, options);
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (!url.includes('.supabase.co')) return route.fallback();
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (url.includes('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    if (url.includes('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.includes('/functions/v1/checkout-payment-capabilities')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, provider: 'iyzico', ...payments }) });
    const rpc = url.match(/\/rpc\/([a-z0-9_]+)/)?.[1];
    if (rpc && handlers[rpc]) {
      const body = route.request().postDataJSON() || {};
      state.calls.push({ rpc, body });
      const result = handlers[rpc](body);
      if (result && result.error) return route.fulfill({ status: result.error.status, contentType: 'application/json', body: JSON.stringify(result.error.body) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    }
    return route.fallback();
  });
  return state;
}
