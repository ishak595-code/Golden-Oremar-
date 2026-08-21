import React, { useEffect, useMemo, useState } from 'react';
import { Check, Info, Loader2, RefreshCw, Search, Send, Store, User, Users } from 'lucide-react';
import { adminListPlatformUsers, type AdminPlatformUser } from './userAdminApi';
import {
  adminBroadcastNotification,
  adminNotificationAudienceCount,
  notificationAdminErrorMessage,
  type NotificationTargetScope,
  type PlatformNotificationType,
} from './notificationAdminApi';

function userLabel(user:AdminPlatformUser){return user.displayName||user.email||user.id;}

export function AdminNotifications() {
  const [users, setUsers] = useState<AdminPlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [audienceCount, setAudienceCount] = useState(0);
  const [audienceError, setAudienceError] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [form, setForm] = useState({
    scope: 'all' as NotificationTargetScope,
    userId: '',
    type: 'system' as PlatformNotificationType,
    title: '',
    message: '',
    actionUrl: '',
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      setUsers((await adminListPlatformUsers()).filter(user => user.status === 'active'));
    } catch (err) {
      setError(notificationAdminErrorMessage(err, 'Kullanıcı listesi yüklenemedi.'));
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (form.scope === 'specific' && !form.userId) {
        setAudienceCount(0);
        setAudienceError('');
        setCountLoading(false);
        return;
      }
      setCountLoading(true);
      setAudienceError('');
      try {
        const count = await adminNotificationAudienceCount(form.scope, form.userId || null);
        if (!cancelled) setAudienceCount(count);
      } catch (err) {
        if (!cancelled) {
          setAudienceCount(0);
          setAudienceError(notificationAdminErrorMessage(err, 'Hedef kitle sayısı hesaplanamadı.'));
        }
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [form.scope, form.userId]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLocaleLowerCase('tr-TR');
    const active = users.filter(user => user.status === 'active');
    const matches = q
      ? active.filter(user => `${userLabel(user)} ${user.email||''} ${user.primaryRole} ${user.roles.join(' ')}`.toLocaleLowerCase('tr-TR').includes(q))
      : active;
    const limited = matches.slice(0, 100);
    const selected = active.find(user => user.id === form.userId);
    if (selected && !limited.some(user => user.id === selected.id)) return [selected, ...limited].slice(0, 100);
    return limited;
  }, [users, userSearch, form.userId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || countLoading || audienceError || audienceCount < 1) return;
    setSending(true);
    setError('');
    try {
      const result = await adminBroadcastNotification({
        scope: form.scope,
        userId: form.userId || null,
        type: form.type,
        title: form.title,
        message: form.message,
        actionUrl: form.actionUrl || null,
      });
      showToast(`${result.recipientCount.toLocaleString('tr-TR')} kullanıcı için bildirim oluşturuldu.`);
      setForm(current => ({ ...current, title: '', message: '', actionUrl: '' }));
    } catch (err) {
      setError(notificationAdminErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const targetCard = (scope: NotificationTargetScope, label: string, icon: React.ReactNode, helper: string) => (
    <button
      type="button"
      onClick={() => setForm(current => ({ ...current, scope, userId: scope === 'specific' ? current.userId : '' }))}
      aria-pressed={form.scope === scope}
      className={`min-h-24 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${form.scope === scope ? 'border-brand-green bg-brand-green/10 text-brand-green' : 'border-gray-200 bg-white text-gray-700 hover:border-brand-green/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
    >
      <div className="flex items-center gap-2 font-semibold">{icon}{label}</div>
      <div className="mt-2 text-xs opacity-75">{helper}</div>
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bildirim Merkezi</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Uygulama içi bildirim gerçek Supabase kayıtlarına yazılır. Kayıtlı cihazlarda push açıksa ve kullanıcı ilgili bildirim türüne izin verdiyse push kuyruğu otomatik oluşturulur.</p>
        </div>
        <button type="button" onClick={() => void loadUsers()} disabled={loadingUsers} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          <RefreshCw className={`mr-2 inline h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} aria-hidden="true" /> Kullanıcıları yenile
        </button>
      </header>

      {error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="notification-audience-title">
          <div className="flex items-start justify-between gap-3">
            <div><h3 id="notification-audience-title" className="font-bold text-gray-900 dark:text-white">Hedef kitle</h3><p className="mt-1 text-xs text-gray-500">Yalnızca aktif hesaplar hedeflenir.</p></div>
            <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-900 dark:bg-gray-700 dark:text-white" role="status" aria-live="polite" aria-atomic="true">{countLoading ? 'Hesaplanıyor' : audienceError ? 'Alıcı sayısı doğrulanamadı' : `${audienceCount.toLocaleString('tr-TR')} alıcı`}</div>
          </div>
          {audienceError ? <div id="notification-audience-error" role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">{audienceError}</div> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {targetCard('all', 'Tüm aktif kullanıcılar', <Users className="h-5 w-5" aria-hidden="true" />, 'Aktif müşteri ve satıcı hesapları')}
            {targetCard('producer', 'Aktif satıcılar', <Store className="h-5 w-5" aria-hidden="true" />, 'Aktif üretici profiline sahip kullanıcılar')}
            {targetCard('specific', 'Belirli kullanıcı', <User className="h-5 w-5" aria-hidden="true" />, 'Tek bir aktif hesaba gönder')}
          </div>

          {form.scope === 'specific' && <div className="mt-4 space-y-3">
            <label className="relative block"><span className="sr-only">Kullanıcı ara</span><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" /><input type="search" maxLength={160} value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="İsim veya e-posta ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
            <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kullanıcı</span><select required aria-describedby={audienceError ? 'notification-audience-error' : undefined} value={form.userId} onChange={event => setForm(current => ({ ...current, userId: event.target.value }))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="">Kullanıcı seçin</option>{filteredUsers.map(user => <option key={user.id} value={user.id}>{userLabel(user)} - {user.email||user.primaryRole}</option>)}</select></label>
          </div>}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-labelledby="notification-content-title">
          <h3 id="notification-content-title" className="font-bold text-gray-900 dark:text-white">Bildirim içeriği</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Tür</span><select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as PlatformNotificationType }))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="system">Sistem</option><option value="campaign">Kampanya</option><option value="producer">Satıcı</option><option value="order">Sipariş</option><option value="payment">Ödeme</option><option value="shipment">Kargo</option><option value="return">İade</option></select></label>
            <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Uygulama içi bağlantı (isteğe bağlı)</span><input maxLength={2048} value={form.actionUrl} onChange={event => setForm(current => ({ ...current, actionUrl: event.target.value }))} placeholder="/?tab=account veya güvenli HTTPS bağlantısı" className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Başlık</span><input required minLength={2} maxLength={160} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Mesaj</span><textarea required minLength={2} maxLength={5000} rows={6} value={form.message} onChange={event => setForm(current => ({ ...current, message: event.target.value }))} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
          <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><strong>E-posta gönderimi bu ekranda taklit edilmiyor.</strong><p className="mt-1">Gerçek bir e-posta sağlayıcısı ve teslimat denetimi bağlanana kadar yalnızca güvenli uygulama içi bildirim ve tercih uyumlu push akışı kullanılır.</p></div></div>
        </section>

        <button type="submit" disabled={sending || countLoading || Boolean(audienceError) || audienceCount < 1 || form.title.trim().length < 2 || form.message.trim().length < 2} className="min-h-12 w-full rounded-xl bg-brand-green px-6 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
          {sending ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Gönderiliyor</span> : <span className="flex items-center justify-center gap-2"><Send className="h-5 w-5" aria-hidden="true" /> {audienceError ? 'Alıcı sayısını doğrulayın' : `${audienceCount.toLocaleString('tr-TR')} kullanıcıya bildirimi oluştur`}</span>}
        </button>
      </form>

      {toast && <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl"><Check className="h-5 w-5 text-green-400" aria-hidden="true" /> {toast}</div>}
    </div>
  );
}
