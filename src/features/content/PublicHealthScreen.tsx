import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Heart, Leaf, Search, Utensils, X } from 'lucide-react';
import { contentPublicUrl, getPublicContentEntry, listContentFavoriteReferences, listPublicContent, toggleContentFavorite, type ContentType } from './api';
import ProductSafetyPanel from './ProductSafetyPanel';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';

type Props = {
  onBack: () => void;
  authenticated: boolean;
  locale?: string;
  onLoginRequired: () => void;
  onOpenProduct?: (slug: string) => void;
};

const tabs: { key: ContentType; label: string; icon: any; description: string }[] = [
  { key: 'health_guide', label: 'Rehberler', icon: BookOpen, description: 'Saklama, kullanım ve gıda güvenliği rehberleri' },
  { key: 'product_health', label: 'Ürün Bilgileri', icon: Leaf, description: 'Ürün bazlı güvenlik ve kullanım bilgileri' },
  { key: 'recipe', label: 'Tarifler', icon: Utensils, description: 'Golden Oremar ürünleriyle yayınlanmış tarifler' },
];

function searchLocale(value: string) {
  const normalized = String(value || 'tr').trim().replace('_', '-');
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(normalized) ? normalized : 'tr';
}

function verifiedTotal(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export default function PublicHealthScreen({ onBack, authenticated, locale = 'tr', onLoginRequired, onOpenProduct }: Props) {
  const [active, setActive] = useState<ContentType>('health_guide');
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [totals, setTotals] = useState<Record<string, number | null>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openingReference, setOpeningReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement | null>(null);
  const detailRequestId = useRef(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  async function load(type: ContentType, force = false) {
    if (items[type] && !force) return;
    try {
      setLoading(true); setError('');
      const result = await listPublicContent(type, locale, 50, 0);
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Array.isArray(result.items)) throw new Error('INVALID_CONTENT_LIST');
      setItems(previous => ({ ...previous, [type]: result.items }));
      setTotals(previous => ({ ...previous, [type]: verifiedTotal(result.total) }));
    } catch { setError('İçerikler şu anda yüklenemedi. Lütfen yeniden deneyin.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(active); }, [active, locale]);
  useEffect(() => { if (error) queueMicrotask(() => errorRef.current?.focus()); }, [error]);
  useEffect(() => {
    if (!authenticated) { setFavorites(new Set()); return; }
    listContentFavoriteReferences()
      .then(rows => setFavorites(new Set((Array.isArray(rows) ? rows : []).map((row: any) => String(row?.slug || row?.id || '')).filter(Boolean))))
      .catch(() => setFavorites(new Set()));
  }, [authenticated]);

  const activeIndex = tabs.findIndex(tab => tab.key === active);
  const visible = useMemo(() => {
    const list = items[active] || [];
    const activeLocale = searchLocale(locale);
    const needle = query.trim().toLocaleLowerCase(activeLocale);
    if (!needle) return list;
    return list.filter((item: any) => `${item?.title || ''} ${item?.summary || ''} ${item?.category || ''}`.toLocaleLowerCase(activeLocale).includes(needle));
  }, [items, active, query, locale]);

  function activateTab(index: number, focus = false) {
    const normalized = (index + tabs.length) % tabs.length;
    const next = tabs[normalized];
    setActive(next.key); setQuery(''); setError(''); setStatus('');
    if (focus) window.requestAnimationFrame(() => tabRefs.current[normalized]?.focus());
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); activateTab(index + 1, true); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); activateTab(index - 1, true); }
    else if (event.key === 'Home') { event.preventDefault(); activateTab(0, true); }
    else if (event.key === 'End') { event.preventDefault(); activateTab(tabs.length - 1, true); }
  }

  async function open(reference: string) {
    if (detailLoading) return;
    const normalized = String(reference || '').trim();
    if (!normalized) { setError('Bu içerik şu anda açılamıyor.'); return; }
    const requestId = ++detailRequestId.current;
    try {
      setDetailLoading(true); setOpeningReference(normalized); setError(''); setStatus('');
      const next = await getPublicContentEntry(normalized, locale);
      if (requestId !== detailRequestId.current) return;
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('INVALID_CONTENT_DETAIL');
      setDetail(next);
    } catch {
      if (requestId === detailRequestId.current) setError('İçerik şu anda açılamadı. Lütfen yeniden deneyin.');
    } finally {
      if (requestId === detailRequestId.current) { setDetailLoading(false); setOpeningReference(''); }
    }
  }

  function cancelDetailLoading() {
    detailRequestId.current += 1;
    setDetailLoading(false);
    setOpeningReference('');
  }

  async function favorite(item: any) {
    if (!authenticated) { onLoginRequired(); return; }
    const key = String(item?.slug || item?.id || '').trim();
    const title = String(item?.title || 'İçerik').trim();
    if (!key) { setError('Bu içerik şu anda favoriye eklenemiyor.'); return; }
    if (favoriteBusy) return;
    try {
      setFavoriteBusy(key); setError(''); setStatus('');
      const result = await toggleContentFavorite(key);
      if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.isFavorite !== 'boolean') throw new Error('INVALID_FAVORITE_RESULT');
      setFavorites(previous => {
        const next = new Set(previous);
        const resultKey = String(result.slug || key);
        if (result.isFavorite) next.add(resultKey);
        else { next.delete(resultKey); next.delete(key); }
        return next;
      });
      setStatus(result.isFavorite ? `${title} favorilerinize eklendi.` : `${title} favorilerinizden çıkarıldı.`);
    } catch { setError('Favori işlemi şu anda tamamlanamadı. Lütfen yeniden deneyin.'); }
    finally { setFavoriteBusy(null); }
  }

  const activeTab = tabs[activeIndex] || tabs[0];
  const activeTotal = totals[active];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <button type="button" onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Geri</button>
      <header className="overflow-hidden rounded-3xl bg-brand-green p-5 text-white shadow-sm sm:p-6"><div className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">Golden Oremar Bilgi Merkezi</div><h1 className="mt-1 text-3xl font-bold">Sağlık & Tarifler</h1><p className="mt-2 max-w-3xl text-white/80">Ürün güvenliği, saklama/kullanım rehberleri ve Golden Oremar tarifleri. Sağlık içerikleri tanı veya tedavi iddiası olarak sunulmaz.</p></header>

      <div className="mt-6 grid grid-cols-3 gap-2" role="tablist" aria-label="İçerik türleri">
        {tabs.map((tab, index) => { const Icon = tab.icon; const selected = active === tab.key; const total = totals[tab.key]; return <button ref={element => { tabRefs.current[index] = element; }} type="button" id={`health-tab-${tab.key}`} aria-controls="health-content-panel" key={tab.key} role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} onKeyDown={event => handleTabKeyDown(event, index)} onClick={() => activateTab(index)} className={`min-h-14 rounded-2xl border px-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${selected ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 dark:border-gray-700'}`}><Icon aria-hidden="true" className="mr-1 inline h-4 w-4" />{tab.label}{total != null ? ` (${total})` : ''}</button>; })}
      </div>
      <p className="mt-2 text-sm text-gray-500">{activeTab.description}</p>

      <label className="relative mt-5 block" htmlFor="health-content-search"><span className="sr-only">İçeriklerde ara</span><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" /><input id="health-content-search" type="search" value={query} maxLength={120} onChange={e => setQuery(e.target.value.slice(0, 120))} placeholder={`${activeTab.label} içinde ara`} className="min-h-12 w-full rounded-xl border bg-transparent pl-12 pr-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" />{query ? <button type="button" onClick={() => setQuery('')} aria-label="İçerik aramasını temizle" className="absolute right-1 top-1/2 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="h-4 w-4" /></button> : null}</label>
      {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}<button type="button" onClick={() => void load(active, true)} className="mt-3 block min-h-11 rounded-lg border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Listeyi yeniden yükle</button></div> : null}
      {status ? <div role="status" aria-live="polite" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}
      {loading ? <div role="status" aria-live="polite" className="mt-6 rounded-xl border p-6 text-center text-gray-500">İçerikler yükleniyor…</div> : null}

      <section id="health-content-panel" role="tabpanel" aria-labelledby={`health-tab-${active}`} className="outline-none">
        {!loading ? <div role="status" aria-live="polite" className="mt-4 text-sm text-gray-500">{visible.length} içerik gösteriliyor{activeTotal != null && !query ? ` • Toplam ${activeTotal}` : ''}.</div> : null}
        {!loading && !visible.length ? <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-gray-500">Bu bölümde eşleşen yayınlanmış içerik bulunmuyor.{query ? <button type="button" onClick={() => setQuery('')} className="mt-3 block min-h-11 w-full rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Aramayı temizle</button> : null}</div> : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item: any) => {
            const image = contentPublicUrl(item?.heroImagePath);
            const favoriteKey = String(item?.slug || item?.id || '').trim();
            const busy = favoriteBusy === favoriteKey;
            const opening = openingReference === String(item?.slug || '');
            const title = String(item?.title || 'Başlık yok');
            return <article key={String(item?.id || item?.slug)} aria-busy={busy || opening} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {image ? <button type="button" disabled={detailLoading || !item?.slug} onClick={() => void open(item.slug)} aria-label={`${title} içeriğini aç`} className="block w-full disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold"><img src={image} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" /></button> : null}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3"><button type="button" disabled={detailLoading || !item?.slug} onClick={() => void open(item.slug)} className="min-h-11 flex-1 text-left disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><h2 className="font-bold text-brand-green dark:text-brand-gold">{opening ? 'İçerik yükleniyor…' : title}</h2></button><button type="button" disabled={busy || !favoriteKey} onClick={() => void favorite(item)} aria-label={favorites.has(favoriteKey) ? `${title} içeriğini favorilerden çıkar` : `${title} içeriğini favoriye ekle`} aria-pressed={favorites.has(favoriteKey)} className="min-h-11 min-w-11 rounded-xl border p-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Heart aria-hidden="true" className={`mx-auto h-5 w-5 ${favorites.has(favoriteKey) ? 'fill-red-500 text-red-500' : ''}`} /></button></div>
                {item?.category ? <div className="mt-1 text-xs font-semibold text-brand-gold">{String(item.category)}</div> : null}
                {item?.summary ? <p className="mt-2 line-clamp-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{String(item.summary)}</p> : null}
                {item?.relatedProduct?.slug ? <button type="button" onClick={() => onOpenProduct?.(String(item.relatedProduct.slug))} className="mt-3 min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">İlgili ürünü aç</button> : null}
              </div>
            </article>;
          })}
        </div>
      </section>

      {detailLoading ? <ContentLoadingDialog onClose={cancelDetailLoading} /> : null}
      {detail ? <ContentDialog detail={detail} onClose={() => setDetail(null)} onOpenProduct={onOpenProduct} /> : null}
    </main>
  );
}

function ContentLoadingDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useAccessibleDialog<HTMLDivElement>(true, onClose);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="content-loading-title" tabIndex={-1} className="w-full max-w-sm rounded-2xl bg-white p-5 text-center text-brand-text shadow-xl outline-none dark:bg-gray-900"><h2 id="content-loading-title" className="font-bold">İçerik yükleniyor</h2><div role="status" aria-live="polite" className="mt-2 text-sm text-gray-500">İçerik hazırlanıyor…</div></div></div>;
}

function ContentDialog({ detail, onClose, onOpenProduct }: { detail: any; onClose: () => void; onOpenProduct?: (slug: string) => void }) {
  const image = contentPublicUrl(detail?.heroImagePath);
  const dialogRef = useAccessibleDialog<HTMLElement>(true, onClose);
  const title = String(detail?.title || 'İçerik');
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-4"><article ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="content-dialog-title" tabIndex={-1} className="mx-auto my-5 max-w-3xl overflow-hidden rounded-3xl bg-white text-brand-text shadow-xl outline-none dark:bg-gray-900">
    <div className="flex items-start justify-between gap-3 border-b p-5"><div><div className="text-xs font-bold uppercase tracking-wide text-brand-gold">{detail?.type === 'recipe' ? 'Tarif' : detail?.type === 'product_health' ? 'Ürün Bilgisi' : 'Rehber'}</div><h2 id="content-dialog-title" className="mt-1 text-2xl font-bold">{title}</h2></div><button type="button" onClick={onClose} aria-label="İçeriği kapat" className="min-h-11 min-w-11 rounded-full border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="mx-auto h-5 w-5" /></button></div>
    {image ? <img src={image} alt="" className="max-h-80 w-full object-cover" /> : null}
    <div className="p-5 sm:p-7">
      {detail?.summary ? <p className="mb-5 text-lg leading-7 text-gray-600 dark:text-gray-300">{String(detail.summary)}</p> : null}
      {detail?.type === 'product_health' ? <ProductSafetyPanel safety={detail.safety} summary={detail.summary} heading="Saklama, kullanım ve güvenlik" className="mb-5" /> : null}
      {detail?.sanitizedHtml ? <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: detail.sanitizedHtml }} /> : <div className="whitespace-pre-wrap leading-7 text-gray-700 dark:text-gray-300">{String(detail?.markdown || 'İçerik metni şu anda gösterilemiyor.')}</div>}
      {detail?.type !== 'recipe' ? <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Bu içerik genel ürün kullanımı ve gıda güvenliği bilgisidir; tanı veya tedavi önerisi değildir.</div> : null}
      {detail?.relatedProduct?.slug ? <button type="button" onClick={() => { onClose(); onOpenProduct?.(String(detail.relatedProduct.slug)); }} className="mt-5 min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">İlgili ürünü aç</button> : null}
    </div>
  </article></div>;
}
