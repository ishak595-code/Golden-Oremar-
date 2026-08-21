import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Panel, EmptyState, ErrorState } from './ui';
import { deleteAddress, upsertAddress } from './api';
import type { Address } from './types';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';

const blank: Address = {
  label: 'Ev', recipient_name: '', phone: '', country_code: '',
  province: '', district: '', neighborhood: '', address_line: '',
  postal_code: '', delivery_notes: '', is_default: false
};

const fields = [
  { key: 'label', label: 'Adres etiketi', autoComplete: 'off', required: true, maxLength: 60 },
  { key: 'recipient_name', label: 'Alıcı adı', autoComplete: 'name', required: true, maxLength: 120 },
  { key: 'phone', label: 'Telefon', autoComplete: 'tel', inputMode: 'tel', required: true, maxLength: 40 },
  { key: 'country_code', label: 'Ülke kodu', autoComplete: 'country', required: true, maxLength: 2 },
  { key: 'province', label: 'İl/Bölge', autoComplete: 'address-level1', required: true, maxLength: 120 },
  { key: 'district', label: 'İlçe/Şehir', autoComplete: 'address-level2', required: true, maxLength: 120 },
  { key: 'neighborhood', label: 'Mahalle/Köy', autoComplete: 'address-level3', required: false, maxLength: 160 },
  { key: 'postal_code', label: 'Posta kodu', autoComplete: 'postal-code', inputMode: 'text', required: false, maxLength: 20 },
] as const;

type SavedAddress = Address & { id: string };

function isSavedAddress(address: Address): address is SavedAddress {
  return typeof address.id === 'string' && address.id.trim().length > 0;
}

