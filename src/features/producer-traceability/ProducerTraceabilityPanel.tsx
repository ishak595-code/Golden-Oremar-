import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  addBatchEvent,
  getBatchEditor,
  getProducerTraceabilityDashboard,
  saveBatch,
  setBatchCertification,
  submitBatch,
} from './api';
import { ErrorState, LoadingState, Panel } from '../account/ui';

const statusLabel: Record<string, string> = {
  draft: 'Taslak',
  review: 'İncelemede',
  released: 'Yayınlandı',
  rejected: 'Düzeltme gerekli',
  recalled: 'Geri çağrıldı',
  archived: 'Arşivlendi',
};

const eventTypeOptions = [
  ['harvested', 'Hasat edildi'],
  ['produced', 'Üretildi'],
  ['packed', 'Paketlendi'],
  ['quality_checked', 'Kalite kontrolü yapıldı'],
  ['stored', 'Depolandı'],
  ['correction', 'Düzeltme kaydı'],
] as const;

const eventTypeLabel = Object.fromEntries(eventTypeOptions) as Record<string, string>;

export default function ProducerTraceabilityPanel({ onBack, onChanged }: { onBack: () => void; onChanged?: () => Promise<void> | void }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [editing, setEditing] = useState<{ mode: 'new' } | { mode: 'existing'; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      setDashboard(await getProducerTraceabilityDashboard());
    } catch (err: any) {
      setError(err?.message || 'Lot bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const products = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of dashboard?.inventory || []) {
      if (!map.has(row.productId)) map.set(row.productId, { id: row.productId, name: row.productName, variants: [] });
      map.get(row.productId).variants.push(row);
    }
    return [...map.values()];
  }, [dashboard]);

  if (editing) {
    return (
      <BatchEditor
        initialBatchId={editing.mode === 'existing' ? editing.id : null}
        products={products}
        onBack={() => setEditing(null)}
        onChanged={async () => { await load(); await onChanged?.(); }}
      />
    );
  }
  if (loading) return <LoadingState label="Lot ve izlenebilirlik bilgileri yükleniyor" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const batches = dashboard?.batches || [];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Satıcı paneline dön"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Geri</button>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border px-4 font-semibold" aria-label="Lot listesini yenile"><RefreshCw aria-hidden="true" className="mr-2 inline h-4 w-4" />Yenile</button>
      </div>

      <Panel title="Lot & İzlenebilirlik" description="Ürünün gerçek hasat veya üretim partisini kaydedin. Trace kodu yalnız admin doğrulamasından sonra müşteriye açılır.">
        {!products.length ? <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Lot oluşturmak için önce satıcı hesabınızda en az bir ürün varyantı bulunmalıdır.</div> : null}
        <button type="button" onClick={() => setEditing({ mode: 'new' })} disabled={!products.length} className="min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50"><Plus aria-hidden="true" className="mr-2 inline h-4 w-4" />Yeni lot oluştur</button>
        {!batches.length ? <p className="mt-4 text-sm text-gray-500">Henüz lot kaydı yok.</p> : <div className="mt-4 space-y-3">{batches.map((batch: any) => (
          <button key={batch.id} type="button" onClick={() => setEditing({ mode: 'existing', id: batch.id })} className="min-h-16 w-full rounded-2xl border p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold">{batch.productName}</div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold dark:bg-gray-800">{statusLabel[batch.status] || batch.status}</span></div>
            <div className="mt-1 text-sm text-gray-500">Lot: {batch.batchCode}</div>
            {batch.status === 'released' && batch.traceCode ? <div className="mt-1 text-sm font-semibold text-brand-green">Trace: {batch.traceCode}</div> : null}
          </button>
        ))}</div>}
      </Panel>

      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm"><div className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" /><p>QR/trace kodu taslak veya incelemedeki lotlarda müşteriye gösterilmez. Yayın kararı admin doğrulamasından sonra verilir; uygulama sahte lot ya da QR üretmez.</p></div></div>
    </div>
  );
}

