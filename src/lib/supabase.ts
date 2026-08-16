import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Missing Supabase client environment variables.');
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Browser redirects can be detected automatically. Native Capacitor callbacks
    // are consumed explicitly from the App plugin so local WebView origins are
    // never mistaken for production auth callback URLs.
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  },
});
