import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Calendar,
  CheckCircle,
  Clock3,
  Eye,
  Flag,
  Globe2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useCustomerSession } from '../features/auth/useCustomerSession';
import { useAuthorization } from '../features/auth/AuthorizationContext';
import { useAccessibleDialog } from '../features/accessibility/useAccessibleDialog';
import {
  ADMIN_PLATFORM_USER_ROLES,
  adminEnforcePlatformUser,
  adminListPlatformUsers,
  adminSetPlatformUserRole,
  userAdminErrorMessage,
  type AdminPlatformUser,
  type AdminPlatformUserRole,
} from './userAdminApi';

type ActionState =
  | { type: 'role'; user: AdminPlatformUser; role: AdminPlatformUserRole }
  | { type: 'block'; user: AdminPlatformUser }
  | { type: 'unblock'; user: AdminPlatformUser }
  | { type: 'close'; user: AdminPlatformUser }
  | null;

const ROLE_LABELS: Record<AdminPlatformUserRole, string> = {
  customer: 'Müşteri',
  producer: 'Üretici / Satıcı',
  support: 'Destek',
  content_editor: 'İçerik Editörü',
  operations: 'Operasyon',
  moderator: 'Moderatör',
  admin: 'Yönetici',
  super_admin: 'Süper Yönetici',
};

const ROLE_HELP: Record<AdminPlatformUserRole, string> = {
  customer: 'Standart müşteri erişimi.',
  producer: 'Doğrulanmış üretici profiline bağlı, yalnız kendi kaynaklarını yöneten satıcı erişimi.',
  support: 'Müşteri destek operasyonlarına erişim.',
  content_editor: 'Yayın ve içerik yönetimi erişimi.',
  operations: 'Sipariş, stok, satıcı ve operasyon yönetimi erişimi.',
  moderator: 'Ürün, yorum, rapor ve içerik moderasyonu erişimi. Finans ve sistem yönetimi içermez.',
  admin: 'Geniş çalışan-yönetici erişimi. Sahip seviyesindeki sistem ve rol yetkilerini içermez.',
  super_admin: 'Uygulama sahibinin tüm platform capabilitylerine sahip en yüksek yönetim rolü.',
};

function roleLabel(role: AdminPlatformUserRole) {
  return ROLE_LABELS[role];
}

function statusLabel(status: AdminPlatformUser['status']) {
  return status === 'active' ? 'Aktif' : status === 'deleted' ? 'Kalıcı kapalı' : 'Engelli';
}

