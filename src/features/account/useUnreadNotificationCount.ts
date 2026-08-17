import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { listNotifications } from './api';
import { getNotificationSoundEnabled, playNotificationSound, primeNotificationAudio } from '../notifications/premiumSounds';
import { clearNativeDeliveredNotifications, subscribeNativePushReceipts } from '../notifications/nativePush';

function normalizeUnreadCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function useUnreadNotificationCount(authenticated: boolean) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const lastKnownUnread = useRef<number | null>(null);

  const commitUnreadCount = useCallback((value: unknown) => {
    const next = normalizeUnreadCount(value);
    const previous = lastKnownUnread.current;
    lastKnownUnread.current = next;
    setUnreadCountState(next);

    // Supabase is authoritative for unread state. Clear stale delivered native
    // notifications both when unread transitions to zero and when the first
    // authenticated hydration already reports zero after a cold app launch.
    if (next === 0 && previous !== 0) void clearNativeDeliveredNotifications();
    return { next, previous };
  }, []);

  const resetUnreadSession = useCallback((clearDelivered = false) => {
    lastKnownUnread.current = null;
    setUnreadCountState(0);
    if (clearDelivered && Capacitor.isNativePlatform()) void clearNativeDeliveredNotifications();
  }, []);

  const setUnreadCount = useCallback((value: number) => {
    commitUnreadCount(value);
  }, [commitUnreadCount]);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      resetUnreadSession(false);
      return 0;
    }
    const data = await listNotifications(1);
    const { next, previous } = commitUnreadCount(data?.unreadCount);

    // The first hydration is only a baseline. Play a signature only when a new unread item arrives.
    if (previous !== null && next > previous && getNotificationSoundEnabled() && document.visibilityState === 'visible') {
      void playNotificationSound();
    }
    return next;
  }, [authenticated, commitUnreadCount, resetUnreadSession]);

  useEffect(() => {
    if (!authenticated) {
      // Signed-out sessions must not retain notifications from the previous customer.
      resetUnreadSession(true);
      return;
    }

    let disposed = false;
    let appStateHandle: PluginListenerHandle | undefined;
    let unsubscribePushReceipt: (() => void) | undefined;

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
      unsubscribePushReceipt = subscribeNativePushReceipts(() => { void safeRefresh(); });
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
      unsubscribePushReceipt?.();
      if (appStateHandle) void appStateHandle.remove();
    };
  }, [authenticated, refresh, resetUnreadSession]);

  return { unreadCount, setUnreadCount, refreshUnreadCount: refresh };
}
