import { useEffect, useState } from 'react';
import { getPublicStorefrontConfig } from './api';

const fallbackInterface = {
  heroTitle: 'Köyden Sofraya',
  heroSubtitle: 'Üretici, menşe ve ürün bilgileri doğrulanan yöresel ürünleri keşfedin.',
  heroButtonText: 'Ürünleri Keşfet',
  featuredTitle: 'Öne Çıkan Ürünler',
  seasonalTitle: 'Mevsimlik Ürünler',
  categoriesTitle: 'Ürün Kategorileri',
};

export function usePublicStorefrontConfig(locale = 'tr') {
  const [state, setState] = useState<any>({
    staticContent: { interface: fallbackInterface },
    heroCategories: [],
    homeSections: [],
    salesReadiness: {},
    loading: true,
    error: '',
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getPublicStorefrontConfig(locale);
        if (!active) return;
        setState({
          staticContent: { interface: { ...fallbackInterface, ...(data?.interface || {}) } },
          heroCategories: Array.isArray(data?.heroCategories) ? data.heroCategories : [],
          homeSections: Array.isArray(data?.homeSections) ? data.homeSections : [],
          salesReadiness: data?.salesReadiness || {},
          brand: data?.brand || null,
          loading: false,
          error: '',
        });
      } catch (error: any) {
        if (!active) return;
        setState((previous: any) => ({
          ...previous,
          loading: false,
          error: error?.message || 'Mağaza arayüz ayarları yüklenemedi.',
        }));
      }
    })();
    return () => { active = false; };
  }, [locale]);

  return state;
}
