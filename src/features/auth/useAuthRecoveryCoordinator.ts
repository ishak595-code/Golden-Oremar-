import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp, type PluginListenerHandle } from '@capacitor/app';
import { supabase } from '../../lib/supabase';
import {
  clearBrowserAuthCallbackArtifacts,
  consumeNativeAuthCallbackUrl,
  isPasswordRecoveryCallbackUrl,
} from './api';

export function useAuthRecoveryCoordinator() {
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [callbackHandled, setCallbackHandled] = useState(false);
  const [error, setError] = useState('');

  const finishRecovery = useCallback(() => {
    setRecoveryPending(false);
    setCallbackHandled(false);
  }, []);

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
      if (!url) return;
      try {
        const result = await consumeNativeAuthCallbackUrl(url);
        if (!result.handled || disposed) return;
        setCallbackHandled(true);
        if (result.recovery) setRecoveryPending(true);
      } catch (e: any) {
        if (!disposed) {
          setCallbackHandled(true);
          setError(String(e?.message || 'Kimlik doğrulama bağlantısı işlenemedi.'));
        }
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
      if (appUrlHandle) void appUrlHandle.remove();
    };
  }, []);

  return {
    recoveryPending,
    callbackHandled,
    error,
    clearError,
    finishRecovery,
  };
}
