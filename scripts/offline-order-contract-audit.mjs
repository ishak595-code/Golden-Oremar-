// Ordering without online payment (WhatsApp, Havale/EFT) contract audit.
//
// Locks the rules that keep this path safe and useful: the database prices
// every line itself, checks stock and publication, needs consent and limits
// abuse; anonymous visitors reach it only through the public bridge; staff
// actions check their own permission; stock is taken on confirmation and
// given back on cancellation; and every storefront entry point (product
// page, member cart, guest cart) offers it while card payment is off.

import fs from 'node:fs';

const failures = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (text, pattern, message) => { if (!(pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern))) failures.push(message); };
const forbid = (text, pattern, message) => { if (pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern)) failures.push(message); };

const base = read('supabase/migrations/20261001172000_offline_order_requests_v1.sql');
const options = read('supabase/migrations/20261001173000_order_request_options_v1.sql');
const submit = options.slice(options.indexOf('create or replace function private.submit_order_request_v1'));

need(submit, "pv.price_minor", 'Order lines must be priced from product_variants, never from the client.');
need(submit, "p.status = 'published' and p.is_active", 'Only published, active products may be ordered.');
need(submit, "pr.status = 'active' and pr.is_verified", 'Only active, verified producers may sell through order requests.');
need(submit, "insufficient_stock:%", 'Tracked stock must be checked when the request is made.');
need(submit, "order_consent_required", 'The pre-contract consent must be required.');
need(submit, "rate_limit_exceeded", 'Order requests must be rate limited.');
need(submit, "on conflict (idempotency_key) do nothing", 'A double tap must not create two orders.');
need(submit, "private.normalize_order_customization_v1", 'Product options must be normalised with the product schema.');
need(submit, "public.get_shipping_quote_v1('TR'", 'Shipping must use the same zone rules as checkout.');

need(base, /create or replace function public\.submit_order_request_v1[\s\S]*?security invoker/, 'The public submit wrapper must stay SECURITY INVOKER.');
need(base, 'grant execute on function api_public_bridge.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) to anon, authenticated, service_role;', 'Guests must reach ordering through the public bridge.');
need(base, 'revoke all on function private.submit_order_request_v1(text, text, text, jsonb, jsonb, boolean) from public, anon, authenticated;', 'The private submit core must not be callable directly.');
need(base, "has_permission('payment.manage')", 'Channel and IBAN settings must require payment.manage.');
need(base, "has_permission('order.read')", 'Listing order requests must require order.read.');
need(base, "has_permission('order.update')", 'Changing order requests must require order.update.');
need(base, 'private.is_valid_tr_iban_v1(iban)', 'IBANs must be checked with the mod-97 validator.');
need(base, "committing := next_status in ('confirmed', 'paid', 'shipped', 'completed') and not r.stock_committed;", 'Stock must be taken once, when a request is confirmed.');
need(base, "available_quantity + (line->>'quantity')::integer", 'Cancelling a confirmed request must give the stock back.');
need(base, "i.available_quantity - coalesce(i.reserved_quantity, 0) >= (line->>'quantity')::integer", 'Confirming must never push stock below zero.');
need(base, "write_admin_audit_v2('order_request.updated'", 'Staff changes to order requests must be audited.');

const api = read('src/features/orders/offlineOrderApi.ts');
need(api, "supabase.rpc('submit_order_request_v1'", 'The storefront must submit through submit_order_request_v1.');
forbid(api.slice(api.indexOf('export async function submitOfflineOrder')), /p_items:[^;]*priceMinor/, 'The client must not send prices.');
need(api, 'https://wa.me/', 'WhatsApp orders must open a prefilled chat.');

const sheet = read('src/features/orders/OfflineOrderSheet.tsx');
need(sheet, 'checked={consent}', 'The order sheet must show the consent checkbox.');
need(sheet, '/kullanim-sartlari', 'The consent must link to the sales terms.');
need(sheet, 'role="dialog" aria-modal="true"', 'The order sheet must be an accessible dialog.');
forbid(sheet, /[☀-➿\u{1F300}-\u{1FAFF}]/u, 'The order sheet must not use emojis.');

const detail = read('src/features/catalog/ProductDetailScreen.tsx');
need(detail, '<OfflineOrderSheet', 'The product page must offer ordering without online payment.');
need(detail, /async function buyNow\(\)[\s\S]{0,400}setOfflineOrderOpen\(true\)/, '"Hemen Satın Al" must open the order sheet while card payment is off.');

const cart = read('src/features/cart/CartCheckoutFlow.tsx');
need(cart, '<OfflineOrderSheet', 'The member cart must offer ordering without online payment.');
need(cart, 'onSubmitted={()=>setOfflineOrderPlaced(true)}', 'The member cart must empty only after the receipt is closed.');
const guest = read('src/features/cart/GuestCartView.tsx');
need(guest, '<OfflineOrderSheet', 'The guest cart must let visitors order without an account.');
need(guest, 'onSubmitted={()=>setOrderPlaced(true)}', 'The guest cart must empty only after the receipt is closed.');

need(sheet, 'orderServiceUnavailable(err)', 'When the order service is down, the sheet must offer the order on WhatsApp.');
need(read('src/lib/offlineCatalog.ts'), 'get_public_offline_ordering_v1:', 'WhatsApp ordering must stay available from the shipped contact details during an outage.');

const shippedOrdering = JSON.parse(read('public/offline-catalog/offline_ordering.json'));
if (!shippedOrdering?.whatsapp?.enabled || !Array.isArray(shippedOrdering?.bankTransfer?.accounts)) failures.push('The shipped ordering channels (offline_ordering.json) must hold WhatsApp and the bank accounts for outages.');
for (const account of shippedOrdering?.bankTransfer?.accounts || []) {
  const iban = String(account.iban || '').replace(/\s/g, '');
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let rest = 0; for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  if (!/^TR\d{24}$/.test(iban) || rest !== 1) failures.push(`Shipped IBAN ${account.iban} fails the mod-97 check.`);
}
need(read('scripts/offline-catalog/export.mjs'), "'offline_ordering.json': await rpc('get_public_offline_ordering_v1')", 'The catalogue export must refresh the shipped ordering channels.');

const tabs = read('src/admin/adminCapabilities.ts');
need(tabs, "'order-requests':'order.read'", 'The order requests admin tab must require order.read.');
need(read('src/pages/AdminPage.tsx'), "case'order-requests':return<AdminOrderRequests/>", 'The admin panel must render the order requests screen.');

if (failures.length) {
  console.error('Offline order contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Offline order contract audit passed: server-side prices, stock and consent, bridged guest access, permissioned staff actions with audited stock moves, and WhatsApp/Havale ordering on the product page, member cart and guest cart.');
