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

function unwrap<T>(data: T | null, error: any): T {
  if (error) throw error;
  return data as T;
}

function normalizeReason(reason: string) {
  const value = reason.trim();
  if (value.length < 8 || value.length > 500) {
    throw new Error('Yönetim gerekçesi 8 ile 500 karakter arasında olmalıdır.');
  }
  return value;
}

export async function adminListPlatformUsers(): Promise<AdminPlatformUser[]> {
  const { data, error } = await supabase.rpc('admin_list_platform_users_v1');
  const rows = unwrap<any[]>(data, error);
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: String(row.id),
    name: String(row.name || 'Kullanıcı'),
    email: String(row.email || ''),
    role: (['user', 'vendor', 'admin', 'super_admin'].includes(String(row.role)) ? row.role : 'user') as AdminPlatformUserRole,
    status: (['active', 'blocked', 'deleted'].includes(String(row.status)) ? row.status : 'blocked') as AdminPlatformUserStatus,
    joinDate: String(row.joinDate || ''),
    vendor_id: row.vendor_id ? String(row.vendor_id) : null,
    lastSeenAt: row.lastSeenAt ? String(row.lastSeenAt) : null,
  }));
}

export async function adminSetPlatformUserRole(userId: string, role: AdminPlatformUserRole, reason: string) {
  const { data, error } = await supabase.rpc('admin_set_platform_user_role_v1', {
    p_user_id: userId,
    p_role: role,
    p_reason: normalizeReason(reason),
  });
  return unwrap<any>(data, error);
}

export async function adminSetPlatformUserStatus(userId: string, status: Exclude<AdminPlatformUserStatus, 'deleted'>, reason: string) {
  const { data, error } = await supabase.rpc('admin_set_platform_user_status_v1', {
    p_user_id: userId,
    p_status: status,
    p_reason: normalizeReason(reason),
  });
  return unwrap<any>(data, error);
}

export async function adminArchivePlatformUser(userId: string, reason: string) {
  const { data, error } = await supabase.rpc('admin_archive_platform_user_v1', {
    p_user_id: userId,
    p_reason: normalizeReason(reason),
  });
  return unwrap<any>(data, error);
}

export function userAdminErrorMessage(error: unknown, fallback = 'Kullanıcı işlemi tamamlanamadı.') {
  const message = String((error as any)?.message || '').trim();
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
