import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';
import { buildCurrentUserFromSession } from './api';

export function useCustomerSession() {
  const [currentUserState, setCurrentUserState] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const verifiedUserRef = useRef<any>(null);

  const setCurrentUser = (next: any) => {
    setCurrentUserState(previous => {
      const resolved = typeof next === 'function' ? next(previous) : next;
      verifiedUserRef.current = resolved;
      return resolved;
    });
  };

  useEffect(() => {
    let active = true;
    let hydrationSequence = 0;

    const hydrate = async (session: Session | null) => {
      const sequence = ++hydrationSequence;
      if (!session?.user) {
        if (active && sequence === hydrationSequence) {
          verifiedUserRef.current = null;
          setCurrentUserState(null);
          setAuthReady(true);
        }
        return;
      }
      try {
        const nextUser = await buildCurrentUserFromSession(session);
        if (active && sequence === hydrationSequence) {
          verifiedUserRef.current = nextUser;
          setCurrentUserState(nextUser);
          setAuthReady(true);
        }
      } catch (error) {
        console.error('Supabase customer session hydration failed', error);
        if (active && sequence === hydrationSequence) {
          // A temporary network/RPC failure must not visually sign out a user whose
          // identity was already verified during this app session. We keep only the
          // previously verified snapshot and retry as soon as connectivity returns.
          if (verifiedUserRef.current) setCurrentUserState(verifiedUserRef.current);
          setAuthReady(true);
        }
      }
    };

    const hydrateCurrentSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await hydrate(data.session);
      } catch (error) {
        console.error('Supabase customer session lookup failed', error);
        if (active) {
          if (verifiedUserRef.current) setCurrentUserState(verifiedUserRef.current);
          setAuthReady(true);
        }
      }
    };

    void hydrateCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep network-backed role/profile hydration outside the synchronous auth callback.
      window.setTimeout(() => { void hydrate(session); }, 0);
    });

    const retryAfterConnectivityRestore = () => { void hydrateCurrentSession(); };
    window.addEventListener(NETWORK_RESTORED_EVENT, retryAfterConnectivityRestore);

    return () => {
      active = false;
      hydrationSequence += 1;
      subscription.unsubscribe();
      window.removeEventListener(NETWORK_RESTORED_EVENT, retryAfterConnectivityRestore);
    };
  }, []);

  return { currentUser: currentUserState, setCurrentUser, authReady };
}
