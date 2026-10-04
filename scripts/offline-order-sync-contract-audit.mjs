// WhatsApp / Havale orders must never be lost or doubled:
//   - Siparişlerim lists the customer's order requests (list_my_order_requests_v1),
//     not only card orders;
//   - when the order path fails, the sheet records the order on the fallback
//     path with the SAME idempotency key, but never to bypass a rules refusal;
//   - when nothing answers, the order is kept on the device only after the
//     customer taps the WhatsApp link (nothing is sent automatically), and is
//     recorded on the server later with the same key (main path first);
//   - sync runs on start, on reconnect and when Siparişlerim opens;
//   - the database side is idempotent, anon-callable only via the bridge,
//     and the customer list is authenticated-only.
import fs from 'node:fs';

const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };

const sql = read('supabase/migrations/20261004190000_order_requests_mine_and_fallback_v1.sql');
const api = read('src/features/orders/offlineOrderApi.ts');
const pending = read('src/features/orders/pendingOrders.ts');
const sheet = read('src/features/orders/OfflineOrderSheet.tsx');
const mine = read('src/features/orders/MyOrderRequests.tsx');
const orders = read('src/features/account/OrdersPanel.tsx');
const app = read('src/App.tsx');

need(/create or replace function public\.list_my_order_requests_v1/.test(sql) && /caller_id uuid := auth\.uid\(\)/.test(sql) && /customer_user_id = caller_id/.test(sql), 'list_my_order_requests_v1 must list only the caller\'s requests.');
need(/revoke all on function public\.list_my_order_requests_v1\([^)]*\) from public, anon/.test(sql), 'list_my_order_requests_v1 must not be callable by anon.');
need(/submit_order_request_fallback_v1/.test(sql) && /where idempotency_key = /.test(sql), 'Fallback path must be idempotent by key.');
need(/'priceUnverified'/.test(sql) && /'fallback', true/.test(sql), 'Fallback path must flag unverified prices and mark its receipt.');
need(/rpc\('submit_order_request_fallback_v1'/.test(api) && /rpc\('list_my_order_requests_v1'/.test(api), 'offlineOrderApi must call both new RPCs.');
need(/export function orderRefusedByRules/.test(api), 'orderRefusedByRules must exist so rule refusals are not bypassed.');
need(/if\(!orderRefusedByRules\(err\)\)/.test(sheet) && /submitOrderFallback\(\{idempotencyKey:keyRef\.current/.test(sheet), 'Sheet must try the fallback with the same key, only when the rules did not refuse.');
need(/onClick=\{\(\)=>pendingRef\.current\?\.\(\)\}/.test(sheet), 'The device copy must be saved only when the customer taps the WhatsApp link.');
need(/whatsappDirectOrderUrl\(number,lines,orderCustomer,method,code\)/.test(sheet), 'The WhatsApp text must carry the device code.');
need(/PENDING_ORDERS_KEY = 'golden-oremar:pending-orders:v1'/.test(pending), 'Pending orders storage key changed.');
need(/submitOfflineOrder\(\{ idempotencyKey: order\.key/.test(pending) && /submitOrderFallback\(\{ idempotencyKey: order\.key/.test(pending) && /reason: 'offline_sync'/.test(pending), 'Sync must reuse the key: main path first, then the fallback.');
need(/if \(orderServiceUnavailable\(error\)\) failure = error;/.test(pending), 'Sync must keep orders pending while the service is down.');
need(/!item\.userId \|\| item\.userId === userId/.test(pending), 'Sync must not record another account\'s device orders.');
need(!/window\.open|location\.href\s*=/.test(pending + mine), 'Nothing may be sent automatically.');
need(/import\('\.\/features\/orders\/pendingOrders'\)/.test(app) && /addEventListener\('online',run\)/.test(app) && /NETWORK_RESTORED_EVENT,run/.test(app), 'App must sync pending orders on start and on reconnect (lazily).');
need(/<MyOrderRequests\/>/.test(orders) && /<MyOrderRequests onCount=/.test(orders), 'Siparişlerim must show WhatsApp/Havale orders, also when card orders cannot load.');
need(/eşitleme bekliyor/.test(mine) && /syncPendingOrders/.test(mine), 'Siparişlerim must show and sync device-only orders.');

if (failures.length) { console.error(`Offline order sync contract audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Offline order sync contract audit passed.');
