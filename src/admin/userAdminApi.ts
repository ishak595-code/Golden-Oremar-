import { supabase } from '../lib/supabase';

export type AdminPlatformUserRole =
  | 'customer'
  | 'producer'
  | 'support'
  | 'content_editor'
  | 'operations'
  | 'admin'
  | 'super_admin';

export type AdminPlatformUserStatus = 'active' | 'blocked' | 'deleted';
export type AdminPlatformProfileStatus = 'active' | 'restricted' | 'blocked' | 'deleted';
export type AdminPlatformUserEnforcementAction = 'block' | 'unblock' | 'close';

export type AdminPlatformUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  roles: AdminPlatformUserRole[];
  primaryRole: AdminPlatformUserRole;
  status: AdminPlatformUserStatus;
  profileStatus: AdminPlatformProfileStatus;
  joinDate: string;
  producerId: string | null;
  producerStatus: string | null;
  producerCommissionBasisPoints: number | null;
  lastSeenAt: string | null;
  lastKnownIp: string | null;
  knownDeviceCount: number;
  activeSecurityRuleCount: number;
  fraudFlag: boolean;
  lastEnforcementReason: string | null;
  lastEnforcementAt: string | null;
};

export type AdminPlatformEnforcementResult = {
  id: string;
  action: AdminPlatformUserEnforcementAction;
  status: AdminPlatformUserStatus;
  producerStatus: string | null;
  securityRuleCount: number;
  fraudFlag: boolean;
};

export const ADMIN_PLATFORM_USER_ROLES: readonly AdminPlatformUserRole[] = [
  'customer',
  'producer',
  'support',
  'content_editor',
  'operations',
  'admin',
  'super_admin',
] as const;

const USER_STATUSES = ['active', 'blocked', 'deleted'] as const;
const PROFILE_STATUSES = ['active', 'restricted', 'blocked', 'deleted'] as const;
const ENFORCEMENT_ACTIONS = new Set<AdminPlatformUserEnforcementAction>(['block', 'unblock', 'close']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_PRIORITY: Record<AdminPlatformUserRole, number> = {
  super_admin: 1,
  admin: 2,
  operations: 3,
  content_editor: 4,
  support: 5,
  producer: 6,
  customer: 7,
};

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500) {
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, max = 500) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalUuid(value: unknown, label: string) {
  if (value == null || value === '') return null;
  return uuid(value, label);
}

function dateTime(value: unknown, label: string, required = true) {
  if (value == null || value === '') {
    if (required) throw new Error(`${label} doğrulanamadı.`);
    return null;
  }
  const text = requiredText(value, label, 80);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} doğrulanamadı.`);
  }
  return value;
}

function optionalInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return value == null ? null : integer(value, label, min, max);
}

function bool(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`);
  return value;
}

function role(value: unknown): AdminPlatformUserRole {
  const text = requiredText(value, 'Kullanıcı rolü', 40);
  if (!ADMIN_PLATFORM_USER_ROLES.includes(text as AdminPlatformUserRole)) {
    throw new Error('Kullanıcı rolü doğrulanamadı.');
  }
  return text as AdminPlatformUserRole;
}

function roles(value: unknown): AdminPlatformUserRole[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > ADMIN_PLATFORM_USER_ROLES.length) {
    throw new Error('Kullanıcı rolleri doğrulanamadı.');
  }
  const normalized = value.map(role);
  if (new Set(normalized).size !== normalized.length || !normalized.includes('customer')) {
    throw new Error('Kullanıcı rolleri doğrulanamadı.');
  }
  return normalized;
}

function status(value: unknown): AdminPlatformUserStatus {
  const text = requiredText(value, 'Kullanıcı durumu', 40);
  if (!USER_STATUSES.includes(text as AdminPlatformUserStatus)) {
    throw new Error('Kullanıcı durumu doğrulanamadı.');
  }
  return text as AdminPlatformUserStatus;
}

function profileStatus(value: unknown): AdminPlatformProfileStatus {
  const text = requiredText(value, 'Profil durumu', 40);
  if (!PROFILE_STATUSES.includes(text as AdminPlatformProfileStatus)) {
    throw new Error('Profil durumu doğrulanamadı.');
  }
  return text as AdminPlatformProfileStatus;
}

