import { useEffect, useState } from 'react';
import { getPublicStorefrontConfig, type StorefrontConfig } from './api';

type StorefrontState = {
  staticContent: { interface: StorefrontConfig['interface'] | null };
  heroCategories: StorefrontConfig['heroCategories'];
  homeSections: StorefrontConfig['homeSections'];
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
          salesReadiness: data.salesReadiness,
          brand: data.brand,
          updatedAt: data.updatedAt,
          loading: false,
          error: '',
        });
      } catch (error: any) {
        if (!active) return;
        setState({
          ...emptyState,
          loading: false,
          error: error?.message || 'Mağaza arayüz ayarları yüklenemedi.',
        });
      }
    })();
    return () => { active = false; };
  }, [locale]);

  return state;
}
