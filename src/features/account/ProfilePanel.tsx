import React, { useEffect, useState } from 'react';
import { RefreshCw, Upload, User } from 'lucide-react';
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
  const [displayName, setDisplayName] = useState(p.display_name);
  const [phone, setPhone] = useState(p.phone ?? '');
  const [locale, setLocale] = useState(p.locale);
  const [marketingConsent, setMarketingConsent] = useState(p.marketing_consent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [avatarConfirmOpen, setAvatarConfirmOpen] = useState(false);
  const avatarConfirmRef = useAccessibleDialog<HTMLDivElement>(avatarConfirmOpen, () => {
    if (!avatarBusy) setAvatarConfirmOpen(false);
  });
  
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(timer); }, [message]);

  useEffect(() => {
    setDisplayName(p.display_name);
    setPhone(p.phone ?? '');
    setLocale(p.locale);
    setMarketingConsent(p.marketing_consent);
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
    setUploadProgress('');
    if (!AVATAR_TYPES.has(file.type)) {
      setError(`Profil fotoğrafı JPEG, PNG, WebP veya AVIF olmalıdır. Seçilen dosya tipi: ${file.type || 'bilinmiyor'}.`);
      return;
    }
    if (file.size <= 0) {
      setError('Profil fotoğrafı boş olamaz. Lütfen geçerli bir fotoğraf seçin.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`Profil fotoğrafı en fazla 5 MB olabilir. Seçilen dosya ${sizeMB} MB. Lütfen daha küçük bir fotoğraf seçin.`);
      return;
    }
    try {
      setAvatarBusy(true);
      setUploadProgress('Fotoğraf doğrulanıyor…');
      const previous = p.avatar_path;
      setUploadProgress('Fotoğraf yükleniyor…');
      const result = await uploadCustomerAvatar(p.id, file);
      if (previous && previous !== result.avatar_path) {
        const { supabase } = await import('../../lib/supabase');
        await supabase.storage.from('user-private').remove([previous]).catch(()=>{});
      }
      setUploadProgress('Profil bilgisi güncelleniyor…');
      await onChanged();
      setUploadProgress('');
      setMessage('✓ Profil fotoğrafınız güncellendi.');
    } catch (err: unknown) {
      setUploadProgress('');
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        setError('Bağlantı hatası. İnternet bağlantınızı kontrol edip yeniden deneyin.');
      } else if (message.includes('size') || message.includes('too large')) {
        setError('Dosya çok büyük. Lütfen 5 MB altında bir fotoğraf seçin.');
      } else if (message.includes('type') || message.includes('format')) {
        setError('Dosya tipi desteklenmiyor. Lütfen JPEG, PNG, WebP veya AVIF fotoğraf seçin.');
      } else {
        setError('Profil fotoğrafı şu anda güncellenemedi. Lütfen yeniden deneyin.');
      }
    } finally {
      setAvatarBusy(false);
      setUploadProgress('');
    }
  }

  async function confirmRemoveAvatar() {
    if (avatarBusy || !p.avatar_path) return;
    try {
      setAvatarBusy(true);
      setError('');
      setMessage('');
      setUploadProgress('');
      await removeCustomerAvatar(p.avatar_path);
      setAvatarConfirmOpen(false);
      await onChanged();
      setMessage('✓ Profil fotoğrafınız kaldırıldı.');
    } catch {
      setAvatarConfirmOpen(false);
      setError('Profil fotoğrafı şu anda kaldırılamadı. Lütfen yeniden deneyin.');
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
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
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
    if (normalizedPhone && !/^[+()0-9 .\-]{10,40}$/.test(normalizedPhone)) {
      setError('Telefon numarası yalnız rakam ve standart telefon işaretlerini içermelidir.');
      return;
    }
    if (normalizedPhone && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setError('Telefon numarası 10 ile 15 rakam arasında olmalıdır.');
      return;
    }
    if (!PROFILE_LOCALES.has(locale)) {
      setError('Bu dil seçeneği kullanılamıyor. Lütfen listeden başka bir dil seçin.');
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
      setMessage('✓ Profil bilgileriniz güncellendi.');
    } catch {
      setError('Profil bilgileriniz şu anda güncellenemedi. Lütfen yeniden deneyin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Profilimi Düzenle" description="Ad, telefon, uygulama dili ve pazarlama izninizi yönetin.">
      <form onSubmit={save} className="space-y-4" aria-busy={saving || avatarBusy}>
        {error ? <ErrorState message={error} /> : null}
        {message ? <div role="status" aria-live="polite" className="rounded-2xl border-2 border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-950/30 dark:text-green-200">{message}</div> : null}
        {uploadProgress ? <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin"/>{uploadProgress}</div> : null}

        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 p-4 dark:border-gray-700">
          <div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-brand-gold/15 text-3xl font-bold text-brand-gold" aria-label="Profil fotoğrafı">
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <User aria-hidden="true" className="h-12 w-12"/>}
            {!avatarUrl && (p.display_name || p.email) ? <span className="absolute text-3xl font-bold">{(p.display_name || p.email || '?').charAt(0).toUpperCase()}</span> : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-brand-green bg-white px-4 py-2.5 font-semibold text-brand-text shadow-sm hover:bg-brand-green/5 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-gold disabled:opacity-50 dark:bg-gray-900">
              {avatarBusy ? <><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin"/>Fotoğraf işleniyor…</> : <><Upload aria-hidden="true" className="h-4 w-4"/>Fotoğraf değiştir</>}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={avatarBusy}
                onChange={e => { void changeAvatar(e.target.files?.[0]); e.currentTarget.value=''; }}
              />
            </label>
            {p.avatar_path ? <button type="button" disabled={avatarBusy} onClick={() => { setError(''); setMessage(''); setUploadProgress(''); setAvatarConfirmOpen(true); }} className="min-h-11 rounded-xl border-2 border-red-300 px-4 font-semibold text-red-700 disabled:opacity-50 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-950/20">Fotoğrafı kaldır</button> : null}
          </div>
          <p className="text-center text-xs leading-5 text-gray-500">JPEG, PNG, WebP veya AVIF formatında, en fazla 5 MB boyutunda fotoğraf yükleyebilirsiniz. Fotoğrafınız yalnız hesabınız için güvenli şekilde saklanır.</p>
        </div>

        <label className="block">
          <span className="text-sm font-semibold">E-posta</span>
          <input name="email" value={p.email} readOnly autoComplete="email" className="mt-1 min-h-11 w-full rounded-xl border bg-gray-100 px-3 text-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          <span className="mt-1 block text-xs text-gray-500">Hesap e-postanız burada görüntülenir ancak bu ekrandan değiştirilemez.</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Ad Soyad</span>
          <input name="display_name" required minLength={2} maxLength={120} disabled={saving} value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" enterKeyHint="done"
            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 disabled:opacity-60 dark:border-gray-700" />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Telefon</span>
          <input name="phone" maxLength={40} disabled={saving} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" enterKeyHint="done"
            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 disabled:opacity-60 dark:border-gray-700" />
          <span className="mt-1 block text-xs text-gray-500">Telefon giriyorsanız 10-15 rakam içermelidir.</span>
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Uygulama dili</span>
          <select required disabled={saving} value={locale} onChange={e => setLocale(e.target.value as AccountOverview['profile']['locale'])}
            className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-transparent px-3 disabled:opacity-60 dark:border-gray-700">
            <option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option>
            <option value="fr">Français</option><option value="ku">Kurdî</option><option value="ar">العربية</option>
          </select>
        </label>

        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <input disabled={saving} type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="mt-1 h-5 w-5" />
          <span>
            <span className="block font-semibold">Kampanya ve pazarlama iletişimi</span>
            <span className="block text-sm text-gray-500">Kapattığınızda kampanya bildirimleri de durdurulur.</span>
          </span>
        </label>

        <button disabled={saving || avatarBusy} aria-busy={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand-green bg-brand-green px-4 font-bold text-white shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:hover:bg-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
          {saving ? <><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin"/>Kaydediliyor…</> : 'Değişiklikleri Kaydet'}
        </button>
      </form>

      {avatarConfirmOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
        <div ref={avatarConfirmRef} role="alertdialog" aria-modal="true" aria-labelledby="avatar-remove-title" aria-describedby="avatar-remove-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900">
          <h3 id="avatar-remove-title" className="text-lg font-bold">Profil fotoğrafını kaldırmak istiyor musunuz?</h3>
          <p id="avatar-remove-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Profil fotoğrafınız hesabınızdan kaldırılacak. Daha sonra yeni bir fotoğraf ekleyebilirsiniz.</p>
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
