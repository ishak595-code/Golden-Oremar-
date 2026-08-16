import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Edit2, Loader2, Percent, Plus, Search, Tag, Truck } from 'lucide-react';
import {
  adminCampaignTargetOptions,
  adminErrorMessage,
  adminListCampaigns,
  adminSaveCampaign,
  basisPointsToPercentage,
  minorToMajor,
  minorToTry,
  slugifyCampaign,
  type AdminCampaign,
  type CampaignDiscountType,
  type CampaignStatus,
  type CampaignTargetScope,
} from './supabaseAdminApi';
import type { CatalogItem, PublicCategory } from '../features/catalog/api';

type FormState = {
  title: string;
  slug: string;
  description: string;
  discountType: CampaignDiscountType;
  discountDisplayValue: number;
  minimumOrderTry: number;
  usageLimit: string;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
  status: CampaignStatus;
  targetScope: CampaignTargetScope;
  targetIds: string[];
};

function toLocalInput(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialForm(): FormState {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: '',
    slug: '',
    description: '',
    discountType: 'percentage',
    discountDisplayValue: 10,
    minimumOrderTry: 0,
    usageLimit: '',
    perUserLimit: 1,
    startsAt: toLocalInput(start),
    endsAt: toLocalInput(end),
    status: 'draft',
    targetScope: 'all',
    targetIds: [],
  };
}

function campaignToForm(campaign: AdminCampaign): FormState {
  const discountDisplayValue = campaign.discount_type === 'percentage'
    ? basisPointsToPercentage(campaign.discount_value)
    : campaign.discount_type === 'fixed'
      ? minorToMajor(campaign.discount_value)
      : 0;
  return {
    title: campaign.title,
    slug: campaign.slug,
    description: campaign.description || '',
    discountType: campaign.discount_type,
    discountDisplayValue,
    minimumOrderTry: minorToMajor(campaign.minimum_order_minor),
    usageLimit: campaign.usage_limit == null ? '' : String(campaign.usage_limit),
    perUserLimit: campaign.per_user_limit || 1,
    startsAt: toLocalInput(campaign.starts_at),
    endsAt: toLocalInput(campaign.ends_at),
    status: campaign.status,
    targetScope: campaign.target_scope,
    targetIds: campaign.target_ids || [],
  };
}

function statusLabel(status: CampaignStatus) {
  return ({ draft: 'Taslak', scheduled: 'Planlandı', active: 'Aktif', paused: 'Duraklatıldı', ended: 'Sona erdi' } as const)[status];
}

