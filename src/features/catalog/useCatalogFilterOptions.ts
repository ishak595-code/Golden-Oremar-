import { useEffect, useState } from 'react';
import { getPublicHomeCatalog, listPublicCategories } from './api';

export function useCatalogFilterOptions() {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [origins, setOrigins] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [categoryRows, home] = await Promise.all([listPublicCategories(), getPublicHomeCatalog()]);
        if (!active) return;
        setCategories((categoryRows || []).map(item => ({ id: item.slug, name: item.name })));
        const values: string[] = Array.from(new Set<string>(
          (home?.items || [])
            .map((item: any) => String(item.origin || '').trim())
            .filter((value: string) => value.length > 0)
        )).sort((a, b) => a.localeCompare(b, 'tr'));
        setOrigins(values);
      } catch {
        if (active) { setCategories([]); setOrigins([]); }
      }
    })();
    return () => { active = false; };
  }, []);

  return { categories, origins };
}
