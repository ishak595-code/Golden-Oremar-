import { supabase } from '../../lib/supabase';
import { submitOfflineOrder, submitOrderFallback, orderServiceUnavailable, type OfflineOrderCustomer, type OfflineOrderLineInput, type OfflineOrderMethod, type OfflineOrderReceipt } from './offlineOrderApi';

/**
 * Orders sent on WhatsApp while the order service could not be reached.
 *
 * The customer already sent the order in the chat, so it must not vanish:
 * the device keeps it ("WhatsApp ile gönderildi") and records it on the
 * server once the service answers again, with the same idempotency key as
 * the failed attempt, so retries can never create a second order. The normal
 * path is tried first (server prices, stock, shipping); if it refuses the
 * order later (stock changed, product withdrawn), the fallback path still
 * records it with a note, because the store has to see what the customer
 * sent. Then it appears in Siparişlerim and in the admin order requests.
 */

export const PENDING_ORDERS_KEY = 'golden-oremar:pending-orders:v1';
export const PENDING_ORDERS_EVENT = 'golden-oremar:pending-orders';
const KEEP_SYNCED_MS = 30 * 24 * 3600 * 1000;

export type PendingOrderLine = { variantId: string; quantity: number; productName: string; variantName: string; unitPriceMinor: number; currency: string; selectedOptions?: Record<string, unknown> };
export type PendingOrder = {
  key: string;
  deviceCode: string;
  userId: string | null;
  method: OfflineOrderMethod;
  source: 'product' | 'cart';
  lines: PendingOrderLine[];
  customer: OfflineOrderCustomer;
  createdAt: string;
  status: 'pending' | 'synced' | 'failed';
  reference: string | null;
  attempts: number;
  lastError: string | null;
  syncedAt: string | null;
};

function read(): PendingOrder[] {
  try {
    const raw = window.localStorage.getItem(PENDING_ORDERS_KEY);
    const value = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.key === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(item.key) && Array.isArray(item.lines) && item.lines.length);
  } catch { return []; }
}

function write(items: PendingOrder[]) {
  const now = Date.now();
  const kept = items.filter(item => item.status !== 'synced' || !item.syncedAt || now - Date.parse(item.syncedAt) < KEEP_SYNCED_MS).slice(-30);
  try { window.localStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(kept)); } catch { /* storage blocked: nothing more we can do */ }
  try { window.dispatchEvent(new CustomEvent(PENDING_ORDERS_EVENT)); } catch { /* not in a browser */ }
}

/** Short code the customer and the store both see (WhatsApp text, Siparişlerim). */
export function deviceCodeFor(key: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  let code = '';
  for (let i = 0; i < 6; i += 1) { code += alphabet[hash % alphabet.length]; hash = Math.floor(hash / alphabet.length) || (hash + 7919 * (i + 1)); }
  return `C-${code}`;
}

export function listPendingOrders(userId?: string | null) {
  return read().filter(item => !userId || !item.userId || item.userId === userId);
}

export function savePendingOrder(input: Omit<PendingOrder, 'deviceCode' | 'createdAt' | 'status' | 'reference' | 'attempts' | 'lastError' | 'syncedAt'>) {
  const items = read();
  if (items.some(item => item.key === input.key)) return items.find(item => item.key === input.key)!;
  const record: PendingOrder = { ...input, deviceCode: deviceCodeFor(input.key), createdAt: new Date().toISOString(), status: 'pending', reference: null, attempts: 0, lastError: null, syncedAt: null };
  write([...items, record]);
  return record;
}

function markerFor(order: PendingOrder) {
  const at = new Date(order.createdAt);
  const when = Number.isNaN(at.getTime()) ? '' : ` ${at.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}`;
  return `[WhatsApp ile gönderildi${when}, cihaz kodu ${order.deviceCode}]`;
}

/** The signed-in user on this device, read from the stored session (works offline). */
export async function currentDeviceUserId() {
  try { const { data } = await supabase.auth.getSession(); return data.session?.user?.id ?? null; } catch { return null; }
}

let running: Promise<number> | null = null;

/** Records every pending order of this user (and this device's guest orders) on the server. Returns how many were recorded. */
export function syncPendingOrders(userId: string | null): Promise<number> {
  if (running) return running;
  running = (async () => {
    let recorded = 0;
    for (const order of read().filter(item => item.status === 'pending' && (!item.userId || item.userId === userId))) {
      const customer = { ...order.customer, note: `${markerFor(order)} ${order.customer.note || ''}`.trim().slice(0, 1000) };
      const items: OfflineOrderLineInput[] = order.lines.map(line => ({ variantId: line.variantId, quantity: line.quantity, ...(line.selectedOptions ? { selectedOptions: line.selectedOptions } : {}) }));
      let receipt: OfflineOrderReceipt | null = null;
      let failure: unknown = null;
      try {
        receipt = await submitOfflineOrder({ idempotencyKey: order.key, method: order.method, source: order.source, items, customer, consent: true });
      } catch (error) {
        if (orderServiceUnavailable(error)) failure = error;
        else {
          try { receipt = await submitOrderFallback({ idempotencyKey: order.key, method: order.method, source: order.source, lines: order.lines, customer, reason: 'offline_sync' }); }
          catch (fallbackError) { failure = fallbackError; }
        }
      }
      const latest = read();
      const index = latest.findIndex(item => item.key === order.key);
      if (index < 0) continue;
      if (receipt) {
        latest[index] = { ...latest[index], status: 'synced', reference: receipt.reference, syncedAt: new Date().toISOString(), lastError: null, attempts: latest[index].attempts + 1 };
        recorded += 1;
      } else {
        const attempts = latest[index].attempts + 1;
        const unavailable = orderServiceUnavailable(failure);
        // A refusal that is not an outage (e.g. invalid phone) will not fix itself: stop after a few tries.
        latest[index] = { ...latest[index], attempts, lastError: String((failure as { message?: unknown })?.message || 'sync_failed').slice(0, 200), status: !unavailable && attempts >= 3 ? 'failed' : 'pending' };
      }
      write(latest);
    }
    return recorded;
  })().finally(() => { running = null; });
  return running;
}
