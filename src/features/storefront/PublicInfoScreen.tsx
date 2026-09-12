import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Info, Shield, Undo2 } from 'lucide-react';
import SafePublishedBody from '../content/SafePublishedBody';
import { getPublicInfoPages } from './api';

type PageKey = 'about' | 'returns' | 'privacy' | 'terms';

const labels: Record<PageKey, { label: string; icon: any }> = {
  about: { label: 'Hakkımızda', icon: Info },
  returns: { label: 'İade ve İptal', icon: Undo2 },
  privacy: { label: 'Gizlilik ve Veri İşleme', icon: Shield },
  terms: { label: 'Kullanım Koşulları', icon: FileText },
};

function safeText(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDocument(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized.length <= 200000 ? normalized : '';
}

function safeDate(value: unknown) {
  const raw = safeText(value, 80);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(date); }
  catch { return ''; }
}

export default function PublicInfoScreen({
  page = 'about',
  locale = 'tr',
  onBack,
  onSelectPage,
}: {
  page?: PageKey;
  locale?: string;
  onBack?: () => void;
  onSelectPage?: (page: PageKey) => void;
}) {
  const [data, setData] = useState<Record<PageKey, any | null> | null>(null);
  const [activePage, setActivePage] = useState<PageKey>(page);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => { setActivePage(page); }, [page]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const result = await getPublicInfoPages(locale);
        if (active) setData(result);
      } catch (err: any) {
        if (active) {
          setData(null);
          setError(err?.message || 'Bilgilendirme sayfası yüklenemedi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!loading) requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }, [loading, activePage]);

  const item = data?.[activePage] || null;
  const meta = labels[activePage];
  const source = item ? safeDocument(item.sanitizedHtml) || safeDocument(item.markdown) : '';
  const publicationDate = safeDate(item?.updatedAt || item?.publishedAt);

  function selectPage(next: PageKey) {
    if (!data?.[next]) return;
    setActivePage(next);
    onSelectPage?.(next);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8" aria-labelledby="public-info-title">
      <div className="mb-5 flex items-start gap-3">
        {onBack ? <button type="button" onClick={onBack} className="min-h-11 rounded-xl border-2 border-gray-200 bg-white px-4 font-bold shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600" aria-label="Önceki ekrana dön"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Geri</button> : null}
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} id="public-info-title" className="text-2xl font-black text-brand-green outline-none dark:text-brand-gold">{safeText(item?.title, 240) || meta.label}</h1>
          {safeText(item?.summary, 1200) ? <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{safeText(item.summary, 1200)}</p> : null}
        </div>
      </div>

      <nav aria-label="Bilgilendirme sayfaları" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(labels) as PageKey[]).map(key => {
          const Icon = labels[key].icon;
          const available = Boolean(data?.[key]);
          return <button key={key} type="button" disabled={!available} aria-current={key === activePage ? 'page' : undefined} aria-label={!available ? `${labels[key].label}, henüz yayınlanmadı` : labels[key].label} onClick={() => selectPage(key)} className={`min-h-11 shrink-0 rounded-xl border-2 px-3 text-sm font-bold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${key === activePage ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 bg-white hover:border-brand-gold/30 hover:bg-brand-gold/5 dark:border-gray-700 dark:bg-gray-900'}`}><Icon aria-hidden="true" className="mr-2 inline h-4 w-4" />{labels[key].label}</button>;
        })}
      </nav>

      {loading ? <div role="status" aria-live="polite" className="rounded-xl border-2 border-gray-200 bg-gray-50 p-6 text-center font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900/50">Sayfa yükleniyor…</div> : null}
      {error ? <div role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-4 font-semibold leading-relaxed text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">⚠️ {error}</div> : null}
      {!loading && !error && !item ? <div role="status" className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30"><h2 className="font-black text-amber-900 dark:text-amber-100">Bu metin henüz yayınlanmadı</h2><p className="mt-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200">Golden Oremar doğrulanmamış veya eksik bir hukuk metnini kullanıcıya nihai metin gibi göstermiyor.</p></div> : null}
      {!loading && !error && item ? <article className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:p-7">{source ? <SafePublishedBody source={source} /> : <div role="status" className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 font-semibold leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">⚠️ Yayın kaydının içerik gövdesi doğrulanamadı.</div>}<p className="mt-6 border-t-2 border-gray-200 pt-4 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">Yayın kaydı: {publicationDate || 'Tarih doğrulanamadı'}</p></article> : null}
    </main>
  );
}
