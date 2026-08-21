import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';
import {
  adminEventRefundError,
  listAdminEventRefunds,
  retryAdminEventRefund,
  type AdminEventRefundItem,
} from './eventRefundAdminApi';

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(minor / 100);
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : 'Yok';
}

export default function AdminEventRefunds() {
  const [items, setItems] = useState<AdminEventRefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmItem, setConfirmItem] = useState<AdminEventRefundItem | null>(null);
  const confirmDialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(confirmItem), () => {
    if (!busy) setConfirmItem(null);
  });

  async function load() {
    try {
      setLoading(true);
      setError('');
      setItems(await listAdminEventRefunds());
    } catch (e) {
      setError(adminEventRefundError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(item.currency, (totals.get(item.currency) || 0) + item.amountMinor);
    }
    return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [items]);

  const totalRiskLabel = totalsByCurrency.length
    ? totalsByCurrency.map(([currency, total]) => money(total, currency)).join(' + ')
    : '0';

  async function retry(item: AdminEventRefundItem) {
    try {
      setBusy(item.reservationId);
      setError('');
      setNotice('');
      await retryAdminEventRefund(item.reservationId);
      setConfirmItem(null);
      setNotice(`${item.reservationCode} için iyzico iadesi doğrulandı.`);
      await load();
    } catch (e) {
      setError(adminEventRefundError(e));
    } finally {
      setBusy('');
    }
  }

  function requestRetry(item: AdminEventRefundItem) {
    if (busy) return;
    if (item.attemptCount > 0) {
      setConfirmItem(item);
      return;
    }
    void retry(item);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-red-700">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Super Admin finans güvenliği</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold">Etkinlik İade Kuyruğu</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Ödeme alındıktan sonra kapasite değiştiği için otomatik onaylanamayan etkinlik rezervasyonları.
            Bu kayıtlarda üretici hakedişi oluşturulmaz.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || Boolean(busy)}
          className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Bekleyen kayıt" value={String(items.length)} />
        <Metric label="Toplam risk tutarı" value={totalRiskLabel} />
        <Metric label="Tekrar deneme görmüş" value={String(items.filter((item) => item.attemptCount > 0).length)} />
      </div>

      {loading ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border">
          <Loader2 className="h-5 w-5 animate-spin" />
          İade kuyruğu yükleniyor...
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.reservationId} className="rounded-2xl border bg-white p-4 dark:bg-gray-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{item.eventTitle}</h3>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">İade gerekli</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Rezervasyon: {item.reservationCode}</p>
                  <p className="mt-2 text-lg font-bold">{money(item.amountMinor, item.currency)}</p>
                  <p className="mt-2 break-all text-xs text-gray-500">Provider ref: {item.providerReference}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Deneme: {item.attemptCount} • Son deneme: {date(item.lastAttemptAt)}
                  </p>
                  {item.lastError ? (
                    <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {item.lastError}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => requestRetry(item)}
                  disabled={Boolean(busy)}
                  className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50"
                  aria-label={`${item.reservationCode} rezervasyonu için iyzico iadesini dene`}
                >
                  <RotateCcw className="mr-2 inline h-4 w-4" />
                  {busy === item.reservationId ? 'İade deneniyor...' : 'iyzico iadeyi dene'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <strong>Bekleyen iade yok.</strong>
          <p className="mt-1 text-sm">Etkinlik tahsilatlarında açık finansal iade kuyruğu bulunmuyor.</p>
        </div>
      )}

      {confirmItem ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6">
          <div
            ref={confirmDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="event-refund-confirm-title"
            aria-describedby="event-refund-confirm-description"
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-900"
          >
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <h3 id="event-refund-confirm-title" className="text-lg font-bold">
                  İkinci iade riskini doğrula
                </h3>
                <p id="event-refund-confirm-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {confirmItem.reservationCode} kaydı daha önce {confirmItem.attemptCount} iade denemesi gördü.
                  iyzico işlem sonucunu doğrulamadan tekrar denemek çift iade riski oluşturabilir.
                </p>
                <p className="mt-3 font-bold">{money(confirmItem.amountMinor, confirmItem.currency)}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                disabled={Boolean(busy)}
                className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void retry(confirmItem)}
                disabled={Boolean(busy)}
                className="min-h-11 rounded-xl bg-red-700 px-4 font-bold text-white disabled:opacity-50"
              >
                {busy === confirmItem.reservationId ? 'İade deneniyor...' : 'Kontrol ettim, tekrar dene'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 dark:bg-gray-900">
      <div className="break-words text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
