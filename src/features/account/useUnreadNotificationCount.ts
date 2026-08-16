import { useCallback, useEffect, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { listNotifications } from './api';

function normalizeUnreadCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function useUnreadNotificationCount(authenticated: boolean) {
  const [unreadCount, setUnreadCountState] = useState(0);
  const [hydrated, setHydrated] = useState(!authenticated);

  const setUnreadCount = useCallback((value: number) => {
    setUnreadCountState(normalizeUnreadCount(value));
  }, []);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setUnreadCountState(0);
      setHydrated(true);
      return 0;
    }
    const data = await listNotifications(1);
    const next = normalizeUnreadCount(data?.unreadCount);
    setUnreadCountState(next);
    setHydrated(true);
    return next;
  }, [authenticated]);

  useEffect(() => {
    setHydrated(!authenticated);
    if (!authenticated) {
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
        if (!disposed) setHydrated(true);
      }
    };

    void safeRefresh();

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
      window.removeEventListener('focus', onWindowFocus);
      if (appStateHandle) void appStateHandle.remove();
    };
  }, [authenticated, refresh]);

  return { unreadCount, setUnreadCount, refreshUnreadCount: refresh, hydrated };
}