function profileStatusLabel(status: AdminPlatformUser['profileStatus']) {
  if (status === 'active') return 'Aktif';
  if (status === 'restricted') return 'Kısıtlı';
  if (status === 'deleted') return 'Silinmiş';
  return 'Engelli';
}

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return 'Kayıt yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih doğrulanamadı';
  return date.toLocaleString('tr-TR', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

function commissionLabel(value: number | null) {
  return value == null ? 'Hassas finans yetkisi yok veya değer tanımlı değil' : `%${(value / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
}

function userHeading(user: AdminPlatformUser) {
  return user.displayName ?? user.email ?? user.id;
}

function isManagementAccount(user: AdminPlatformUser) {
  return user.roles.includes('admin') || user.roles.includes('super_admin');
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 dark:bg-gray-800">
      <div className="text-2xl font-black">{value.toLocaleString('tr-TR')}</div>
      <div className="mt-1 text-xs font-semibold text-gray-500">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3 dark:bg-gray-800/70">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
    </div>
  );
}

function RoleBadges({ roles }: { roles: AdminPlatformUserRole[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map(role => (
        <span key={role} className="rounded-full border bg-white px-2.5 py-1 text-xs font-semibold dark:bg-gray-900">
          {roleLabel(role)}
        </span>
      ))}
    </div>
  );
}

export function AdminUsers() {
  const { currentUser } = useCustomerSession();
  const { can } = useAuthorization();
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
  const [blockIps, setBlockIps] = useState(false);
  const [blockDevices, setBlockDevices] = useState(false);
  const [fraudFlag, setFraudFlag] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [closeConfirm, setCloseConfirm] = useState('');

  const nestedOpen = Boolean(action);
  const detailRef = useAccessibleDialog<HTMLDivElement>(Boolean(selectedUser) && !nestedOpen, () => {
    if (!busyId) setSelectedUser(null);
  });
  const actionRef = useAccessibleDialog<HTMLDivElement>(Boolean(action), () => {
    if (!busyId) closeAction();
  });

  const currentUserId = String(currentUser?.id || '');
  const canManageRoles = can('role.manage');
  const canSuspendUsers = can('user.suspend');
  const canRestoreUsers = can('user.restore');
  const canEraseUsers = can('user.erase');
  const canManageSecurity = can('security.manage');

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const rows = await adminListPlatformUsers();
      setUsers(rows);
      setSelectedUser(current => (current ? rows.find(row => row.id === current.id) ?? null : null));
    } catch (nextError) {
      setError(userAdminErrorMessage(nextError, 'Kullanıcı listesi yüklenemedi.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('tr-TR');
    return users.filter(user => {
      if (roleFilter !== 'all' && user.primaryRole !== roleFilter) return false;
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      if (!query) return true;
      return [user.displayName, user.email, user.producerId, user.lastKnownIp, user.roles.join(' '), user.id]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(query);
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      active: users.filter(user => user.status === 'active').length,
      blocked: users.filter(user => user.status === 'blocked').length,
      fraud: users.filter(user => user.fraudFlag).length,
      producers: users.filter(user => Boolean(user.producerId)).length,
    }),
    [users],
  );

  function closeAction() {
    setAction(null);
    setReason('');
    setBlockIps(false);
    setBlockDevices(false);
    setFraudFlag(false);
    setExpiresAt('');
    setCloseConfirm('');
    setError('');
  }

  function openAction(next: NonNullable<ActionState>) {
    setAction(next);
    setReason('');
    setBlockIps(false);
    setBlockDevices(false);
    setFraudFlag(next.type === 'block' && next.user.fraudFlag);
    setExpiresAt('');
    setCloseConfirm('');
    setError('');
  }

  function canManageTarget(user: AdminPlatformUser) {
    return !isManagementAccount(user) || canManageRoles;
  }

  function canAssignRole(user: AdminPlatformUser, nextRole: AdminPlatformUserRole) {
    if (!canManageRoles) return false;
    if (user.id === currentUserId) return false;
    if (user.primaryRole === nextRole) return false;
    if (isManagementAccount(user) && !canManageRoles) return false;
    if (nextRole === 'producer' && !user.producerId) return false;
    return true;
  }

  async function submitAction(event: React.FormEvent) {
    event.preventDefault();
    if (!action || busyId) return;

    const permitted = action.type === 'role'
      ? canManageRoles
      : action.type === 'block'
        ? canSuspendUsers
        : action.type === 'unblock'
          ? canRestoreUsers
          : canEraseUsers;
    if (!permitted) {
      setError('Bu işlem için gerekli capability mevcut değil.');
      return;
    }

    const trimmed = reason.trim();
    const maxReason = action.type === 'role' ? 500 : 1000;
    if (trimmed.length < 8 || trimmed.length > maxReason) {
      setError(`Yönetim gerekçesi 8 ile ${maxReason} karakter arasında olmalıdır.`);
      return;
    }
    if (action.type === 'close' && closeConfirm !== 'KAPAT') {
      setError('Kalıcı kapatma için KAPAT yazın.');
      return;
    }

    setBusyId(action.user.id);
    setError('');
    try {
      if (action.type === 'role') {
        await adminSetPlatformUserRole(action.user.id, action.role, trimmed);
        showToast(`Ana rol ${roleLabel(action.role)} olarak güncellendi.`);
      } else if (action.type === 'block') {
        await adminEnforcePlatformUser({
          userId: action.user.id,
          action: 'block',
          reason: trimmed,
          blockKnownIps: canManageSecurity && blockIps,
          blockKnownDevices: canManageSecurity && blockDevices,
          fraudFlag: canManageSecurity && fraudFlag,
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        });
        showToast('Hesap güvenlik politikasıyla engellendi.');
      } else if (action.type === 'unblock') {
        await adminEnforcePlatformUser({ userId: action.user.id, action: 'unblock', reason: trimmed });
        showToast('Hesap erişimi yeniden açıldı. Üretici mağazası gerekiyorsa ayrıca incelenmelidir.');
      } else {
        await adminEnforcePlatformUser({
          userId: action.user.id,
          action: 'close',
          reason: trimmed,
          blockKnownIps: canManageSecurity && blockIps,
          blockKnownDevices: canManageSecurity && blockDevices,
          fraudFlag: canManageSecurity && fraudFlag,
        });
        showToast('Hesap kalıcı olarak kapatıldı ve satış erişimi durduruldu.');
      }
      closeAction();
      await load(true);
    } catch (nextError) {
      setError(userAdminErrorMessage(nextError));
    } finally {
      setBusyId('');
    }
  }

  const actionTitle = action?.type === 'role'
    ? 'Ana rolü değiştir'
    : action?.type === 'block'
      ? 'Hesabı engelle'
      : action?.type === 'unblock'
        ? 'Hesabı yeniden aç'
        : action?.type === 'close'
          ? 'Hesabı kalıcı kapat'
          : '';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Kullanıcı ve Güvenlik Yönetimi</h2>
          <p className="mt-1 max-w-4xl text-sm text-gray-500">
            Canlı capability sözleşmesini yönetin. Müşteri, satıcı, destek, içerik editörü, operasyon, moderatör, yönetici ve uygulama sahibi Süper Yönetici rolleri ayrı sorumluluk sınırlarıyla uygulanır.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50">
          <RefreshCw aria-hidden="true" className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Aktif hesap" value={counts.active} />
        <Metric label="Engelli hesap" value={counts.blocked} />
        <Metric label="Risk işaretli" value={counts.fraud} />
        <Metric label="Üretici profili" value={counts.producers} />
      </div>

      {toast ? (
        <div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200">{toast}</div>
      ) : null}

      {error && !action ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>
      ) : null}

      <section className="grid gap-3 rounded-2xl border bg-white p-4 dark:bg-gray-800 md:grid-cols-[minmax(0,1fr)_200px_180px]" aria-label="Kullanıcı filtreleri">
        <label className="relative">
          <span className="sr-only">Kullanıcı ara</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="İsim, e-posta, kullanıcı, üretici veya IP ara..." className="min-h-11 w-full rounded-xl border bg-gray-50 py-2 pl-10 pr-4 dark:bg-gray-900" />
        </label>
        <select aria-label="Ana rol filtrele" value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)} className="min-h-11 rounded-xl border bg-gray-50 px-3 dark:bg-gray-900">
          <option value="all">Tüm ana roller</option>
          {ADMIN_PLATFORM_USER_ROLES.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
        </select>
        <select aria-label="Durum filtrele" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 rounded-xl border bg-gray-50 px-3 dark:bg-gray-900">
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="blocked">Engelli</option>
          <option value="deleted">Kalıcı kapalı</option>
        </select>
      </section>

      {loading ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />Kullanıcılar yükleniyor...</div>
      ) : (
        <section className="space-y-3" aria-label="Kullanıcı listesi">
          {filtered.map(user => (
            <article key={user.id} className={`rounded-2xl border bg-white p-4 dark:bg-gray-800 ${user.fraudFlag ? 'border-red-300 dark:border-red-900' : ''}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-bold">{userHeading(user)}</h3>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold dark:bg-gray-700">{roleLabel(user.primaryRole)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === 'active' ? 'bg-green-100 text-green-800' : user.status === 'blocked' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-700'}`}>{statusLabel(user.status)}</span>
                    {user.fraudFlag ? <span className="inline-flex items-center gap-1 rounded-full bg-red-700 px-2.5 py-1 text-xs font-bold text-white"><Flag aria-hidden="true" className="h-3.5 w-3.5" />Riskli</span> : null}
                  </div>
                  {user.displayName && user.email ? <p className="mt-1 break-all text-sm text-gray-500">{user.email}</p> : null}
                  <div className="mt-2"><RoleBadges roles={user.roles} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>{user.knownDeviceCount} bilinen cihaz</span><span>{user.activeSecurityRuleCount} aktif güvenlik kuralı</span>{user.producerId ? <span>Üretici profili bağlı</span> : null}</div>
                  {user.lastEnforcementReason ? <p className="mt-2 line-clamp-2 text-xs text-red-700">Son güvenlik notu: {user.lastEnforcementReason}</p> : null}
                </div>
                <button type="button" onClick={() => setSelectedUser(user)} className="min-h-11 rounded-xl border px-4 font-semibold"><Eye aria-hidden="true" className="mr-1 inline h-4 w-4" />İncele</button>
              </div>
            </article>
          ))}
          {!filtered.length ? <div className="rounded-2xl border p-8 text-center text-gray-500"><Users aria-hidden="true" className="mx-auto mb-2 h-9 w-9 opacity-30" />Filtreyle eşleşen kullanıcı yok.</div> : null}
        </section>
      )}

      {selectedUser && !action ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <section ref={detailRef} role="dialog" aria-modal="true" aria-labelledby="user-detail-title" tabIndex={-1} className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 outline-none dark:bg-gray-900 sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h3 id="user-detail-title" className="break-words text-xl font-bold">{userHeading(selectedUser)}</h3>{selectedUser.email ? <p className="mt-1 break-all text-sm text-gray-500">{selectedUser.email}</p> : <p className="mt-1 text-sm text-gray-500">E-posta kaydı yok</p>}</div><button type="button" onClick={() => setSelectedUser(null)} className="min-h-11 min-w-11 rounded-xl" aria-label="Kullanıcı detayını kapat"><X aria-hidden="true" className="mx-auto h-5 w-5" /></button></div>

            <div className="mt-4 rounded-xl border p-4"><div className="mb-2 text-xs font-semibold text-gray-500">Aktif roller</div><RoleBadges roles={selectedUser.roles} /></div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Ana rol" value={roleLabel(selectedUser.primaryRole)} />
              <Info label="Hesap durumu" value={statusLabel(selectedUser.status)} />
              <Info label="Profil durumu" value={profileStatusLabel(selectedUser.profileStatus)} />
              <Info label="Katılım" value={formatDate(selectedUser.joinDate, true)} />
              <Info label="Son görülme" value={formatDate(selectedUser.lastSeenAt, true)} />
              <Info label="Son bilinen IP" value={selectedUser.lastKnownIp ?? 'Hassas güvenlik yetkisi yok veya henüz kaydedilmedi'} />
              <Info label="Bilinen cihaz" value={String(selectedUser.knownDeviceCount)} />
              <Info label="Aktif güvenlik kuralı" value={String(selectedUser.activeSecurityRuleCount)} />
              <Info label="Üretici durumu" value={selectedUser.producerId ? selectedUser.producerStatus ?? 'Durum kaydı yok' : 'Üretici profili yok'} />
              <Info label="Üretici komisyonu" value={selectedUser.producerId ? commissionLabel(selectedUser.producerCommissionBasisPoints) : 'Üretici profili yok'} />
              <Info label="Kullanıcı kimliği" value={selectedUser.id} />
              <Info label="Üretici kimliği" value={selectedUser.producerId ?? 'Bağlı üretici profili yok'} />
            </div>

            {selectedUser.fraudFlag ? <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><strong>Dolandırıcılık veya risk işareti aktif.</strong> Hesaba bağlı güvenlik kuralları kaldırılmadan yeniden erişim verilmemelidir.</div> : null}
            {selectedUser.lastEnforcementReason ? <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800"><div className="font-semibold">Son yönetim kararı</div><p className="mt-1">{selectedUser.lastEnforcementReason}</p><div className="mt-1 text-xs text-gray-500">{formatDate(selectedUser.lastEnforcementAt, true)}</div></div> : null}

            {selectedUser.status !== 'deleted' ? (
              <div className="mt-6 space-y-5">
                <div>
                  <h4 className="font-bold">Ana rol yönetimi</h4>
                  <p className="mt-1 text-xs text-gray-500">Her hesap müşteri temel rolünü korur. Rol değiştirme yalnız role.manage capability'sine sahip uygulama sahibi tarafından yapılabilir.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ADMIN_PLATFORM_USER_ROLES.map(nextRole => {
                      const disabled = Boolean(busyId) || !canAssignRole(selectedUser, nextRole);
                      return <button key={nextRole} type="button" disabled={disabled} onClick={() => openAction({ type: 'role', user: selectedUser, role: nextRole })} className="min-h-14 rounded-xl border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40" title={ROLE_HELP[nextRole]}><span className="block font-bold">{roleLabel(nextRole)}</span><span className="mt-0.5 block text-xs text-gray-500">{ROLE_HELP[nextRole]}</span></button>;
                    })}
                  </div>
                  {selectedUser.id === currentUserId ? <p className="mt-2 text-xs font-semibold text-amber-700">Kendi yönetici rolünüz bu ekrandan değiştirilemez.</p> : null}
                  {!selectedUser.producerId ? <p className="mt-1 text-xs text-gray-500">Üretici rolü için önce gerçek bir üretici profili bulunmalıdır.</p> : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedUser.status === 'active' ? (
                    <button type="button" disabled={Boolean(busyId) || !canSuspendUsers || selectedUser.id === currentUserId || !canManageTarget(selectedUser)} onClick={() => openAction({ type: 'block', user: selectedUser })} className="min-h-11 rounded-xl border border-orange-300 px-4 font-bold text-orange-800 disabled:opacity-40 dark:text-orange-200"><Ban aria-hidden="true" className="mr-2 inline h-4 w-4" />Hesabı engelle</button>
                  ) : selectedUser.status === 'blocked' ? (
                    <button type="button" disabled={Boolean(busyId) || !canRestoreUsers || selectedUser.id === currentUserId || !canManageTarget(selectedUser)} onClick={() => openAction({ type: 'unblock', user: selectedUser })} className="min-h-11 rounded-xl border border-green-300 px-4 font-bold text-green-800 disabled:opacity-40 dark:text-green-200"><CheckCircle aria-hidden="true" className="mr-2 inline h-4 w-4" />Hesabı yeniden aç</button>
                  ) : null}

                  <button type="button" disabled={Boolean(busyId) || !canEraseUsers || selectedUser.id === currentUserId || selectedUser.roles.includes('super_admin')} onClick={() => openAction({ type: 'close', user: selectedUser })} className="min-h-11 rounded-xl border border-red-300 px-4 font-bold text-red-800 disabled:opacity-40 dark:text-red-200"><LockKeyhole aria-hidden="true" className="mr-2 inline h-4 w-4" />Kalıcı kapat</button>
                </div>

                {isManagementAccount(selectedUser) && !canManageRoles ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle aria-hidden="true" className="mr-2 inline h-4 w-4" />Yönetici hesaplarına rol ve güvenlik müdahalesi yalnız role.manage capability'si olan uygulama sahibi tarafından yapılabilir.</div> : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {action ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
          <section ref={actionRef} role="dialog" aria-modal="true" aria-labelledby="user-action-title" tabIndex={-1} className="max-h-[96dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 outline-none dark:bg-gray-900 sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h3 id="user-action-title" className="text-xl font-bold">{actionTitle}</h3><p className="mt-1 break-words text-sm text-gray-500">{userHeading(action.user)}</p></div><button type="button" onClick={closeAction} disabled={Boolean(busyId)} className="min-h-11 min-w-11 rounded-xl disabled:opacity-40" aria-label="İşlemi kapat"><X aria-hidden="true" className="mx-auto h-5 w-5" /></button></div>

            {action.type === 'role' ? <div className="mt-4 rounded-xl border p-4"><div className="text-xs font-semibold text-gray-500">Yeni ana rol</div><div className="mt-1 font-bold">{roleLabel(action.role)}</div><p className="mt-1 text-sm text-gray-500">{ROLE_HELP[action.role]}</p></div> : null}
            {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}

            <form onSubmit={submitAction} className="mt-5 space-y-4">
              <label className="block"><span className="text-sm font-bold">Yönetim gerekçesi</span><textarea value={reason} onChange={event => setReason(event.target.value)} minLength={8} maxLength={action.type === 'role' ? 500 : 1000} required rows={4} className="mt-2 w-full rounded-xl border bg-white p-3 dark:bg-gray-950" placeholder="Kararın denetlenebilir ve somut gerekçesini yazın." /></label>

              {action.type === 'block' ? <label className="block"><span className="text-sm font-bold">Engel bitiş tarihi</span><input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-gray-950" /><span className="mt-1 block text-xs text-gray-500">Boş bırakılırsa kullanıcı kuralı süresiz kalır.</span></label> : null}

              {(action.type === 'block' || action.type === 'close') && canManageSecurity ? (
                <fieldset className="space-y-2 rounded-xl border p-4"><legend className="px-1 text-sm font-bold">Gelişmiş güvenlik seçenekleri</legend><label className="flex min-h-10 items-center gap-3"><input type="checkbox" checked={blockIps} onChange={event => setBlockIps(event.target.checked)} /><span>Bilinen IP adreslerini de engelle</span></label><label className="flex min-h-10 items-center gap-3"><input type="checkbox" checked={blockDevices} onChange={event => setBlockDevices(event.target.checked)} /><span>Bilinen cihazları da engelle</span></label><label className="flex min-h-10 items-center gap-3"><input type="checkbox" checked={fraudFlag} onChange={event => setFraudFlag(event.target.checked)} /><span>Dolandırıcılık / yüksek risk işareti ekle</span></label></fieldset>
              ) : null}

              {action.type === 'close' ? <label className="block rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"><span className="text-sm font-bold text-red-900 dark:text-red-200">Kalıcı kapatmayı doğrulamak için KAPAT yazın</span><input value={closeConfirm} onChange={event => setCloseConfirm(event.target.value)} autoComplete="off" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-gray-950" /></label> : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={closeAction} disabled={Boolean(busyId)} className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-40">Vazgeç</button><button type="submit" disabled={Boolean(busyId)} className="min-h-11 rounded-xl bg-brand-green px-5 font-bold text-brand-on-green disabled:opacity-50">{busyId ? <Loader2 aria-hidden="true" className="mr-2 inline h-4 w-4 animate-spin" /> : null}İşlemi uygula</button></div>
            </form>
          </section>
        </div>
      ) : null}

      <div className="sr-only" role="status" aria-live="polite">{busyId ? 'Yönetim işlemi uygulanıyor.' : ''}</div>
    </div>
  );
}