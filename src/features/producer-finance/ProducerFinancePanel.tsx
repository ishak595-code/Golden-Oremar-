import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { getProducerFinance, listProducerPayouts } from './api';
import { ErrorState, LoadingState, Money, Panel } from '../account/ui';

const payoutLabel: Record<string, string> = {
  scheduled: 'Planlandı',
  processing: 'İşleniyor',
  paid: 'Ödendi',
  failed: 'Başarısız',
  cancelled: 'İptal edildi',
};

export default function ProducerFinancePanel({ onBack }: { onBack: () => void }) {
  const [balances, setBalances] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [balanceRows, payoutRows] = await Promise.all([
        getProducerFinance(),
        listProducerPayouts(20, 0),
      ]);
      setBalances(balanceRows || []);
      setPayouts(payoutRows || []);
    } catch (err: any) {
      setError(err?.message || 'Finans bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <LoadingState label="Satıcı finans bilgileri yükleniyor" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Satıcı paneline dön">
          <ArrowLeft className="mr-2 inline h-4 w-4" />Geri
        </button>
        <button onClick={() => void load()} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Finans bilgilerini yenile">
          <RefreshCw className="mr-2 inline h-4 w-4" />Yenile
        </button>
      </div>

      <Panel title="Finans ve Bakiye" description="Bakiyeler yalnız tamamlanan ve muhasebeleşen sipariş hareketlerinden hesaplanır.">
        {!balances.length ? (
          <p className="text-sm text-gray-500">Henüz finans hareketi yok.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {balances.map((balance: any) => (
              <div key={balance.currency} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">{balance.currency || 'TRY'}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Metric label="Kullanılabilir" value={<Money minor={Number(balance.availableMinor || 0)} currency={balance.currency || 'TRY'} />} />
                  <Metric label="Bekleyen" value={<Money minor={Number(balance.pendingMinor || 0)} currency={balance.currency || 'TRY'} />} />
                  <Metric label="Net satış" value={<Money minor={Number(balance.netSalesMinor || 0)} currency={balance.currency || 'TRY'} />} />
                  <Metric label="Ödenen" value={<Money minor={Number(balance.paidMinor || 0)} currency={balance.currency || 'TRY'} />} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Ödeme Geçmişi" description="Planlanan ve tamamlanan satıcı ödemeleriniz.">
        {!payouts.length ? (
          <p className="text-sm text-gray-500">Henüz payout kaydı yok.</p>
        ) : (
          <div className="space-y-3">
            {payouts.map((payout: any) => (
              <article key={payout.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold"><Money minor={Number(payout.amount_minor || 0)} currency={payout.currency || 'TRY'} /></div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold dark:bg-gray-800">
                    {payoutLabel[payout.status] || payout.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-500">Oluşturulma: {formatDate(payout.created_at)}</div>
                {payout.scheduled_at ? <div className="text-sm text-gray-500">Planlanan: {formatDate(payout.scheduled_at)}</div> : null}
                {payout.processed_at ? <div className="text-sm text-gray-500">İşlendi: {formatDate(payout.processed_at)}</div> : null}
                {payout.status === 'failed' && payout.note ? <div role="status" className="mt-2 text-sm text-red-700">{payout.note}</div> : null}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
          <p>Para çekme işlemi burada simüle edilmez. Gerçek ödeme sağlayıcısı ve payout politikası tamamlanana kadar ödeme planlama platform yönetimi tarafından yapılır; bu ekran yalnız gerçek bakiye ve gerçek ödeme kayıtlarını gösterir.</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 font-bold">{value}</div></div>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}