function enforcementAction(value: unknown): AdminPlatformUserEnforcementAction {
  const text = requiredText(value, 'Güvenlik işlemi', 20) as AdminPlatformUserEnforcementAction;
  if (!ENFORCEMENT_ACTIONS.has(text)) throw new Error('Güvenlik işlemi doğrulanamadı.');
  return text;
}

function normalizeUser(value: unknown, index: number): AdminPlatformUser {
  if (!isRecord(value)) throw new Error(`${index + 1}. kullanıcı kaydı doğrulanamadı.`);

  const normalizedRoles = roles(value.roles);
  const primaryRole = role(value.primaryRole);
  const expectedPrimary = [...normalizedRoles].sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b])[0];
  if (!normalizedRoles.includes(primaryRole) || primaryRole !== expectedPrimary) {
    throw new Error(`${index + 1}. kullanıcının ana rolü doğrulanamadı.`);
  }

  return {
    id: uuid(value.id, 'Kullanıcı kimliği'),
    displayName: optionalText(value.displayName, 'Kullanıcı adı', 240),
    email: optionalText(value.email, 'Kullanıcı e-postası', 320),
    roles: normalizedRoles,
    primaryRole,
    status: status(value.status),
    profileStatus: profileStatus(value.profileStatus),
    joinDate: dateTime(value.joinDate, 'Katılım tarihi', true) as string,
    producerId: optionalUuid(value.producerId, 'Üretici kimliği'),
    producerStatus: optionalText(value.producerStatus, 'Üretici durumu', 60),
    producerCommissionBasisPoints: optionalInteger(value.producerCommissionBasisPoints, 'Üretici komisyonu', 0, 10000),
    lastSeenAt: dateTime(value.lastSeenAt, 'Son görülme tarihi', false),
    lastKnownIp: optionalText(value.lastKnownIp, 'Son IP', 80),
    knownDeviceCount: integer(value.knownDeviceCount, 'Bilinen cihaz sayısı', 0, 1000000),
    activeSecurityRuleCount: integer(value.activeSecurityRuleCount, 'Aktif güvenlik kuralı sayısı', 0, 1000000),
    fraudFlag: bool(value.fraudFlag, 'Dolandırıcılık işareti'),
    lastEnforcementReason: optionalText(value.lastEnforcementReason, 'Son güvenlik gerekçesi', 1000),
    lastEnforcementAt: dateTime(value.lastEnforcementAt, 'Son güvenlik işlemi', false),
  };
}

function normalizeEnforcementReason(reason: string) {
  const value = reason.trim();
  if (value.length < 8 || value.length > 1000 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new Error('Yönetim gerekçesi 8 ile 1000 karakter arasında olmalıdır.');
  }
  return value;
}

function normalizeRoleReason(reason: string) {
  const value = reason.trim();
  if (value.length < 8 || value.length > 500 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new Error('Rol değişikliği gerekçesi 8 ile 500 karakter arasında olmalıdır.');
  }
  return value;
}

function validateRoleInput(value: AdminPlatformUserRole) {
  if (!ADMIN_PLATFORM_USER_ROLES.includes(value)) throw new Error('Kullanıcı rolü doğrulanamadı.');
  return value;
}

export async function adminListPlatformUsers(): Promise<AdminPlatformUser[]> {
  const { data, error } = await supabase.rpc('admin_list_platform_users_v3');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Kullanıcı listesi doğrulanamadı.');
  return rows.map(normalizeUser);
}

