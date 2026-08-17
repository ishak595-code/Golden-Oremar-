import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Panel, EmptyState, ErrorState } from './ui';
import { deleteAddress, upsertAddress } from './api';
import type { Address } from './types';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';

const blank: Address = {
  label: 'Ev', recipient_name: '', phone: '', country_code: 'TR',
  province: '', district: '', neighborhood: '', address_line: '',
  postal_code: '', delivery_notes: '', is_default: false
};

const fields = [
  { key: 'label', label: 'Adres etiketi', autoComplete: 'off', maxLength: 60 },
  { key: 'recipient_name', label: 'Alıcı adı', autoComplete: 'name', required: true, maxLength: 120 },
  { key: 'phone', label: 'Telefon', autoComplete: 'tel', inputMode: 'tel', required: true, maxLength: 32 },
  { key: 'country_code', label: 'Ülke kodu', autoComplete: 'country', required: true, maxLength: 2 },
  { key: 'province', label: 'İl/Bölge', autoComplete: 'address-level1', required: true, maxLength: 120 },
  { key: 'district', label: 'İlçe/Şehir', autoComplete: 'address-level2', required: true, maxLength: 120 },
  { key: 'neighborhood', label: 'Mahalle/Köy', autoComplete: 'address-level3', maxLength: 160 },
  { key: 'postal_code', label: 'Posta kodu', autoComplete: 'postal-code', inputMode: 'text', maxLength: 24 },
] as const;

function validateAddress(address: Address) {
  const recipient = String(address.recipient_name || '').trim();
  const phone = String(address.phone || '').trim();
  const country = String(address.country_code || '').trim().toUpperCase();
  const province = String(address.province || '').trim();
  const district = String(address.district || '').trim();
  const line = String(address.address_line || '').trim();
  if (recipient.length < 2) return 'Alıcı adı en az 2 karakter olmalıdır.';
  if (phone.replace(/[^0-9]/g, '').length < 7) return 'Geçerli bir teslimat telefonu yazın.';
  if (!/^[A-Z]{2}$/.test(country)) return 'Ülke kodu iki harfli ISO kodu olmalıdır.';
  if (province.length < 2) return 'İl veya bölge bilgisini yazın.';
  if (district.length < 2) return 'İlçe veya şehir bilgisini yazın.';
  if (line.length < 5) return 'Açık adres en az 5 karakter olmalıdır.';
  if (line.length > 500) return 'Açık adres en fazla 500 karakter olabilir.';
  if (String(address.delivery_notes || '').length > 500) return 'Teslimat notu en fazla 500 karakter olabilir.';
  return '';
}

