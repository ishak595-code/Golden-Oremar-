import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Info, Shield, Undo2 } from 'lucide-react';
import { getPublicInfoPages } from './api';

type PageKey = 'about' | 'returns' | 'privacy' | 'terms';

const labels: Record<PageKey, { label: string; icon: any }> = {
  about: { label: 'Hakkımızda', icon: Info },
  returns: { label: 'İade ve İptal', icon: Undo2 },
  privacy: { label: 'Gizlilik ve Veri İşleme', icon: Shield },
  terms: { label: 'Kullanım Koşulları', icon: FileText },
};

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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const result = await getPublicInfoPages(locale);
        if (active) setData(result);
      } catch (err: any) {
        if (active) setError(err?.message || 'Bilgilendirme sayfası yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [locale]);

  const item = data?.[page];
  const meta = labels[page];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8" aria-labelledby="public-info-title">
      <div className="mb-5 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Önceki ekrana dön">
            <ArrowLeft className="mr-2 inline h-4 w-4" />Geri
          </button>
        ) : null}
        <div>
          <h1 id="public-info-title" className="text-2xl font-bold text-brand-green dark:text-brand-gold">{item?.title || meta.label}</h1>
          {item?.summary ? <p className="mt-1 text-sm text-gray-500">{item.summary}</p> : null}
        </div>
      </div>

      <nav aria-label="Bilgilendirme sayfaları" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(labels) as PageKey[]).map((key) => {
          const Icon = labels[key].icon;
          const available = !!data?.[key];
          return (
            <button
              key={key}
              type="button"
              disabled={!available}
              aria-current={key === page ? 'page' : undefined}
              onClick={() => available && onSelectPage?.(key)}
              className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${key === page ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : ''}`}
            >
              <Icon className="mr-2 inline h-4 w-4" />{labels[key].label}
            </button>
          );
        })}
      </nav>

      {loading ? <div role="status" aria-live="polite" className="rounded-xl border p-6 text-center text-gray-500">Sayfa yükleniyor…</div> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div> : null}

      {!loading && !error && !item ? (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-bold">Bu metin henüz yayınlanmadı</h2>
          <p className="mt-2 text-sm">Golden Oremar doğrulanmamış veya eksik bir hukuk metnini kullanıcıya nihai metin gibi göstermiyor.</p>
        </div>
      ) : null}

      {!loading && item ? (
        <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">
          {item.sanitizedHtml ? (
            <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: item.sanitizedHtml }} />
          ) : (
            <div className="whitespace-pre-wrap leading-7">{item.markdown || 'İçerik yayınlanmamış.'}</div>
          )}
          <p className="mt-6 border-t pt-4 text-xs text-gray-500">
            Yayın kaydı: {item.publishedAt ? new Date(item.publishedAt).toLocaleString('tr-TR') : 'tarih belirtilmedi'}
          </p>
        </article>
      ) : null}
    </main>
  );
}
