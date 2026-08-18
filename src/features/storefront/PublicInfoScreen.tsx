import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Info, Shield, Undo2 } from 'lucide-react';
import { getPublicInfoPages } from './api';

type PageKey = 'about' | 'returns' | 'privacy' | 'terms';

const labels: Record<PageKey, { label: string; icon: any }> = {
  about: { label: 'Hakkımızda', icon: Info },
  returns: { label: 'İade ve İptal', icon: Undo2 },
  privacy: { label: 'Gizlilik ve Veri İşleme', icon: Shield },
  terms: { label: 'Kullanım Koşulları', icon: FileText },
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeText(value: unknown, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDocument(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized.length <= 200000 ? normalized : '';
}

function safeHref(value: string) {
  const href = value.trim();
  if (/^https:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) return href;
  return '';
}

function renderSafeNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map((child, index) => renderSafeNode(child, `${key}-${index}`));
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') return <h2 key={key} className="mt-7 text-xl font-bold text-brand-green first:mt-0 dark:text-brand-gold">{children}</h2>;
  if (tag === 'p') return <p key={key} className="mt-3 leading-7 text-gray-700 dark:text-gray-300">{children}</p>;
  if (tag === 'ul') return <ul key={key} className="mt-3 list-disc space-y-2 pl-6 text-gray-700 dark:text-gray-300">{children}</ul>;
  if (tag === 'ol') return <ol key={key} className="mt-3 list-decimal space-y-2 pl-6 text-gray-700 dark:text-gray-300">{children}</ol>;
  if (tag === 'li') return <li key={key}>{children}</li>;
  if (tag === 'strong' || tag === 'b') return <strong key={key}>{children}</strong>;
  if (tag === 'em' || tag === 'i') return <em key={key}>{children}</em>;
  if (tag === 'br') return <br key={key} />;
  if (tag === 'a') {
    const href = safeHref(element.getAttribute('href') || '');
    return href ? <a key={key} href={href} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined} className="font-semibold text-brand-green underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:text-brand-gold">{children}</a> : <React.Fragment key={key}>{children}</React.Fragment>;
  }
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

function PublishedBody({ source }: { source: string }) {
  if (!source) return null;
  if (typeof DOMParser === 'undefined') return <div className="whitespace-pre-wrap break-words leading-7 text-gray-700 dark:text-gray-300">{source.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</div>;
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  return <div className="break-words">{Array.from(parsed.body.childNodes).map((node, index) => renderSafeNode(node, `public-info-${index}`))}</div>;
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
        {onBack ? (
          <button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold" aria-label="Önceki ekrana dön">
            <ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Geri
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} id="public-info-title" className="text-2xl font-bold text-brand-green outline-none dark:text-brand-gold">{safeText(item?.title, 240) || meta.label}</h1>
          {safeText(item?.summary, 1200) ? <p className="mt-1 text-sm text-gray-500">{safeText(item.summary, 1200)}</p> : null}
        </div>
      </div>

      <nav aria-label="Bilgilendirme sayfaları" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(labels) as PageKey[]).map((key) => {
          const Icon = labels[key].icon;
          const available = Boolean(data?.[key]);
          return (
            <button
              key={key}
              type="button"
              disabled={!available}
              aria-current={key === activePage ? 'page' : undefined}
              aria-label={!available ? `${labels[key].label}, henüz yayınlanmadı` : labels[key].label}
              onClick={() => selectPage(key)}
              className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${key === activePage ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : ''}`}
            >
              <Icon aria-hidden="true" className="mr-2 inline h-4 w-4" />{labels[key].label}
            </button>
          );
        })}
      </nav>

      {loading ? <div role="status" aria-live="polite" className="rounded-xl border p-6 text-center text-gray-500">Sayfa yükleniyor…</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}

      {!loading && !error && !item ? (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <h2 className="font-bold">Bu metin henüz yayınlanmadı</h2>
          <p className="mt-2 text-sm">Golden Oremar doğrulanmamış veya eksik bir hukuk metnini kullanıcıya nihai metin gibi göstermiyor.</p>
        </div>
      ) : null}

      {!loading && !error && item ? (
        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
          {source ? <PublishedBody source={source} /> : <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Yayın kaydının içerik gövdesi doğrulanamadı.</div>}
          <p className="mt-6 border-t pt-4 text-xs text-gray-500">
            Yayın kaydı: {publicationDate || 'Tarih doğrulanamadı'}
          </p>
        </article>
      ) : null}
    </main>
  );
}