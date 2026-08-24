import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing staff MFA contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function req(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const migration=read('supabase/migrations/20260824124542_add_staff_totp_mfa_transition_v1.sql');
req(migration,/current_authenticator_assurance_level_v1/,'Database must derive the current JWT authenticator assurance level.');
req(migration,/auth\.jwt\(\)->>'aal'/,'AAL must come from the authenticated JWT claim.');
req(migration,/user_requires_staff_mfa_v1/,'Staff role MFA policy helper is missing.');
for(const role of['support','content_editor','operations','moderator','admin','super_admin'])req(migration,new RegExp(`'${role}'`),`Staff MFA policy must include ${role}.`);
req(migration,/auth\.mfa_factors/,'MFA enforcement must use Supabase Auth factors rather than an app-local flag.');
req(migration,/factor\.status::text='verified'/,'Only verified MFA factors may activate enforcement.');
req(migration,/factor\.factor_type::text='totp'/,'Staff MFA enforcement must be bound to verified TOTP factors.');
req(migration,/private\.has_permission\(p_permission_key text\)[\s\S]*current_authenticator_assurance_level_v1\(\)='aal2'/,'Capability execution must require AAL2 after staff TOTP enrollment.');
req(migration,/mfa_enforcement_active:=staff_mfa_required and mfa_factor_enrolled/,'Authorization context must expose deterministic MFA enforcement state.');
req(migration,/and \(not mfa_enforcement_active or aal='aal2'\)/,'AAL1 staff sessions with a verified factor must receive no effective permissions.');
req(migration,/baseline_allowed:=coalesce\(private\.user_has_permission_v1\(caller_id,'admin\.access'\),false\)/,'Admin shell status must remain available for the MFA challenge while capability execution is separately locked.');

const api=read('src/features/auth/mfaApi.ts');
for(const method of['mfa.listFactors','mfa.enroll','mfa.challenge','mfa.verify','mfa.unenroll','refreshSession','getAuthenticatorAssuranceLevel'])req(api,new RegExp(method.replace('.','\\.')),`MFA client must use Supabase ${method}.`);
req(api,/TOTP_CODE_RE=\/\^\\d\{6\}\$\//,'TOTP input must be exactly six digits.');
req(api,/data:image\\\/svg\\\+xml/,'MFA QR source must be restricted to SVG data URLs.');
req(api,/currentLevel!=='aal2'/,'Successful verification must prove the refreshed session is AAL2.');
req(api,/factor\.status==='verified'/,'Verified factors must be distinguished from unverified enrollment state.');
forbid(api,/dangerouslySetInnerHTML/,'MFA QR must never be rendered through raw HTML injection.');
forbid(api,/console\.(?:log|info|debug).*secret/i,'MFA enrollment secrets must never be logged.');

const gate=read('src/features/auth/StaffMfaGate.tsx');
req(gate,/factorEnrolled/,'Staff MFA gate must distinguish enrollment from challenge.');
req(gate,/beginStaffTotpEnrollment/,'Staff MFA gate must support first-factor enrollment.');
req(gate,/verifyExistingStaffTotp/,'Staff MFA gate must challenge returning staff sessions.');
req(gate,/autoComplete="one-time-code"/,'TOTP input must expose secure one-time-code semantics.');
req(gate,/pattern="\[0-9\]\{6\}"/,'TOTP UI must constrain six numeric digits.');
req(gate,/Güvenli çıkış yap/,'MFA gate must always provide a safe logout path.');
forbid(gate,/Atla|Şimdi değil|Sonra yap/i,'Mandatory staff MFA gate must not expose a bypass action.');

const authorization=read('src/features/auth/authorizationApi.ts');
for(const field of['staffMfaRequired','mfaFactorEnrolled','mfaSatisfied','mfaEnforcementActive','authenticatorAssuranceLevel'])req(authorization,new RegExp(field),`Authorization snapshot must validate ${field}.`);
req(authorization,/AAL1 personel oturumuna capability sızdı/,'Client authorization must fail closed if AAL1 receives staff capabilities after enrollment.');

const adminPage=read('src/pages/AdminPage.tsx');
req(adminPage,/StaffMfaGate/,'Admin workspace must mount the staff MFA gate.');
req(adminPage,/snapshot\?\.staffMfaRequired&&!snapshot\.mfaSatisfied/,'Admin workspace must gate unsatisfied staff MFA.');
const gateIndex=adminPage.indexOf("if(snapshot?.staffMfaRequired&&!snapshot.mfaSatisfied)");
const fallbackIndex=adminPage.indexOf('const fallback=firstAllowedAdminTab(can);');
if(gateIndex<0||fallbackIndex<0||gateIndex>fallbackIndex)failures.push('MFA gate must run before permission fallback so enrolled AAL1 staff can reach the challenge screen.');

if(failures.length){console.error('Golden Oremar staff MFA contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar staff MFA contract audit passed: verified TOTP, AAL2 capability enforcement, enrollment/challenge UX, safe QR handling and no-bypass admin gating are intact.');
