import assert from 'node:assert/strict';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.VITE_SUPABASE_URL||'').trim();
const key=String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim();
const controlUrl=String(process.env.E2E_CI_CONTROL_URL||'').trim();
const oidc=String(process.env.E2E_CI_OIDC_TOKEN||'').trim();
const runId=String(process.env.GITHUB_RUN_ID||'').trim();
if(!url||!key||!controlUrl||!oidc||!/^[0-9]{1,24}$/.test(runId))throw new Error('staff_mfa_e2e_environment_missing');

const slots=['mfa-mod-a','mfa-mod-b','mfa-admin','mfa-super'];
const credentials=new Map();
const created=[];

function email(slot){return `goldenoremar+ci-e2e-${runId}-${slot}@gmail.com`;}
function password(){return `Mfa-${randomBytes(18).toString('base64url')}!9`;}
function client(){return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
function decodeJwt(token){const part=String(token||'').split('.')[1]||'';const padded=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');return JSON.parse(Buffer.from(padded,'base64').toString('utf8'));}
function base32(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';const clean=String(secret||'').toUpperCase().replace(/=+$/,'').replace(/\s+/g,'');let bits='';for(const ch of clean){const idx=alphabet.indexOf(ch);if(idx<0)throw new Error('invalid_totp_secret');bits+=idx.toString(2).padStart(5,'0');}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(Number.parseInt(bits.slice(i,i+8),2));return Buffer.from(bytes);}
function totp(secret,time=Date.now()){const counter=Math.floor(time/30000);const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(counter));const digest=createHmac('sha1',base32(secret)).update(msg).digest();const offset=digest[digest.length-1]&15;const value=((digest[offset]&0x7f)<<24)|((digest[offset+1]&0xff)<<16)|((digest[offset+2]&0xff)<<8)|(digest[offset+3]&0xff);return String(value%1_000_000).padStart(6,'0');}
function wrongTotp(secret){const value=Number(totp(secret));return String((value+137)%1_000_000).padStart(6,'0');}
async function control(action,extra={}){const response=await fetch(controlUrl,{method:'POST',headers:{Authorization:`Bearer ${oidc}`,'Content-Type':'application/json'},body:JSON.stringify({action,runId,...extra})});const body=await response.json().catch(()=>({}));if(!response.ok||body?.ok!==true)throw new Error(`ci_control_${action}_failed:${response.status}:${String(body?.error||'unknown')}`);return body;}
async function provision(role,slot){const pass=password();credentials.set(slot,{email:email(slot),password:pass});const data=await control('provision-staff',{slot,staffRole:role,password:pass,displayName:`Golden Oremar MFA CI ${role}`});created.push(slot);return data;}
async function signIn(c,slot){const cred=credentials.get(slot);assert.ok(cred);const{data,error}=await c.auth.signInWithPassword(cred);assert.ifError(error);assert.ok(data.session?.access_token);return data.session;}
async function context(c){const{data,error}=await c.rpc('authorization_context_v1');assert.ifError(error);assert.ok(data&&typeof data==='object'&&!Array.isArray(data));return data;}
async function can(c,permission){const{data,error}=await c.rpc('authorization_has_permission_v1',{p_permission_key:permission});assert.ifError(error);assert.equal(typeof data,'boolean');return data;}
function permissionDenied(error){return Boolean(error&&(error.code==='42501'||/permission_required|admin_required|access_denied|not_allowed|aal2_verified_factor_required|mfa_factor_not_owned|staff_mfa_event_required/i.test(String(error.message||''))));}
async function expectPermissionDenied(promise,label){const{error}=await promise;assert.ok(error,`${label}: privileged RPC unexpectedly succeeded`);assert.ok(permissionDenied(error),`${label}: expected authorization denial, got ${error.code||''} ${error.message||''}`);}
async function expectNotAuthorizationDenied(promise,label){const{error}=await promise;assert.ok(error,`${label}: random fixture unexpectedly mutated data`);assert.ok(!permissionDenied(error),`${label}: authorized role was blocked by permission gate: ${error.code||''} ${error.message||''}`);}
async function assertAal1StaffDenied(c,expectedRole){const snap=await context(c);assert.ok(Array.isArray(snap.roles)&&snap.roles.includes(expectedRole));assert.equal(snap.staffMfaRequired,true);assert.equal(snap.mfaSatisfied,false);assert.equal(snap.authenticatorAssuranceLevel,'aal1');assert.equal(snap.canAccessAdmin,false);assert.deepEqual(snap.permissions,['mfa.self_manage']);for(const p of ['admin.access','product.moderate','seller.approve','refund.approve','refund.execute','payout.release','role.manage','system.configure'])assert.equal(await can(c,p),false,`${expectedRole} AAL1 leaked ${p}`);
  await expectPermissionDenied(c.rpc('admin_review_product_v3',{p_product_id:randomUUID(),p_approve:false,p_reason:'CI MFA AAL1 denial',p_ownership_checked:false,p_image_checked:false,p_scope_checked:false,p_origin_checked:false}),'product moderation');
  await expectPermissionDenied(c.rpc('admin_review_producer_application_v3',{p_application_id:randomUUID(),p_status:'approved',p_reason:'CI MFA AAL1 denial',p_commission_basis_points:1000}),'seller approval');
  await expectPermissionDenied(c.rpc('admin_record_manual_refund_v1',{p_return_id:randomUUID(),p_payment_id:randomUUID(),p_provider_reference:'ci-mfa-deny',p_amount_minor:100,p_status:'completed'}),'refund execution');
  await expectPermissionDenied(c.rpc('admin_update_producer_payout_v1',{p_payout_id:randomUUID(),p_status:'paid',p_provider:'ci',p_provider_reference:'ci-mfa-deny',p_note:'CI MFA AAL1 denial'}),'payout release');
  await expectPermissionDenied(c.rpc('admin_set_platform_user_role_v2',{p_user_id:randomUUID(),p_role:'customer',p_reason:'CI MFA AAL1 denial'}),'role governance');
  await expectPermissionDenied(c.rpc('admin_update_brand_configuration_v1',{p_section:'general',p_payload:{}}),'system configuration');
  return snap;
}
async function enroll(c,name){const{data,error}=await c.auth.mfa.enroll({factorType:'totp',friendlyName:name});assert.ifError(error);assert.ok(data?.id&&data?.totp?.secret);return{id:data.id,secret:data.totp.secret};}
async function verifyFactor(c,factor){const challenge=await c.auth.mfa.challenge({factorId:factor.id});assert.ifError(challenge.error);const verification=await c.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code:totp(factor.secret)});assert.ifError(verification.error);const refreshed=await c.auth.refreshSession();assert.ifError(refreshed.error);const assurance=await c.auth.mfa.getAuthenticatorAssuranceLevel();assert.ifError(assurance.error);assert.equal(assurance.data.currentLevel,'aal2');const session=(await c.auth.getSession()).data.session;assert.ok(session?.access_token);assert.equal(decodeJwt(session.access_token).aal,'aal2');const audit=await c.rpc('mfa_record_self_event_v1',{p_event:'mfa.privileged_session_established',p_factor_id:factor.id});assert.ifError(audit.error);return session;}
async function challengeWithBadCode(c,factor){const challenge=await c.auth.mfa.challenge({factorId:factor.id});assert.ifError(challenge.error);const verification=await c.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code:wrongTotp(factor.secret)});assert.ok(verification.error,'invalid TOTP unexpectedly verified');const audit=await c.rpc('mfa_record_self_event_v1',{p_event:'mfa.challenge_failed',p_factor_id:factor.id});assert.ifError(audit.error);}
async function verifiedFactors(c){const{data,error}=await c.auth.mfa.listFactors();assert.ifError(error);return(data?.totp||[]).filter(x=>x.status==='verified');}
async function aal(c){const{data,error}=await c.auth.mfa.getAuthenticatorAssuranceLevel();assert.ifError(error);return data;}

