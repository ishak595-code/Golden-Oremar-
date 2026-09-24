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

/**
 * Canonical public path segments. Turkish, because these are the addresses
 * customers share and that search engines index for a Turkish storefront.
 *
 * The English segments the router accepted before (/product, /producer,
 * /events) keep working as aliases in routeFromPath, and ?tab= query URLs keep
 * working in parsePublicRoute, so no link already shared or saved breaks.
 * Only the addresses the app *generates* change.
 */
export const PUBLIC_PATH = {
  product: 'urun',
  producer: 'uretici',
  category: 'kategori',
  events: 'etkinlikler',
  search: 'ara',
} as const;
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
  url.pathname = `/${PUBLIC_PATH.product}/${encodeURIComponent(safeReference)}`;
  return url.toString();
}

export function buildProducerUrl(reference: unknown, baseHref?: string): string {
  const safeReference = cleanPublicReference(reference);
  if (!safeReference) throw new Error('invalid_producer_reference');
  const url = safeNavigationBaseUrl(baseHref);
  url.search = '';
  url.hash = '';
  url.pathname = `/${PUBLIC_PATH.producer}/${encodeURIComponent(safeReference)}`;
  return url.toString();
}

export function buildEventUrl(reference: unknown, baseHref?: string): string {
  const safeReference = cleanPublicReference(reference);
  if (!safeReference) throw new Error('invalid_event_reference');
  const url = safeNavigationBaseUrl(baseHref);
  url.search = '';
  url.hash = '';
  url.pathname = `/${PUBLIC_PATH.events}/${encodeURIComponent(safeReference)}`;
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
  const query = String(input.query ?? '').trim().slice(0, 160);
  const category = cleanPublicReference(input.categorySlug);
  const producer = cleanPublicReference(input.producerId);
  // A category with nothing else attached gets its own permanent address,
  // because that is the page worth indexing and sharing. Anything carrying a
  // free-text query or a producer filter is a transient search and lives
  // under /ara with query parameters, which is the conventional shape search
  // engines expect not to index as distinct content.
  if (category && !query && !producer) {
    url.pathname = `/${PUBLIC_PATH.category}/${encodeURIComponent(category)}`;
    return url.toString();
  }
  url.pathname = `/${PUBLIC_PATH.search}`;
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
    categorySlug: cleanPublicReference(url.searchParams.get('category')) || pathRoute.categorySlug,
    producerId: cleanPublicReference(url.searchParams.get('producerId')),
  };
}

/**
 * Hosts whose https links the native app claims and opens in-app.
 *
 * Deliberately an explicit allow-list. The OS only hands the app a URL it has
 * verified the app may open, so an attacker cannot normally route an arbitrary
 * link here - but the allow-list means that even a misconfigured intent
 * filter, or a future custom scheme, cannot make the app treat an unrelated
 * site's path as one of its own screens.
 *
 * golden-oremar.vercel.app is included so deep links work before the custom
 * domain is connected, and keep working afterwards for anything already
 * shared on the Vercel address.
 */
export const DEEP_LINK_HOSTS = new Set([
  'goldenoremar.com',
  'www.goldenoremar.com',
  'golden-oremar.vercel.app',
]);

export type DeepLinkTarget =
  | { kind: 'product'; reference: string }
  | { kind: 'producer'; reference: string }
  | { kind: 'category'; slug: string }
  | { kind: 'search'; query: string }
  | { kind: 'events'; reference: string | null }
  | { kind: 'home' };

/**
 * Map an https link the OS opened the app with to the screen it should show.
 *
 * Returns null for anything that is not one of this app's public links -
 * other hosts, non-https schemes, and the custom-scheme auth callbacks, which
 * useAuthRecoveryCoordinator owns. Returning null rather than 'home' matters:
 * it lets two appUrlOpen listeners coexist without one hijacking the other's
 * URLs.
 *
 * Account, cart, orders and admin paths are intentionally not honoured from a
 * link. A tapped link should never drop someone into a signed-in screen, and
 * it keeps the deep-link surface limited to public, shareable pages.
 */
