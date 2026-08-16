
import React, { useState } from 'react';
import { Panel, EmptyState, ErrorState } from './ui';
import { deleteAddress, upsertAddress } from './api';
import type { Address } from './types';

const blank: Address = {
  label: 'Ev', recipient_name: '', phone: '', country_code: 'TR',
  province: '', district: '', neighborhood: '', address_line: '',
  postal_code: '', delivery_notes: '', is_default: false
};

export default function AddressesPanel({ addresses, onChanged }: { addresses: Address[]; onChanged: () => Promise<void> | void }) {
  const [editing, setEditing] = useState<Address | null>(null);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      await upsertAddress(editing);
      setEditing(null);
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Adres kaydedilemedi.');
    }
  }

  async function remove(id?: string) {
    if (!id) return;
    setError('');
    try {
      await deleteAddress(id);
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Adres silinemedi.');
    }
  }

  return (
    <Panel title="Adreslerim" description="Teslimat adreslerinizi ekleyin ve varsayılan adresinizi seçin.">
      {error ? <ErrorState message={error} /> : null}
      <button onClick={() => setEditing({ ...blank })} className="mb-4 min-h-11 rounded-xl bg-brand-green px-4 font-bold text-white">
        Yeni adres ekle
      </button>

      <div className="space-y-3">
        {addresses.length === 0 ? <EmptyState title="Kayıtlı adres yok" body="İlk teslimat adresinizi ekleyebilirsiniz." /> : addresses.map(a => (
          <article key={a.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">{a.label} {a.is_default ? <span className="text-xs text-brand-green">• Varsayılan</span> : null}</div>
                <p className="mt-1 text-sm">{a.recipient_name} • {a.phone}</p>
                <p className="mt-1 text-sm text-gray-500">{a.address_line}, {a.neighborhood ? `${a.neighborhood}, ` : ''}{a.district}/{a.province} {a.postal_code || ''} • {a.country_code}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setEditing({ ...a })} className="min-h-11 rounded-lg border px-3 text-sm font-semibold">Düzenle</button>
                <button onClick={() => remove(a.id)} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700">Sil</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div role="dialog" aria-modal="true" aria-label="Adres düzenleme" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <form onSubmit={save} className="mx-auto mt-8 max-w-xl rounded-2xl bg-white dark:bg-gray-900 p-5">
            <h3 className="text-lg font-bold">{editing.id ? 'Adresi düzenle' : 'Yeni adres'}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['label','Adres etiketi'], ['recipient_name','Alıcı adı'], ['phone','Telefon'],
                ['country_code','Ülke kodu'], ['province','İl/Bölge'], ['district','İlçe/Şehir'],
                ['neighborhood','Mahalle/Köy'], ['postal_code','Posta kodu'],
              ].map(([key,label]) => (
                <label key={key} className="block">
                  <span className="text-sm font-semibold">{label}</span>
                  <input value={(editing as any)[key] || ''} onChange={e => setEditing({ ...editing, [key]: e.target.value })}
                    className="mt-1 w-full min-h-11 rounded-xl border bg-transparent px-3" />
                </label>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Açık adres</span>
              <textarea value={editing.address_line} onChange={e => setEditing({ ...editing, address_line: e.target.value })}
                rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-semibold">Teslimat notu</span>
              <textarea value={editing.delivery_notes || ''} onChange={e => setEditing({ ...editing, delivery_notes: e.target.value })}
                rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3" />
            </label>
            <label className="mt-3 flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={editing.is_default} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} className="h-5 w-5" />
              <span>Varsayılan teslimat adresim yap</span>
            </label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setEditing(null)} className="min-h-11 flex-1 rounded-xl border font-semibold">Vazgeç</button>
              <button className="min-h-11 flex-1 rounded-xl bg-brand-green font-bold text-white">Kaydet</button>
            </div>
          </form>
        </div>
      ) : null}
    </Panel>
  );
}
