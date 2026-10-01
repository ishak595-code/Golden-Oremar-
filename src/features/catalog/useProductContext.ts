import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';
import { toLegacyHomeProduct, type LegacyHomeProduct } from './useLiveHomeCatalog';

/**
 * The product page's own card plus products from the same category and the
 * same store, from one small call (get_public_product_context_v1).
 *
 * The page used to download the whole catalogue twice for this. Both page
 * sections that need it share one request per product, kept for a minute, so
 * moving between products and back costs nothing.
 */

export type ProductContext = {
  product: LegacyHomeProduct;
  sameCategory: LegacyHomeProduct[];
  sameStore: LegacyHomeProduct[];
};

const FRESH_MS = 60_000;
const MAX_ENTRIES = 40;
type Entry = { at: number; promise: Promise<ProductContext | null> };
const cache = new Map<string, Entry>();

if (typeof window !== 'undefined') window.addEventListener(NETWORK_RESTORED_EVENT, () => cache.clear());

function cards(value: unknown): LegacyHomeProduct[] {
  if (!Array.isArray(value)) return [];
  const result: LegacyHomeProduct[] = [];
  for (const item of value.slice(0, 24)) {
    // A single damaged card is left out rather than hiding the whole rail.
    try { result.push(toLegacyHomeProduct(item)); } catch { /* skip */ }
  }
  return result;
}

async function fetchContext(reference: string): Promise<ProductContext | null> {
  const { data, error } = await supabase.rpc('get_public_product_context_v1', { p_reference: reference, p_limit: 8 });
  if (error) throw error;
  if (!data || typeof data !== 'object' || !(data as any).product) return null;
  const raw = data as Record<string, unknown>;
  return { product: toLegacyHomeProduct(raw.product), sameCategory: cards(raw.sameCategory), sameStore: cards(raw.sameStore) };
}

export function loadProductContext(reference: string): Promise<ProductContext | null> {
  const key = reference.trim().toLocaleLowerCase('tr-TR');
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < FRESH_MS) return hit.promise;
  const promise = fetchContext(reference.trim());
  cache.set(key, { at: now, promise });
  // A failed call is not remembered, so the next visit tries again.
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return promise;
}

export function useProductContext(reference: string | null | undefined) {
  const [state, setState] = useState<{ reference: string | null; context: ProductContext | null; loading: boolean }>({ reference: null, context: null, loading: Boolean(reference) });
  useEffect(() => {
    if (!reference) { setState({ reference: null, context: null, loading: false }); return; }
    let active = true;
    setState(current => current.reference === reference ? current : { reference, context: null, loading: true });
    loadProductContext(reference)
      .then(context => { if (active) setState({ reference, context, loading: false }); })
      .catch(() => { if (active) setState({ reference, context: null, loading: false }); });
    return () => { active = false; };
  }, [reference]);
  return state.reference === reference ? state : { reference: reference ?? null, context: null, loading: Boolean(reference) };
}