export async function adminSetPlatformUserRole(
  userId: string,
  nextRole: AdminPlatformUserRole,
  reason: string,
) {
  const id = uuid(userId, 'Kullanıcı kimliği');
  const requestedRole = validateRoleInput(nextRole);
  const { data, error } = await supabase.rpc('admin_set_platform_user_role_v2', {
    p_user_id: id,
    p_role: requestedRole,
    p_reason: normalizeRoleReason(reason),
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Güncellenen kullanıcı kimliği') !== id) {
    throw new Error('Rol güncelleme yanıtı doğrulanamadı.');
  }

  const returnedRole = role(result.role);
  const returnedRoles = roles(result.roles);
  const expectedRoles: AdminPlatformUserRole[] = requestedRole === 'customer' ? ['customer'] : [requestedRole, 'customer'];
  if (
    returnedRole !== requestedRole ||
    returnedRoles.length !== expectedRoles.length ||
    expectedRoles.some(expected => !returnedRoles.includes(expected))
  ) {
    throw new Error('Rol güncelleme yanıtı doğrulanamadı.');
  }

  return { id, role: returnedRole, roles: returnedRoles };
}

export async function adminEnforcePlatformUser(input: {
  userId: string;
  action: AdminPlatformUserEnforcementAction;
  reason: string;
  blockKnownIps?: boolean;
  blockKnownDevices?: boolean;
  fraudFlag?: boolean;
  expiresAt?: string | null;
}): Promise<AdminPlatformEnforcementResult> {
  const id = uuid(input.userId, 'Kullanıcı kimliği');
  if (!ENFORCEMENT_ACTIONS.has(input.action)) throw new Error('Hesap güvenlik işlemi doğrulanamadı.');

  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const date = new Date(input.expiresAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new Error('Engel bitiş tarihi gelecekte olmalıdır.');
    }
    expiresAt = date.toISOString();
  }

  const { data, error } = await supabase.rpc('admin_enforce_platform_user_v1', {
    p_user_id: id,
    p_action: input.action,
    p_reason: normalizeEnforcementReason(input.reason),
    p_block_known_ips: input.blockKnownIps === true,
    p_block_known_devices: input.blockKnownDevices === true,
    p_fraud_flag: input.fraudFlag === true,
    p_expires_at: expiresAt,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Güvenlik işlemi kullanıcı kimliği') !== id) {
    throw new Error('Hesap güvenlik işlemi yanıtı doğrulanamadı.');
  }

  const action = enforcementAction(result.action);
  const returnedStatus = status(result.status);
  const expectedStatus: AdminPlatformUserStatus = input.action === 'block' ? 'blocked' : input.action === 'unblock' ? 'active' : 'deleted';
  if (action !== input.action || returnedStatus !== expectedStatus) {
    throw new Error('Hesap güvenlik işlemi yanıtı doğrulanamadı.');
  }

  return {
    id,
    action,
    status: returnedStatus,
    producerStatus: optionalText(result.producerStatus, 'Üretici durumu', 60),
    securityRuleCount: integer(result.securityRuleCount, 'Aktif güvenlik kuralı sayısı', 0, 1000000),
    fraudFlag: bool(result.fraudFlag, 'Dolandırıcılık işareti'),
  };
}

export function userAdminErrorMessage(error: unknown, fallback = 'Kullanıcı işlemi tamamlanamadı.') {
  const message = error instanceof Error ? error.message.trim() : String((error as { message?: unknown } | null)?.message || '').trim();
  if (!message) return fallback;

  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'],
    ['super_admin_required', 'Yönetici ve Süper Yönetici hesapları ile bu rollere atama işlemleri yalnızca Süper Yönetici tarafından yönetilebilir.'],
    ['cannot_change_current_user_role', 'Kendi yönetici rolünüzü bu ekrandan değiştiremezsiniz.'],
    ['cannot_enforce_current_user', 'Kendi hesabınızı bu ekrandan engelleyemez veya kapatamazsınız.'],
    ['super_admin_account_cannot_be_closed_here', 'Süper Yönetici hesabı bu güvenlik akışından kalıcı kapatılamaz.'],
    ['cannot_demote_current_super_admin', 'Kendi Süper Yönetici rolünüzü düşüremezsiniz.'],
    ['last_super_admin_cannot_be_demoted', 'Sistemdeki son aktif Süper Yönetici rolü kaldırılamaz.'],
    ['producer_profile_required', 'Üretici rolü için kullanıcıya bağlı aktif veya askıya alınmış gerçek bir üretici profili gerekiyor.'],
    ['user_not_found', 'Kullanıcı artık bulunamadı. Listeyi yenileyin.'],
    ['invalid_user_role', 'Seçilen rol canlı rol sözleşmesinde bulunmuyor.'],
    ['enforcement_reason_required', 'Bu güvenlik kararı için 8 ile 1000 karakter arasında gerekçe yazın.'],
    ['invalid_block_expiry', 'Engel bitiş tarihi gelecekte olmalıdır.'],
    ['platform_access_blocked', 'Bu yönetici oturumu güvenlik politikası nedeniyle engellenmiş.'],
    ['role_reason_required', 'Rol değişikliği için 8 ile 500 karakter arasında gerekçe gerekiyor.'],
  ];

  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 300 ? message : fallback;
}