export default function AddressesPanel({ addresses, onChanged }: { addresses: Address[]; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<Address | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const editDialogRef = useAccessibleDialog<HTMLFormElement>(!!editing, () => { if (!saving) setEditing(null); });
  const deleteDialogRef = useAccessibleDialog<HTMLDivElement>(!!deleteCandidate, () => { if (!deleteBusy) setDeleteCandidate(null); });

  function startCreate() {
    setError('');
    setStatus('');
    setEditing({ ...blank });
  }

  function startEdit(address: Address) {
    setError('');
    setStatus('');
    setEditing({ ...address });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || saving) return;
    setError('');
    setStatus('');
    const normalized = {
      ...editing,
      label: String(editing.label || '').trim() || 'Teslimat',
      recipient_name: String(editing.recipient_name || '').trim(),
      phone: String(editing.phone || '').trim(),
      country_code: String(editing.country_code || '').trim().toUpperCase(),
      province: String(editing.province || '').trim(),
      district: String(editing.district || '').trim(),
      neighborhood: String(editing.neighborhood || '').trim() || null,
      address_line: String(editing.address_line || '').trim(),
      postal_code: String(editing.postal_code || '').trim() || null,
      delivery_notes: String(editing.delivery_notes || '').trim() || null,
    } as Address;
    const issue = validateAddress(normalized);
    if (issue) { setError(issue); return; }
    try {
      setSaving(true);
      await upsertAddress(normalized);
      setEditing(null);
      await onChanged();
      setStatus(editing.id ? 'Adres güncellendi.' : 'Yeni adres kaydedildi.');
    } catch (err: any) {
      setError(err?.message || 'Adres kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!deleteCandidate?.id || deleteBusy) return;
    setError('');
    setStatus('');
    try {
      setDeleteBusy(true);
      await deleteAddress(deleteCandidate.id);
      setDeleteCandidate(null);
      await onChanged();
      setStatus('Adres silindi.');
    } catch (err: any) {
      setError(err?.message || 'Adres silinemedi.');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Panel title="Adreslerim" description="Teslimat adreslerinizi ekleyin ve varsayılan adresinizi seçin.">
      {error ? <ErrorState message={error} /> : null}
      {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}
      <button type="button" onClick={startCreate} className="mb-4 min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
        Yeni adres ekle
      </button>

      <div className="space-y-3">
        {addresses.length === 0 ? <EmptyState title="Kayıtlı adres yok" body="İlk teslimat adresinizi ekleyebilirsiniz." /> : addresses.map(a => (
          <article key={a.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-bold">{a.label} {a.is_default ? <span className="text-xs text-brand-green">• Varsayılan</span> : null}</div>
                <p className="mt-1 text-sm">{a.recipient_name} • {a.phone}</p>
                <p className="mt-1 break-words text-sm text-gray-500">{a.address_line}, {a.neighborhood ? `${a.neighborhood}, ` : ''}{a.district}/{a.province} {a.postal_code || ''} • {a.country_code}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
                <button type="button" onClick={() => startEdit(a)} className="min-h-11 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Düzenle</button>
                <button type="button" onClick={() => { setError(''); setStatus(''); setDeleteCandidate(a); }} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300">Sil</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-4" aria-hidden="false">
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
                <p id="address-dialog-description" className="mt-1 text-sm text-gray-500">Teslimat için gerekli alanları eksiksiz girin.</p>
              </div>
              <button type="button" disabled={saving} onClick={() => setEditing(null)} aria-label="Adres penceresini kapat" className="grid min-h-11 min-w-11 place-items-center rounded-xl border disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {fields.map(field => {
                const value = String((editing as any)[field.key] || '');
                return (
                  <label key={field.key} className="block">
                    <span className="text-sm font-semibold">{field.label}{'required' in field && field.required ? ' *' : ''}</span>
                    <input
                      value={value}
                      required={'required' in field ? field.required : false}
                      autoComplete={field.autoComplete}
                      inputMode={'inputMode' in field ? field.inputMode as any : undefined}
                      maxLength={field.maxLength}
                      pattern={field.key === 'country_code' ? '[A-Za-z]{2}' : undefined}
                      disabled={saving}
                      onChange={e => {
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
              <textarea required minLength={5} maxLength={500} autoComplete="street-address" value={editing.address_line} disabled={saving} onChange={e => setEditing({ ...editing, address_line: e.target.value })}
                rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Teslimat notu</span>
              <textarea maxLength={500} value={editing.delivery_notes || ''} disabled={saving} onChange={e => setEditing({ ...editing, delivery_notes: e.target.value })}
                rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3 disabled:opacity-60" />
            </label>
            <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl px-1">
              <input type="checkbox" checked={editing.is_default} disabled={saving} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} className="h-5 w-5" />
              <span>Varsayılan teslimat adresim yap</span>
            </label>
            <div aria-live="polite" className="sr-only">{saving ? 'Adres kaydediliyor.' : ''}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" disabled={saving} onClick={() => setEditing(null)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button>
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
                <p id="delete-address-description" className="mt-1 text-sm text-gray-500">“{deleteCandidate.label}” adresi hesabınızdan kaldırılacak. Bu işlem geri alınamaz.</p>
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
