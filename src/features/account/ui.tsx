import React, { useId } from 'react';

export function Panel({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6"
    >
      <h2 id={titleId} data-account-panel-heading tabIndex={-1} className="text-xl font-bold text-brand-green outline-none dark:text-brand-gold">{title}</h2>
      {description ? <p id={descriptionId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function LoadingState({ label = 'Yükleniyor' }: { label?: string }) {
  return <div role="status" aria-live="polite" aria-atomic="true" className="py-8 text-center text-gray-500">{label}…</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200">
      <p>{message}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800">Tekrar dene</button> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-7 text-center dark:border-gray-700">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Money({ minor, currency = 'TRY' }: { minor: number; currency?: string }) {
  const amountMinor = Number(minor);
  const normalizedCurrency = String(currency || '').trim().toUpperCase();
  const validAmount = Number.isSafeInteger(amountMinor);
  const validCurrency = /^[A-Z]{3}$/.test(normalizedCurrency);

  if (!validAmount || !validCurrency) {
    return <span role="status" className="text-red-700 dark:text-red-300">Tutar doğrulanamadı</span>;
  }

  try {
    return <>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: normalizedCurrency }).format(amountMinor / 100)}</>;
  } catch {
    return <span role="status" className="text-red-700 dark:text-red-300">Tutar doğrulanamadı</span>;
  }
}
