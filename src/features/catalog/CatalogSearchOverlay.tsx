import React, { useEffect, useRef, useState } from 'react';
import { Grid2X2, Package, Search, Store } from 'lucide-react';
import { catalogSuggestions, type CatalogSuggestion } from './api';

type Props = {
  query: string;
  open: boolean;
  onQueryChange: (value: string) => void;
  onProduct: (slug: string) => void;
  onProducer: (id: string, slug: string, label: string) => void;
  onCategory: (slug: string, label: string) => void;
  onAllResults: (query: string) => void;
  onRequestClose: () => void;
};

const iconFor = (kind: CatalogSuggestion['kind']) =>
  kind === 'product' ? Package : kind === 'producer' ? Store : Grid2X2;

export default function CatalogSearchOverlay({
  query,
  open,
  onQueryChange,
  onProduct,
  onProducer,
  onCategory,
  onAllResults,
  onRequestClose,
}: Props) {
  const [items, setItems] = useState<CatalogSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    if (!normalized) {
      setItems([]);
      setError('');
      setLoading(false);
      return;
    }

    const current = ++requestId.current;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const next = await catalogSuggestions(normalized, 10);
        if (requestId.current === current) setItems(next);
      } catch (err: any) {
        if (requestId.current === current) {
          setItems([]);
          setError(err?.message || 'Arama önerileri alınamadı.');
        }
      } finally {
        if (requestId.current === current) setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  function choose(item: CatalogSuggestion) {
    onQueryChange(item.label);
    if (item.kind === 'product') onProduct(item.value);
    else if (item.kind === 'producer') onProducer(item.id, item.value, item.label);
    else onCategory(item.value, item.label);
  }

  return (
    <div
      id="catalog-search-suggestions"
      data-catalog-search-overlay="true"
      className="absolute left-4 right-4 z-[100] mx-auto mt-2 max-h-[70vh] max-w-7xl overflow-y-auto rounded-2xl border border-brand-gold/20 bg-white shadow-2xl dark:bg-gray-900"
      role="region"
      aria-label="Arama önerileri"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onRequestClose();
        }
      }}
      onBlur={event => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        onRequestClose();
      }}
    >
      {!query.trim() ? (
        <div className="p-5 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-start gap-3">
            <Search aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
            <div>
              <div className="font-bold text-brand-text">Ürün, üretici veya kategori arayın</div>
              <p className="mt-1 text-gray-500">Öneriler Golden Oremar'ın canlı kataloğundan gelir.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {loading ? 'Aranıyor' : error ? error : `${items.length} öneri bulundu`}
          </div>

          {loading ? <div role="status" className="p-4 text-sm text-gray-500">Aranıyor…</div> : null}
          {error ? <div role="alert" className="m-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

          {!loading && !error && items.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Bu ifadeyle eşleşen öneri bulunamadı.</div>
          ) : null}

          {items.length > 0 ? (
            <ul aria-label="Arama önerileri" className="space-y-1">
              {items.map(item => {
                const Icon = iconFor(item.kind);
                const typeLabel = item.kind === 'product' ? 'Ürün' : item.kind === 'producer' ? 'Üretici' : 'Kategori';
                return (
                  <li key={`${item.kind}:${item.id}`}>
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => choose(item)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-brand-text transition-colors hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                    >
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-gold" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.label}</span>
                        <span className="block text-xs text-gray-500">{typeLabel}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => onAllResults(query.trim())}
            className="mt-2 min-h-12 w-full rounded-xl border border-brand-gold/30 px-4 text-left font-bold text-brand-gold hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
          >
            “{query.trim()}” için tüm sonuçları göster
          </button>
        </div>
      )}
    </div>
  );
}
