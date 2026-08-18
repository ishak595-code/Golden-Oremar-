import { useEffect, useState } from 'react';
import { getPublicHomeCatalog, listPublicCategories } from './api';
import { NETWORK_RESTORED_EVENT } from '../resilience/useConnectivity';

function safeText(value: unknown, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

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
        if (!Array.isArray(categoryRows)) throw new Error('Kategori filtreleri doğrulanamadı.');
        const safeCategories = categoryRows.map(item => {
          const id = safeText(item?.slug, 220);
          const name = safeText(item?.name, 160);
          if (!id || !name) throw new Error('Kategori filtresi kimliği doğrulanamadı.');
          return { id, name };
        });
        if (!home || typeof home !== 'object' || Array.isArray(home) || !Array.isArray((home as any).items)) throw new Error('Menşe filtreleri doğrulanamadı.');
        const values = Array.from(new Set<string>(
          (home as any).items
            .map((item: any) => safeText(item?.origin, 240))
            .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b, 'tr'));
        setCategories(safeCategories);
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
