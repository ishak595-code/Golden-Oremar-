import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../../lib/supabase';
import {
  clearBrowserAuthCallbackArtifacts,
  closeNativeAuthBrowser,
  consumeNativeAuthCallbackUrl,
  isNativeAuthCallbackUrl,
  isPasswordRecoveryCallbackUrl,
} from './api';

const CALLBACK_RETRY_DEBOUNCE_MS = 5000;

function callbackKey(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url.trim().slice(0, 32768);
  }
}

export function useAuthRecoveryCoordinator() {
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [callbackHandled, setCallbackHandled] = useState(false);
  const [error, setError] = useState('');
  const completedCallbacksRef = useRef(new Set<string>());
  const callbackAttemptsRef = useRef(new Map<string, number>());
  const processingCallbacksRef = useRef(new Set<string>());

  const finishRecovery = useCallback(() => {
    setRecoveryPending(false);
    setCallbackHandled(false);
  }, []);

  const acknowledgeCallback = useCallback(() => setCallbackHandled(false), []);
  const clearError = useCallback(() => setError(''), []);

  useEffect(() => {
    let disposed = false;
    let appUrlHandle: PluginListenerHandle | undefined;

    const markRecoveryReady = () => {
      if (disposed) return;
      setRecoveryPending(true);
      setCallbackHandled(true);
    };

    const handleNativeUrl = async (url?: string) => {
      if (!url || !isNativeAuthCallbackUrl(url)) return;
      const key = callbackKey(url);
      if (!key || completedCallbacksRef.current.has(key) || processingCallbacksRef.current.has(key)) return;
      const now = Date.now();
      const lastAttempt = callbackAttemptsRef.current.get(key) || 0;
      if (now - lastAttempt < CALLBACK_RETRY_DEBOUNCE_MS) return;
      callbackAttemptsRef.current.set(key, now);
      processingCallbacksRef.current.add(key);

      try {
        const result = await consumeNativeAuthCallbackUrl(url);
        if (!result.handled || disposed) return;
        completedCallbacksRef.current.add(key);
        callbackAttemptsRef.current.delete(key);
        await closeNativeAuthBrowser();
        if (disposed) return;
        setError('');
        setCallbackHandled(true);
        if (result.recovery) setRecoveryPending(true);
      } catch (e: any) {
        await closeNativeAuthBrowser();
        if (!disposed) {
          setCallbackHandled(true);
          setError(String(e?.message || 'Kimlik doğrulama bağlantısı işlenemedi.'));
        }
      } finally {
        processingCallbacksRef.current.delete(key);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearBrowserAuthCallbackArtifacts();
        markRecoveryReady();
      }
    });

    if (Capacitor.isNativePlatform()) {
      void CapApp.getLaunchUrl()
        .then(result => handleNativeUrl(result?.url))
        .catch(e => {
          if (!disposed) setError(String(e?.message || 'Uygulama açılış bağlantısı okunamadı.'));
        });

      void CapApp.addListener('appUrlOpen', event => {
        void handleNativeUrl(event.url);
      }).then(handle => {
        if (disposed) void handle.remove();
        else appUrlHandle = handle;
      });
    } else if (typeof window !== 'undefined' && isPasswordRecoveryCallbackUrl(window.location.href)) {
      // Supabase detects the browser session itself. This check only protects
      // against a recovery event racing the component subscription during startup.
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) markRecoveryReady();
      });
    }

    return () => {
      disposed = true;
      subscription.unsubscribe();
      processingCallbacksRef.current.clear();
      if (appUrlHandle) void appUrlHandle.remove();
    };
  }, []);

  return {
    recoveryPending,
    callbackHandled,
    error,
    clearError,
    acknowledgeCallback,
    finishRecovery,
  };
}