export function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [toast, setToast] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [campaignRows, options] = await Promise.all([
        adminListCampaigns(),
        adminCampaignTargetOptions(),
      ]);
      setCampaigns(campaignRows);
      setCategories(options.categories);
      setProducts(options.products);
    } catch (err) {
      setError(adminErrorMessage(err, 'Kampanyalar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setIsModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, saving]);

  const filteredCampaigns = useMemo(() => {
    const q = searchTerm.trim().toLocaleLowerCase('tr-TR');
    if (!q) return campaigns;
    return campaigns.filter(campaign => `${campaign.title} ${campaign.slug} ${campaign.description || ''}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [campaigns, searchTerm]);

  const targetOptions = useMemo(() => {
    const q = targetSearch.trim().toLocaleLowerCase('tr-TR');
    const rows = form.targetScope === 'categories'
      ? categories.map(category => ({ id: category.id, label: category.name, meta: `${category.productCount} ürün` }))
      : form.targetScope === 'products'
        ? products.map(product => ({ id: product.id, label: product.name, meta: product.producer?.name || '' }))
        : [];
    if (!q) return rows;
    return rows.filter(row => `${row.label} ${row.meta}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [categories, products, form.targetScope, targetSearch]);

  const openCreate = () => {
    setEditingCampaign(null);
    setSlugTouched(false);
    setForm(initialForm());
    setTargetSearch('');
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (campaign: AdminCampaign) => {
    setEditingCampaign(campaign);
    setSlugTouched(true);
    setForm(campaignToForm(campaign));
    setTargetSearch('');
    setError('');
    setIsModalOpen(true);
  };

  const updateTitle = (title: string) => {
    setForm(current => ({
      ...current,
      title,
      slug: slugTouched ? current.slug : slugifyCampaign(title),
    }));
  };

  const updateTargetScope = (targetScope: CampaignTargetScope) => {
    setForm(current => ({ ...current, targetScope, targetIds: [] }));
    setTargetSearch('');
  };

  const toggleTarget = (id: string) => {
    setForm(current => ({
      ...current,
      targetIds: current.targetIds.includes(id)
        ? current.targetIds.filter(value => value !== id)
        : [...current.targetIds, id],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await adminSaveCampaign({
        id: editingCampaign?.id,
        slug: form.slug || slugifyCampaign(form.title),
        title: form.title,
        description: form.description,
        discountType: form.discountType,
        discountDisplayValue: form.discountDisplayValue,
        currency: 'TRY',
        minimumOrderTry: form.minimumOrderTry,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        perUserLimit: form.perUserLimit,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        status: form.status,
        targetScope: form.targetScope,
        targetIds: form.targetIds,
      });
      await load();
      setIsModalOpen(false);
      showToast(editingCampaign ? 'Kampanya güncellendi.' : 'Kampanya oluşturuldu.');
    } catch (err) {
      setError(adminErrorMessage(err, 'Kampanya kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const formatDiscount = (campaign: AdminCampaign) => {
    if (campaign.discount_type === 'percentage') return `%${basisPointsToPercentage(campaign.discount_value).toLocaleString('tr-TR')}`;
    if (campaign.discount_type === 'fixed') return `${minorToTry(campaign.discount_value)} ${campaign.currency || 'TRY'}`;
    return 'Ücretsiz kargo';
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600 dark:text-gray-300" role="status">Kampanyalar yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kampanyalar</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Yüzde değerleri ekranda gerçek yüzde olarak, tutarlar TRY olarak gösterilir. Backend dönüşümü güvenli API katmanında yapılır.</p>
        </div>
        <button type="button" onClick={openCreate} className="min-h-11 rounded-xl bg-brand-green px-4 py-2 text-white flex items-center justify-center gap-2 hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2">
          <Plus className="h-5 w-5" aria-hidden="true" /> Yeni Kampanya
        </button>
      </div>

      {error && !isModalOpen && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 p-4 dark:border-gray-700">
          <label className="relative block max-w-md">
            <span className="sr-only">Kampanya ara</span>
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" placeholder="Kampanya ara..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </label>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
          {filteredCampaigns.map(campaign => (
            <article key={campaign.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{campaign.title}</h3>
                  <p className="mt-1 truncate text-xs text-gray-500">{campaign.description || campaign.slug}</p>
                </div>
                <button type="button" onClick={() => openEdit(campaign)} aria-label={`${campaign.title} kampanyasını düzenle`} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/30">
                  <Edit2 className="mx-auto h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-gray-500">İndirim</dt><dd className="font-semibold text-gray-900 dark:text-white">{formatDiscount(campaign)}</dd></div>
                <div><dt className="text-xs text-gray-500">Durum</dt><dd className="font-semibold text-gray-900 dark:text-white">{statusLabel(campaign.status)}</dd></div>
                <div><dt className="text-xs text-gray-500">Hedef</dt><dd>{campaign.target_scope === 'all' ? 'Tüm ürünler' : campaign.target_scope === 'categories' ? `${campaign.target_ids.length} kategori` : `${campaign.target_ids.length} ürün`}</dd></div>
                <div><dt className="text-xs text-gray-500">Minimum sepet</dt><dd>{minorToTry(campaign.minimum_order_minor)} TRY</dd></div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50">
              <tr><th className="px-6 py-4">Kampanya</th><th className="px-6 py-4">İndirim</th><th className="px-6 py-4">Hedef</th><th className="px-6 py-4">Geçerlilik</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4 text-right">İşlem</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredCampaigns.map(campaign => (
                <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-6 py-4"><div className="font-medium text-gray-900 dark:text-white">{campaign.title}</div><div className="max-w-56 truncate text-xs text-gray-500">{campaign.description || campaign.slug}</div></td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{formatDiscount(campaign)}</td>
                  <td className="px-6 py-4"><span className="flex items-center gap-1"><Tag className="h-4 w-4 text-gray-400" aria-hidden="true" />{campaign.target_scope === 'all' ? 'Tüm ürünler' : campaign.target_scope === 'categories' ? `${campaign.target_ids.length} kategori` : `${campaign.target_ids.length} ürün`}</span></td>
                  <td className="px-6 py-4"><span className="flex items-center gap-1 text-xs"><Calendar className="h-4 w-4 text-gray-400" aria-hidden="true" />{new Date(campaign.starts_at).toLocaleDateString('tr-TR')} - {new Date(campaign.ends_at).toLocaleDateString('tr-TR')}</span></td>
                  <td className="px-6 py-4"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-100">{statusLabel(campaign.status)}</span></td>
                  <td className="px-6 py-4 text-right"><button type="button" onClick={() => openEdit(campaign)} aria-label={`${campaign.title} kampanyasını düzenle`} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/30"><Edit2 className="mx-auto h-4 w-4" aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCampaigns.length === 0 && <div className="p-8 text-center text-gray-500">Kampanya bulunamadı.</div>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setIsModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="campaign-dialog-title" className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-800 sm:rounded-2xl">
            <div className="shrink-0 border-b border-gray-100 p-5 dark:border-gray-700">
              <h3 id="campaign-dialog-title" className="text-xl font-bold text-gray-900 dark:text-white">{editingCampaign ? 'Kampanyayı Düzenle' : 'Yeni Kampanya'}</h3>
            </div>
            <form id="campaign-form" onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5">
              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kampanya adı</span><input autoFocus required minLength={2} maxLength={160} value={form.title} onChange={event => updateTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
                <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kısa ad</span><input required value={form.slug} onChange={event => { setSlugTouched(true); setForm(current => ({ ...current, slug: slugifyCampaign(event.target.value) })); }} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
                <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Durum</span><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as CampaignStatus }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="draft">Taslak</option><option value="scheduled">Planlandı</option><option value="active">Aktif</option><option value="paused">Duraklatıldı</option><option value="ended">Sona erdi</option></select></label>
                <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Açıklama</span><textarea maxLength={4000} rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
              </div>

              <fieldset className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <legend className="px-2 text-sm font-semibold text-gray-900 dark:text-white">İndirim</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Tür</span><select value={form.discountType} onChange={event => setForm(current => ({ ...current, discountType: event.target.value as CampaignDiscountType, discountDisplayValue: event.target.value === 'free_shipping' ? 0 : current.discountDisplayValue || 10 }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900"><option value="percentage">Yüzde indirim</option><option value="fixed">Sabit tutar</option><option value="free_shipping">Ücretsiz kargo</option></select></label>
                  {form.discountType !== 'free_shipping' ? <label><span className="mb-1 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">{form.discountType === 'percentage' ? <Percent className="h-4 w-4" aria-hidden="true" /> : 'TRY'} Değer</span><input type="number" required min={form.discountType === 'percentage' ? 0.01 : 0.01} max={form.discountType === 'percentage' ? 100 : undefined} step="0.01" value={form.discountDisplayValue} onChange={event => setForm(current => ({ ...current, discountDisplayValue: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900" /></label> : <div className="flex items-end"><div className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-green-50 px-4 text-sm font-medium text-green-800 dark:bg-green-950/30 dark:text-green-200"><Truck className="h-5 w-5" aria-hidden="true" /> Kargo ücreti kampanya tarafından karşılanır</div></div>}
                  <label><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Minimum sepet (TRY)</span><input type="number" min="0" step="0.01" value={form.minimumOrderTry} onChange={event => setForm(current => ({ ...current, minimumOrderTry: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900" /></label>
                  <label><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Kullanıcı başına limit</span><input type="number" min="1" step="1" value={form.perUserLimit} onChange={event => setForm(current => ({ ...current, perUserLimit: Number(event.target.value) }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900" /></label>
                  <label><span className="mb-1 block text-sm text-gray-600 dark:text-gray-300">Toplam kullanım limiti (isteğe bağlı)</span><input type="number" min="1" step="1" value={form.usageLimit} onChange={event => setForm(current => ({ ...current, usageLimit: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900" /></label>
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Başlangıç</span><input type="datetime-local" required value={form.startsAt} onChange={event => setForm(current => ({ ...current, startsAt: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900" /></label>
                <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Bitiş</span><input type="datetime-local" required value={form.endsAt} onChange={event => setForm(current => ({ ...current, endsAt: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900" /></label>
              </div>

              <fieldset className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                <legend className="px-2 text-sm font-semibold text-gray-900 dark:text-white">Kampanya hedefi</legend>
                <label><span className="sr-only">Hedef türü</span><select value={form.targetScope} onChange={event => updateTargetScope(event.target.value as CampaignTargetScope)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900"><option value="all">Tüm ürünler</option><option value="categories">Belirli kategoriler</option><option value="products">Belirli ürünler</option></select></label>
                {form.targetScope !== 'all' && <div className="mt-4 space-y-3"><label className="relative block"><span className="sr-only">Hedeflerde ara</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" value={targetSearch} onChange={event => setTargetSearch(event.target.value)} placeholder={form.targetScope === 'categories' ? 'Kategori ara...' : 'Ürün ara...'} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 dark:border-gray-700 dark:bg-gray-900" /></label><p className="text-xs text-gray-500">{form.targetIds.length} seçim</p><div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-700">{targetOptions.map(option => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"><input type="checkbox" checked={form.targetIds.includes(option.id)} onChange={() => toggleTarget(option.id)} className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>{option.meta && <span className="block truncate text-xs text-gray-500">{option.meta}</span>}</span></label>)}{targetOptions.length === 0 && <div className="p-4 text-center text-sm text-gray-500">Eşleşen hedef bulunamadı.</div>}</div></div>}
              </fieldset>
            </form>
            <div className="flex shrink-0 gap-3 border-t border-gray-100 p-5 dark:border-gray-700">
              <button type="button" disabled={saving} onClick={() => setIsModalOpen(false)} className="min-h-11 flex-1 rounded-xl px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">İptal</button>
              <button type="submit" form="campaign-form" disabled={saving} className="min-h-11 flex-1 rounded-xl bg-brand-green px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Kaydediliyor</span> : 'Kaydet'}</button>
            </div>
          </section>
        </div>
      )}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /><span className="font-medium">{toast}</span></div>}
    </div>
  );
}
