import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Boxes, Eye, Loader2, Package, RefreshCw, Search, TrendingDown } from 'lucide-react';
import { adminListInventory, inventoryAdminErrorMessage, inventoryMoney, type AdminInventoryRow } from './inventoryAdminApi';

export function AdminStock({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [rows, setRows] = useState<AdminInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'low' | 'out' | 'all'>('low');
  const [selected, setSelected] = useState<AdminInventoryRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await adminListInventory());
    } catch (err) {
      setError(inventoryAdminErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const trackedRows = useMemo(() => rows.filter(row => ['tracked', 'seasonal'].includes(row.stock_mode)), [rows]);
  const reports = useMemo(() => ({
    low: trackedRows.filter(row => row.sellable_quantity > 0 && row.sellable_quantity <= Math.max(1, row.reorder_level)).length,
    out: trackedRows.filter(row => row.sellable_quantity === 0).length,
    reserved: trackedRows.reduce((sum, row) => sum + row.reserved_quantity, 0),
    variants: rows.length,
  }), [trackedRows, rows.length]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return rows.filter(row => {
      if (view === 'out' && !(row.stock_mode === 'tracked' || row.stock_mode === 'seasonal') || view === 'out' && row.sellable_quantity !== 0) return false;
      if (view === 'low' && (!(row.stock_mode === 'tracked' || row.stock_mode === 'seasonal') || row.sellable_quantity <= 0 || row.sellable_quantity > Math.max(1, row.reorder_level))) return false;
      if (!q) return true;
      return `${row.product_name} ${row.variant_name} ${row.sku || ''} ${row.producer_name}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [rows, searchTerm, view]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Stok Gözetimi</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Bu ekran gerçek varyant stoğunu, rezervasyonu ve yeniden sipariş seviyesini denetler. Stok miktarını yönetici adına sessizce değiştirmiyoruz. Stok mutasyonu satıcıya ait ve sürüm kontrollü üretici API'sinden yapılır.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={() => setView('low')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'low' ? 'border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20' : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'}`}><div className="flex items-center justify-between gap-3"><AlertTriangle className="h-5 w-5 text-orange-600" aria-hidden="true" /><span className="text-2xl font-bold text-gray-900 dark:text-white">{reports.low}</span></div><div className="mt-3 font-semibold text-gray-900 dark:text-white">Kritik stok</div><div className="mt-1 text-xs text-gray-500">Satılabilir stok yeniden sipariş seviyesinde</div></button>
        <button type="button" onClick={() => setView('out')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'out' ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20' : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'}`}><div className="flex items-center justify-between gap-3"><TrendingDown className="h-5 w-5 text-red-600" aria-hidden="true" /><span className="text-2xl font-bold text-gray-900 dark:text-white">{reports.out}</span></div><div className="mt-3 font-semibold text-gray-900 dark:text-white">Tükenen varyant</div><div className="mt-1 text-xs text-gray-500">Satılabilir miktar sıfır</div></button>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="flex items-center justify-between gap-3"><Boxes className="h-5 w-5 text-blue-600" aria-hidden="true" /><span className="text-2xl font-bold text-gray-900 dark:text-white">{reports.reserved.toLocaleString('tr-TR')}</span></div><div className="mt-3 font-semibold text-gray-900 dark:text-white">Rezerve stok</div><div className="mt-1 text-xs text-gray-500">Aktif siparişler için ayrılmış toplam adet</div></div>
        <button type="button" onClick={() => setView('all')} className={`rounded-2xl border p-4 text-left shadow-sm ${view === 'all' ? 'border-brand-green/50 bg-green-50 dark:bg-green-950/20' : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'}`}><div className="flex items-center justify-between gap-3"><Package className="h-5 w-5 text-brand-green" aria-hidden="true" /><span className="text-2xl font-bold text-gray-900 dark:text-white">{reports.variants.toLocaleString('tr-TR')}</span></div><div className="mt-3 font-semibold text-gray-900 dark:text-white">Tüm varyantlar</div><div className="mt-1 text-xs text-gray-500">Aktif ve pasif varyant kayıtları</div></button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Stok listesi">
        <div className="border-b border-gray-100 p-4 dark:border-gray-700"><label className="relative block max-w-xl"><span className="sr-only">Stokta ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Ürün, varyant, SKU veya üretici ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label></div>

        {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Stok bilgileri yükleniyor...</div> : <>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">{filtered.map(row => <article key={row.variant_id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-gray-900 dark:text-white">{row.product_name}</h3><p className="mt-1 truncate text-xs text-gray-500">{row.variant_name} · {row.sku || 'SKU yok'} · {row.producer_name}</p></div><button type="button" onClick={() => setSelected(row)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${row.product_name} stok detayını aç`}><Eye className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{row.producer_verified && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Doğrulanmış satıcı</span>}<span className={`rounded-full px-2.5 py-1 font-semibold ${row.sellable_quantity === 0 ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200' : row.sellable_quantity <= Math.max(1, row.reorder_level) ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200' : 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200'}`}>Satılabilir {row.sellable_quantity}</span></div><dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Mevcut</dt><dd className="font-bold text-gray-900 dark:text-white">{row.available_quantity}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Rezerve</dt><dd className="font-bold text-gray-900 dark:text-white">{row.reserved_quantity}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Eşik</dt><dd className="font-bold text-gray-900 dark:text-white">{row.reorder_level}</dd></div></dl></article>)}</div>

          <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Ürün / varyant</th><th className="px-6 py-4">Satıcı</th><th className="px-6 py-4">Stok</th><th className="px-6 py-4">Fiyat</th><th className="px-6 py-4">Güncellendi</th><th className="px-6 py-4 text-right">Detay</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(row => <tr key={row.variant_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{row.product_name}</div><div className="mt-1 text-xs text-gray-500">{row.variant_name} · {row.sku || 'SKU yok'} · {row.stock_mode}</div></td><td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{row.producer_name}</div><div className="mt-1 text-xs text-gray-500">{row.producer_verified ? 'Kimlik doğrulandı' : 'Kimlik doğrulanmadı'} · {row.producer_status}</div></td><td className="px-6 py-4"><div className={`font-bold ${row.sellable_quantity === 0 ? 'text-red-700 dark:text-red-300' : row.sellable_quantity <= Math.max(1, row.reorder_level) ? 'text-orange-700 dark:text-orange-300' : 'text-gray-900 dark:text-white'}`}>{row.sellable_quantity} satılabilir</div><div className="mt-1 text-xs text-gray-500">{row.available_quantity} mevcut · {row.reserved_quantity} rezerve · eşik {row.reorder_level}</div></td><td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{inventoryMoney(row.price_minor, row.currency)}</td><td className="px-6 py-4 text-xs text-gray-500">{row.updated_at ? new Date(row.updated_at).toLocaleString('tr-TR') : 'Bilinmiyor'}</td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelected(row)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${row.product_name} stok detayını aç`}><Eye className="mx-auto h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
          {filtered.length === 0 && <div className="p-10 text-center text-gray-500">Bu görünümde eşleşen stok kaydı yok.</div>}
        </>}
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><div className="flex items-start justify-between gap-4"><div><h3 id="inventory-detail-title" className="text-xl font-bold text-gray-900 dark:text-white">{selected.product_name}</h3><p className="mt-1 text-sm text-gray-500">{selected.variant_name} · {selected.sku || 'SKU yok'}</p></div><button type="button" onClick={() => setSelected(null)} className="min-h-11 min-w-11 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Stok detayını kapat">Kapat</button></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Mevcut</dt><dd className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.available_quantity}</dd></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Rezerve</dt><dd className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.reserved_quantity}</dd></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Satılabilir</dt><dd className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.sellable_quantity}</dd></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Yeniden sipariş eşiği</dt><dd className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selected.reorder_level}</dd></div></dl><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100"><strong>{selected.producer_name}</strong> bu stoğun sorumlu satıcısıdır. Envanter sürümü {selected.version}. Yönetici ekranı stok hareketlerini gözler, satıcının stoğunu iz bırakmadan değiştirmez.</div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { setSelected(null); setActiveTab?.('products'); }} className="min-h-11 rounded-xl border border-gray-200 px-4 font-semibold text-gray-700 hover:border-brand-green dark:border-gray-700 dark:text-gray-200">Ürün yönetimine git</button><button type="button" onClick={() => { setSelected(null); setActiveTab?.('vendors'); }} className="min-h-11 rounded-xl bg-brand-green px-4 font-semibold text-white hover:bg-green-700">Satıcı yönetimine git</button></div></section></div>}
    </div>
  );
}
