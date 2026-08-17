import React, { useEffect, useState } from 'react';
import { Panel, ErrorState } from './ui';
import { getPrivateAssetSignedUrl, removeCustomerAvatar, updateProfile, uploadCustomerAvatar } from './api';
import type { AccountOverview } from './types';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';

const PROFILE_LOCALES = new Set(['tr','en','de','fr','ku','ar']);
const AVATAR_TYPES = new Set(['image/jpeg','image/png','image/webp','image/avif']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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
  const [avatarConfirmOpen, setAvatarConfirmOpen] = useState(false);
  const avatarConfirmRef = useAccessibleDialog<HTMLDivElement>(avatarConfirmOpen, () => {
    if (!avatarBusy) setAvatarConfirmOpen(false);
  });

  useEffect(() => {
    setDisplayName(p.display_name || '');
    setPhone(p.phone || '');
    setLocale(PROFILE_LOCALES.has(String(p.locale || '')) ? String(p.locale) : 'tr');
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
    if (!file || avatarBusy) return;
    setError('');
    setMessage('');
    if (!AVATAR_TYPES.has(file.type)) {
      setError('Profil fotoğrafı JPEG, PNG, WebP veya AVIF olmalıdır.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
      setError('Profil fotoğrafı en fazla 5 MB olabilir.');
      return;
    }
    try {
      setAvatarBusy(true);
      const previous = p.avatar_path;
      const result = await uploadCustomerAvatar(p.id, file);
      if (previous && previous !== result.avatar_path) {
        const { supabase } = await import('../../lib/supabase');
        await supabase.storage.from('user-private').remove([previous]).catch(()=>{});
      }
      await onChanged();
      setMessage('Profil fotoğrafınız güncellendi.');
    } catch (err: any) {
      setError(err?.message || 'Profil fotoğrafı güncellenemedi.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function confirmRemoveAvatar() {
    if (avatarBusy) return;
    try {
      setAvatarBusy(true);
      setError('');
      setMessage('');
      await removeCustomerAvatar(p.avatar_path);
      setAvatarConfirmOpen(false);
      await onChanged();
      setMessage('Profil fotoğrafınız kaldırıldı.');
    } catch (err: any) {
      setAvatarConfirmOpen(false);
      setError(err?.message || 'Profil fotoğrafı kaldırılamadı.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError('');
    setMessage('');
    const normalizedName = displayName.trim().replace(/\s+/g, ' ');
    const normalizedPhone = phone.trim();
    if (normalizedName.length < 2) {
      setError('Ad soyad en az 2 karakter olmalıdır.');
      return;
    }
    if (normalizedName.length > 120) {
      setError('Ad soyad en fazla 120 karakter olabilir.');
      return;
    }
    if (normalizedPhone.length > 40) {
      setError('Telefon numarası en fazla 40 karakter olabilir.');
      return;
    }
    if (normalizedPhone && !/^[+()0-9 .\-]{5,40}$/.test(normalizedPhone)) {
      setError('Telefon numarası yalnız rakam ve standart telefon işaretlerini içermelidir.');
      return;
    }
    if (!PROFILE_LOCALES.has(locale)) {
      setError('Desteklenmeyen uygulama dili seçildi.');
      return;
    }
    try {
      setSaving(true);
      await updateProfile({
        displayName: normalizedName,
        phone: normalizedPhone || null,
        locale,
        marketingConsent,
      });
      await onChanged();
      setDisplayName(normalizedName);
      setPhone(normalizedPhone);
      setMessage('Profil bilgileriniz güncellendi.');
    } catch (err: any) {
      setError(err?.message || 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Profilimi Düzenle" description="Ad, telefon, uygulama dili ve pazarlama izninizi yönetin.">
      <form onSubmit={save} className="space-y-4" aria-busy={saving || avatarBusy}>
        {error ? <ErrorState message={error} /> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{message}</div> : null}

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand-gold/15 text-3xl font-bold text-brand-gold" aria-label="Profil fotoğrafı">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (p.display_name || p.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="min-h-11 cursor-pointer rounded-xl border px-4 py-2.5 font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-gold">
              {avatarBusy ? 'Fotoğraf işleniyor…' : 'Fotoğraf değiştir'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={avatarBusy}
                onChange={e => { void changeAvatar(e.target.files?.[0]); e.currentTarget.value=''; }}
              />
            </label>
            {p.avatar_path ? <button type="button" disabled={avatarBusy} onClick={() => { setError(''); setMessage(''); setAvatarConfirmOpen(true); }} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Fotoğrafı kaldır</button> : null}
          </div>
          <p className="text-center text-xs text-gray-500">JPEG, PNG, WebP veya AVIF; en fazla 5 MB. Dosya private alanda tutulur.</p>
        </div>

        <label className="block">
          <span className="text-sm font-semibold">E-posta</span>
          <input value={p.email || ''} readOnly autoComplete="email" className="mt-1 min-h-11 w-full rounded-xl border bg-gray-100 px-3 text-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          <span className="mt-1 block text-xs text-gray-500">E-posta kimlik hesabınızdan gelir; burada doğrudan değiştirilemez.</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Ad Soyad</span>
          <input required minLength={2} maxLength={120} disabled={saving} value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name"
            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 disabled:opacity-60 dark:border-gray-700" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Telefon</span>
          <input maxLength={40} disabled={saving} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel"
            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 disabled:opacity-60 dark:border-gray-700" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Uygulama dili</span>
          <select disabled={saving} value={locale} onChange={e => setLocale(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 disabled:opacity-60 dark:border-gray-700">
            <option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option>
            <option value="fr">Français</option><option value="ku">Kurdî</option><option value="ar">العربية</option>
          </select>
        </label>

        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <input disabled={saving} type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>
            <span className="block font-semibold">Kampanya ve pazarlama iletişimi</span>
            <span className="block text-sm text-gray-500">Kapattığınızda kampanya push tercihi de backend tarafından kapatılır.</span>
          </span>
        </label>

        <button disabled={saving || avatarBusy} className="min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
          {saving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
        </button>
      </form>

      {avatarConfirmOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
        <div ref={avatarConfirmRef} role="alertdialog" aria-modal="true" aria-labelledby="avatar-remove-title" aria-describedby="avatar-remove-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900">
          <h3 id="avatar-remove-title" className="text-lg font-bold">Profil fotoğrafını kaldırmak istiyor musunuz?</h3>
          <p id="avatar-remove-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Profil fotoğrafı hesabınızdan ve size ait private depolama yolundan kaldırılacak. Yeni bir fotoğrafı daha sonra tekrar ekleyebilirsiniz.</p>
          <div aria-live="polite" className="sr-only">{avatarBusy ? 'Profil fotoğrafı kaldırılıyor.' : ''}</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" disabled={avatarBusy} onClick={() => setAvatarConfirmOpen(false)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button>
            <button type="button" disabled={avatarBusy} onClick={() => void confirmRemoveAvatar()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{avatarBusy ? 'Kaldırılıyor…' : 'Fotoğrafı Kaldır'}</button>
          </div>
        </div>
      </div> : null}
    </Panel>
  );
}
