import { useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Network } from '@capacitor/network';

export const NETWORK_RESTORED_EVENT = 'golden-oremar:network-restored';

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  const [restoreSequence, setRestoreSequence] = useState(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    let disposed = false;
    let nativeHandle: PluginListenerHandle | undefined;

    const apply = (connected: boolean) => {
      if (disposed) return;
      setIsOnline(connected);
      if (!connected) {
        wasOffline.current = true;
        return;
      }
      if (wasOffline.current) {
        wasOffline.current = false;
        setRestoreSequence(value => value + 1);
        window.dispatchEvent(new Event(NETWORK_RESTORED_EVENT));
      }
    };

    if (Capacitor.isNativePlatform()) {
      void Network.getStatus()
        .then(status => apply(status.connected))
        .catch(() => apply(typeof navigator === 'undefined' ? true : navigator.onLine !== false));
      void Network.addListener('networkStatusChange', status => apply(status.connected)).then(handle => {
        if (disposed) void handle.remove();
        else nativeHandle = handle;
      });
    } else {
      apply(navigator.onLine !== false);
      const online = () => apply(true);
      const offline = () => apply(false);
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
      return () => {
        disposed = true;
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
      };
    }

    return () => {
      disposed = true;
      if (nativeHandle) void nativeHandle.remove();
    };
  }, []);

  return { isOnline, restoreSequence };
}
