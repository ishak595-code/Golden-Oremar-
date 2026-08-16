
import React, { useEffect, useState } from 'react';
import { Panel, ErrorState } from './ui';
import { getPrivateAssetSignedUrl, removeCustomerAvatar, updateProfile, uploadCustomerAvatar } from './api';
import type { AccountOverview } from './types';

export default function ProfilePanel({ overview, onChanged }: {
  overview: AccountOverview;
  onChanged: () => Promise<void> | void;
}) {
  const p = overview.profile;
  const [displayName, setDisplayName] = useState(p.display_name || '');
  const [phone, setPhone] = useState(p.phone || '');
  const [locale, setLocale] = useState(p.locale || 'tr');
  const [marketingConsent, setMarketingConsent] = useState(!!p.marketing_consent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    setDisplayName(p.display_name || '');
    setPhone(p.phone || '');
    setLocale(p.locale || 'tr');
    setMarketingConsent(!!p.marketing_consent);
  }, [p.display_name, p.phone, p.locale, p.marketing_consent]);

  useEffect(() => {
    let active = true;
    if (!p.avatar_path) {
      setAvatarUrl('');
      return;
    }
    getPrivateAssetSignedUrl(p.avatar_path)
      .then(url => { if (active) setAvatarUrl(url); })
      .catch(() => { if (active) setAvatarUrl(''); });
    return () => { active = false; };
  }, [p.avatar_path]);

  async function changeAvatar(file?: File) {
    if (!file) return;
    try {
      setAvatarBusy(true);
      setError('');
      const previous = p.avatar_path;
      const result = await uploadCustomerAvatar(p.id, file);
      if (previous && previous !== result.avatar_path) {
        // Only delete the old object after the database points to the new one.
        // Storage RLS ensures the user can remove only their own path.
        const { supabase } = await import('../../lib/supabase');
        await supabase.storage.from('user-private').remove([previous]).catch(()=>{});
      }
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Profil fotoğrafı güncellenemedi.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    try {
      setAvatarBusy(true);
      setError('');
      await removeCustomerAvatar(p.avatar_path);
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Profil fotoğrafı kaldırılamadı.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (displayName.trim().length < 2) {
      setError('Ad soyad en az 2 karakter olmalıdır.');
      return;
    }
    try {
      setSaving(true);
      await updateProfile({
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        locale,
        marketingConsent,
      });
      await onChanged();
      setMessage('Profil bilgileriniz güncellendi.');
    } catch (err: any) {
      setError(err?.message || 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Profilimi Düzenle" description="Ad, telefon, uygulama dili ve pazarlama izninizi yönetin.">
      <form onSubmit={save} className="space-y-4">
        {error ? <ErrorState message={error} /> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</div> : null}

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand-gold/15 text-3xl font-bold text-brand-gold" aria-label="Profil fotoğrafı">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (p.display_name || p.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="min-h-11 cursor-pointer rounded-xl border px-4 py-2.5 font-semibold">
              {avatarBusy ? 'Fotoğraf işleniyor…' : 'Fotoğraf değiştir'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={avatarBusy}
                onChange={e => { void changeAvatar(e.target.files?.[0]); e.currentTarget.value=''; }}
              />
            </label>
            {p.avatar_path ? <button type="button" disabled={avatarBusy} onClick={removeAvatar} className="min-h-11 rounded-xl border border-red-200 px-4 font-semibold text-red-700 disabled:opacity-50">Fotoğrafı kaldır</button> : null}
          </div>
          <p className="text-center text-xs text-gray-500">JPEG, PNG, WebP veya AVIF; en fazla 5 MB. Dosya private alanda tutulur.</p>
        </div>

        <label className="block">
          <span className="text-sm font-semibold">E-posta</span>
          <input value={p.email || ''} readOnly className="mt-1 w-full min-h-11 rounded-xl border bg-gray-100 px-3 text-gray-600" />
          <span className="mt-1 block text-xs text-gray-500">E-posta kimlik hesabınızdan gelir; burada doğrudan değiştirilemez.</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Ad Soyad</span>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name"
            className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Telefon</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel"
            className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Uygulama dili</span>
          <select value={locale} onChange={e => setLocale(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3">
            <option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option>
            <option value="fr">Français</option><option value="ku">Kurdî</option><option value="ar">العربية</option>
          </select>
        </label>

        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>
            <span className="block font-semibold">Kampanya ve pazarlama iletişimi</span>
            <span className="block text-sm text-gray-500">Kapattığınızda kampanya push tercihi de backend tarafından kapatılır.</span>
          </span>
        </label>

        <button disabled={saving} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50">
          {saving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
        </button>
      </form>
    </Panel>
  );
}
