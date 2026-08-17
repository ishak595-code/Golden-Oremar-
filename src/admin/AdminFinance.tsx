import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, Loader2, RefreshCw, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminErrorMessage, adminFinanceReport, minorToMajor, minorToTry, type AdminFinanceReport } from './supabaseAdminApi';

type RangeKey = '7days' | '30days' | 'thisMonth' | 'lastMonth';

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveRange(key: RangeKey) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (key === 'thisMonth') return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1, 12)), to: dateKey(today) };
  if (key === 'lastMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12);
    const to = new Date(today.getFullYear(), today.getMonth(), 0, 12);
    return { from: dateKey(from), to: dateKey(to) };
  }
  const days = key === '30days' ? 29 : 6;
  const from = new Date(today);
  from.setDate(today.getDate() - days);
  return { from: dateKey(from), to: dateKey(today) };
}

function csvCell(value: string | number) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function AdminFinance() {
  const [report, setReport] = useState<AdminFinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<RangeKey>('7days');

  const range = useMemo(() => resolveRange(dateRange), [dateRange]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await adminFinanceReport(range.from, range.to));
    } catch (err) {
      setReport(null);
      setError(adminErrorMessage(err, 'Finans raporu yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [range.from, range.to]);

  const chartData = useMemo(() => (report?.daily_sales || []).map(day => ({
    date: new Date(`${day.date}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
    netSales: minorToMajor(day.net_sales_minor),
    grossSales: minorToMajor(day.gross_sales_minor),
    refunds: minorToMajor(day.refund_minor),
  })), [report]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Golden Oremar Finans Raporu', `${report.from} / ${report.to}`],
      ['Para Birimi', report.currency],
      ['Sipariş Sayısı', report.totals.order_count],
      ['Brüt Satış', minorToMajor(report.totals.gross_sales_minor)],
      ['İade', minorToMajor(report.totals.refund_minor)],
      ['Net Satış', minorToMajor(report.totals.net_sales_minor)],
      ['Platform Komisyonu', minorToMajor(report.totals.commission_minor)],
      ['Tahmini Satıcı Hakedişi', minorToMajor(report.totals.estimated_payout_minor)],
      [],
      ['Gün', 'Sipariş', 'Brüt Satış', 'İade', 'Net Satış'],
      ...report.daily_sales.map(day => [day.date, day.order_count, minorToMajor(day.gross_sales_minor), minorToMajor(day.refund_minor), minorToMajor(day.net_sales_minor)]),
      [],
      ['Satıcı', 'Sipariş', 'Brüt Satış', 'Komisyon', 'Tahmini Hakediş'],
      ...report.vendor_income.map(vendor => [vendor.vendor_name, vendor.order_count, minorToMajor(vendor.gross_sales_minor), minorToMajor(vendor.commission_minor), minorToMajor(vendor.estimated_payout_minor)]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `golden-oremar-finans-${report.from}-${report.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const totals = report?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Finans Raporları</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sadece Supabase üzerinde doğrulanmış sipariş, iade, komisyon ve tahmini hakediş verileri gösterilir.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <span className="sr-only">Rapor tarih aralığı</span>
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <select value={dateRange} onChange={event => setDateRange(event.target.value as RangeKey)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-auto">
              <option value="7days">Son 7 gün</option><option value="30days">Son 30 gün</option><option value="thisMonth">Bu ay</option><option value="lastMonth">Geçen ay</option>
            </select>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
          <button type="button" onClick={exportCsv} disabled={!report || loading} className="min-h-11 rounded-xl bg-brand-green px-4 py-2 text-white flex items-center justify-center gap-2 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" /> CSV</button>
        </div>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">Rapor aralığı: <strong className="text-gray-700 dark:text-gray-200">{range.from} - {range.to}</strong></div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
      {loading && <div role="status" className="flex min-h-32 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Finans verileri yükleniyor...</div>}

      {!loading && report && totals && <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-center gap-2 text-sm text-gray-500"><TrendingUp className="h-5 w-5 text-green-600" aria-hidden="true" /> Brüt satış</div><div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{minorToTry(totals.gross_sales_minor)} TRY</div><div className="mt-1 text-xs text-gray-500">{totals.order_count.toLocaleString('tr-TR')} ücretli sipariş</div></div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-center gap-2 text-sm text-gray-500"><TrendingDown className="h-5 w-5 text-orange-600" aria-hidden="true" /> İadeler</div><div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{minorToTry(totals.refund_minor)} TRY</div><div className="mt-1 text-xs text-gray-500">Başarılı refund hareketleri</div></div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-center gap-2 text-sm text-gray-500"><WalletCards className="h-5 w-5 text-blue-600" aria-hidden="true" /> Net satış</div><div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{minorToTry(totals.net_sales_minor)} TRY</div><div className="mt-1 text-xs text-gray-500">Brüt satış eksi başarılı iadeler</div></div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-sm text-gray-500">Platform komisyonu</div><div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{minorToTry(totals.commission_minor)} TRY</div><div className="mt-1 text-xs text-gray-500">Tahmini satıcı hakedişi: {minorToTry(totals.estimated_payout_minor)} TRY</div></div>
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="sales-chart-title">
          <h3 id="sales-chart-title" className="text-lg font-bold text-gray-900 dark:text-white">Günlük net satış</h3>
          <p className="mt-1 text-xs text-gray-500">Grafik TRY bazındadır.</p>
          <div className="mt-5 h-72 w-full" aria-label="Günlük net satış grafiği">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} /><YAxis axisLine={false} tickLine={false} fontSize={12} width={60} /><Tooltip formatter={(value: number) => [`${Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TRY`, 'Net satış']} /><Area type="monotone" dataKey="netSales" stroke="currentColor" fill="currentColor" fillOpacity={0.12} /></AreaChart></ResponsiveContainer>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="vendor-income-title">
          <div className="border-b border-gray-100 p-5 dark:border-gray-700"><h3 id="vendor-income-title" className="text-lg font-bold text-gray-900 dark:text-white">Satıcı Gelirleri</h3><p className="mt-1 text-xs text-gray-500">Hakediş değeri rapor anındaki tahmindir. Gerçek payout kaydı oluşmadan ödeme yapılmış gibi gösterilmez.</p></div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">{report.vendor_income.map(vendor => <article key={vendor.producer_id} className="p-4"><h4 className="font-semibold text-gray-900 dark:text-white">{vendor.vendor_name}</h4><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-gray-500">Brüt satış</dt><dd>{minorToTry(vendor.gross_sales_minor)} TRY</dd></div><div><dt className="text-xs text-gray-500">Komisyon</dt><dd>{minorToTry(vendor.commission_minor)} TRY</dd></div><div><dt className="text-xs text-gray-500">Tahmini hakediş</dt><dd className="font-semibold text-green-700 dark:text-green-300">{minorToTry(vendor.estimated_payout_minor)} TRY</dd></div><div><dt className="text-xs text-gray-500">Sipariş</dt><dd>{vendor.order_count}</dd></div></dl></article>)}</div>
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Satıcı</th><th className="px-6 py-4">Sipariş</th><th className="px-6 py-4">Brüt satış</th><th className="px-6 py-4">Komisyon</th><th className="px-6 py-4">Tahmini hakediş</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{report.vendor_income.map(vendor => <tr key={vendor.producer_id}><td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{vendor.vendor_name}</td><td className="px-6 py-4">{vendor.order_count}</td><td className="px-6 py-4">{minorToTry(vendor.gross_sales_minor)} TRY</td><td className="px-6 py-4">{minorToTry(vendor.commission_minor)} TRY</td><td className="px-6 py-4 font-semibold text-green-700 dark:text-green-300">{minorToTry(vendor.estimated_payout_minor)} TRY</td></tr>)}</tbody></table></div>
          {report.vendor_income.length === 0 && <div className="p-8 text-center text-gray-500">Bu tarih aralığında doğrulanmış satıcı geliri yok.</div>}
        </section>
      </>}
    </div>
  );
}