export function resolveDeepLinkTarget(rawUrl: unknown): DeepLinkTarget | null {
  const raw = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !DEEP_LINK_HOSTS.has(url.hostname.toLowerCase())) return null;

  const route = parsePublicRoute(url.toString());
  if (route.tab === 'product-detail' && route.productReference) return { kind: 'product', reference: route.productReference };
  if (route.tab === 'producer-profile' && route.producerReference) return { kind: 'producer', reference: route.producerReference };
  if (route.tab === 'search-results') {
    if (route.categorySlug && !route.query) return { kind: 'category', slug: route.categorySlug };
    if (route.query) return { kind: 'search', query: route.query };
  }
  if (route.tab === 'events') return { kind: 'events', reference: route.eventReference };
  return { kind: 'home' };
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

  if (first === PUBLIC_PATH.product) return { tab: 'product-detail' as PublicAppTab, productReference: cleanPublicReference(safeDecode(second)), producerReference: null, eventReference: null, accountView: null, adminView: null, categorySlug: null };
  if (first === PUBLIC_PATH.producer) {
    const producerReference = cleanPublicReference(safeDecode(second));
    if (producerReference) return { tab: 'producer-profile' as PublicAppTab, productReference: null, producerReference, eventReference: null, accountView: null, adminView: null, categorySlug: null };
  }
  if (first === PUBLIC_PATH.category) {
    const categorySlug = cleanPublicReference(safeDecode(second));
    if (categorySlug) return { tab: 'search-results' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: null, adminView: null, categorySlug };
  }
  if (first === PUBLIC_PATH.search) return { tab: 'search-results' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: null, adminView: null, categorySlug: null };
  if (first === PUBLIC_PATH.events) return { tab: 'events' as PublicAppTab, productReference: null, producerReference: null, eventReference: cleanPublicReference(safeDecode(second)), accountView: null, adminView: null, categorySlug: null };
  if (first === 'product') return { tab: 'product-detail' as PublicAppTab, productReference: cleanPublicReference(second), producerReference: null, eventReference: null, accountView: null, adminView: null, categorySlug: null };
  if (first === 'events') return { tab: 'events' as PublicAppTab, productReference: null, producerReference: null, eventReference: cleanPublicReference(second), accountView: null, adminView: null, categorySlug: null };
  if (first === 'messages') {
    const reference = cleanPublicReference(second);
    return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: reference ? `messages:${reference}` : 'messages', adminView: null, categorySlug: null };
  }
  if (first === 'orders') {
    const reference = cleanPublicReference(second);
    return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: reference ? `orders:${reference}` : 'orders', adminView: null, categorySlug: null };
  }
  if (first === 'settings') return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: 'settings', adminView: null, categorySlug: null };
  if (first === 'account') {
    const view = second === 'producer-application' ? 'vendor-apply' : safeAccountView(second) || 'menu';
    return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: view, adminView: null, categorySlug: null };
  }
  if (first === 'producer') {
    if (second === 'products') return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: 'producer-products', adminView: null, categorySlug: null };
    if (SELLER_SUBVIEWS.has(second)) return { tab: 'account' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: `seller:${second}`, adminView: null, categorySlug: null };
    const producerReference = cleanPublicReference(second);
    if (producerReference) return { tab: 'producer-profile' as PublicAppTab, productReference: null, producerReference, eventReference: null, accountView: null, adminView: null, categorySlug: null };
  }
  if (first === 'admin') return { tab: 'admin' as PublicAppTab, productReference: null, producerReference: null, eventReference: null, accountView: null, adminView: safeAdminView(second) || 'dashboard', categorySlug: null };
  return { tab: null, productReference: null, producerReference: null, eventReference: null, accountView: null, adminView: null, categorySlug: null };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

function toPublicShareUrl(value: string) {
  const source = new URL(value);
  if (PUBLIC_PROTOCOLS.has(source.protocol)) return source.toString();
  if (source.protocol !== 'capacitor:') throw new Error('invalid_share_url');

  const configuredOrigin = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN || '').trim();
  if (!configuredOrigin) throw new Error('public_share_origin_not_configured');
  const publicBase = new URL(configuredOrigin);
  if (!PUBLIC_PROTOCOLS.has(publicBase.protocol)) throw new Error('invalid_public_share_origin');

  // The path must travel with the share. Addresses are now path-based
  // (/urun/<slug>), so copying only search and hash - as this did when every
  // address was ?tab= on the root - would turn a product shared from the
  // native app into a link to the home page.
  publicBase.pathname = source.pathname;
  publicBase.search = source.search;
  publicBase.hash = source.hash;
  return publicBase.toString();
}
