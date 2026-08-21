import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, FileText, HeartPulse, Loader2, Plus, RefreshCw, Search, Soup, Trash2, X } from 'lucide-react';
import { adminListProducts, type AdminProduct } from './productAdminApi';
import {
  adminArchiveContent,
  adminListContent,
  adminSaveContent,
  contentAdminErrorMessage,
  type AdminContentEntry,
  type AdminContentType,
} from './contentAdminApi';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';

type EditorState = {
  type: AdminContentType;
  title: string;
  summary: string;
  content: string;
  image: string;
  relatedProductId: string;
  category: string;
  date: string;
};

const emptyEditor = (type: AdminContentType): EditorState => ({ type, title: '', summary: '', content: '', image: '', relatedProductId: '', category: '', date: new Date().toISOString().slice(0, 10) });

function typeLabel(type: AdminContentType) {
  return ({ blog: 'Sağlık yazısı', recipe: 'Tarif', health_guide: 'Sağlık rehberi', product_health: 'Ürün sağlık bilgisi' } as const)[type];
}

function typeIcon(type: AdminContentType) {
  if (type === 'recipe') return <Soup className="h-5 w-5" aria-hidden="true" />;
  if (type === 'product_health' || type === 'health_guide') return <HeartPulse className="h-5 w-5" aria-hidden="true" />;
  return <FileText className="h-5 w-5" aria-hidden="true" />;
}

function formatContentDate(value: unknown) {
  const raw = String(value || '').trim();
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı';
  try { return date.toLocaleString('tr-TR'); } catch { return 'Tarih doğrulanamadı'; }
}