async function moderatorScenario(){
  await provision('moderator','mfa-mod-a');await provision('moderator','mfa-mod-b');
  const a=client();await signIn(a,'mfa-mod-a');let snap=await assertAal1StaffDenied(a,'moderator');assert.equal(snap.staffMfaState,'enrollment_required');assert.equal(snap.staffMfaTransitionPending,true);
  const primary=await enroll(a,'CI Moderator Primary');snap=await context(a);assert.equal(snap.mfaFactorEnrolled,false);assert.deepEqual(snap.permissions,['mfa.self_manage']);
  const forgedPrivilegedAudit=await a.rpc('mfa_record_self_event_v1',{p_event:'mfa.privileged_session_established',p_factor_id:primary.id});assert.ok(forgedPrivilegedAudit.error&&permissionDenied(forgedPrivilegedAudit.error),'AAL1/unverified factor forged privileged-session audit event unexpectedly succeeded');
  await verifyFactor(a,primary);snap=await context(a);assert.equal(snap.staffMfaState,'enforced');assert.equal(snap.staffMfaTransitionPending,false);assert.equal(snap.mfaSatisfied,true);assert.equal(await can(a,'product.moderate'),true);for(const p of ['refund.execute','payout.release','role.manage','system.configure'])assert.equal(await can(a,p),false,`moderator AAL2 leaked ${p}`);
  await expectNotAuthorizationDenied(a.rpc('admin_review_product_v3',{p_product_id:randomUUID(),p_approve:false,p_reason:'CI authorized moderator probe',p_ownership_checked:false,p_image_checked:false,p_scope_checked:false,p_origin_checked:false}),'moderator product endpoint');
  await challengeWithBadCode(a,primary);

  const secondBrowser=client();await signIn(secondBrowser,'mfa-mod-a');const secondAal=await aal(secondBrowser);assert.equal(secondAal.currentLevel,'aal1');assert.equal(secondAal.nextLevel,'aal2');await assertAal1StaffDenied(secondBrowser,'moderator');

  const backup=await enroll(a,'CI Moderator Backup');assert.equal((await verifiedFactors(a)).length,1);await verifyFactor(a,backup);let factors=await verifiedFactors(a);assert.equal(factors.length,2);
  const primaryChallenge=await a.auth.mfa.challenge({factorId:primary.id});assert.ifError(primaryChallenge.error);const primaryVerify=await a.auth.mfa.verify({factorId:primary.id,challengeId:primaryChallenge.data.id,code:totp(primary.secret)});assert.ifError(primaryVerify.error);
  const backupChallenge=await a.auth.mfa.challenge({factorId:backup.id});assert.ifError(backupChallenge.error);const backupVerify=await a.auth.mfa.verify({factorId:backup.id,challengeId:backupChallenge.data.id,code:totp(backup.secret)});assert.ifError(backupVerify.error);

  const b=client();await signIn(b,'mfa-mod-b');await assertAal1StaffDenied(b,'moderator');const bFactor=await enroll(b,'CI Other User Factor');await verifyFactor(b,bFactor);
  const ownershipAttack=await b.auth.mfa.unenroll({factorId:primary.id});assert.ok(ownershipAttack.error,'other-user factor ID unenroll attack unexpectedly succeeded');const ownershipAudit=await b.rpc('mfa_record_self_event_v1',{p_event:'mfa.challenge_failed',p_factor_id:primary.id});assert.ok(ownershipAudit.error&&permissionDenied(ownershipAudit.error),'other-user factor audit ownership attack was not denied');

  const removeBackup=await a.auth.mfa.unenroll({factorId:backup.id});assert.ifError(removeBackup.error);factors=await verifiedFactors(a);assert.equal(factors.length,1);assert.equal(factors[0].id,primary.id);
  const removeLast=await a.auth.mfa.unenroll({factorId:primary.id});assert.ok(removeLast.error,'last verified staff factor deletion unexpectedly succeeded');assert.equal((await verifiedFactors(a)).length,1);snap=await context(a);assert.equal(snap.staffMfaState,'enforced');

  await a.auth.signOut();await signIn(a,'mfa-mod-a');assert.equal((await aal(a)).currentLevel,'aal1');await assertAal1StaffDenied(a,'moderator');await verifyFactor(a,primary);assert.equal(await can(a,'product.moderate'),true);
  const refresh=await a.auth.refreshSession();assert.ifError(refresh.error);assert.equal(decodeJwt(refresh.data.session.access_token).aal,'aal2');assert.equal(await can(a,'product.moderate'),true);

  await control('set-block',{slot:'mfa-mod-a',blocked:true});assert.equal(await can(a,'product.moderate'),false,'blocked account retained moderator capability on old AAL2 token');snap=await context(a);assert.deepEqual(snap.permissions,[]);await control('set-block',{slot:'mfa-mod-a',blocked:false});assert.equal(await can(a,'product.moderate'),true);

  const auditSummary=await control('mfa-audit-summary',{slot:'mfa-mod-a'});const events=auditSummary.events||{};for(const event of ['mfa.enrollment_started','mfa.factor_verified','mfa.transition_completed','mfa.challenge_started','mfa.challenge_succeeded','mfa.challenge_failed','mfa.privileged_session_established'])assert.ok(Number(events[event]||0)>=1,`missing MFA audit event ${event}`);

  await control('remove-staff-roles',{slot:'mfa-mod-a'});assert.equal(await can(a,'product.moderate'),false,'removed staff role retained capability on old AAL2 token');snap=await context(a);assert.ok(!snap.roles.includes('moderator'));
}

async function roleScenario(role,slot,allowed,denied){
  await provision(role,slot);const c=client();await signIn(c,slot);await assertAal1StaffDenied(c,role);const factor=await enroll(c,`CI ${role}`);await verifyFactor(c,factor);const snap=await context(c);assert.equal(snap.mfaSatisfied,true);assert.equal(snap.canAccessAdmin,true);for(const p of allowed)assert.equal(await can(c,p),true,`${role} missing ${p}`);for(const p of denied)assert.equal(await can(c,p),false,`${role} leaked ${p}`);return{client:c,factor,snapshot:snap};
}

try{
  await moderatorScenario();
  await roleScenario('admin','mfa-admin',['admin.access','user.manage','refund.execute'],['role.manage','payout.release','system.configure','security.manage']);
  const owner=await roleScenario('super_admin','mfa-super',['admin.access','role.manage','payout.release','system.configure','security.manage','payment.manage','user.erase','product.remove','mfa.self_manage'],[]);
  assert.ok(owner.snapshot.permissions.length>=77,'Super Admin does not receive the complete active capability set');
  console.log('staff-mfa-e2e: PASS');
}finally{
  for(const slot of [...created].reverse())await control('delete',{slot}).catch(()=>undefined);
}
