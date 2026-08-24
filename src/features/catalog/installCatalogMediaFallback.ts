const FALLBACK_DATA_URI = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const CATALOG_PUBLIC_MARKER = '/storage/v1/object/public/catalog-public/';
const LEGACY_PRODUCT_MARKER = '/images/products/';
const FALLBACK_CLASS = 'go-catalog-media-fallback';
const FALLBACK_LABEL = 'Ürün görseli şu anda kullanılamıyor';

function catalogMediaSource(img: HTMLImageElement) {
  return String(img.currentSrc || img.src || '').trim();
}

function isCatalogMediaSource(src: string) {
  if (!src || src === FALLBACK_DATA_URI) return false;
  try {
    const url = new URL(src, window.location.href);
    return url.pathname.includes(CATALOG_PUBLIC_MARKER) || url.pathname.includes(LEGACY_PRODUCT_MARKER);
  } catch {
    return false;
  }
}

function unavailableAlt(previousAlt: string) {
  const alt = previousAlt.trim();
  if (!alt) return '';
  if (alt.includes(FALLBACK_LABEL)) return alt;
  return `${alt}. ${FALLBACK_LABEL}.`;
}

function applyFallback(img: HTMLImageElement) {
  if (img.dataset.goCatalogMediaFallback === 'true') return;
  const originalSrc = catalogMediaSource(img);
  if (!isCatalogMediaSource(originalSrc)) return;

  img.dataset.goCatalogMediaFallback = 'true';
  img.dataset.goCatalogMediaOriginalSrc = originalSrc;
  img.dataset.goCatalogMediaOriginalAlt = img.alt;
  img.classList.add(FALLBACK_CLASS);
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.alt = unavailableAlt(img.alt);
  img.title = FALLBACK_LABEL;
  img.style.background = '#000';
  img.style.objectFit = 'contain';
  img.src = FALLBACK_DATA_URI;
}

function clearFallback(img: HTMLImageElement) {
  if (img.dataset.goCatalogMediaFallback !== 'true') return;
  if (catalogMediaSource(img) === FALLBACK_DATA_URI) return;
  img.dataset.goCatalogMediaFallback = 'false';
  img.classList.remove(FALLBACK_CLASS);
  img.style.removeProperty('background');
  img.style.removeProperty('object-fit');
  const originalAlt = img.dataset.goCatalogMediaOriginalAlt;
  if (typeof originalAlt === 'string') img.alt = originalAlt;
  img.removeAttribute('title');
}

function retryRecoveredNetworkImages() {
  document.querySelectorAll<HTMLImageElement>('img[data-go-catalog-media-fallback="true"]').forEach(img => {
    if (img.dataset.goCatalogMediaRetry === '1') return;
    const originalSrc = String(img.dataset.goCatalogMediaOriginalSrc || '').trim();
    if (!isCatalogMediaSource(originalSrc)) return;
    img.dataset.goCatalogMediaRetry = '1';
    img.src = originalSrc;
  });
}

export function installCatalogMediaFallback() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const onError = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) applyFallback(target);
  };
  const onLoad = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) clearFallback(target);
  };
  const onOnline = () => retryRecoveredNetworkImages();

  window.addEventListener('error', onError, true);
  window.addEventListener('load', onLoad, true);
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('error', onError, true);
    window.removeEventListener('load', onLoad, true);
    window.removeEventListener('online', onOnline);
  };
}
