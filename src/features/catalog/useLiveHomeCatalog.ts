import { publicCatalogUrl } from './api';
import { optionalProductHandlingProfile, type ProductHandlingProfile } from './productHandlingApi';

export type LegacyHomeProduct = {
  id: string;
  legacyId?: string | null;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  categorySlug: string;
  price: number | null;
  originalPrice?: number | null;
  currency: string | null;
  image: string;
  origin?: string | null;
  unit?: string | null;
  tags: string[];
  rating: number | null;
  reviewCount: number | null;
  stock?: number | null;
  stockMode: string;
  is_approved: true;
  is_featured: boolean;
  homeSection?: string;
  preOrder: boolean;
  variantId: string;
  variantName: string;
  vendor_id: string;
  producerId: string;
  producerName: string;
  producerFollowerCount: number;
  producerVerified: boolean;
  producerOriginVerified: boolean;
  producerStoreKind: 'official'|'independent';
  producerBadgeTone: 'ruby'|'blue';
  producerStorefrontTier: 'standard'|'verified'|'signature';
  handlingProfile: ProductHandlingProfile;
};

export type LegacyHomeCategory = {
  id: string;
  databaseId: string;
  name: string;
  description: string;
  icon?: string | null;
  image?: string;
  productCount: number;
  sortOrder: number;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function safeText(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function safeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function safeRating(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 5 ? value : null;
}
function safeCurrency(value: unknown) {
  const currency = safeText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}
function compactSearchTerms(values: unknown[]) {
  return Array.from(new Set(
    values
      .flatMap(value => typeof value === 'string' ? value.split(/[\s,;/|]+/g) : [])
      .map(value => value.trim())
      .filter(value => value.length > 1 && value.length <= 120)
  ));
}

/**
 * One catalogue card from the API as the storefront's product shape. Throws
 * when the card's identity cannot be verified, so a damaged card is never
 * shown as if it were a real product. Shared by the home catalogue and the
 * product page context.
 */
export function toLegacyHomeProduct(item: any): LegacyHomeProduct {
  if ((!isRecord(item) || !safeText(item.id,160) || !safeText(item.slug,220) || !safeText(item.name,300) || !isRecord(item.category) || !safeText(item.category.slug,220) || !safeText(item.category.name,160) || !isRecord(item.producer) || !safeText(item.producer.id,160) || !safeText(item.producer.name,240) || safeInteger(item.producer.followerCount)===null || typeof item.producer.verified!=='boolean' || typeof item.producer.originVerified!=='boolean' || !['official','independent'].includes(item.producer.storeKind) || !['ruby','blue'].includes(item.producer.badgeTone) || !['standard','verified','signature'].includes(item.producer.storefrontTier) || !isRecord(item.variant) || !safeText(item.variant.id,160) || !safeText(item.variant.name,240))) throw new Error('Ana katalogda kimliği doğrulanamayan ürün bulundu. Liste güvenli şekilde gösterilemedi.');
  const producerId = safeText(item.producer.id,160);
  const origin = safeText(item.origin,240) || null;
  const priceMinor = safeInteger(item.variant.priceMinor);
  const compareAtMinor = safeInteger(item.variant.compareAtPriceMinor);
  const currency = safeCurrency(item.currency);
  const availableQuantity = item.availableQuantity == null ? null : safeInteger(item.availableQuantity);
  const stockMode = safeText(item.stockMode,80);
  const rating = safeRating(item.averageRating);
  const reviewCount = safeInteger(item.reviewCount);
  const followerCount = safeInteger(item.producer.followerCount);
  const handlingProfile = optionalProductHandlingProfile(item.handlingProfile);
  if (followerCount === null || !handlingProfile) throw new Error('Ana katalog kart kimliği doğrulanamadı.');
  const tags = compactSearchTerms([
    safeText(item.name,300),
    safeText(item.category.name,160),
    safeText(item.category.slug,220),
    safeText(item.producer.name,240),
    safeText(item.producer.village,160),
    safeText(item.producer.district,160),
    safeText(item.producer.province,160),
    origin,
    safeText(item.unitLabel,120),
    safeText(item.variant.name,240),
    handlingProfile.productType,
    handlingProfile.safetyClass,
  ]);
  return {
    id: safeText(item.id,160),
    legacyId: safeText(item.legacyId,160) || null,
    slug: safeText(item.slug,220),
    name: safeText(item.name,300),
    description: safeText(item.shortDescription,1000),
    shortDescription: safeText(item.shortDescription,1000),
    category: safeText(item.category.name,160),
    categorySlug: safeText(item.category.slug,220),
    price: priceMinor === null ? null : priceMinor / 100,
    originalPrice: compareAtMinor === null ? null : compareAtMinor / 100,
    currency,
    image: publicCatalogUrl(item.imagePath),
    origin,
    unit: safeText(item.unitLabel,120) || safeText(item.variant.name,120) || null,
    tags,
    rating,
    reviewCount,
    stock: availableQuantity,
    stockMode,
    is_approved: true as const,
    is_featured: item.featured === true,
    homeSection: safeText(item.homeSection,80) || (item.featured === true ? 'featured' : 'regular'),
    preOrder: stockMode === 'preorder',
    variantId: safeText(item.variant.id,160),
    variantName: safeText(item.variant.name,240),
    vendor_id: producerId,
    producerId,
    producerName: safeText(item.producer.name,240),
    producerFollowerCount: followerCount,
    producerVerified: item.producer.verified === true,
    producerOriginVerified: item.producer.originVerified === true,
    producerStoreKind: item.producer.storeKind as 'official'|'independent',
    producerBadgeTone: item.producer.badgeTone as 'ruby'|'blue',
    producerStorefrontTier: item.producer.storefrontTier as 'standard'|'verified'|'signature',
    handlingProfile,
  };
}
