import { useEffect, useState } from 'react';
import { getPublicStorefrontConfig, type StorefrontConfig } from './api';

type StorefrontState = {
  staticContent: { interface: StorefrontConfig['interface'] | null };
  heroCategories: StorefrontConfig['heroCategories'];
  homeSections: StorefrontConfig['homeSections'];
  eventSpotlight: StorefrontConfig['eventSpotlight'] | null;
  salesReadiness: StorefrontConfig['salesReadiness'] | null;
  brand: StorefrontConfig['brand'] | null;
  updatedAt: string | null;
  loading: boolean;
  error: string;
};

const emptyState: StorefrontState = {
  staticContent: { interface: null },
  heroCategories: [],
  homeSections: [],
  eventSpotlight: null,
  salesReadiness: null,
  brand: null,
  updatedAt: null,
  loading: true,
  error: '',
};

export function usePublicStorefrontConfig(locale = 'tr') {
  const [state, setState] = useState<StorefrontState>(emptyState);

  useEffect(() => {
    let active = true;
    setState({ ...emptyState, loading: true });
    (async () => {
      try {
        const data = await getPublicStorefrontConfig(locale);
        if (!active) return;
        setState({
          staticContent: { interface: data.interface },
          heroCategories: data.heroCategories,
          homeSections: data.homeSections,
          eventSpotlight: data.eventSpotlight,
          salesReadiness: data.salesReadiness,
          brand: data.brand,
          updatedAt: data.updatedAt,
          loading: false,
          error: '',
        });
      } catch (error: unknown) {
        if (!active) return;
        const message = error instanceof Error && error.message ? error.message : 'Mağaza arayüz ayarları yüklenemedi.';
        setState({ ...emptyState, loading: false, error: message });
      }
    })();
    return () => { active = false; };
  }, [locale]);

  return state;
}
