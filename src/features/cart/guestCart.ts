import { useEffect, useState } from 'react';

/**
 * A cart for visitors who have not signed in yet.
 *
 * Large marketplaces let anyone fill a cart and ask for an account only at
 * checkout; asking at "add to cart" loses the customer at the first tap. The
 * guest cart lives on the device (localStorage). It holds what the visitor
 * chose plus a display copy of name, price and image so the cart screen
 * opens instantly; none of it is trusted. When the visitor signs in, every
 * line is sent to the real cart through the same server call a signed-in
 * customer uses, which checks price, stock and availability again.
 */

export type GuestCartLine = {
  key: string;
  variantId: string;
  quantity: number;
  selectedOptions: Record<string, unknown>;
  productSlug: string;
  productName: string;
  variantName: string;
  producerName: string;
  priceMinor: number;
  currency: string;
  imagePath: string | null;
  addedAt: number;
};

const STORAGE_KEY = 'golden_oremar_guest_cart_v1';
export const GUEST_CART_EVENT = 'golden-oremar:guest-cart-changed';
const MAX_LINES = 50;
const MAX_QUANTITY = 99;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function stableOptions(options: Record<string, unknown>) {
  return JSON.stringify(Object.keys(options).sort().map(key => [key, options[key]]));
}
export function guestLineKey(variantId: string, options: Record<string, unknown>) {
  return `${variantId}|${stableOptions(options)}`;
}

function sanitize(raw: unknown, now: number): GuestCartLine | null {
  if (!isRecord(raw)) return null;
  const variantId = text(raw.variantId, 160);
  const productSlug = text(raw.productSlug, 220);
  const productName = text(raw.productName, 300);
  const quantity = Number(raw.quantity);
  const priceMinor = Number(raw.priceMinor);
  const addedAt = Number(raw.addedAt);
  const currency = text(raw.currency, 3).toUpperCase();
  const selectedOptions = isRecord(raw.selectedOptions) ? raw.selectedOptions : {};
  if (!variantId || !productSlug || !productName) return null;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return null;
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) return null;
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  if (!Number.isFinite(addedAt) || now - addedAt > MAX_AGE_MS) return null;
  return {
    key: guestLineKey(variantId, selectedOptions),
    variantId,
    quantity,
    selectedOptions,
    productSlug,
    productName,
    variantName: text(raw.variantName, 240),
    producerName: text(raw.producerName, 240),
    priceMinor,
    currency,
    imagePath: text(raw.imagePath, 1000) || null,
    addedAt,
  };
}

export function readGuestCart(): GuestCartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    return Array.isArray(parsed) ? parsed.map(line => sanitize(line, now)).filter((line): line is GuestCartLine => Boolean(line)).slice(0, MAX_LINES) : [];
  } catch {
    return [];
  }
}

function writeGuestCart(lines: GuestCartLine[]) {
  try {
    if (lines.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.slice(0, MAX_LINES)));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing or a full disk: the cart still works for this page view.
  }
  try { window.dispatchEvent(new CustomEvent(GUEST_CART_EVENT)); } catch { /* not in a browser */ }
}

export function guestCartCount(lines = readGuestCart()) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function addToGuestCart(input: Omit<GuestCartLine, 'key' | 'addedAt' | 'quantity'>, quantity: number) {
  const lines = readGuestCart();
  const key = guestLineKey(input.variantId, input.selectedOptions);
  const add = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity) || 1));
  const existing = lines.find(line => line.key === key);
  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + add);
    existing.priceMinor = input.priceMinor;
    existing.addedAt = Date.now();
  } else {
    if (lines.length >= MAX_LINES) throw new Error('Sepete en fazla 50 farklı ürün eklenebilir.');
    lines.unshift({ ...input, key, quantity: add, addedAt: Date.now() });
  }
  writeGuestCart(lines);
  return lines;
}

export function setGuestCartQuantity(key: string, quantity: number) {
  const next = readGuestCart()
    .map(line => line.key === key ? { ...line, quantity: Math.min(MAX_QUANTITY, Math.floor(quantity)) } : line)
    .filter(line => line.quantity >= 1);
  writeGuestCart(next);
  return next;
}

export function removeGuestCartLines(keys: string[]) {
  const drop = new Set(keys);
  const next = readGuestCart().filter(line => !drop.has(line.key));
  writeGuestCart(next);
  return next;
}

export function clearGuestCart() {
  writeGuestCart([]);
}

/** Live view of the guest cart, updated across tabs and components. */
export function useGuestCart() {
  const [lines, setLines] = useState<GuestCartLine[]>(() => (typeof window === 'undefined' ? [] : readGuestCart()));
  useEffect(() => {
    const refresh = () => setLines(readGuestCart());
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) refresh(); };
    window.addEventListener(GUEST_CART_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(GUEST_CART_EVENT, refresh); window.removeEventListener('storage', onStorage); };
  }, []);
  return lines;
}

export type GuestCartMergeResult = { added: number; skipped: string[] };

/** The server said no to this product (stock, availability, options), as opposed to a fault. */
function isProductRefusal(error: unknown) {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return code === 'P0002' || code === '22023' || code === '55000'
    || /insufficient_stock|not_available|unavailable|variant_not_found|product_not_found|invalid_quantity|option|sold_out|stok/.test(message);
}

/**
 * Moves the guest cart into the signed-in customer's cart. Quantities add up
 * to what the account already holds (capped at 99). A line the server refuses
 * (sold out, withdrawn, not enough stock) is reported by name and dropped, so
 * the visitor is told instead of finding it silently missing.
 */
export async function mergeGuestCartIntoAccount(
  setItem: (input: { variantId: string; quantity: number; selectedOptions: Record<string, unknown> }) => Promise<{ items: Array<{ variantId: string; quantity: number; selectedOptions: Record<string, unknown> }> }>,
  current: { items: Array<{ variantId: string; quantity: number; selectedOptions: Record<string, unknown> }> },
): Promise<GuestCartMergeResult> {
  const lines = readGuestCart();
  if (!lines.length) return { added: 0, skipped: [] };
  const held = new Map(current.items.map(item => [guestLineKey(item.variantId, item.selectedOptions || {}), item.quantity]));
  let added = 0;
  const skipped: string[] = [];
  for (const line of [...lines].reverse()) {
    const already = held.get(line.key) || 0;
    try {
      await setItem({ variantId: line.variantId, quantity: Math.min(MAX_QUANTITY, already + line.quantity), selectedOptions: line.selectedOptions });
      added += line.quantity;
    } catch (error) {
      // No connection or a server fault: keep what is left for the next try
      // instead of throwing the visitor's choices away.
      if (!isProductRefusal(error)) throw error;
      if (already === 0) skipped.push(line.productName);
    }
    removeGuestCartLines([line.key]);
  }
  return { added, skipped };
}
