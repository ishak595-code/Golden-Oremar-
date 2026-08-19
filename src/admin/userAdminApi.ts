import { supabase } from '../lib/supabase';

export type AdminPlatformUserRole = 'user' | 'vendor' | 'admin' | 'super_admin';
export type AdminPlatformUserStatus = 'active' | 'blocked' | 'deleted';
export type AdminPlatformProfileStatus = 'active' | 'restricted' | 'blocked' | 'deleted';
export type AdminPlatformUserEnforcementAction = 'block' | 'unblock' | 'close';

export type AdminPlatformUser = {
  id: string;
  name: string;
  email: string;
  role: AdminPlatformUserRole;
  status: AdminPlatformUserStatus;
  profileStatus: AdminPlatformProfileStatus;
  joinDate: string;
  vendor_id: string | null;
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

const USER_ROLES = ['user', 'vendor', 'admin', 'super_admin'] as const;
const USER_STATUSES = ['active', 'blocked', 'deleted'] as const;
const PROFILE_STATUSES = ['active', 'restricted', 'blocked', 'deleted'] as const;
const ENFORCEMENT_ACTIONS = new Set<AdminPlatformUserEnforcementAction>(['block', 'unblock', 'close']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap<T>(data: T | null, error: unknown): T { if (error) throw error; return data as T; }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function requiredText(value: unknown, label: string, max = 500) { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`); return text; }
function optionalText(value: unknown, label: string, max = 500) { if (value == null || value === '') return null; if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`); const text = value.trim(); if (!text) return null; if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`); return text; }
function uuid(value: unknown, label: string) { const text = requiredText(value, label, 36); if (!UUID_RE.test(text)) throw new Error(`${label} doğrulanamadı.`); return text; }
function optionalUuid(value: unknown, label: string) { if (value == null || value === '') return null; return uuid(value, label); }
function dateTime(value: unknown, label: string, required = true) { if (value == null || value === '') { if (required) throw new Error(`${label} doğrulanamadı.`); return null; } const text = requiredText(value, label, 80); if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label} doğrulanamadı.`); return text; }
function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} doğrulanamadı.`); return value; }
function optionalInteger(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) { return value == null ? null : integer(value, label, min, max); }
function bool(value: unknown, label: string) { if (typeof value !== 'boolean') throw new Error(`${label} doğrulanamadı.`); return value; }
function role(value: unknown): AdminPlatformUserRole { const text = requiredText(value, 'Kullanıcı rolü', 40); if (!USER_ROLES.includes(text as AdminPlatformUserRole)) throw new Error('Kullanıcı rolü doğrulanamadı.'); return text as AdminPlatformUserRole; }
function status(value: unknown): AdminPlatformUserStatus { const text = requiredText(value, 'Kullanıcı durumu', 40); if (!USER_STATUSES.includes(text as AdminPlatformUserStatus)) throw new Error('Kullanıcı durumu doğrulanamadı.'); return text as AdminPlatformUserStatus; }
function profileStatus(value: unknown): AdminPlatformProfileStatus { const text = requiredText(value, 'Profil durumu', 40); if (!PROFILE_STATUSES.includes(text as AdminPlatformProfileStatus)) throw new Error('Profil durumu doğrulanamadı.'); return text as AdminPlatformProfileStatus; }

function normalizeUser(value: unknown, index: number): AdminPlatformUser {
  if (!isRecord(value)) throw new Error(`${index + 1}. kullanıcı kaydı doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Kullanıcı kimliği'), name: requiredText(value.name, 'Kullanıcı adı', 240), email: optionalText(value.email, 'Kullanıcı e-postası', 320) || '', role: role(value.role), status: status(value.status), profileStatus: profileStatus(value.profileStatus), joinDate: dateTime(value.joinDate, 'Katılım tarihi', true) as string,
    vendor_id: optionalUuid(value.vendor_id, 'Üretici kimliği'), producerStatus: optionalText(value.producerStatus, 'Üretici durumu', 60), producerCommissionBasisPoints: optionalInteger(value.producerCommissionBasisPoints, 'Üretici komisyonu', 0, 10000), lastSeenAt: dateTime(value.lastSeenAt, 'Son görülme tarihi', false), lastKnownIp: optionalText(value.lastKnownIp, 'Son IP', 80),
    knownDeviceCount: integer(value.knownDeviceCount, 'Bilinen cihaz sayısı', 0, 1000000), activeSecurityRuleCount: integer(value.activeSecurityRuleCount, 'Aktif güvenlik kuralı sayısı', 0, 1000000), fraudFlag: bool(value.fraudFlag, 'Dolandırıcılık işareti'), lastEnforcementReason: optionalText(value.lastEnforcementReason, 'Son güvenlik gerekçesi', 1000), lastEnforcementAt: dateTime(value.lastEnforcementAt, 'Son güvenlik işlemi', false),
  };
}

