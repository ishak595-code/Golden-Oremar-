const RECOVERY_FLAG = 'go:chunk-recovery-at';
const RECOVERY_WINDOW_MS = 60_000;

/**
 * Detects the "stale deployment" failure mode.
 *
 * The app is a PWA with hashed asset filenames. When a new version is
 * deployed, every lazily-loaded chunk gets a new hash. A client still holding
 * the previous index bundle in its service worker cache will keep requesting
 * the old filenames, which no longer exist on the server. The import rejects
 * and React unmounts into the error boundary.
 *
 * Browsers word this differently, so the check covers the known variants
 * rather than matching one string.
 */
export function isStaleChunkError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown })?.message ?? error ?? ''
  ).toLowerCase();
  if (!message) return false;
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('unable to preload css') ||
    (message.includes('loading chunk') && message.includes('failed'))
  );
}

/**
 * Recovers from a stale deployment by discarding the cached build and
 * reloading.
 *
 * A plain location.reload() is not enough here: the service worker would serve
 * the same stale index document straight back, so the next import fails
 * identically and the user sees an endless "try again". This clears the
 * Cache Storage entries and unregisters the service worker first, so the
 * reload reaches the network and picks up the current build.
 *
 * Guarded against reload loops. If a recovery was already attempted within the
 * last minute, this returns false and lets the error boundary show its normal
 * message, so a genuinely broken deployment presents an error instead of
 * cycling forever.
 *
 * Returns true when a reload has been scheduled, false when the caller should
 * fall back to showing the error.
 */
export async function recoverFromStaleChunk(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const previous = Number(window.sessionStorage.getItem(RECOVERY_FLAG) || 0);
    if (previous && Date.now() - previous < RECOVERY_WINDOW_MS) return false;
    window.sessionStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    // Private browsing can throw on sessionStorage. Without the guard a loop
    // is possible, so decline to auto-recover rather than risk one.
    return false;
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch {
    // Cache eviction is best effort; unregistering below is the part that
    // actually breaks the stale-document cycle.
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
  } catch {
    // Ignore; the reload below is still worth attempting.
  }

  window.location.reload();
  return true;
}

/**
 * Clears the recovery marker after a successful load, so a later deployment
 * is allowed its own recovery attempt rather than being suppressed by a stale
 * flag from hours earlier.
 */
export function markAppLoadedSuccessfully() {
  try {
    window.sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // Nothing to do.
  }
}

/**
 * Catches stale-chunk failures that never reach a React error boundary -
 * a rejected dynamic import from an event handler, for instance.
 */
export function installStaleChunkListeners() {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', event => {
    if (isStaleChunkError(event.reason)) {
      event.preventDefault();
      void recoverFromStaleChunk();
    }
  });

  window.addEventListener('error', event => {
    if (isStaleChunkError(event.error || event.message)) {
      void recoverFromStaleChunk();
    }
  });
}
