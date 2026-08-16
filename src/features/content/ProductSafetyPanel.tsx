import React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldCheck } from 'lucide-react';

type SafetySection = { title?: string; items?: unknown[] };
type SafetyWarning = { code?: string; severity?: string; text?: string };
type SafetySource = { authority?: string; title?: string; url?: string; topic?: string; accessedAt?: string };

type SafetyPayload = {
  schemaVersion?: number;
  guidanceKind?: string;
  safetyClass?: string;
  storage?: SafetySection;
  preparation?: SafetySection;
  warnings?: SafetyWarning[];
  allergens?: { known?: unknown[]; verifyLabel?: boolean; text?: string };
  verificationNeeded?: unknown[];
  claimPolicy?: string;
  sources?: SafetySource[];
};

export default function ProductSafetyPanel({
  safety,
  summary,
  heading = 'Güvenli saklama ve kullanım',
  className = '',
}: {
  safety?: SafetyPayload | null;
  summary?: string | null;
  heading?: string;
  className?: string;
}) {
  if (!safety || Number(safety.schemaVersion || 0) < 2) return null;

  const storage = strings(safety.storage?.items);
  const preparation = strings(safety.preparation?.items);
  const verification = strings(safety.verificationNeeded);
  const knownAllergens = strings(safety.allergens?.known);
  const warnings = Array.isArray(safety.warnings)
    ? safety.warnings.filter(item => item && typeof item.text === 'string' && item.text.trim())
    : [];
  const sources = Array.isArray(safety.sources)
    ? safety.sources.filter(item => item && typeof item.url === 'string' && /^https:\/\//i.test(item.url))
    : [];
  const isNonFood = safety.guidanceKind === 'non_food_safety';

  return <section aria-labelledby="product-safety-title" className={`rounded-2xl border border-brand-green/20 bg-brand-green/[0.03] p-5 ${className}`}>
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-green/10 text-brand-green"><ShieldCheck aria-hidden="true" className="h-5 w-5" /></div>
      <div className="min-w-0">
        <h2 id="product-safety-title" className="text-xl font-bold">{heading}</h2>
        {summary ? <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{summary}</p> : null}
      </div>
    </div>

    {warnings.length ? <div className="mt-4 space-y-2">
      {warnings.map((warning, index) => {
        const high = warning.severity === 'high';
        return <div key={`${warning.code || 'warning'}:${index}`} className={`rounded-xl border p-3 text-sm leading-6 ${high ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100'}`}>
          <div className="flex gap-2">{high ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<span>{warning.text}</span></div>
        </div>;
      })}
    </div> : null}

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <InfoCard title={safety.storage?.title || 'Saklama'} items={storage} />
      <InfoCard title={safety.preparation?.title || (isNonFood ? 'Güvenli kullanım' : 'Hazırlama / kullanım')} items={preparation} />
    </div>

    {safety.allergens?.text || knownAllergens.length ? <div className="mt-3 rounded-xl border bg-white p-4 dark:bg-gray-900">
      <h3 className="font-bold">{isNonFood ? 'Ürün sınıfı' : 'Alerjen bilgisi'}</h3>
      {knownAllergens.length ? <p className="mt-1 text-sm"><strong>Bilinen:</strong> {knownAllergens.join(', ')}</p> : null}
      {safety.allergens?.text ? <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{safety.allergens.text}</p> : null}
    </div> : null}

    {verification.length ? <div className="mt-3 rounded-xl border border-dashed bg-white p-4 dark:bg-gray-900">
      <h3 className="flex items-center gap-2 font-bold"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand-green" />Ürüne özel doğrulanması gerekenler</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-600 dark:text-gray-300">{verification.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ul>
    </div> : null}

    {safety.claimPolicy ? <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{safety.claimPolicy}</p> : null}

    {sources.length ? <details className="mt-4 rounded-xl border bg-white p-4 dark:bg-gray-900">
      <summary className="min-h-11 cursor-pointer font-bold">Resmî kaynaklar ({sources.length})</summary>
      <ul className="mt-2 space-y-2">{sources.map((source, index) => <li key={`${source.url}:${index}`}>
        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-green underline underline-offset-2">
          <span>{source.authority ? `${source.authority}: ` : ''}{source.title || source.topic || 'Kaynak'}</span><ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
        </a>
        {source.topic ? <div className="text-xs text-gray-500">{source.topic}</div> : null}
      </li>)}</ul>
    </details> : null}
  </section>;
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <div className="rounded-xl border bg-white p-4 dark:bg-gray-900"><h3 className="font-bold">{title}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-gray-600 dark:text-gray-300">{items.map((item, index) => <li key={`${item}:${index}`}>{item}</li>)}</ul></div>;
}

function strings(values: unknown[] | undefined) {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string' && !!value.trim()) : [];
}
