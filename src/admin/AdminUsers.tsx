import React, { useEffect, useMemo, useState } from 'react';
import { Archive, BadgeCheck, Calendar, CheckCircle, Clock3, Eye, Loader2, RefreshCw, Search, Shield, Store, Users, X, XCircle } from 'lucide-react';
import { useCustomerSession } from '../features/auth/useCustomerSession';
import {
  adminArchivePlatformUser,
  adminListPlatformUsers,
  adminSetPlatformUserRole,
  adminSetPlatformUserStatus,
  userAdminErrorMessage,
  type AdminPlatformUser,
  type AdminPlatformUserRole,
} from './userAdminApi';

type ActionState =
  | { type: 'role'; user: AdminPlatformUser; role: AdminPlatformUserRole }
  | { type: 'status'; user: AdminPlatformUser; status: 'active' | 'blocked' }
  | { type: 'archive'; user: AdminPlatformUser }
  | null;

function roleLabel(role: AdminPlatformUserRole) {
  return ({ user: 'Üye', vendor: 'Satıcı', admin: 'Yönetici', super_admin: 'Süper Yönetici' } as const)[role];
}

function statusLabel(status: AdminPlatformUser['status']) {
  return status === 'active' ? 'Aktif' : status === 'deleted' ? 'Arşivlendi' : 'Engelli';
}

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return 'Bilinmiyor';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bilinmiyor';
  return date.toLocaleString('tr-TR', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

export function AdminUsers() {
  const { currentUser } = useCustomerSession();
  const [users, setUsers] = useState<AdminPlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminPlatformUserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminPlatformUser['status']>('all');
  const [selectedUser, setSelectedUser] = useState<AdminPlatformUser | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [reason, setReason] = useState('');

  const currentRoles = Array.isArray(currentUser?.roles) ? currentUser.roles.map(String) : [];
  const isSuperAdmin = currentRoles.includes('super_admin');
  const currentUserId = String(currentUser?.id || '');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setUsers(await adminListPlatformUsers());
    } catch (err) {
      setError(userAdminErrorMessage(err, 'Kullanıcı listesi yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return users.filter(user => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      if (!query) return true;
      return `${user.name} ${user.email} ${user.vendor_id || ''}`.toLocaleLowerCase('tr-TR').includes(query);
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const openAction = (next: NonNullable<ActionState>) => {
    setReason('');
    setError('');
    setAction(next);
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action || busyId) return;
    const activeAction = action;
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 8) {
      setError('Yönetim işlemi için en az 8 karakterlik gerekçe yazın.');
      return;
    }

    setBusyId(activeAction.user.id);
    setError('');
    try {
      if (activeAction.type === 'role') {
        await adminSetPlatformUserRole(activeAction.user.id, activeAction.role, trimmedReason);
        showToast(`Rol ${roleLabel(activeAction.role)} olarak güncellendi.`);
      } else if (activeAction.type === 'status') {
        await adminSetPlatformUserStatus(activeAction.user.id, activeAction.status, trimmedReason);
        showToast(activeAction.status === 'active' ? 'Kullanıcı yeniden etkinleştirildi.' : 'Kullanıcı erişimi engellendi.');
      } else {
        await adminArchivePlatformUser(activeAction.user.id, trimmedReason);
        showToast('Kullanıcı güvenli biçimde arşivlendi.');
      }
      setAction(null);
      setSelectedUser(current => current?.id === activeAction.user.id ? null : current);
      await load(true);
    } catch (err) {
      setError(userAdminErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const canManageTarget = (user: AdminPlatformUser) => user.role !== 'super_admin' || isSuperAdmin;

  const actionTitle = action?.type === 'role'
    ? 'Kullanıcı rolünü değiştir'
    : action?.type === 'archive'
      ? 'Kullanıcıyı arşivle'
      : action?.status === 'active'
        ? 'Kullanıcıyı etkinleştir'
        : 'Kullanıcıyı engelle';

  const actionDescription = action?.type === 'role'
    ? `${action.user.name} hesabının rolü ${roleLabel(action.role)} olarak değiştirilecek. Bu işlem sunucu tarafında yetki kontrolünden geçer.`
    : action?.type === 'archive'
      ? `${action.user.name} hesabı silinmek yerine veri bütünlüğünü koruyacak şekilde arşivlenecek, aktif üretici erişimi askıya alınacaktır.`
      : action
        ? `${action.user.name} hesabının durumu ${action.status === 'active' ? 'aktif' : 'engelli'} olarak değiştirilecek.`
        : '';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kullanıcı Yönetimi</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Kullanıcılar doğrudan Supabase hesap kayıtlarından gelir. Rol, durum ve arşivleme işlemleri gerekçeli yönetici RPC'leri üzerinden uygulanır.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Yenile
        </button>
      </header>

      {error && !action && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Kullanıcı filtreleri">
        <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative block">
            <span className="sr-only">Kullanıcı ara</span>
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="İsim, e-posta veya satıcı kimliği ara..." className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
          </label>
          <label><span className="sr-only">Rol filtrele</span><select value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm roller</option><option value="user">Üye</option><option value="vendor">Satıcı</option><option value="admin">Yönetici</option><option value="super_admin">Süper Yönetici</option></select></label>
          <label><span className="sr-only">Durum filtrele</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="blocked">Engelli</option><option value="deleted">Arşivlendi</option></select></label>
        </div>
      </section>

      {loading ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Kullanıcılar yükleniyor...</div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="Kullanıcı listesi">
          <div className="divide-y divide-gray-100 dark:divide-gray-700 lg:hidden">
            {filteredUsers.map(user => (
              <article key={user.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/10 font-bold text-brand-green">{user.name.charAt(0).toLocaleUpperCase('tr-TR')}</div><div className="min-w-0"><h3 className="truncate font-semibold text-gray-900 dark:text-white">{user.name}</h3><p className="truncate text-xs text-gray-500">{user.email}</p></div></div>
                  </div>
                  <button type="button" onClick={() => setSelectedUser(user)} className="min-h-11 min-w-11 rounded-xl p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${user.name} detaylarını aç`}><Eye className="mx-auto h-5 w-5" aria-hidden="true" /></button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-100">{roleLabel(user.role)}</span><span className={`rounded-full px-2.5 py-1 font-semibold ${user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200' : user.status === 'deleted' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'}`}>{statusLabel(user.status)}</span>{user.vendor_id && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><Store className="h-3.5 w-3.5" aria-hidden="true" /> Üretici profili</span>}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-gray-500">Katılım</div><div className="mt-1 text-gray-800 dark:text-gray-200">{formatDate(user.joinDate)}</div></div><div><div className="text-xs text-gray-500">Son görülme</div><div className="mt-1 text-gray-800 dark:text-gray-200">{formatDate(user.lastSeenAt)}</div></div></div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 dark:bg-gray-900/50"><tr><th className="px-6 py-4">Kullanıcı</th><th className="px-6 py-4">Rol</th><th className="px-6 py-4">Durum</th><th className="px-6 py-4">Katılım</th><th className="px-6 py-4">Son görülme</th><th className="px-6 py-4 text-right">İşlem</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredUsers.map(user => <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40"><td className="px-6 py-4"><div className="font-semibold text-gray-900 dark:text-white">{user.name}</div><div className="text-xs text-gray-500">{user.email}</div>{user.vendor_id && <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">Üretici: {user.vendor_id}</div>}</td><td className="px-6 py-4">{roleLabel(user.role)}</td><td className="px-6 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200' : user.status === 'deleted' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'}`}>{statusLabel(user.status)}</span></td><td className="px-6 py-4">{formatDate(user.joinDate)}</td><td className="px-6 py-4">{formatDate(user.lastSeenAt)}</td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelectedUser(user)} className="min-h-11 min-w-11 rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" aria-label={`${user.name} detaylarını aç`}><Eye className="mx-auto h-4 w-4" aria-hidden="true" /></button></td></tr>)}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && <div className="p-10 text-center text-gray-500"><Users className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden="true" /> Filtrelerle eşleşen kullanıcı yok.</div>}
        </section>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setSelectedUser(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-detail-title" className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h3 id="user-detail-title" className="text-xl font-bold text-gray-900 dark:text-white">{selectedUser.name}</h3><p className="mt-1 break-all text-sm text-gray-500">{selectedUser.email}</p></div><button type="button" onClick={() => setSelectedUser(null)} className="min-h-11 min-w-11 rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Kullanıcı detaylarını kapat"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><dt className="flex items-center gap-2 text-xs text-gray-500"><Shield className="h-4 w-4" aria-hidden="true" /> Rol</dt><dd className="mt-1 font-semibold text-gray-900 dark:text-white">{roleLabel(selectedUser.role)}</dd></div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><dt className="flex items-center gap-2 text-xs text-gray-500"><BadgeCheck className="h-4 w-4" aria-hidden="true" /> Hesap durumu</dt><dd className="mt-1 font-semibold text-gray-900 dark:text-white">{statusLabel(selectedUser.status)}</dd></div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><dt className="flex items-center gap-2 text-xs text-gray-500"><Calendar className="h-4 w-4" aria-hidden="true" /> Katılım</dt><dd className="mt-1 text-gray-900 dark:text-white">{formatDate(selectedUser.joinDate, true)}</dd></div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60"><dt className="flex items-center gap-2 text-xs text-gray-500"><Clock3 className="h-4 w-4" aria-hidden="true" /> Son görülme</dt><dd className="mt-1 text-gray-900 dark:text-white">{formatDate(selectedUser.lastSeenAt, true)}</dd></div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/60 sm:col-span-2"><dt className="flex items-center gap-2 text-xs text-gray-500"><Store className="h-4 w-4" aria-hidden="true" /> Üretici profili</dt><dd className="mt-1 break-all text-gray-900 dark:text-white">{selectedUser.vendor_id || 'Bu kullanıcıya bağlı üretici profili yok.'}</dd></div>
            </dl>

            {selectedUser.status !== 'deleted' && <div className="mt-6 space-y-4">
              <div><h4 className="font-semibold text-gray-900 dark:text-white">Rol yönetimi</h4><p className="mt-1 text-xs text-gray-500">Yönetici ve süper yönetici atamaları yalnızca süper yönetici yetkisiyle tamamlanabilir. Satıcı rolü için geçerli üretici profili gerekir.</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['user', 'vendor', 'admin', 'super_admin'] as AdminPlatformUserRole[]).map(role => <button key={role} type="button" disabled={Boolean(busyId) || selectedUser.role === role || ((role === 'admin' || role === 'super_admin' || selectedUser.role === 'super_admin') && !isSuperAdmin)} onClick={() => openAction({ type: 'role', user: selectedUser, role })} className="min-h-11 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">{roleLabel(role)}</button>)}</div>

              <div className="grid gap-2 sm:grid-cols-2">
                {selectedUser.status === 'active' ? <button type="button" disabled={Boolean(busyId) || selectedUser.id === currentUserId || !canManageTarget(selectedUser)} onClick={() => openAction({ type: 'status', user: selectedUser, status: 'blocked' })} className="min-h-11 rounded-xl border border-orange-200 px-4 py-2 font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-40 dark:border-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-950/30"><XCircle className="mr-2 inline h-4 w-4" aria-hidden="true" /> Erişimi engelle</button> : <button type="button" disabled={Boolean(busyId) || !canManageTarget(selectedUser)} onClick={() => openAction({ type: 'status', user: selectedUser, status: 'active' })} className="min-h-11 rounded-xl border border-green-200 px-4 py-2 font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40 dark:border-green-900/50 dark:text-green-300 dark:hover:bg-green-950/30"><CheckCircle className="mr-2 inline h-4 w-4" aria-hidden="true" /> Yeniden etkinleştir</button>}
                <button type="button" disabled={Boolean(busyId) || selectedUser.id === currentUserId || !canManageTarget(selectedUser)} onClick={() => openAction({ type: 'archive', user: selectedUser })} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"><Archive className="mr-2 inline h-4 w-4" aria-hidden="true" /> Hesabı arşivle</button>
              </div>
            </div>}

            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">Bu ekranda yalnızca yönetim RPC'sinin sunduğu gerçek hesap alanları gösterilir. Eski yerel DataContext içindeki sahte sipariş geçmişi ve adres verileri bilinçli olarak kaldırıldı.</div>
          </section>
        </div>
      )}

      {action && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busyId) setAction(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-action-title" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-800 sm:rounded-2xl">
            <h3 id="user-action-title" className="text-lg font-bold text-gray-900 dark:text-white">{actionTitle}</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{actionDescription}</p>
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
            <form onSubmit={submitAction} className="mt-4 space-y-4">
              <label><span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Yönetim gerekçesi</span><textarea autoFocus required minLength={8} maxLength={500} rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="Kararın denetlenebilir gerekçesini yazın..." className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-brand-green dark:border-gray-700 dark:bg-gray-900 dark:text-white" /><span className="mt-1 block text-xs text-gray-500">{reason.trim().length}/500, minimum 8 karakter</span></label>
              <div className="flex gap-3"><button type="button" disabled={Boolean(busyId)} onClick={() => setAction(null)} className="min-h-11 flex-1 rounded-xl px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">İptal</button><button type="submit" disabled={Boolean(busyId) || reason.trim().length < 8} className={`min-h-11 flex-1 rounded-xl px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${action.type === 'archive' ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-green hover:bg-green-700'}`}>{busyId ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> İşleniyor</span> : 'Onayla'}</button></div>
            </form>
          </section>
        </div>
      )}

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[70] rounded-xl bg-gray-900 px-5 py-3 text-white shadow-2xl">{toast}</div>}
    </div>
  );
}