function normalizeReason(reason: string) { const value = reason.trim(); if (value.length < 8 || value.length > 1000 || /[\u0000-\u001F\u007F]/.test(value)) throw new Error('Yönetim gerekçesi 8 ile 1000 karakter arasında olmalıdır.'); return value; }
function validateRoleInput(value: AdminPlatformUserRole) { if (!USER_ROLES.includes(value)) throw new Error('Kullanıcı rolü doğrulanamadı.'); return value; }

export async function adminListPlatformUsers(): Promise<AdminPlatformUser[]> {
  const { data, error } = await supabase.rpc('admin_list_platform_users_v2');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Kullanıcı listesi doğrulanamadı.');
  return rows.map(normalizeUser);
}

export async function adminSetPlatformUserRole(userId: string, nextRole: AdminPlatformUserRole, reason: string) {
  const id = uuid(userId, 'Kullanıcı kimliği'); const requestedRole = validateRoleInput(nextRole);
  const { data, error } = await supabase.rpc('admin_set_platform_user_role_v1', { p_user_id: id, p_role: requestedRole, p_reason: normalizeReason(reason) });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Güncellenen kullanıcı kimliği') !== id || role(result.role) !== requestedRole) throw new Error('Rol güncelleme yanıtı doğrulanamadı.');
  return result;
}

export async function adminEnforcePlatformUser(input: { userId: string; action: AdminPlatformUserEnforcementAction; reason: string; blockKnownIps?: boolean; blockKnownDevices?: boolean; fraudFlag?: boolean; expiresAt?: string | null; }) {
  const id = uuid(input.userId, 'Kullanıcı kimliği');
  if (!ENFORCEMENT_ACTIONS.has(input.action)) throw new Error('Hesap güvenlik işlemi doğrulanamadı.');
  let expiresAt: string | null = null;
  if (input.expiresAt) { const date = new Date(input.expiresAt); if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error('Engel bitiş tarihi gelecekte olmalıdır.'); expiresAt = date.toISOString(); }
  const { data, error } = await supabase.rpc('admin_enforce_platform_user_v1', {
    p_user_id: id, p_action: input.action, p_reason: normalizeReason(input.reason), p_block_known_ips: input.blockKnownIps === true, p_block_known_devices: input.blockKnownDevices === true, p_fraud_flag: input.fraudFlag === true, p_expires_at: expiresAt,
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Güvenlik işlemi kullanıcı kimliği') !== id) throw new Error('Hesap güvenlik işlemi yanıtı doğrulanamadı.');
  return result;
}

export async function adminSetPlatformUserStatus(userId: string, nextStatus: 'active' | 'blocked', reason: string) {
  return adminEnforcePlatformUser({ userId, action: nextStatus === 'active' ? 'unblock' : 'block', reason });
}

export async function adminArchivePlatformUser(userId: string, reason: string) {
  return adminEnforcePlatformUser({ userId, action: 'close', reason });
}

export function userAdminErrorMessage(error: unknown, fallback = 'Kullanıcı işlemi tamamlanamadı.') {
  const message = error instanceof Error ? error.message.trim() : String((error as any)?.message || '').trim();
  if (!message) return fallback;
  const map: Array<[string, string]> = [
    ['admin_required', 'Bu işlem için yönetici yetkisi gerekiyor.'], ['super_admin_required', 'IP, cihaz, dolandırıcılık işareti ve kalıcı hesap kapatma işlemleri yalnızca Süper Yönetici tarafından yapılabilir.'], ['cannot_enforce_current_user', 'Kendi hesabınızı bu ekrandan engelleyemez veya kapatamazsınız.'],
    ['super_admin_account_cannot_be_closed_here', 'Süper Yönetici hesabı bu güvenlik akışından kalıcı kapatılamaz.'], ['cannot_archive_current_user', 'Kendi hesabınızı arşivleyemezsiniz.'], ['cannot_block_current_user', 'Kendi hesabınızı engelleyemezsiniz.'], ['cannot_demote_current_super_admin', 'Kendi süper yönetici rolünüzü düşüremezsiniz.'],
    ['last_super_admin_cannot_be_demoted', 'Sistemdeki son aktif süper yönetici rolü kaldırılamaz.'], ['producer_profile_required', 'Satıcı rolü için kullanıcıya bağlı geçerli bir üretici profili gerekiyor.'], ['user_not_found', 'Kullanıcı artık bulunamadı. Listeyi yenileyin.'],
    ['enforcement_reason_required', 'Bu güvenlik kararı için 8 ile 1000 karakter arasında gerekçe yazın.'], ['invalid_block_expiry', 'Engel bitiş tarihi gelecekte olmalıdır.'], ['platform_access_blocked', 'Bu yönetici oturumu güvenlik politikası nedeniyle engellenmiş.'],
    ['role_reason_required', 'Rol değişikliği için en az 8 karakterlik gerekçe gerekiyor.'],
  ];
  for (const [key, text] of map) if (message.includes(key)) return text;
  return message.length <= 300 ? message : fallback;
}