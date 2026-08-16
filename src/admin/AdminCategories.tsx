import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, EyeOff, Image as ImageIcon, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { adminArchiveCategory, adminListCategories, adminSaveCategory, categoryAdminErrorMessage, type AdminCategory } from './categoryAdminApi';

type FormState = { name: string; description: string; icon: string; image: string; sortOrder: number; isActive: boolean };
const emptyForm = (): FormState => ({ name: '', description: '', icon: '', image: '', sortOrder: 0, isActive: true });

export function AdminCategories({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<AdminCategory | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setCategories(await adminListCategories());
    } catch (err) {
      setError(categoryAdminErrorMessage(err, 'Kategoriler yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return categories.filter(category => {
      if (!showInactive && !category.is_active) return false;
      if (!q) return true;
      return `${category.name} ${category.slug} ${category.description || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [categories, searchTerm, showInactive]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      image: category.image_path || '',
      sortOrder: category.sort_order,
      isActive: category.is_active,
    });
    setError('');
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(editing?.id || 'new');
    setError('');
    try {
      await adminSaveCategory({
        reference: editing?.id || null,
        name: form.name,
        description: form.description,
        icon: form.icon,
        image: form.image,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
      showToast(editing ? 'Kategori güncellendi.' : 'Yeni kategori oluşturuldu.');
      closeEditor();
      await load(true);
    } catch (err) {
      setError(categoryAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const archive = async () => {
    if (!archiveTarget || busy) return;
    setBusy(archiveTarget.id);
    setError('');
    try {
      await adminArchiveCategory(archiveTarget.id);
      showToast('Kategori pasifleştirildi.');
      setArchiveTarget(null);
      await load(true);
    } catch (err) {
      setError(categoryAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const activeCount = categories.filter(category => category.is_active).length;
  const publishedProductCount = categories.reduce((sum, category) => sum + category.published_product_count, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kategori Yönetimi</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Kategori yapısı canlı Supabase kataloğunu yönetir. Yayında ürünü olan kategori doğrudan pasifleştirilemez. Geçici görsel URL'leri kalıcı kayıt olarak kabul edilmez.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile</button><button type="button" onClick={openCreate} className="min-h-11 rounded-xl bg-brand-green px-4 py-2 font-semibold text-white hover:bg-green-700"><Plus className="mr-2 inline h-4 w-4" aria-hidden="true" /> Yeni kategori</button></div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Toplam kategori</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{categories.length}</div></div><div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Aktif kategori</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</div></div><div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Yayındaki ürün</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{publishedProductCount}</div></div><button type="button" onClick={() => setActiveTab?.('products')} className="rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Ürün yönetimi</div><div className="mt-1 font-semibold text-brand-green">Kategorilere bağlı ürünleri aç</div></button></div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Kategori listesi"><div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"><label className="relative block w-full max-w-xl"><span className="sr-only">Kategori ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Kategori adı, kısa ad veya açıklama ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><label className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm dark:border-gray-700"><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /> Pasifleri göster</label></div>{loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Kategoriler yükleniyor...</div> : <><div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">{filtered.map(category => <article key={category.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-700">{category.icon ? <span aria-hidden="true">{category.icon}</span> : <ImageIcon className="h-5 w-5" aria-hidden="true" />}</div><div className="min-w-0"><h3 className="truncate font-bold text-gray-900 dark:text-white">{category.name}</h3><p className="mt-1 truncate text-xs text-gray-500">/{category.slug}</p></div></div><button type="button" onClick={() => openEdit(category)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${category.name} kategorisini düzenle`}><Edit2 className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-semibold ${category.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{category.is_active ? 'Aktif' : 'Pasif'}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{category.published_product_count} yayında</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{category.product_count} toplam ürün</span></div><p className="mt-3 line-clamp-2 text-sm text-gray-500">{category.description || 'Açıklama yok'}</p></article>)}</div><div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm text-gray-600 dark:text-gray-300"><thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Kategori</th><th className="px-6 py-4">Açıklama</th><th className="px-6 py-4">Ürünler</th><th className="px-6 py-4">Sıra</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filtered.map(category => <tr key={category.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{category.name}</div><div className="mt-1 text-xs text-gray-500">/{category.slug}</div></td><td className="max-w-sm px-6 py-4"><div className="line-clamp-2">{category.description || 'Açıklama yok'}</div></td><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{category.published_product_count} yayında</div><div className="mt-1 text-xs text-gray-500">{category.product_count} toplam</div></td><td className="px-6 py-4">{category.sort_order}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${category.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{category.is_active ? 'Aktif' : 'Pasif'}</span></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => openEdit(category)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${category.name} kategorisini düzenle`}><Edit2 className="mx-auto h-4 w-4" aria-hidden="true" /></button>{category.is_active && <button type="button" onClick={() => setArchiveTarget(category)} className="min-h-11 min-w-11 rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label={`${category.name} kategorisini pasifleştir`}><EyeOff className="mx-auto h-4 w-4" aria-hidden="true" /></button>}</div></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="p-10 text-center text-gray-500">Kategori bulunamadı.</div>}</>}</section>

      {(editing !== null || form.name !== '' || busy === 'new') && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) closeEditor(); }}><section role="dialog" aria-modal="true" aria-labelledby="category-editor-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><h3 id="category-editor-title" className="text-lg font-bold text-gray-900 dark:text-white">{editing ? 'Kategoriyi düzenle' : 'Yeni kategori'}</h3><p className="mt-1 text-xs text-gray-500">Kısa ad yeni kategorilerde sunucu tarafından Türkçe metinden güvenli biçimde üretilir.</p></div><button type="button" disabled={Boolean(busy)} onClick={closeEditor} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700" aria-label="Kategori düzenleyiciyi kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div><form onSubmit={submit} className="mt-4 space-y-4"><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kategori adı</span><input autoFocus required minLength={2} maxLength={120} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Açıklama</span><textarea maxLength={3000} rows={4} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">İkon / sembol</span><input maxLength={80} value={form.icon} onChange={event => setForm(current => ({ ...current, icon: event.target.value }))} placeholder="Örn. 🍯" className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Sıralama</span><input type="number" step="1" value={form.sortOrder} onChange={event => setForm(current => ({ ...current, sortOrder: Number(event.target.value) }))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label></div><label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kalıcı görsel yolu veya HTTPS URL</span><input maxLength={2048} value={form.image} onChange={event => setForm(current => ({ ...current, image: event.target.value }))} placeholder="catalog-public/... veya https://..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label><label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"><input type="checkbox" checked={form.isActive} onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))} /><span>Bu kategori müşteri kataloğunda aktif olsun</span></label>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<div className="flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={closeEditor} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">Vazgeç</button><button type="submit" disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl bg-brand-green px-4 font-semibold text-white hover:bg-green-700 disabled:opacity-50">{busy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Kaydediliyor</span> : 'Kaydet'}</button></div></form></section></div>}

      {archiveTarget && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="archive-category-title" className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl"><h3 id="archive-category-title" className="text-lg font-bold text-gray-900 dark:text-white">Kategoriyi pasifleştir</h3><p className="mt-2 text-sm text-gray-500"><strong>{archiveTarget.name}</strong> müşteri kataloğundan kaldırılacak. Kategoride yayında ürün varsa backend bu işlemi reddeder.</p>{error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<div className="mt-5 flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => { setArchiveTarget(null); setError(''); }} className="min-h-11 flex-1 rounded-xl px-4 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">Vazgeç</button><button type="button" disabled={Boolean(busy)} onClick={() => void archive()} className="min-h-11 flex-1 rounded-xl bg-red-700 px-4 font-semibold text-white hover:bg-red-800 disabled:opacity-50">Pasifleştir</button></div></section></div>}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