function BatchEditor({ initialBatchId, products, onBack, onChanged }: { initialBatchId: string | null; products: any[]; onBack: () => void; onChanged: () => Promise<void> | void }) {
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(!!initialBatchId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [packagingDate, setPackagingDate] = useState('');
  const [bestBeforeDate, setBestBeforeDate] = useState('');
  const [country, setCountry] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [method, setMethod] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');

  const selectedProduct = products.find((item: any) => item.id === productId);
  const variants = selectedProduct?.variants || [];
  const editable = !batch || ['draft', 'rejected'].includes(batch.status);

  useEffect(() => {
    if (!initialBatchId) {
      const first = products[0];
      setProductId(first?.id || '');
      setVariantId(first?.variants?.[0]?.variantId || '');
      return;
    }
    void reload(initialBatchId);
  }, [initialBatchId]);

  useEffect(() => {
    if (!selectedProduct) return;
    if (!selectedProduct.variants.some((row: any) => row.variantId === variantId)) setVariantId(selectedProduct.variants[0]?.variantId || '');
  }, [productId]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function hydrate(data: any) {
    setBatch(data);
    setProductId(data.productId);
    setVariantId(data.variantId || '');
    setBatchCode(data.batchCode);
    setHarvestDate(data.harvestDate || '');
    setProductionDate(data.productionDate || '');
    setPackagingDate(data.packagingDate || '');
    setBestBeforeDate(data.bestBeforeDate || '');
    setCountry(data.origin.countryCode);
    setProvince(data.origin.province);
    setDistrict(data.origin.district);
    setVillage(data.origin.village);
    setMethod(data.productionMethod);
    setQuantity(data.initialQuantity == null ? '' : String(data.initialQuantity));
    setUnit(data.quantityUnit || '');
    setNotes(data.publicNotes || '');
  }

  async function reload(id: string) {
    try { setLoading(true); setError(''); hydrate(await getBatchEditor(id)); } catch (err: any) { setError(friendly(err)); } finally { setLoading(false); }
  }

  function validate() {
    if (!productId || !variantId) return 'Ürün ve varyant seçin.';
    const normalizedBatchCode = batchCode.trim().toUpperCase();
    if (!/^[A-Z0-9._/-]{3,80}$/.test(normalizedBatchCode)) return 'Lot kodu en az 3 karakter olmalı; yalnız harf, rakam, nokta, alt çizgi, eğik çizgi veya tire içerebilir.';
    if (!harvestDate && !productionDate) return 'Hasat tarihi veya üretim tarihi zorunludur.';
    if (!/^[A-Z]{2}$/.test(country.trim().toUpperCase())) return 'Menşe ülke kodunu iki harfli ISO biçiminde girin.';
    if (province.trim().length < 2 || district.trim().length < 2 || village.trim().length < 2) return 'Menşe il, ilçe ve köy bilgilerini tamamlayın.';
    if (method.trim().length < 2) return 'Üretim yöntemini açıklayın.';
    if ((quantity && !unit.trim()) || (!quantity && unit.trim())) return 'Miktar ve birim birlikte girilmelidir.';
    if (quantity) {
      const parsedQuantity = Number(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return 'Başlangıç miktarı geçerli ve sıfırdan büyük olmalıdır.';
    }
    return '';
  }

  async function save() {
    const issue = validate();
    if (issue) { setError(issue); return; }
    try {
      setBusy(true); setError(''); setMessage('');
      const result = await saveBatch({ batchId: batch?.id || null, productReference: productId, variantId, batchCode, harvestDate, productionDate, packagingDate, bestBeforeDate, originCountryCode: country, originProvince: province, originDistrict: district, originVillage: village, productionMethod: method, initialQuantity: quantity ? Number(quantity) : null, quantityUnit: unit, publicNotes: notes });
      await reload(result.batchId);
      setMessage('Lot taslağı kaydedildi.');
      await onChanged();
    } catch (err: any) { setError(friendly(err)); } finally { setBusy(false); }
  }

  async function addEvent(input: { eventType: string; eventAt: string; locationLabel: string; publicNote: string; visibility: 'public' | 'private' }) {
    if (!batch?.id) { setError('Önce lot taslağını kaydedin.'); return; }
    try { setBusy(true); setError(''); await addBatchEvent({ batchId: batch.id, ...input }); await reload(batch.id); setMessage('İzlenebilirlik olayı eklendi.'); } catch (err: any) { setError(friendly(err)); } finally { setBusy(false); }
  }

  async function toggleCertification(id: string, enabled: boolean) {
    if (!batch?.id) return;
    try { setBusy(true); setError(''); await setBatchCertification(batch.id, id, enabled); await reload(batch.id); } catch (err: any) { setError(friendly(err)); } finally { setBusy(false); }
  }

  async function submitReview() {
    if (!batch?.id) return;
    if (!(batch.events || []).some((event: any) => event.visibility === 'public')) { setError('Admin incelemesine göndermeden önce en az bir müşteriye açık izlenebilirlik olayı ekleyin.'); return; }
    try { setBusy(true); setError(''); await submitBatch(batch.id); await reload(batch.id); setMessage('Lot admin incelemesine gönderildi.'); await onChanged(); } catch (err: any) { setError(friendly(err)); } finally { setBusy(false); }
  }

  async function copyTrace() {
    if (!batch?.traceCode) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(batch.traceCode);
      setMessage('Trace kodu kopyalandı.');
    } catch {
      setError('Trace kodu bu cihazda panoya kopyalanamadı.');
    }
  }

  if (loading) return <LoadingState label="Lot ayrıntıları yükleniyor" />;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft aria-hidden="true" className="mr-2 inline h-4 w-4" />Lot listesine dön</button>{batch?.status ? <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold dark:bg-gray-800">{statusLabel[batch.status] || batch.status}</span> : null}</div>
    {error ? <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">{error}</div> : null}
    {message ? <div role="status" aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-100">{message}</div> : null}

    <Panel title={batch ? `Lot: ${batch.batchCode}` : 'Yeni Lot'} description="Ürün, menşe ve üretim bilgilerini gerçek partiye göre girin. Menşe ülkesi otomatik varsayılmaz.">
      <fieldset disabled={!editable || busy} className="space-y-4 disabled:opacity-70"><legend className="sr-only">Lot bilgileri</legend>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Ürün"><select value={productId} onChange={e => setProductId(e.target.value)} className="min-h-11 w-full rounded-xl border bg-transparent px-3">{products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Varyant"><select value={variantId} onChange={e => setVariantId(e.target.value)} className="min-h-11 w-full rounded-xl border bg-transparent px-3">{variants.map((v: any) => <option key={v.variantId} value={v.variantId}>{v.variantName}</option>)}</select></Field></div>
        <Field label="Lot kodu"><input value={batchCode} onChange={e => setBatchCode(e.target.value.toUpperCase())} minLength={3} maxLength={80} autoCapitalize="characters" className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><DateField label="Hasat tarihi" value={harvestDate} onChange={setHarvestDate} /><DateField label="Üretim tarihi" value={productionDate} onChange={setProductionDate} /><DateField label="Paketleme tarihi" value={packagingDate} onChange={setPackagingDate} /><DateField label="Tavsiye edilen tüketim tarihi" value={bestBeforeDate} onChange={setBestBeforeDate} /></div>
        <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="col-span-full font-bold">Menşe / Köy</legend><Field label="Ülke kodu"><input value={country} onChange={e => setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} minLength={2} maxLength={2} autoCapitalize="characters" autoComplete="country" placeholder="TR, CH, DE…" className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field><Field label="İl / bölge"><input value={province} onChange={e => setProvince(e.target.value)} maxLength={100} autoComplete="address-level1" className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field><Field label="İlçe"><input value={district} onChange={e => setDistrict(e.target.value)} maxLength={100} autoComplete="address-level2" className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field><Field label="Köy / mezra"><input value={village} onChange={e => setVillage(e.target.value)} maxLength={160} className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field></fieldset>
        <Field label="Üretim yöntemi"><textarea value={method} onChange={e => setMethod(e.target.value)} rows={3} minLength={2} maxLength={500} className="w-full rounded-xl border bg-transparent p-3" /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Başlangıç miktarı"><input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field><Field label="Birim"><input value={unit} onChange={e => setUnit(e.target.value)} maxLength={30} placeholder="kg, adet, litre…" className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field></div>
        <Field label="Müşteriye açık lot notu"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={1500} className="w-full rounded-xl border bg-transparent p-3" /></Field>
        {editable ? <button type="button" onClick={() => void save()} disabled={busy} className="min-h-11 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50">{busy ? 'Kaydediliyor…' : 'Lot Taslağını Kaydet'}</button> : null}
      </fieldset>
    </Panel>

    {batch?.id ? <EventPanel events={batch.events || []} disabled={!editable || busy} onAdd={addEvent} /> : null}
    {batch?.id && batch.certifications?.length ? <Panel title="Doğrulanmış Ürün Sertifikaları" description="Yalnız ürün için geçerli backend sertifikaları burada ilişkilendirilebilir."><div className="space-y-2">{batch.certifications.map((cert: any) => <label key={cert.id} className="flex min-h-11 items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={!!cert.linked} disabled={!editable || busy} onChange={e => void toggleCertification(cert.id, e.target.checked)} /><span><strong>{cert.type}</strong>{cert.issuer ? ` · ${cert.issuer}` : ''}</span></label>)}</div></Panel> : null}
    {batch?.status === 'released' && batch.traceCode ? <Panel title="Yayınlanmış Trace Kodu" description="Bu kod yalnız yayınlanmış lot için müşteriye açılır."><div className="flex flex-wrap items-center gap-3"><code className="rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">{batch.traceCode}</code><button type="button" onClick={() => void copyTrace()} className="min-h-11 rounded-xl border px-4 font-semibold"><ClipboardCopy aria-hidden="true" className="mr-2 inline h-4 w-4" />Kopyala</button></div></Panel> : null}
    {batch?.id && editable ? <button type="button" onClick={() => void submitReview()} disabled={busy} className="min-h-12 w-full rounded-xl bg-brand-gold px-4 font-bold text-white disabled:opacity-50">Admin İncelemesine Gönder</button> : null}
    {batch?.reviewReason ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">İnceleme notu: {batch.reviewReason}</div> : null}
  </div>;
}

function EventPanel({ events, disabled, onAdd }: { events: any[]; disabled: boolean; onAdd: (input: any) => Promise<void> }) {
  const [type, setType] = useState<(typeof eventTypeOptions)[number][0]>('harvested');
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  async function add() {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return;
    await onAdd({ eventType: type, eventAt: date.toISOString(), locationLabel: location, publicNote: note, visibility });
    setNote('');
  }
  return <Panel title="İzlenebilirlik Olayları" description="Hasat, üretim, paketleme, kalite kontrolü veya depolama gibi gerçek parti olaylarını kaydedin.">
    <div className="space-y-3">{events.map((event: any) => <div key={event.id} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{eventTypeLabel[event.eventType] || event.eventType}</strong><span className="text-xs">{event.visibility === 'public' ? 'Müşteriye açık' : 'Özel'}</span></div><div className="mt-1 text-sm text-gray-500">{formatDate(event.eventAt)}{event.locationLabel ? ` · ${event.locationLabel}` : ''}</div>{event.publicNote ? <p className="mt-1 text-sm">{event.publicNote}</p> : null}</div>)}</div>
    <fieldset disabled={disabled} className="mt-4 grid gap-3 sm:grid-cols-2 disabled:opacity-60"><legend className="col-span-full font-bold">Yeni olay</legend><Field label="Olay türü"><select value={type} onChange={e => setType(e.target.value as (typeof eventTypeOptions)[number][0])} className="min-h-11 w-full rounded-xl border bg-transparent px-3">{eventTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Tarih ve saat"><input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field><Field label="Konum etiketi"><input value={location} onChange={e => setLocation(e.target.value)} maxLength={200} className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field><Field label="Görünürlük"><select value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'private')} className="min-h-11 w-full rounded-xl border bg-transparent px-3"><option value="public">Müşteriye açık</option><option value="private">Yalnız yönetim</option></select></Field><div className="sm:col-span-2"><Field label="Olay notu"><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1500} className="w-full rounded-xl border bg-transparent p-3" /></Field></div><button type="button" onClick={() => void add()} className="min-h-11 rounded-xl border px-4 font-semibold sm:col-span-2">Olayı Ekle</button></fieldset>
  </Panel>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}</label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><input type="date" value={value} onChange={e => onChange(e.target.value)} className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></Field>; }
function formatDate(value?: string | null) { if (!value) return 'Tarih yok'; const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı'; try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date); } catch { return 'Tarih doğrulanamadı'; } }
function friendly(err: any) { const raw = String(err?.message || err || 'İşlem tamamlanamadı.'); if (raw.includes('batch_not_editable')) return 'Bu lot artık düzenlenemez.'; if (raw.includes('batch_not_ready_for_review') || raw.includes('batch_origin_incomplete') || raw.includes('batch_origin_date_incomplete') || raw.includes('batch_production_method_incomplete')) return 'Menşe, üretim yöntemi, tarih ve en az bir müşteriye açık olay tamamlanmalıdır.'; if (raw.includes('explicit_origin_country_required') || raw.includes('invalid_origin_country')) return 'Menşe ülke kodunu açıkça iki harfli ISO biçiminde girin.'; if (raw.includes('batch_code')) return 'Lot kodunu kontrol edin; biçimi geçersiz olabilir veya aynı üreticide tekrar edemez.'; if (raw.includes('invalid_batch_event_type')) return 'İzlenebilirlik olay türünü listeden seçin.'; if (raw.includes('certification')) return 'Sertifika bu ürün için geçerli değil veya süresi dolmuş.'; return raw; }
