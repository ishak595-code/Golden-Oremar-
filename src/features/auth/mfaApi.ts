import { supabase } from '../../lib/supabase';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOTP_CODE_RE=/^\d{6}$/;
const MAX_QR_LENGTH=512_000;

export type StaffTotpFactor={id:string;friendlyName:string;status:'verified'|'unverified'};
export type StaffTotpEnrollment={factorId:string;qrCode:string;secret:string};

function factorId(value:unknown){const id=typeof value==='string'?value.trim():'';if(!UUID_RE.test(id))throw new Error('MFA faktör kimliği doğrulanamadı.');return id;}
function totpCode(value:unknown){const code=typeof value==='string'?value.replace(/\s+/g,''):'';if(!TOTP_CODE_RE.test(code))throw new Error('Doğrulama kodu 6 rakam olmalıdır.');return code;}
function friendlyName(value:unknown){const text=typeof value==='string'?value.trim():'';return text&&text.length<=120&&!/[\u0000-\u001F\u007F]/.test(text)?text:'Authenticator';}
function enrollmentSecret(value:unknown){const text=typeof value==='string'?value.trim():'';if(!text||text.length>256||/[\u0000-\u0020\u007F]/.test(text))throw new Error('Authenticator kurulum anahtarı doğrulanamadı.');return text;}
function qrCodeSource(value:unknown){const text=typeof value==='string'?value.trim():'';if(!text||text.length>MAX_QR_LENGTH||!/^data:image\/svg\+xml(?:(?:;charset=utf-8|;utf-8)?(?:;base64)?)?,/i.test(text))throw new Error('Authenticator QR kodu güvenli biçimde alınamadı.');return text;}

function normalizeTotpFactors(data:unknown):StaffTotpFactor[]{
  const record=Boolean(data)&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:{};
  const raw=Array.isArray(record.totp)?record.totp:[];
  const factors:StaffTotpFactor[]=[];
  for(const item of raw){
    if(!item||typeof item!=='object'||Array.isArray(item))continue;
    const source=item as Record<string,unknown>;
    const id=typeof source.id==='string'&&UUID_RE.test(source.id.trim())?source.id.trim():'';
    const status=source.status==='verified'?'verified':source.status==='unverified'?'unverified':null;
    if(id&&status)factors.push({id,friendlyName:friendlyName(source.friendly_name),status});
  }
  return factors;
}

export async function listStaffTotpFactors(){
  const{data,error}=await supabase.auth.mfa.listFactors();
  if(error)throw error;
  return normalizeTotpFactors(data);
}

export async function getAuthenticatorAssuranceLevel(){
  const{data,error}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(error)throw error;
  const currentLevel=data?.currentLevel==='aal2'?'aal2':'aal1';
  const nextLevel=data?.nextLevel==='aal2'?'aal2':'aal1';
  return{currentLevel,nextLevel};
}

async function removeStaleUnverifiedFactors(){
  const factors=await listStaffTotpFactors();
  for(const factor of factors){
    if(factor.status!=='unverified')continue;
    const{error}=await supabase.auth.mfa.unenroll({factorId:factor.id});
    if(error)throw error;
  }
}

export async function beginStaffTotpEnrollment():Promise<StaffTotpEnrollment>{
  const existing=await listStaffTotpFactors();
  if(existing.some(factor=>factor.status==='verified'))throw new Error('Doğrulanmış bir authenticator zaten kayıtlı. Yeni kurulum yerine mevcut faktörle doğrulama yapın.');
  await removeStaleUnverifiedFactors();
  const{data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Golden Oremar Yönetim'});
  if(error)throw error;
  if(!data?.totp)throw new Error('Authenticator kurulum bilgisi alınamadı.');
  return{factorId:factorId(data.id),qrCode:qrCodeSource(data.totp.qr_code),secret:enrollmentSecret(data.totp.secret)};
}

async function verifyChallenge(targetFactorId:string,code:string){
  const id=factorId(targetFactorId);const normalizedCode=totpCode(code);
  const challenge=await supabase.auth.mfa.challenge({factorId:id});
  if(challenge.error)throw challenge.error;
  const challengeId=factorId(challenge.data.id);
  const verification=await supabase.auth.mfa.verify({factorId:id,challengeId,code:normalizedCode});
  if(verification.error)throw verification.error;
  const refreshed=await supabase.auth.refreshSession();
  if(refreshed.error)throw refreshed.error;
  const assurance=await getAuthenticatorAssuranceLevel();
  if(assurance.currentLevel!=='aal2')throw new Error('İkinci faktör doğrulandı ancak güvenli AAL2 oturumu oluşturulamadı.');
  return true;
}

export async function verifyStaffTotpEnrollment(targetFactorId:string,code:string){return verifyChallenge(targetFactorId,code);}

export async function verifyExistingStaffTotp(code:string,targetFactorId?:string){
  const factors=(await listStaffTotpFactors()).filter(factor=>factor.status==='verified');
  if(!factors.length)throw new Error('Doğrulanmış authenticator faktörü bulunamadı.');
  const target=targetFactorId?factors.find(factor=>factor.id===factorId(targetFactorId)):factors[0];
  if(!target)throw new Error('Seçilen authenticator faktörü bulunamadı.');
  return verifyChallenge(target.id,code);
}

export async function cancelStaffTotpEnrollment(targetFactorId:string){
  const id=factorId(targetFactorId);
  const factors=await listStaffTotpFactors();
  const factor=factors.find(item=>item.id===id);
  if(!factor)return true;
  if(factor.status==='verified')throw new Error('Doğrulanmış authenticator bu kurulum iptal akışından kaldırılamaz.');
  const{error}=await supabase.auth.mfa.unenroll({factorId:id});
  if(error)throw error;
  return true;
}
