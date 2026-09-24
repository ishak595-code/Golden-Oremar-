import { SITE_NAME, serializeJsonLd, type SeoPage } from './seoModel';

const JSON_LD_ID = 'go-seo-jsonld';

function setMeta(attr: 'name' | 'property', key: string, value: string | null) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

/**
 * Apply page metadata to the live document, from the same builder the build
 * step uses. Called once a page's real data has loaded, so the rendered
 * document - which is what Google's renderer ultimately indexes - carries the
 * current price and availability rather than the build-time snapshot.
 */
export function applySeo(page: SeoPage) {
  if (typeof document === 'undefined') return;
  document.title = page.title;
  setMeta('name', 'description', page.description);
  setMeta('property', 'og:type', page.type);
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:title', page.title);
  setMeta('property', 'og:description', page.description);
  setMeta('property', 'og:url', page.canonical);
  setMeta('property', 'og:image', page.image);
  setMeta('name', 'twitter:card', page.image ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', page.title);
  setMeta('name', 'twitter:description', page.description);
  setMeta('name', 'twitter:image', page.image);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = page.canonical;

  // Prerendered pages ship their JSON-LD as plain script tags. Remove those so
  // the document never carries two Product blocks with different prices.
  document.head
    .querySelectorAll('script[type="application/ld+json"]:not(#' + JSON_LD_ID + ')')
    .forEach(node => node.remove());

  clearSeoStructuredData();
  if (!page.jsonLd.length) return;
  const script = document.createElement('script');
  script.id = JSON_LD_ID;
  script.type = 'application/ld+json';
  // textContent, not innerHTML: the browser never re-parses this as markup.
  // serializeJsonLd escapes regardless, so the output is safe either way.
  script.textContent = serializeJsonLd(page.jsonLd.length === 1 ? page.jsonLd[0] : page.jsonLd);
  document.head.appendChild(script);
}

/** Remove page-specific structured data when leaving a page, so a product's
 *  Product schema does not linger on the home screen or the cart. */
export function clearSeoStructuredData() {
  if (typeof document === 'undefined') return;
  document.getElementById(JSON_LD_ID)?.remove();
}

/** The public origin for canonical URLs. The native app runs on capacitor://,
 *  which must never be emitted as a canonical address. */
export function publicSeoOrigin(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN || '').trim();
  if (/^https:\/\//i.test(configured)) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) return window.location.origin;
  return 'https://golden-oremar.vercel.app';
}