function safeCount(value: unknown) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export function AdminContent({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [entries, setEntries] = useState<AdminContentEntry[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AdminContentType>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminContentEntry | null>(null);
  const [form, setForm] = useState<EditorState>(emptyEditor('blog'));
  const [archiveTarget, setArchiveTarget] = useState<AdminContentEntry | null>(null);
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
      const [contentRows, productRows] = await Promise.all([adminListContent(), adminListProducts()]);
      setEntries(Array.isArray(contentRows) ? contentRows : []);
      setProducts(Array.isArray(productRows) ? productRows : []);
    } catch (err) {
      setError(contentAdminErrorMessage(err, 'İçerik kütüphanesi yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return entries.filter(entry => {
      if (typeFilter !== 'all' && entry.content_type !== typeFilter) return false;
      if (!q) return true;
      return `${entry.title} ${entry.summary || ''} ${entry.slug} ${entry.related_product_name || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }, [entries, searchTerm, typeFilter]);

  const counts = useMemo(() => ({
    total: entries.length,
    blog: entries.filter(entry => entry.content_type === 'blog').length,
    recipe: entries.filter(entry => entry.content_type === 'recipe').length,
    health: entries.filter(entry => ['health_guide', 'product_health'].includes(entry.content_type)).length,
  }), [entries]);

  const openCreate = (type: AdminContentType = typeFilter === 'all' ? 'blog' : typeFilter) => {
    setEditing(null);
    setForm(emptyEditor(type));
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (entry: AdminContentEntry) => {
    setEditing(entry);
    setForm({ type: entry.content_type, title: entry.title, summary: entry.summary || '', content: entry.content, image: entry.image || '', relatedProductId: entry.related_product_id || '', category: String(entry.metadata?.originalCategory || ''), date: String(entry.metadata?.originalDate || entry.published_at?.slice(0, 10) || '') });
    setError('');
    setEditorOpen(true);
  };

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditing(null);
    setError('');
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(editing?.id || 'new');
    setError('');
    try {
      await adminSaveContent({ reference: editing?.id || null, type: form.type, title: form.title, summary: form.summary, content: form.content, image: form.image, relatedProductId: form.type === 'product_health' ? form.relatedProductId : null, category: form.category, date: form.date });
      showToast(editing ? 'İçerik güncellendi.' : 'İçerik yayınlandı.');
      setEditorOpen(false);
      setEditing(null);
      await load(true);
    } catch (err) {
      setError(contentAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const archive = async () => {
    if (!archiveTarget || busy) return;
    setBusy(archiveTarget.id);
    setError('');
    try {
      await adminArchiveContent(archiveTarget.id);
      showToast('İçerik arşivlendi.');
      setArchiveTarget(null);
      await load(true);
    } catch (err) {
      setError(contentAdminErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">İçerik Kütüphanesi</h2><p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Sağlık yazıları, tarifler, rehberler ve ürün sağlık açıklamaları gerçek Supabase içerik kayıtlarından yayınlanır. Sistem doğrulanmamış tıbbi iddiaları ve geçici görsel adreslerini sunucu tarafında reddeder.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setActiveTab?.('settings')} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Site ve iletişim ayarları</button><button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"><RefreshCw aria-hidden="true" className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Yenile</button><button type="button" onClick={() => openCreate()} className="min-h-11 rounded-xl bg-brand-green px-4 font-semibold text-white"><Plus aria-hidden="true" className="mr-2 inline h-4 w-4"/>Yeni içerik</button></div></header>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Toplam içerik" value={counts.total}/><Metric label="Sağlık yazısı" value={counts.blog}/><Metric label="Tarif" value={counts.recipe}/><Metric label="Sağlık rehberi / ürün" value={counts.health}/></div>

    {error && !editorOpen && !archiveTarget && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="İçerik kütüphanesi"><div className="grid gap-3 border-b p-4 dark:border-gray-700 md:grid-cols-[minmax(0,1fr)_220px]"><label className="relative"><span className="sr-only">İçerik ara</span><Search aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"/><input type="search" maxLength={160} value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Başlık, özet, ürün veya kısa ad ara..." className="min-h-11 w-full rounded-xl border bg-gray-50 pl-10 pr-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"/></label><label><span className="sr-only">İçerik türü</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)} className="min-h-11 w-full rounded-xl border bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm içerikler</option><option value="blog">Sağlık yazıları</option><option value="recipe">Tarifler</option><option value="health_guide">Sağlık rehberleri</option><option value="product_health">Ürün sağlık bilgileri</option></select></label></div>{loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-500"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin"/>İçerikler yükleniyor...</div> : <div className="divide-y dark:divide-gray-700">{filtered.map(entry => <article key={entry.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className="rounded-xl bg-brand-green/10 p-2.5 text-brand-green">{typeIcon(entry.content_type)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-gray-900 dark:text-white">{entry.title}</h3><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-700">{typeLabel(entry.content_type)}</span></div><p className="mt-1 text-xs text-gray-500">/{entry.slug} · {String(entry.locale || '').toUpperCase() || 'Dil doğrulanamadı'} · {entry.updated_at ? formatContentDate(entry.updated_at) : 'Tarih yok'}</p><p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{entry.summary || entry.content || 'İçerik metni yok'}</p>{entry.related_product_name && <p className="mt-1 text-xs font-medium text-blue-700 dark:text-blue-300">İlişkili ürün: {entry.related_product_name}</p>}</div></div><div className="flex gap-2"><button type="button" onClick={() => openEdit(entry)} className="min-h-11 rounded-xl border px-4 font-semibold text-blue-700 dark:border-gray-700 dark:text-blue-300"><Edit2 aria-hidden="true" className="mr-2 inline h-4 w-4"/>Düzenle</button><button type="button" onClick={() => { setError(''); setArchiveTarget(entry); }} className="min-h-11 rounded-xl border border-red-200 px-4 font-semibold text-red-700 dark:text-red-300"><Trash2 aria-hidden="true" className="mr-2 inline h-4 w-4"/>Arşivle</button></div></article>)}{filtered.length === 0 && <div className="p-10 text-center text-gray-500">İçerik bulunamadı.</div>}</div>}</section>

    {editorOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}><div ref={editorRef} role="dialog" aria-modal="true" aria-labelledby="content-editor-title" aria-describedby="content-editor-description" tabIndex={-1} className="max-h-[96dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl"><div className="flex justify-between gap-3"><div><h3 id="content-editor-title" className="text-lg font-bold dark:text-white">{editing ? 'İçeriği düzenle' : 'Yeni içerik'}</h3><p id="content-editor-description" className="mt-1 text-xs text-gray-500">Sağlık metinlerinde tedavi vaadi veya doğrulanmamış sağlık sonucu yazmayın.</p></div><button type="button" disabled={Boolean(busy)} onClick={closeEditor} className="min-h-11 min-w-11 rounded-xl" aria-label="İçerik düzenleyiciyi kapat"><X aria-hidden="true" className="mx-auto h-5 w-5"/></button></div><form onSubmit={submit} className="mt-5 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="İçerik türü"><select disabled={Boolean(editing)} value={form.type} onChange={event => setForm({...form,type:event.target.value as AdminContentType,relatedProductId:''})}><option value="blog">Sağlık yazısı</option><option value="recipe">Tarif</option><option value="health_guide">Sağlık rehberi</option><option value="product_health">Ürün sağlık bilgisi</option></select></Field><Field label="Tarih"><input type="date" value={form.date} onChange={event => setForm({...form,date:event.target.value})}/></Field></div><Field label="Başlık"><input required minLength={2} maxLength={240} value={form.title} onChange={event => setForm({...form,title:event.target.value})}/></Field><Field label="Özet"><textarea rows={3} maxLength={2000} value={form.summary} onChange={event => setForm({...form,summary:event.target.value})}/></Field><Field label="İçerik"><textarea required rows={10} maxLength={200000} value={form.content} onChange={event => setForm({...form,content:event.target.value})}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Kategori etiketi"><input maxLength={120} value={form.category} onChange={event => setForm({...form,category:event.target.value})}/></Field><Field label="Kalıcı görsel yolu veya HTTPS URL"><input maxLength={2048} value={form.image} onChange={event => setForm({...form,image:event.target.value})}/></Field></div>{form.type === 'product_health' && <Field label="İlişkili ürün"><select required value={form.relatedProductId} onChange={event => setForm({...form,relatedProductId:event.target.value})}><option value="">Ürün seçin</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} - {product.producer_name}</option>)}</select></Field>}{error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<div className="flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={closeEditor} className="min-h-11 flex-1 rounded-xl border dark:border-gray-700">Vazgeç</button><button type="submit" disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl bg-brand-green font-semibold text-white disabled:opacity-50">{busy ? 'Kaydediliyor...' : 'Yayınla'}</button></div></form></div></div>}

    {archiveTarget && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy){setArchiveTarget(null);setError('');}}}><div ref={archiveDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="archive-content-title" aria-describedby="archive-content-description" tabIndex={-1} className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-800 sm:rounded-2xl"><h3 id="archive-content-title" className="text-lg font-bold dark:text-white">İçeriği arşivle</h3><p id="archive-content-description" className="mt-2 text-sm text-gray-500"><strong>{archiveTarget.title}</strong> müşteri içerik kütüphanesinden kaldırılacak. Kayıt denetim için korunur.</p>{error && <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}<div className="mt-5 flex gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => { setArchiveTarget(null); setError(''); }} className="min-h-11 flex-1 rounded-xl border dark:border-gray-700">Vazgeç</button><button type="button" disabled={Boolean(busy)} onClick={() => void archive()} className="min-h-11 flex-1 rounded-xl bg-red-700 font-semibold text-white disabled:opacity-50">{busy ? 'İşleniyor...' : 'Arşivle'}</button></div></div></div>}

    {toast && <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check aria-hidden="true" className="h-5 w-5 text-green-400"/>{toast}</div>}
    <style>{`.content-field{width:100%;min-height:44px;border:1px solid rgb(209 213 219);border-radius:.75rem;padding:.7rem .8rem;background:transparent}.dark .content-field{border-color:rgb(55 65 81)}`}</style>
  </div>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{safeCount(value).toLocaleString('tr-TR')}</div></div>}
function Field({label,children}:{label:string;children:React.ReactElement<{className?:string}>}){return <label className="block"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>{React.cloneElement(children,{className:'content-field'})}</label>}