function validateAddress(address: Address) {
  const label = String(address.label || '').trim();
  const recipient = String(address.recipient_name || '').trim();
  const phone = String(address.phone || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  const country = String(address.country_code || '').trim().toUpperCase();
  const province = String(address.province || '').trim();
  const district = String(address.district || '').trim();
  const neighborhood = String(address.neighborhood || '').trim();
  const postal = String(address.postal_code || '').trim();
  const line = String(address.address_line || '').trim();
  if (label.length < 1 || label.length > 60) return 'Adres etiketi 1 ile 60 karakter arasında olmalıdır.';
  if (recipient.length < 2 || recipient.length > 120) return 'Alıcı adı 2 ile 120 karakter arasında olmalıdır.';
  if (!/^[+()0-9 .\-]{10,40}$/.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15) return 'Teslimat telefonu 10 ile 15 rakam içermelidir.';
  if (!/^[A-Z]{2}$/.test(country)) return 'Ülke kodu iki harfli ISO kodu olmalıdır.';
  if (province.length < 2 || province.length > 120) return 'İl veya bölge bilgisi 2 ile 120 karakter arasında olmalıdır.';
  if (district.length < 2 || district.length > 120) return 'İlçe veya şehir bilgisi 2 ile 120 karakter arasında olmalıdır.';
  if (neighborhood.length > 160) return 'Mahalle veya köy bilgisi en fazla 160 karakter olabilir.';
  if (postal.length > 20) return 'Posta kodu en fazla 20 karakter olabilir.';
  if (line.length < 10 || line.length > 1000) return 'Açık adres 10 ile 1000 karakter arasında olmalıdır.';
  if (String(address.delivery_notes || '').length > 500) return 'Teslimat notu en fazla 500 karakter olabilir.';
  return '';
}

export default function AddressesPanel({ addresses, onChanged }: { addresses: Address[]; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<Address | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<SavedAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('');
  const editDialogRef = useAccessibleDialog<HTMLFormElement>(!!editing, () => { if (!saving) setEditing(null); });
  const deleteDialogRef = useAccessibleDialog<HTMLDivElement>(!!deleteCandidate, () => { if (!deleteBusy) setDeleteCandidate(null); });
  const savedAddresses = addresses.filter(isSavedAddress);
  const addressContractValid = savedAddresses.length === addresses.length;

  function startCreate() {
    setError('');
    setFormError('');
    setStatus('');
    setEditing({ ...blank });
  }

  function startEdit(address: SavedAddress) {
    setError('');
    setFormError('');
    setStatus('');
    setEditing({ ...address });
  }

  function closeEditor() {
    if (saving) return;
    setFormError('');
    setEditing(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || saving) return;
    setFormError('');
    setStatus('');
    const normalized = {
      ...editing,
      id: String(editing.id || '').trim() || undefined,
      label: String(editing.label || '').trim(),
      recipient_name: String(editing.recipient_name || '').trim(),
      phone: String(editing.phone || '').trim(),
      country_code: String(editing.country_code || '').trim().toUpperCase(),
      province: String(editing.province || '').trim(),
      district: String(editing.district || '').trim(),
      neighborhood: String(editing.neighborhood || '').trim() || null,
      address_line: String(editing.address_line || '').trim(),
      postal_code: String(editing.postal_code || '').trim() || null,
      delivery_notes: String(editing.delivery_notes || '').trim() || null,
      is_default: editing.is_default === true,
    } as Address;
    const issue = validateAddress(normalized);
    if (issue) { setFormError(issue); return; }
    try {
      setSaving(true);
      await upsertAddress(normalized);
      const wasEditing = Boolean(normalized.id);
      setEditing(null);
      setFormError('');
      await onChanged();
      setStatus(wasEditing ? 'Adres güncellendi.' : 'Yeni adres kaydedildi.');
    } catch (err: unknown) {
      setFormError(err instanceof Error && err.message ? err.message : 'Adres kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!deleteCandidate || deleteBusy) return;
    setError('');
    setStatus('');
    try {
      setDeleteBusy(true);
      await deleteAddress(deleteCandidate.id);
      setDeleteCandidate(null);
      await onChanged();
      setStatus('Adres silindi.');
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Adres silinemedi.');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Panel title="Adreslerim" description="Türkiye veya yurt dışındaki teslimat adreslerinizi ekleyin ve varsayılan adresinizi seçin.">
      {error ? <ErrorState message={error} /> : null}
      {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}
      {!addressContractValid ? <ErrorState message="Kayıtlı adreslerden en az birinin kimliği doğrulanamadı. Adres düzenleme ve silme işlemleri güvenlik amacıyla kapatıldı." /> : null}
      <button type="button" onClick={startCreate} className="mb-4 min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
        Yeni adres ekle
      </button>

      <div className="space-y-3">
        {savedAddresses.length === 0 ? <EmptyState title="Kayıtlı adres yok" body="İlk teslimat adresinizi ekleyebilirsiniz." /> : savedAddresses.map(a => (
          <article key={a.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-bold">{a.label} {a.is_default ? <span className="text-xs text-brand-green">• Varsayılan</span> : null}</div>
                <p className="mt-1 text-sm">{a.recipient_name} • {a.phone}</p>
                <p className="mt-1 break-words text-sm text-gray-500">{a.address_line}{a.neighborhood ? `, ${a.neighborhood}` : ''}, {a.district}, {a.province}{a.postal_code ? ` ${a.postal_code}` : ''} • {a.country_code}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
                <button type="button" disabled={!addressContractValid} onClick={() => startEdit(a)} className="min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Düzenle</button>
                <button type="button" disabled={!addressContractValid} onClick={() => { setError(''); setStatus(''); setDeleteCandidate(a); }} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300">Sil</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-4">
          <form
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-dialog-title"
            aria-describedby="address-dialog-description"
            tabIndex={-1}
            onSubmit={save}
            className="mx-auto mt-8 max-w-xl rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="address-dialog-title" className="text-lg font-bold">{editing.id ? 'Adresi düzenle' : 'Yeni adres'}</h3>
                <p id="address-dialog-description" className="mt-1 text-sm text-gray-500">Teslimat için gerekli alanları eksiksiz girin. Ülke kodunu TR, CH, DE gibi iki harfli ISO koduyla yazın.</p>
              </div>
              <button type="button" disabled={saving} onClick={closeEditor} aria-label="Adres penceresini kapat" className="grid min-h-11 min-w-11 place-items-center rounded-xl border disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            {formError ? <div id="address-form-error" role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{formError}</div> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fields.map(field => {
                const value = String(editing[field.key] ?? '');
                return (
                  <label key={field.key} className="block">
                    <span className="text-sm font-semibold">{field.label}{field.required ? ' *' : ''}</span>
                    <input
                      value={value}
                      required={field.required}
                      autoComplete={field.autoComplete}
                      inputMode={'inputMode' in field ? field.inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode'] : undefined}
                      maxLength={field.maxLength}
                      pattern={field.key === 'country_code' ? '[A-Za-z]{2}' : undefined}
                      disabled={saving}
                      aria-describedby={formError ? 'address-form-error' : undefined}
                      onChange={e => {
                        if (formError) setFormError('');
                        const nextValue = field.key === 'country_code' ? e.target.value.toUpperCase().slice(0, 2) : e.target.value;
                        setEditing({ ...editing, [field.key]: nextValue });
                      }}
                      className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60"
                    />
                  </label>
                );
              })}
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Açık adres *</span>
              <textarea required minLength={10} maxLength={1000} autoComplete="street-address" value={editing.address_line} disabled={saving} aria-describedby={formError ? 'address-form-error' : undefined} onChange={e => { if (formError) setFormError(''); setEditing({ ...editing, address_line: e.target.value }); }}
                rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Teslimat notu</span>
              <textarea maxLength={500} value={editing.delivery_notes || ''} disabled={saving} onChange={e => setEditing({ ...editing, delivery_notes: e.target.value })}
                rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" />
            </label>
            <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl px-1">
              <input type="checkbox" checked={editing.is_default === true} disabled={saving} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} className="h-5 w-5" />
              <span>Varsayılan teslimat adresim yap</span>
            </label>
            <div aria-live="polite" className="sr-only">{saving ? 'Adres kaydediliyor.' : ''}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" disabled={saving} onClick={closeEditor} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button>
              <button disabled={saving} className="min-h-11 rounded-xl bg-brand-green font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteCandidate ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            ref={deleteDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-address-title"
            aria-describedby="delete-address-description"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none dark:bg-gray-900"
          >
            <div className="flex items-start gap-3">
              <div aria-hidden="true" className="rounded-xl bg-red-50 p-2 text-red-700 dark:bg-red-950/30 dark:text-red-300"><Trash2 className="h-5 w-5" /></div>
              <div>
                <h3 id="delete-address-title" className="text-lg font-bold">Adresi silmek istiyor musunuz?</h3>
                <p id="delete-address-description" className="mt-1 text-sm text-gray-500">“{deleteCandidate.label}” hesabınızdan kaldırılacak. Bu işlem geri alınamaz.</p>
              </div>
            </div>
            <div aria-live="polite" className="sr-only">{deleteBusy ? 'Adres siliniyor.' : ''}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" disabled={deleteBusy} onClick={() => setDeleteCandidate(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button>
              <button type="button" disabled={deleteBusy} onClick={() => void confirmRemove()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{deleteBusy ? 'Siliniyor…' : 'Adresi Sil'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
