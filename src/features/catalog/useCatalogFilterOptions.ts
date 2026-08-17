import { useEffect, useState } from 'react';
import { getPublicHomeCatalog, listPublicCategories } from './api';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';

export function useCatalogFilterOptions() {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [origins, setOrigins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadSequence, setReloadSequence] = useState(0);

  useEffect(() => {
    const restore = () => setReloadSequence(value => value + 1);
    window.addEventListener(NETWORK_RESTORED_EVENT, restore);
    return () => window.removeEventListener(NETWORK_RESTORED_EVENT, restore);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const [categoryRows, home] = await Promise.all([listPublicCategories(), getPublicHomeCatalog()]);
        if (!active) return;
        setCategories((categoryRows || []).map(item => ({ id: item.slug, name: item.name })));
        const values: string[] = Array.from(new Set<string>(
          (home?.items || [])
            .map((item: any) => String(item.origin || '').trim())
            .filter((value: string) => value.length > 0)
        )).sort((a, b) => a.localeCompare(b, 'tr'));
        setOrigins(values);
      } catch (err: any) {
        if (active) {
          setCategories([]);
          setOrigins([]);
          setError(err?.message || 'Katalog filtreleri yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadSequence]);

  return { categories, origins, loading, error };
}
