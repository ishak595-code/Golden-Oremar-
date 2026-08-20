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
  | 'about'
  | 'admin';

export type AppActionTarget =
  | { kind: 'account'; view: string }
  | { kind: 'product'; reference: string }
  | { kind: 'producer'; reference: string }
  | { kind: 'events'; reference: string | null }
  | { kind: 'admin'; view: string }
  | { kind: 'notifications' };

const SAFE_REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9._~-]{0,199}$/;
const NAVIGATION_PROTOCOLS = new Set(['http:', 'https:', 'capacitor:']);
const PUBLIC_PROTOCOLS = new Set(['http:', 'https:']);
const ACCOUNT_VIEWS = new Set([
  'menu', 'home', 'profile', 'orders', 'reviews', 'addresses', 'favorites', 'followed-producers', 'gifts',
  'payments', 'notifications', 'settings', 'seller', 'producer-products', 'producer-profile-edit', 'support',
  'messages', 'vendor-apply',
]);
const SELLER_SUBVIEWS = new Set(['dashboard', 'orders', 'messages', 'traceability', 'finance', 'events', 'product-health']);
const ADMIN_VIEWS = new Set([
  'dashboard', 'production-readiness', 'business-compliance', 'official-store-products', 'product-health', 'products',
  'product-approvals', 'product-removal', 'orders', 'returns', 'stock', 'shipping-readiness', 'finance',
  'producer-payouts', 'payment-controls', 'transactional-emails', 'users', 'account-erasure', 'role-governance',
  'system-errors', 'content', 'settings', 'categories', 'vendors', 'storefronts', 'reviews', 'campaigns',
  'notifications', 'vendor-applications', 'events', 'producer-event-submissions',
]);

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

export function buildEventUrl(reference: unknown, baseHref?: string): string {
  const safeReference = cleanPublicReference(reference);
  if (!safeReference) throw new Error('invalid_event_reference');
  const url = safeNavigationBaseUrl(baseHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set('tab', 'events');
  url.searchParams.set('event', safeReference);
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
  const pathRoute = routeFromPath(url.pathname);
  const requestedTab = String(url.searchParams.get('tab') || pathRoute.tab || 'home') as PublicAppTab;
  const accountView = safeAccountView(url.searchParams.get('view')) || pathRoute.accountView;
  const adminView = safeAdminView(url.searchParams.get('adminView')) || pathRoute.adminView;
  return {
    tab: requestedTab,
    productReference: cleanPublicReference(url.searchParams.get('product')) || pathRoute.productReference,
    producerReference: cleanPublicReference(url.searchParams.get('producer')) || pathRoute.producerReference,
    eventReference: cleanPublicReference(url.searchParams.get('event')) || pathRoute.eventReference,
    accountView,
    adminView,
    query: String(url.searchParams.get('q') || '').trim().slice(0, 160),
    categorySlug: cleanPublicReference(url.searchParams.get('category')),
    producerId: cleanPublicReference(url.searchParams.get('producerId')),
  };
}

export function resolveAppActionTarget(actionUrl: unknown, metadata: Record<string, unknown> = {}, baseHref?: string): AppActionTarget {
  const conversationId = cleanPublicReference(metadata.conversationId);
  if (conversationId) return { kind: 'account', view: `messages:${conversationId}` };
  const orderId = cleanPublicReference(metadata.orderId);
  if (orderId) return { kind: 'account', view: `orders:${orderId}` };

  const raw = typeof actionUrl === 'string' ? actionUrl.trim() : '';
  if (!raw) return { kind: 'notifications' };
  const base = safeNavigationBaseUrl(baseHref);
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return { kind: 'notifications' };
  }
  if (!isAllowedInternalActionUrl(url, base)) return { kind: 'notifications' };

  const route = parsePublicRoute(url.toString());
  if (route.tab === 'product-detail' && route.productReference) return { kind: 'product', reference: route.productReference };
  if (route.tab === 'producer-profile' && route.producerReference) return { kind: 'producer', reference: route.producerReference };
  if (route.tab === 'events') return { kind: 'events', reference: route.eventReference };
  if (route.tab === 'admin') return { kind: 'admin', view: route.adminView || 'dashboard' };
  if (route.tab === 'account') return { kind: 'account', view: route.accountView || 'menu' };
  return { kind: 'notifications' };
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

function isAllowedInternalActionUrl(url: URL, base: URL) {
  if (!NAVIGATION_PROTOCOLS.has(url.protocol)) return false;
  if (url.protocol === 'capacitor:') return base.protocol === 'capacitor:' && url.host === base.host;
  if (!PUBLIC_PROTOCOLS.has(url.protocol)) return false;
  const allowedOrigin = internalPublicOrigin(base);
  return Boolean(allowedOrigin && url.origin === allowedOrigin);
}

function internalPublicOrigin(base: URL) {
  if (PUBLIC_PROTOCOLS.has(base.protocol)) return base.origin;
  const configured = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN || '').trim();
  if (!configured) return null;
  try {
    const publicBase = new URL(configured);
    return PUBLIC_PROTOCOLS.has(publicBase.protocol) ? publicBase.origin : null;
  } catch {
    return null;
  }
}

