/**
 * Single source of truth for page metadata and structured data.
 *
 * Used in two places that must never disagree:
 *   - scripts/prerender-seo.mjs, which writes static HTML at build time so
 *     crawlers and link-preview bots see real titles, images and prices
 *   - applySeo.ts, which updates the live document once the app has loaded
 *     current data
 *
 * If these drifted - a price or availability in the prerendered JSON-LD that
 * differed from what the rendered page shows - Google treats it as a
 * structured-data mismatch and can drop the rich result. Keeping both paths on
 * one builder is what prevents that.
 *
 * This module has no imports and no DOM access, so the build script can
 * transpile and execute it directly in Node.
 */

export const SITE_NAME = 'Golden Oremar';
export const DEFAULT_TITLE = 'Golden Oremar | Doğrulanmış Üreticilerden Köy Ürünleri';
export const DEFAULT_DESCRIPTION =
  'Doğrulanmış üreticilerden köy ve yöresel ürünler. Bal, peynir, tereyağı ve daha fazlası, üretildiği köyden kapınıza.';

const SAFE_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._~-]{0,199}$/;

export type SeoAvailability = 'in_stock' | 'out_of_stock' | 'preorder';

export type SeoProductInput = {
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceMinor: number | null;
  currency: string;
  availability: SeoAvailability;
  brandName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  ratingAverage: number | null;
  ratingCount: number;
};

export type SeoPage = {
  title: string;
  description: string;
  canonical: string;
  image: string | null;
  type: 'website' | 'product';
  jsonLd: Record<string, unknown>[];
};

/** A slug is used as a filesystem directory at build time, so it is validated
 *  here rather than trusted. This is the path-traversal guard. */
export function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && SAFE_SLUG.test(value);
}

/** Collapse whitespace and cut on a word boundary, so descriptions stay inside
 *  the length search engines display without ending mid-word. */
export function clip(value: unknown, max: number): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

function joinUrl(origin: string, path: string) {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

function absoluteImage(origin: string, image: string | null): string | null {
  if (!image) return null;
  if (/^https:\/\//i.test(image)) return image;
  if (image.startsWith('/')) return joinUrl(origin, image);
  return null;
}

const SCHEMA_AVAILABILITY: Record<SeoAvailability, string> = {
  in_stock: 'https://schema.org/InStock',
  out_of_stock: 'https://schema.org/OutOfStock',
  preorder: 'https://schema.org/PreOrder',
};

export function productSeo(input: SeoProductInput, origin: string, fallbackImage: string | null = null): SeoPage {
  const canonical = joinUrl(origin, `/urun/${encodeURIComponent(input.slug)}`);
  const image = absoluteImage(origin, input.imageUrl) || absoluteImage(origin, fallbackImage);
  const description = clip(input.description || `${input.name} - ${SITE_NAME}`, 155);

  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description,
    url: canonical,
    sku: input.slug,
  };
  if (image) product.image = [image];
  if (input.brandName) product.brand = { '@type': 'Brand', name: input.brandName };
  if (input.categoryName) product.category = input.categoryName;

  // An Offer is only emitted with a real price. Google rejects an Offer
  // without one, and inventing a price would be worse than omitting it.
  if (typeof input.priceMinor === 'number' && Number.isFinite(input.priceMinor) && input.priceMinor >= 0) {
    product.offers = {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: input.currency || 'TRY',
      price: (input.priceMinor / 100).toFixed(2),
      availability: SCHEMA_AVAILABILITY[input.availability],
      seller: { '@type': 'Organization', name: SITE_NAME },
    };
  }

  // Ratings are only claimed when real reviews exist. A zero-review
  // aggregateRating is a structured-data violation that can remove every rich
  // result from the site, not just this product's.
  if (input.ratingCount > 0 && typeof input.ratingAverage === 'number' && input.ratingAverage > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.ratingAverage.toFixed(1),
      reviewCount: input.ratingCount,
    };
  }

  const crumbs: Record<string, unknown>[] = [
    { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: joinUrl(origin, '/') },
  ];
  if (input.categoryName && input.categorySlug && isSafeSlug(input.categorySlug)) {
    crumbs.push({
      '@type': 'ListItem',
      position: 2,
      name: input.categoryName,
      item: joinUrl(origin, `/kategori/${encodeURIComponent(input.categorySlug)}`),
    });
  }
  crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: input.name, item: canonical });

  return {
    title: `${clip(input.name, 60)} | ${SITE_NAME}`,
    description,
    canonical,
    image,
    type: 'product',
    jsonLd: [product, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }],
  };
}

export function categorySeo(
  input: { slug: string; name: string; description?: string | null },
  origin: string,
  fallbackImage: string | null = null,
): SeoPage {
  const canonical = joinUrl(origin, `/kategori/${encodeURIComponent(input.slug)}`);
  return {
    title: `${clip(input.name, 60)} | ${SITE_NAME}`,
    description: clip(input.description || `${input.name}: doğrulanmış üreticilerden köy ürünleri. ${SITE_NAME}.`, 155),
    canonical,
    image: absoluteImage(origin, fallbackImage),
    type: 'website',
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: joinUrl(origin, '/') },
        { '@type': 'ListItem', position: 2, name: input.name, item: canonical },
      ],
    }],
  };
}

export function producerSeo(
  input: { slug: string; name: string; description?: string | null; location?: string | null },
  origin: string,
  fallbackImage: string | null = null,
): SeoPage {
  const canonical = joinUrl(origin, `/uretici/${encodeURIComponent(input.slug)}`);
  const where = input.location ? ` ${input.location}.` : '';
  return {
    title: `${clip(input.name, 60)} | ${SITE_NAME}`,
    description: clip(input.description || `${input.name}, doğrulanmış üretici.${where} ${SITE_NAME}.`, 155),
    canonical,
    image: absoluteImage(origin, fallbackImage),
    type: 'website',
    jsonLd: [],
  };
}

export function homeSeo(origin: string, fallbackImage: string | null = null): SeoPage {
  const home = joinUrl(origin, '/');
  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonical: home,
    image: absoluteImage(origin, fallbackImage),
    type: 'website',
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: home,
      ...(absoluteImage(origin, fallbackImage) ? { logo: absoluteImage(origin, fallbackImage) } : {}),
    }],
  };
}

/**
 * Serialise JSON-LD for embedding inside a <script> element.
 *
 * Product names and descriptions are written by producers, so they are
 * untrusted. JSON.stringify alone is not safe here: a name containing
 * "</script>" would close the element and whatever followed would execute as
 * HTML. Escaping <, > and & to their \u sequences keeps the JSON valid and the
 * element unbreakable. U+2028 and U+2029 are escaped because they are legal in
 * JSON but terminate lines in older JavaScript parsers.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Escape a value for a double-quoted HTML attribute or text node. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The head tags a page needs, as an HTML string. Used by the build step. */
export function renderHeadTags(page: SeoPage): string {
  const meta = (attr: 'name' | 'property', key: string, value: string | null) =>
    value ? `<meta ${attr}="${key}" content="${escapeHtml(value)}">` : '';
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    meta('name', 'description', page.description),
    `<link rel="canonical" href="${escapeHtml(page.canonical)}">`,
    meta('property', 'og:type', page.type),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', 'tr_TR'),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    meta('property', 'og:url', page.canonical),
    meta('property', 'og:image', page.image),
    meta('name', 'twitter:card', page.image ? 'summary_large_image' : 'summary'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', page.image),
    ...page.jsonLd.map(block => `<script type="application/ld+json">${serializeJsonLd(block)}</script>`),
  ].filter(Boolean).join('\n    ');
}
