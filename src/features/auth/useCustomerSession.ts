import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { buildCurrentUserFromSession } from './api';

export function useCustomerSession() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    let hydrationSequence = 0;

    const hydrate = async (session: Session | null) => {
      const sequence = ++hydrationSequence;
      if (!session?.user) {
        if (active && sequence === hydrationSequence) {
          setCurrentUser(null);
          setAuthReady(true);
        }
        return;
      }
      try {
        const nextUser = await buildCurrentUserFromSession(session);
        if (active && sequence === hydrationSequence) setCurrentUser(nextUser);
      } catch (error) {
        console.error('Supabase customer session hydration failed', error);
        if (active && sequence === hydrationSequence) setCurrentUser(null);
      } finally {
        if (active && sequence === hydrationSequence) setAuthReady(true);
      }
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Supabase initial customer session failed', error);
        if (active) setAuthReady(true);
        return;
      }
      void hydrate(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Keep network-backed role/profile hydration outside the synchronous auth callback.
      window.setTimeout(() => { void hydrate(session); }, 0);
    });

    return () => {
      active = false;
      hydrationSequence += 1;
      subscription.unsubscribe();
    };
  }, []);

  return { currentUser, setCurrentUser, authReady };
}
