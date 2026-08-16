import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, CheckCircle, Eye, Loader2, Package, RefreshCw, Search, ShieldCheck, Star, X, XCircle } from 'lucide-react';
import {
  adminListProducts,
  adminReviewProduct,
  formatProductMoney,
  productAdminErrorMessage,
  type AdminProduct,
  type AdminProductStatus,
} from './productAdminApi';

function statusLabel(status: AdminProductStatus) {
  return ({ draft: 'Taslak', review: 'İncelemede', published: 'Yayında', rejected: 'Reddedildi', archived: 'Arşivlendi' } as const)[status];
}

function statusClass(status: AdminProductStatus) {
  if (status === 'published') return 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200';
  if (status === 'review') return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200';
  if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  if (status === 'archived') return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200';
}

export function AdminProducts({ initialView = 'all' }: { setActiveTab?: (tab: string) => void; initialView?: 'all' | 'pending' }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminProductStatus>(initialView === 'pending' ? 'review' : 'all');
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await adminListProducts();
      setProducts(rows);
      setSelected(current => current ? rows.find(row => row.id === current.id) || null : null);
    } catch (err) {
      setError(productAdminErrorMessage(err, 'Ürünler yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return products.filter(product => {
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      if (!q) return true;
      return `${product.name} ${product.producer_name} ${product.category_name || ''} ${product.origin || ''} ${product.slug}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [products, searchTerm, statusFilter]);

  const counts = useMemo(() => ({
    review: products.filter(product => product.status === 'review').length,
    published: products.filter(product => product.status === 'published').length,
    rejected: products.filter(product => product.status === 'rejected').length,
    lowStock: products.filter(product => ['tracked', 'seasonal'].includes(product.stock_mode) && product.available_quantity <= 5).length,
  }), [products]);

  const openReview = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setReason('');
    setError('');
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reviewAction || busyId) return;
    setBusyId(selected.id);
    setError('');
    try {
      await adminReviewProduct(selected.id, reviewAction === 'approve', reason);
      showToast(reviewAction === 'approve' ? 'Ürün yayınlandı.' : 'Ürün düzeltme için satıcıya geri gönderildi.');
      setReviewAction(null);
      await load(true);
    } catch (err) {
      setError(productAdminErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ürün Yönetimi</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Ürünleri satıcı oluşturur ve günceller. Yönetici tarafı doğrulanmış üretici, içerik yeterliliği, fiyatlı varyant ve birincil görsel şartlarını sunucu tarafında tekrar kontrol ederek yayın kararı verir.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">İncelemede</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.review}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Yayında</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.published}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Reddedildi</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.rejected}</div></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Düşük stok</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{counts.lowStock}</div></div>
      </div>

      {error && !reviewAction && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <section className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_220px]" aria-label="Ürün filtreleri">
        <label className="relative"><span className="sr-only">Ürün ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Ürün, üretici, kategori veya menşe ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
        <label><span className="sr-only">Ürün durumunu filtrele</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm durumlar</option><option value="review">İncelemede</option><option value="published">Yayında</option><option value="rejected">Reddedildi</option><option value="draft">Taslak</option><option value="archived">Arşivlendi</option></select></label>
      </section>

      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Ürünler yükleniyor...</div> : <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Ürün listesi">
        <div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">{filtered.map(product => <article key={product.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-gray-900 dark:text-white">{product.name}</h3><p className="mt-1 text-xs text-gray-500">{product.producer_name} · {product.category_name || 'Kategori yok'}</p></div><button type="button" onClick={() => setSelected(product)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${product.name} ürününü incele`}><Eye className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(product.status)}`}>{statusLabel(product.status)}</span>{product.producer_verified && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Üretici doğrulandı</span>}{product.producer_origin_verified && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Menşe doğrulandı</span>}</div><dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Fiyat</dt><dd className="font-semibold text-gray-900 dark:text-white">{formatProductMoney(product.base_price_minor, product.currency)}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Stok</dt><dd className="font-semibold text-gray-900 dark:text-white">{product.available_quantity}</dd></div><div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900/60"><dt className="text-xs text-gray-500">Puan</dt><dd className="font-semibold text-gray-900 dark:text-white">{product.rating_average.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</dd></div></dl></article>)}</div>

        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Ürün</th><th className="px-6 py-4">Üretici</th><th className="px-6 py-4">Fiyat / stok</th><th className="px-6 py-4">Güven</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(product => <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{product.name}</div><div className="mt-1 text-xs text-gray-500">{product.category_name || 'Kategori yok'} · {product.origin || 'Menşe belirtilmemiş'}</div></td><td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{product.producer_name}</div><div className="mt-1 text-xs text-gray-500">{product.variant_count} varyant</div></td><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{formatProductMoney(product.base_price_minor, product.currency)}</div><div className="mt-1 text-xs text-gray-500">Satılabilir stok: {product.available_quantity}</div></td><td className="px-6 py-4"><div className="space-y-1 text-xs"><div className={product.producer_verified ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}>{product.producer_verified ? 'Üretici doğrulandı' : 'Üretici doğrulanmadı'}</div><div className={product.producer_origin_verified ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}>{product.producer_origin_verified ? 'Menşe doğrulandı' : 'Menşe doğrulanmadı'}</div></div></td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(product.status)}`}>{statusLabel(product.status)}</span></td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelected(product)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${product.name} ürününü incele`}><Eye className="mx-auto h-4 w-4" aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
        {filtered.length === 0 && <div className="p-10 text-center text-gray-500"><Package className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" /> Filtrelerle eşleşen ürün yok.</div>}
      </section>}

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="product-review-title" className="max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="product-review-title" className="text-xl font-bold text-gray-900 dark:text-white">{selected.name}</h3><p className="mt-1 text-sm text-gray-500">{selected.producer_name} · {selected.category_name || 'Kategori yok'}</p></div><button type="button" onClick={() => setSelected(null)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Ürün detayını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Fiyat</div><div className="mt-1 font-bold text-gray-900 dark:text-white">{formatProductMoney(selected.base_price_minor, selected.currency)}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Satılabilir stok</div><div className="mt-1 font-bold text-gray-900 dark:text-white">{selected.available_quantity}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Varyant</div><div className="mt-1 font-bold text-gray-900 dark:text-white">{selected.variant_count}</div></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><div className="text-xs text-gray-500">Değerlendirme</div><div className="mt-1 flex items-center gap-1 font-bold text-gray-900 dark:text-white"><Star className="h-4 w-4 fill-current text-yellow-500" aria-hidden="true" /> {selected.rating_average.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ({selected.review_count})</div></div></div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Ürün içeriği</h4><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Kısa açıklama</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.short_description || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">Açıklama</dt><dd className="mt-1 whitespace-pre-wrap text-gray-900 dark:text-white">{selected.description || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">Menşe</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.origin || 'Yok'}</dd></div></dl></section><section className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Lojistik ve dış ticaret</h4><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-gray-500">Stok modeli</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.stock_mode}</dd></div><div><dt className="text-xs text-gray-500">İhracat durumu</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.export_status}</dd></div><div><dt className="text-xs text-gray-500">Menşe ülke kodu</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.country_of_origin_code || 'Yok'}</dd></div><div><dt className="text-xs text-gray-500">Ürün niteliği</dt><dd className="mt-1 text-gray-900 dark:text-white">{selected.is_perishable ? 'Bozulabilir ürün' : 'Bozulabilir işaretli değil'}{selected.requires_cold_chain ? ' · Soğuk zincir gerekir' : ''}{selected.shelf_life_days ? ` · ${selected.shelf_life_days} gün raf ömrü` : ''}</dd></div></dl></section></div>

        <section className="mt-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-700"><h4 className="font-bold text-gray-900 dark:text-white">Güven kontrolü</h4><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className={`rounded-xl p-3 text-sm ${selected.producer_verified ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100' : 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100'}`}><BadgeCheck className="mr-2 inline h-4 w-4" aria-hidden="true" /> Üretici kimliği {selected.producer_verified ? 'doğrulandı' : 'doğrulanmadı'}</div><div className={`rounded-xl p-3 text-sm ${selected.producer_origin_verified ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-200'}`}><ShieldCheck className="mr-2 inline h-4 w-4" aria-hidden="true" /> Üretim menşei {selected.producer_origin_verified ? 'doğrulandı' : 'doğrulanmadı'}</div></div><p className="mt-3 text-xs text-gray-500">Yayın onayı verildiğinde backend ayrıca aktif fiyatlı varyant, birincil ürün görseli, içerik yeterliliği ve doğrulanmış aktif üretici koşullarını yeniden denetler.</p></section>

        {selected.status === 'review' && <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => openReview('reject')} className="min-h-11 rounded-xl border border-red-200 px-4 font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300"><XCircle className="mr-2 inline h-4 w-4" aria-hidden="true" /> Düzeltme iste / reddet</button><button type="button" disabled={!selected.producer_verified} onClick={() => openReview('approve')} className="min-h-11 rounded-xl bg-brand-green px-4 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle className="mr-2 inline h-4 w-4" aria-hidden="true" /> Yayınla</button></div>}
      </section></div>}

      {reviewAction && selected && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="product-action-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><h3 id="product-action-title" className="text-lg font-bold text-gray-900 dark:text-white">{reviewAction === 'approve' ? 'Ürünü yayınla' : 'Ürünü satıcıya geri gönder'}</h3><p className="mt-1 text-sm text-gray-500">{selected.name}</p>{error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<form onSubmit={submitReview} className="mt-4 space-y-4"><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{reviewAction === 'reject' ? 'Düzeltme / ret gerekçesi' : 'İnceleme notu (isteğe bağlı)'}</span><textarea autoFocus required={reviewAction === 'reject'} minLength={reviewAction === 'reject' ? 8 : undefined} maxLength={2000} rows={5} value={reason} onChange={event => setReason(event.target.value)} placeholder={reviewAction === 'reject' ? 'Satıcının hangi alanları düzeltmesi gerektiğini açıkça yazın...' : 'İsterseniz denetim notu ekleyin...'} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="flex gap-3"><button type="button" disabled={Boolean(busyId)} onClick={() => { setReviewAction(null); setError(''); }} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">İptal</button><button type="submit" disabled={Boolean(busyId) || (reviewAction === 'reject' && reason.trim().length < 8)} className={`min-h-11 flex-1 rounded-xl px-4 font-semibold text-white disabled:opacity-50 ${reviewAction === 'reject' ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-green hover:bg-green-700'}`}>{busyId ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> İşleniyor</span> : 'Onayla'}</button></div></form></section></div>}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
