import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { resolveDeepLinkTarget, type DeepLinkTarget } from './appUrl';

const DUPLICATE_WINDOW_MS = 1500;

/**
 * Opens the right screen when the OS hands the native app a Golden Oremar
 * link - a product shared on WhatsApp, a category in a campaign message.
 *
 * Two delivery paths are covered because the OS uses both:
 *   - appUrlOpen fires when the app is already running, or resumes from the
 *     background, and a link is tapped
 *   - getLaunchUrl returns the link that cold-started the app. On a cold start
 *     some platforms also fire appUrlOpen for the same URL, so identical URLs
 *     arriving within a short window are delivered once
 *
 * This listener only acts on https links for the hosts in DEEP_LINK_HOSTS.
 * The custom-scheme auth callbacks are handled by useAuthRecoveryCoordinator,
 * which registers its own appUrlOpen listener; resolveDeepLinkTarget returns
 * null for those, so the two listeners never compete for the same URL.
 *
 * No-op on the web, where the browser already loads the linked page directly.
 */
export function useNativeDeepLinks(onTarget: (target: DeepLinkTarget) => void) {
  // The latest handler is read through a ref so the native listener is
  // registered exactly once and never re-subscribes on every render.
  const handlerRef = useRef(onTarget);
  handlerRef.current = onTarget;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let handle: { remove: () => Promise<void> } | null = null;
    const recent = new Map<string, number>();

    const dispatch = (url?: string) => {
      if (disposed || !url) return;
      const target = resolveDeepLinkTarget(url);
      if (!target) return;
      const now = Date.now();
      if (now - (recent.get(url) || 0) < DUPLICATE_WINDOW_MS) return;
      recent.set(url, now);
      handlerRef.current(target);
    };

    void CapApp.getLaunchUrl()
      .then(result => dispatch(result?.url))
      .catch(() => {
        // No launch URL, or the plugin is unavailable: nothing to open.
      });

    void CapApp.addListener('appUrlOpen', event => dispatch(event.url)).then(registered => {
      if (disposed) void registered.remove();
      else handle = registered;
    });

    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, []);
}
