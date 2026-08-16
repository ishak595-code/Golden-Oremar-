import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { listNotifications } from './api';
import { getNotificationSoundEnabled, playNotificationSound, primeNotificationAudio } from '../notifications/premiumSounds';

function normalizeUnreadCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function useUnreadNotificationCount(authenticated: boolean) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const lastKnownUnread = useRef<number | null>(null);

  const setUnreadCount = useCallback((value: number) => {
    const next = normalizeUnreadCount(value);
    lastKnownUnread.current = next;
    setUnreadCountState(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      lastKnownUnread.current = null;
      setUnreadCountState(0);
      return 0;
    }
    const data = await listNotifications(1);
    const next = normalizeUnreadCount(data?.unreadCount);
    const previous = lastKnownUnread.current;
    lastKnownUnread.current = next;
    setUnreadCountState(next);

    // The first hydration is only a baseline. Play a signature only when a new unread item arrives.
    if (previous !== null && next > previous && getNotificationSoundEnabled() && document.visibilityState === 'visible') {
      void playNotificationSound();
    }
    return next;
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) {
      lastKnownUnread.current = null;
      setUnreadCountState(0);
      return;
    }

    let disposed = false;
    let appStateHandle: PluginListenerHandle | undefined;

    const safeRefresh = async () => {
      try {
        if (!disposed) await refresh();
      } catch (error) {
        console.warn('Unread notification count could not be refreshed', error);
      }
    };

    void safeRefresh();

    // A user gesture primes Web Audio so future foreground notifications can play reliably.
    const prime = () => { void primeNotificationAudio(); };
    window.addEventListener('pointerdown', prime, { once: true, passive: true });
    window.addEventListener('keydown', prime, { once: true });

    const onWindowFocus = () => { void safeRefresh(); };
    window.addEventListener('focus', onWindowFocus);

    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void safeRefresh();
      }).then(handle => {
        if (disposed) void handle.remove();
        else appStateHandle = handle;
      });
    }

    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
      window.removeEventListener('focus', onWindowFocus);
      if (appStateHandle) void appStateHandle.remove();
    };
  }, [authenticated, refresh]);

  return { unreadCount, setUnreadCount, refreshUnreadCount: refresh };
}
