import { supabase } from '../../lib/supabase';
import { isCanonicalRole, isPermissionKey, type CanonicalRole, type PermissionKey } from './permissions';

export type AuthorizationContextSnapshot = {
  userId: string;
  accountStatus: string;
  roles: CanonicalRole[];
  permissions: PermissionKey[];
  canAccessAdmin: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function text(value:unknown,label:string,max=120){const next=typeof value==='string'?value.trim():'';if(!next||next.length>max||/[\u0000-\u001F\u007F]/.test(next))throw new Error(`${label} doğrulanamadı.`);return next;}

export async function getAuthorizationContext():Promise<AuthorizationContextSnapshot>{
  const{data,error}=await supabase.rpc('authorization_context_v1');
  if(error)throw error;
  if(!record(data))throw new Error('Yetki bağlamı sunucudan doğrulanamadı.');
  const userId=text(data.userId,'Kullanıcı kimliği',36);
  if(!UUID_RE.test(userId))throw new Error('Kullanıcı kimliği doğrulanamadı.');
  const accountStatus=text(data.accountStatus,'Hesap durumu',80);
  if(!Array.isArray(data.roles)||data.roles.length>16)throw new Error('Rol listesi doğrulanamadı.');
  if(!Array.isArray(data.permissions)||data.permissions.length>256)throw new Error('Permission listesi doğrulanamadı.');
  const roles=[...new Set(data.roles.filter(isCanonicalRole))];
  if(roles.length!==data.roles.length)throw new Error('Bilinmeyen canonical rol döndürüldü.');
  const permissions=[...new Set(data.permissions.filter(isPermissionKey))];
  if(permissions.length!==data.permissions.length)throw new Error('Bilinmeyen canonical permission döndürüldü.');
  const canAccessAdmin=bool(data.canAccessAdmin,'Yönetim erişimi');
  const isAdmin=bool(data.isAdmin,'Admin durumu');
  const isSuperAdmin=bool(data.isSuperAdmin,'Super Admin durumu');
  if(canAccessAdmin!==permissions.includes('admin.access'))throw new Error('Yönetim capability cevabı tutarsız.');
  if(isSuperAdmin!==roles.includes('super_admin'))throw new Error('Super Admin rol cevabı tutarsız.');
  if(isAdmin!==(roles.includes('admin')||roles.includes('super_admin')))throw new Error('Admin rol cevabı tutarsız.');
  return{userId,accountStatus,roles,permissions,canAccessAdmin,isAdmin,isSuperAdmin};
}
