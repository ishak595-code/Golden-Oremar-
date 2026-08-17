export type PublicAppTab =
  | 'home'
  | 'categories'
  | 'cart'
  | 'account'
  | 'product-detail'
  | 'search-results'
  | 'producer-profile'
  | 'events'
  | 'health'
  | 'contact'
  | 'about';

const SAFE_REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9._~-]{0,199}$/;
const NAVIGATION_PROTOCOLS = new Set(['http:', 'https:', 'capacitor:']);
const PUBLIC_PROTOCOLS = new Set(['http:', 'https:']);

export function cleanPublicReference(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized || !SAFE_REFERENCE.test(normalized)) return null;
  return normalized;
}

export function buildProductUrl(reference: unknown, baseHref?: string): string {
  const safeReference = cleanPublicReference(reference);
  if (!safeReference) throw new Error('invalid_product_reference');
  const url = safeNavigationBaseUrl(baseHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set('tab', 'product-detail');
  url.searchParams.set('product', safeReference);
  return url.toString();
}

export function buildProducerUrl(reference: unknown, baseHref?: string): string {
  const safeReference = cleanPublicReference(reference);
  if (!safeReference) throw new Error('invalid_producer_reference');
  const url = safeNavigationBaseUrl(baseHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set('tab', 'producer-profile');
  url.searchParams.set('producer', safeReference);
  return url.toString();
}

export function buildSearchUrl(input: {
  query?: unknown;
  categorySlug?: unknown;
  producerId?: unknown;
}, baseHref?: string): string {
  const url = safeNavigationBaseUrl(baseHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set('tab', 'search-results');
  const query = String(input.query ?? '').trim().slice(0, 160);
  const category = cleanPublicReference(input.categorySlug);
  const producer = cleanPublicReference(input.producerId);
  if (query) url.searchParams.set('q', query);
  if (category) url.searchParams.set('category', category);
  if (producer) url.searchParams.set('producerId', producer);
  return url.toString();
}

export function parsePublicRoute(href?: string) {
  const url = safeNavigationBaseUrl(href);
  const tab = String(url.searchParams.get('tab') || 'home') as PublicAppTab;
  return {
    tab,
    productReference: cleanPublicReference(url.searchParams.get('product')),
    producerReference: cleanPublicReference(url.searchParams.get('producer')),
    query: String(url.searchParams.get('q') || '').trim().slice(0, 160),
    categorySlug: cleanPublicReference(url.searchParams.get('category')),
    producerId: cleanPublicReference(url.searchParams.get('producerId')),
  };
}

export async function shareOrCopy(input: {
  title: string;
  text?: string;
  url: string;
}): Promise<'shared' | 'copied' | 'cancelled'> {
  const publicUrl = toPublicShareUrl(input.url);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: input.title,
        text: input.text?.trim() || undefined,
        url: publicUrl,
      });
      return 'shared';
    } catch (error: any) {
      if (error?.name === 'AbortError') return 'cancelled';
      // Some Web Share implementations reject valid payloads. Fall through to clipboard.
    }
  }
  await copyText(publicUrl);
  return 'copied';
}

export async function copyText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === 'undefined') throw new Error('clipboard_unavailable');
  const textarea = document.createElement('textarea');
  const active = document.activeElement as HTMLElement | null;
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  active?.focus?.();
  if (!copied) throw new Error('clipboard_copy_failed');
}

function safeNavigationBaseUrl(href?: string) {
  const value = href || (typeof window !== 'undefined' ? window.location.href : 'https://goldenoremar.invalid/');
  const url = new URL(value);
  if (!NAVIGATION_PROTOCOLS.has(url.protocol)) throw new Error('invalid_navigation_base_url');
  return url;
}

function toPublicShareUrl(value: string) {
  const source = new URL(value);
  if (PUBLIC_PROTOCOLS.has(source.protocol)) return source.toString();
  if (source.protocol !== 'capacitor:') throw new Error('invalid_share_url');

  const configuredOrigin = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN || '').trim();
  if (!configuredOrigin) throw new Error('public_share_origin_not_configured');
  const publicBase = new URL(configuredOrigin);
  if (!PUBLIC_PROTOCOLS.has(publicBase.protocol)) throw new Error('invalid_public_share_origin');

  publicBase.search = source.search;
  publicBase.hash = source.hash;
  return publicBase.toString();
}
