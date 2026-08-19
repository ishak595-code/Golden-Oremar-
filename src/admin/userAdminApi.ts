import { supabase } from '../lib/supabase';

export type AdminPlatformUserRole = 'user' | 'vendor' | 'admin' | 'super_admin';
export type AdminPlatformUserStatus = 'active' | 'blocked' | 'deleted';

export type AdminPlatformUser = {
  id: string;
  name: string;
  email: string;
  role: AdminPlatformUserRole;
  status: AdminPlatformUserStatus;
  joinDate: string;
  vendor_id: string | null;
  lastSeenAt: string | null;
};

const USER_ROLES = ['user', 'vendor', 'admin', 'super_admin'] as const;
const USER_STATUSES = ['active', 'blocked', 'deleted'] as const;

function unwrap<T>(data: T | null, error: unknown): T {
  if (error) throw error;
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function optionalText(value: unknown, label: string, max = 500) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw new Error(`${label} doğrulanamadı.`);
  const text = value.trim();
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new Error(`${label} doğrulanamadı.`);
  return text;
}

function uuid(value: unknown, label: string) {
  const text = requiredText(value, label, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error(`${label} doğrulanamadı.`);
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

function role(value: unknown): AdminPlatformUserRole {
  const text = requiredText(value, 'Kullanıcı rolü', 40);
  if (!USER_ROLES.includes(text as AdminPlatformUserRole)) throw new Error('Kullanıcı rolü doğrulanamadı.');
  return text as AdminPlatformUserRole;
}

function status(value: unknown): AdminPlatformUserStatus {
  const text = requiredText(value, 'Kullanıcı durumu', 40);
  if (!USER_STATUSES.includes(text as AdminPlatformUserStatus)) throw new Error('Kullanıcı durumu doğrulanamadı.');
  return text as AdminPlatformUserStatus;
}

function normalizeUser(value: unknown, index: number): AdminPlatformUser {
  if (!isRecord(value)) throw new Error(`${index + 1}. kullanıcı kaydı doğrulanamadı.`);
  return {
    id: uuid(value.id, 'Kullanıcı kimliği'),
    name: requiredText(value.name, 'Kullanıcı adı', 240),
    email: optionalText(value.email, 'Kullanıcı e-postası', 320),
    role: role(value.role),
    status: status(value.status),
    joinDate: dateTime(value.joinDate, 'Katılım tarihi', true) as string,
    vendor_id: optionalUuid(value.vendor_id, 'Üretici kimliği'),
    lastSeenAt: dateTime(value.lastSeenAt, 'Son görülme tarihi', false),
  };
}

function normalizeReason(reason: string) {
  const value = reason.trim();
  if (value.length < 8 || value.length > 500 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new Error('Yönetim gerekçesi 8 ile 500 karakter arasında olmalıdır.');
  }
  return value;
}

function validateRoleInput(value: AdminPlatformUserRole) {
  if (!USER_ROLES.includes(value)) throw new Error('Kullanıcı rolü doğrulanamadı.');
  return value;
}

function validateStatusInput(value: Exclude<AdminPlatformUserStatus, 'deleted'>) {
  if (value !== 'active' && value !== 'blocked') throw new Error('Kullanıcı durumu doğrulanamadı.');
  return value;
}

export async function adminListPlatformUsers(): Promise<AdminPlatformUser[]> {
  const { data, error } = await supabase.rpc('admin_list_platform_users_v1');
  const rows = unwrap<unknown>(data, error);
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('Kullanıcı listesi doğrulanamadı.');
  return rows.map(normalizeUser);
}

export async function adminSetPlatformUserRole(userId: string, nextRole: AdminPlatformUserRole, reason: string) {
  const id = uuid(userId, 'Kullanıcı kimliği');
  const requestedRole = validateRoleInput(nextRole);
  const { data, error } = await supabase.rpc('admin_set_platform_user_role_v1', {
    p_user_id: id,
    p_role: requestedRole,
    p_reason: normalizeReason(reason),
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Güncellenen kullanıcı kimliği') !== id || role(result.role) !== requestedRole) {
    throw new Error('Rol güncelleme yanıtı doğrulanamadı.');
  }
  return result;
}

export async function adminSetPlatformUserStatus(userId: string, nextStatus: Exclude<AdminPlatformUserStatus, 'deleted'>, reason: string) {
  const id = uuid(userId, 'Kullanıcı kimliği');
  const requestedStatus = validateStatusInput(nextStatus);
  const { data, error } = await supabase.rpc('admin_set_platform_user_status_v1', {
    p_user_id: id,
    p_status: requestedStatus,
    p_reason: normalizeReason(reason),
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Güncellenen kullanıcı kimliği') !== id || status(result.status) !== requestedStatus) {
    throw new Error('Durum güncelleme yanıtı doğrulanamadı.');
  }
  return result;
}

export async function adminArchivePlatformUser(userId: string, reason: string) {
  const id = uuid(userId, 'Kullanıcı kimliği');
  const { data, error } = await supabase.rpc('admin_archive_platform_user_v1', {
    p_user_id: id,
    p_reason: normalizeReason(reason),
  });
  const result = unwrap<unknown>(data, error);
  if (!isRecord(result) || uuid(result.id, 'Arşivlenen kullanıcı kimliği') !== id) {
    throw new Error('Kullanıcı arşivleme yanıtı doğrulanamadı.');
  }
  return result;
}

export function userAdminErrorMessage(error: unknown, fallback = 'Kullanıcı işlemi tamamlanamadı.') {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return fallback;
  if (message.includes('admin_required')) return 'Bu işlem için yönetici yetkisi gerekiyor.';
  if (message.includes('super_admin_required')) return 'Bu işlem yalnızca süper yönetici tarafından yapılabilir.';
  if (message.includes('cannot_archive_current_user')) return 'Kendi hesabınızı arşivleyemezsiniz.';
  if (message.includes('cannot_block_current_user')) return 'Kendi hesabınızı engelleyemezsiniz.';
  if (message.includes('cannot_demote_current_super_admin')) return 'Kendi süper yönetici rolünüzü düşüremezsiniz.';
  if (message.includes('last_super_admin_cannot_be_demoted')) return 'Sistemdeki son aktif süper yönetici rolü kaldırılamaz.';
  if (message.includes('producer_profile_required')) return 'Satıcı rolü için kullanıcıya bağlı geçerli bir üretici profili gerekiyor.';
  if (message.includes('user_not_found')) return 'Kullanıcı artık bulunamadı. Listeyi yenileyin.';
  if (message.includes('role_reason_required') || message.includes('status_reason_required') || message.includes('archive_reason_required')) return 'Bu yönetim işlemi için en az 8 karakterlik gerekçe gerekiyor.';
  return message.length <= 240 ? message : fallback;
}
