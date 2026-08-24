import {createClient} from '@supabase/supabase-js';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const command=String(process.argv[2]||'status').trim().toLowerCase();
const userId=String(process.argv[3]||process.env.MFA_RECOVERY_USER_ID||'').trim();
const reason=String(process.env.MFA_RECOVERY_REASON||process.argv.slice(4).join(' ')||'').trim();
const url=String(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'').trim().replace(/\/+$/,'');
const serviceRole=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();

if(!['status','reset-all','cancel'].includes(command))throw new Error('usage: node scripts/super-admin-mfa-recovery.mjs <status|reset-all|cancel> <user-uuid> [reason]');
if(!UUID_RE.test(userId))throw new Error('valid_super_admin_user_uuid_required');
if(!url||!serviceRole)throw new Error('SUPABASE_URL_and_SUPABASE_SERVICE_ROLE_KEY_required');
if(serviceRole===String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||''))throw new Error('service_role_key_required_not_publishable_key');
if(command!=='status'&&(reason.length<20||reason.length>1000))throw new Error('recovery_reason_must_be_20_to_1000_characters');

const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});

async function rpc(name,args){const{data,error}=await admin.rpc(name,args);if(error)throw new Error(`${name}:${error.code||''}:${error.message||'failed'}`);return data;}
async function status(){return rpc('get_super_admin_mfa_recovery_status_for_service_v1',{p_user_id:userId});}
function normalizeFactors(data){const factors=Array.isArray(data?.factors)?data.factors:Array.isArray(data)?data:[];return factors.filter(item=>item&&typeof item==='object').map(item=>({id:String(item.id||''),type:String(item.factor_type||item.factorType||item.type||''),status:String(item.status||'')})).filter(item=>UUID_RE.test(item.id));}
function safeStatus(value){return{ok:Boolean(value?.ok),state:String(value?.state||'unknown'),active:Boolean(value?.active),expiresAt:value?.expiresAt||null,verifiedTotpFactorCount:Number(value?.verifiedTotpFactorCount||0),recoveryStartedAt:value?.recoveryStartedAt||null,recoveryCompletedAt:value?.recoveryCompletedAt||null};}

if(command==='status'){
 console.log(JSON.stringify(safeStatus(await status()),null,2));
 process.exit(0);
}

if(command==='cancel'){
 const result=await rpc('cancel_super_admin_mfa_recovery_for_service_v1',{p_user_id:userId,p_reason:reason});
 console.log(JSON.stringify({ok:Boolean(result?.ok),cancelled:Boolean(result?.cancelled),state:String(result?.state||'unknown')},null,2));
 process.exit(0);
}

const confirmation=String(process.env.MFA_RECOVERY_CONFIRM||'').trim();
const expected=`RESET-MFA-${userId.slice(-8).toUpperCase()}`;
if(confirmation!==expected)throw new Error(`explicit_confirmation_required_set_MFA_RECOVERY_CONFIRM_to_${expected}`);

const before=safeStatus(await status());
if(before.state!=='enforced')throw new Error(`recovery_requires_enforced_state_current_${before.state}`);
if(before.verifiedTotpFactorCount<1)throw new Error('recovery_requires_at_least_one_verified_totp_factor');

const listed=await admin.auth.admin.mfa.listFactors({userId});
if(listed.error)throw new Error(`admin_mfa_list_failed:${listed.error.message}`);
const verifiedTotp=normalizeFactors(listed.data).filter(item=>item.type==='totp'&&item.status==='verified');
if(!verifiedTotp.length)throw new Error('verified_totp_factor_list_empty');
if(verifiedTotp.length!==before.verifiedTotpFactorCount)throw new Error('verified_totp_factor_count_mismatch');

let recoveryOpened=false;
try{
 const opened=await rpc('begin_super_admin_mfa_recovery_for_service_v1',{p_user_id:userId,p_reason:reason});
 recoveryOpened=true;
 if(!opened?.ok||opened?.state!=='enforced'||!opened?.expiresAt)throw new Error('recovery_window_not_opened');
 for(const factor of verifiedTotp){
   const deletion=await admin.auth.admin.mfa.deleteFactor({userId,id:factor.id});
   if(deletion.error)throw new Error(`admin_mfa_delete_failed:${deletion.error.message}`);
 }
 const after=safeStatus(await status());
 if(after.state!=='enforced'||after.active||after.verifiedTotpFactorCount!==0)throw new Error(`post_reset_invariant_failed:${JSON.stringify(after)}`);
 console.log(JSON.stringify({ok:true,state:after.state,verifiedTotpFactorCount:after.verifiedTotpFactorCount,recoveryWindowActive:after.active,nextStep:'Sign in at AAL1, enroll a new TOTP factor, verify it, then confirm AAL2 before any management capability is used.'},null,2));
}catch(error){
 if(recoveryOpened)await rpc('cancel_super_admin_mfa_recovery_for_service_v1',{p_user_id:userId,p_reason:`Recovery utility aborted safely: ${String(error instanceof Error?error.message:error).slice(0,700)}`}).catch(()=>undefined);
 throw error;
}
