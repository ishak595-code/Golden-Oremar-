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
  staffMfaRequired: boolean;
  mfaFactorEnrolled: boolean;
  mfaSatisfied: boolean;
  mfaEnforcementActive: boolean;
  staffMfaState: 'enrollment_required'|'enforced'|null;
  staffMfaTransitionPending: boolean;
  authenticatorAssuranceLevel: 'aal1'|'aal2';
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function bool(value:unknown,label:string){if(typeof value!=='boolean')throw new Error(`${label} doğrulanamadı.`);return value;}
function text(value:unknown,label:string,max=120){const next=typeof value==='string'?value.trim():'';if(!next||next.length>max||/[\u0000-\u001F\u007F]/.test(next))throw new Error(`${label} doğrulanamadı.`);return next;}
function assuranceLevel(value:unknown):'aal1'|'aal2'{if(value==='aal1'||value==='aal2')return value;throw new Error('Authenticator güven seviyesi doğrulanamadı.');}
function staffMfaState(value:unknown):'enrollment_required'|'enforced'|null{if(value===null||value===undefined)return null;if(value==='enrollment_required'||value==='enforced')return value;throw new Error('Personel MFA güvenlik durumu doğrulanamadı.');}

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
  const staffMfaRequired=bool(data.staffMfaRequired,'Personel MFA zorunluluğu');
  const mfaFactorEnrolled=bool(data.mfaFactorEnrolled,'MFA faktör durumu');
  const mfaSatisfied=bool(data.mfaSatisfied,'MFA doğrulama durumu');
  const mfaEnforcementActive=bool(data.mfaEnforcementActive,'MFA enforcement durumu');
  const staffMfaStateValue=staffMfaState(data.staffMfaState);
  const staffMfaTransitionPending=bool(data.staffMfaTransitionPending,'MFA transition durumu');
  const authenticatorAssuranceLevel=assuranceLevel(data.authenticatorAssuranceLevel);
  if(canAccessAdmin!==permissions.includes('admin.access'))throw new Error('Yönetim capability cevabı tutarsız.');
  if(isSuperAdmin!==roles.includes('super_admin'))throw new Error('Super Admin rol cevabı tutarsız.');
  if(isAdmin!==(roles.includes('admin')||roles.includes('super_admin')))throw new Error('Admin rol cevabı tutarsız.');
  if(mfaEnforcementActive!==staffMfaRequired)throw new Error('MFA enforcement cevabı tutarsız.');
  if(!staffMfaRequired&&(mfaSatisfied!==true||staffMfaStateValue!==null||staffMfaTransitionPending))throw new Error('MFA gerektirmeyen oturum yanlış güven durumunda.');
  if(staffMfaRequired&&staffMfaStateValue===null)throw new Error('Personel MFA güvenlik durumu eksik.');
  if(staffMfaTransitionPending!==(staffMfaRequired&&staffMfaStateValue==='enrollment_required'))throw new Error('Personel MFA transition cevabı tutarsız.');
  if(staffMfaRequired&&mfaSatisfied&&!(staffMfaStateValue==='enforced'&&mfaFactorEnrolled&&authenticatorAssuranceLevel==='aal2'))throw new Error('Personel MFA doğrulaması güvenli AAL2 koşullarını sağlamıyor.');
  if(staffMfaRequired&&!mfaSatisfied){const unsafe=permissions.filter(permission=>permission!=='mfa.self_manage');if(unsafe.length||canAccessAdmin)throw new Error('AAL1 personel oturumuna ayrıcalıklı capability sızdı.');}
  if(staffMfaRequired&&!permissions.includes('mfa.self_manage'))throw new Error('Personel kendi MFA faktörünü yönetme capability’sini alamadı.');
  return{userId,accountStatus,roles,permissions,canAccessAdmin,isAdmin,isSuperAdmin,staffMfaRequired,mfaFactorEnrolled,mfaSatisfied,mfaEnforcementActive,staffMfaState:staffMfaStateValue,staffMfaTransitionPending,authenticatorAssuranceLevel};
}