function safeAccountView(value: unknown) {
  const normalized = String(value ?? '').trim();
  if (ACCOUNT_VIEWS.has(normalized)) return normalized;
  const separator = normalized.indexOf(':');
  if (separator < 1) return null;
  const prefix = normalized.slice(0, separator);
  const suffix = normalized.slice(separator + 1);
  if ((prefix === 'messages' || prefix === 'orders') && cleanPublicReference(suffix)) return `${prefix}:${suffix}`;
  if (prefix === 'seller' && SELLER_SUBVIEWS.has(suffix)) return `seller:${suffix}`;
  return null;
}
function safeAdminView(value: unknown) {
  const normalized = String(value ?? '').trim();
  return ADMIN_VIEWS.has(normalized) ? normalized : null;
}
function routeFromPath(pathname: string) {
  const normalized = `/${String(pathname || '').split('/').filter(Boolean).join('/')}`;
  const parts = normalized.split('/').filter(Boolean);
  const first = parts[0] || '';
  const second = parts[1] || '';

  if (first === 'product') return { tab: 'product-detail' as PublicAppTab, productReference: cleanPublicReference(second), producerReference: null, eventReference: null, accountView: null, adminView: null };
  if (first === 'events') return { tab: 'events' as PublicAppTab, productReference: null, producerReference: null, eventReference: cleanPublicReference(second), accountView: null, adminView: null };
  if (first === 'messages') {
    const reference = cleanPublicReference(second);
    return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: reference ? `messages:${reference}` : 'messages', adminView: null };
  }
  if (first === 'orders') {
    const reference = cleanPublicReference(second);
    return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: reference ? `orders:${reference}` : 'orders', adminView: null };
  }
  if (first === 'settings') return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: 'settings', adminView: null };
  if (first === 'account') {
    const view = second === 'orders' ? 'orders' : second === 'reviews' ? 'reviews' : second === 'messages' ? 'messages' : second === 'settings' ? 'settings' : 'menu';
    return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: view, adminView: null };
  }
  if (first === 'producer') {
    if (second === 'products') return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: 'producer-products', adminView: null };
    if (SELLER_SUBVIEWS.has(second)) return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: `seller:${second}`, adminView: null };
    const producerReference = cleanPublicReference(second);
    if (producerReference) return { tab: 'producer-profile' as PublicAppTab, productReference: null, producerReference, eventReference: null, accountView: null, adminView: null };
  }
  if (first === 'admin') return { tab: 'admin' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: null, adminView: safeAdminView(second) || 'dashboard' };
  return { tab: null, productReference: null, producerReference: null, eventReference: null, accountView: null, adminView: null };
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
