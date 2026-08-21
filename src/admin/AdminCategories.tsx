import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, EyeOff, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';
import { adminArchiveCategory, adminListCategories, adminSaveCategory, categoryAdminErrorMessage, type AdminCategory } from './categoryAdminApi';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';

type FormState = { name: string; description: string; icon: string; image: string; sortOrder: number; isActive: boolean };
const emptyForm = (): FormState => ({ name: '', description: '', icon: '', image: '', sortOrder: 0, isActive: true });

function safeCount(value: unknown) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export function AdminCategories({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<AdminCategory | null>(null);
  const editorRef = useAccessibleDialog<HTMLDivElement>(editorOpen, () => {
    if (!busy) closeEditor();
  });
  const archiveDialogRef = useAccessibleDialog<HTMLDivElement>(Boolean(archiveTarget), () => {
    if (!busy) {
      setArchiveTarget(null);
      setError('');
    }
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await adminListCategories();
      setCategories(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(categoryAdminErrorMessage(err, 'Kategoriler yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
    setEditorOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setForm({ name: category.name, description: category.description || '', icon: category.icon || '', image: category.image_path || '', sortOrder: Number.isSafeInteger(Number(category.sort_order)) ? Number(category.sort_order) : 0, isActive: category.is_active === true });
    setError('');
    setEditorOpen(true);
  };

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setError('');
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(editing?.id || 'new');
    setError('');
    try {
      await adminSaveCategory({ reference: editing?.id || null, name: form.name, description: form.description, icon: form.icon, image: form.image, sortOrder: form.sortOrder, isActive: form.isActive });
      showToast(editing ? 'Kategori güncellendi.' : 'Yeni kategori oluşturuldu.');
      setEditorOpen(false);
      setEditing(null);
      setForm(emptyForm());
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
  const publishedProductCount = categories.reduce((sum, category) => sum + safeCount(category.published_product_count), 0);

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kategori Yönetimi</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Kategori yapısı canlı Supabase kataloğunu yönetir. Yayında ürünü olan kategori doğrudan pasifleştirilemez ve geçici görsel URL'leri kalıcı veri sayılmaz.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border px-4 dark:border-gray-700"><RefreshCw aria-hidden="true" className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Yenile</button><button type="button" onClick={openCreate} className="min-h-11 rounded-xl bg-brand-green px-4 font-semibold text-white"><Plus aria-hidden="true" className="mr-2 inline h-4 w-4" />Yeni kategori</button></div>
    </header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Toplam kategori" value={categories.length}/><Metric label="Aktif kategori" value={activeCount}/><Metric label="Yayındaki ürün" value={publishedProductCount}/><button type="button" onClick={() => setActiveTab?.('products')} className="rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">Ürün yönetimi</div><div className="mt-1 font-semibold text-brand-green">Bağlı ürünleri aç</div></button></div>

    {error && !editorOpen && !archiveTarget && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Kategori listesi">
      <div className="flex flex-col gap-3 border-b p-4 dark:border-gray-700 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Kategori ara</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input type="search" maxLength={160} value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Kategori adı, kısa ad veya açıklama ara..." className="min-h-11 w-full rounded-xl border bg-gray-50 pl-10 pr-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"/></label><label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 dark:border-gray-700"><input type="checkbox" checked={showInactive} onChange={event => setShowInactive(event.target.checked)}/>Pasifleri göster</label></div>
      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-500"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>Kategoriler yükleniyor...</div> : <div className="divide-y dark:divide-gray-700">{filtered.map(category => <article key={category.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900 dark:text-white">{category.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{category.is_active ? 'Aktif' : 'Pasif'}</span></div><p className="mt-1 text-xs text-gray-500">/{category.slug} · sıra {Number.isSafeInteger(Number(category.sort_order)) ? Number(category.sort_order) : 'Doğrulanamadı'}</p><p className="mt-2 line-clamp-2 text-sm text-gray-500">{category.description || 'Açıklama yok'}</p></div><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-blue-50 px-3 py-2 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{safeCount(category.published_product_count)} yayında</span><span className="rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-700">{safeCount(category.product_count)} toplam</span><button type="button" onClick={() => openEdit(category)} className="min-h-11 min-w-11 rounded-xl border text-blue-600 dark:border-gray-700" aria-label={`${category.name} kategorisini düzenle`}><Edit2 aria-hidden="true" className="mx-auto h-4 w-4"/></button>{category.is_active && <button type="button" onClick={() => { setError(''); setArchiveTarget(category); }} className="min-h-11 min-w-11 rounded-xl border border-red-200 text-red-600" aria-label={`${category.name} kategorisini pasifleştir`}><EyeOff aria-hidden="true" className="mx-auto h-4 w-4"/></button>}</div></article>)}{filtered.length === 0 && <div className="p-10 text-center text-gray-500">Kategori bulunamadı.</div>}</div>}
    </section>

    {editorOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}><div ref={editorRef} role="dialog" aria-modal="true" aria-labelledby="category-editor-title" aria-describedby="category-editor-description" tabIndex={-1} className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl"><div className="flex justify-between gap-3"><div><h3 id="category-editor-title" className="text-lg font-bold dark:text-white">{editing ? 'Kategoriyi düzenle' : 'Yeni kategori'}</h3><p id="category-editor-description" className="mt-1 text-xs text-gray-500">Yeni kategorinin kısa adı sunucuda güvenli biçimde üretilir.</p></div><button type="button" onClick={closeEditor} disabled={Boolean(busy)} className="min-h-11 min-w-11 rounded-xl" aria-label="Kategori düzenleyiciyi kapat"><X aria-hidden="true" className="mx-auto h-5 w-5"/></button></div><form onSubmit={submit} className="mt-4 space-y-4"><Field label="Kategori adı"><input required minLength={2} maxLength={120} value={form.name} onChange={event => setForm({...form,name:event.target.value})}/></Field><Field label="Açıklama"><textarea maxLength={3000} rows={4} value={form.description} onChange={event => setForm({...form,description:event.target.value})}/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="İkon / sembol"><input maxLength={80} value={form.icon} onChange={event => setForm({...form,icon:event.target.value})} placeholder="Örn. 🍯"/></Field><Field label="Sıralama"><input type="number" min="0" max="1000000" step="1" value={form.sortOrder} onChange={event => setForm({...form,sortOrder:Number(event.target.value)})}/></Field></div><Field label="Kalıcı görsel yolu veya HTTPS URL"><input maxLength={2048} value={form.image} onChange={event => setForm({...form,image:event.target.value})}/></Field><label className="flex min-h-11 items-center gap-3 rounded-xl border p-3 dark:border-gray-700"><input type="checkbox" checked={form.isActive} onChange={event => setForm({...form,isActive:event.target.checked})}/>Müşteri kataloğunda aktif olsun</label>{error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<div className="flex gap-3"><button type="button" onClick={closeEditor} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl border dark:border-gray-700">Vazgeç</button><button type="submit" disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl bg-brand-green font-semibold text-white disabled:opacity-50">{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></div></form></div></div>}

    {archiveTarget && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy){setArchiveTarget(null);setError('');}}}><div ref={archiveDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="archive-category-title" aria-describedby="archive-category-description" tabIndex={-1} className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl"><h3 id="archive-category-title" className="text-lg font-bold dark:text-white">Kategoriyi pasifleştir</h3><p id="archive-category-description" className="mt-2 text-sm text-gray-500"><strong>{archiveTarget.name}</strong> müşteri kataloğundan kaldırılacak. Yayında ürün varsa sunucu işlemi reddeder.</p>{error && <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<div className="mt-5 flex gap-3"><button type="button" onClick={() => { if (!busy) { setArchiveTarget(null); setError(''); } }} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl border disabled:opacity-50 dark:border-gray-700">Vazgeç</button><button type="button" disabled={Boolean(busy)} onClick={() => void archive()} className="min-h-11 flex-1 rounded-xl bg-red-700 font-semibold text-white disabled:opacity-50">{busy ? 'İşleniyor...' : 'Pasifleştir'}</button></div></div></div>}

    {toast && <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check aria-hidden="true" className="h-5 w-5 text-green-400"/>{toast}</div>}
    <style>{`.category-field{width:100%;min-height:44px;border:1px solid rgb(209 213 219);border-radius:.75rem;padding:.7rem .8rem;background:transparent}.dark .category-field{border-color:rgb(55 65 81)}`}</style>
  </div>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{safeCount(value).toLocaleString('tr-TR')}</div></div>}
function Field({label,children}:{label:string;children:React.ReactElement<{className?:string}>}){return <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>{React.cloneElement(children,{className:'category-field'})}</label>}
