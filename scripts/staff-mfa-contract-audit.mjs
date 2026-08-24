import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing staff MFA contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function req(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const baseline=read('supabase/migrations/20260824124542_add_staff_totp_mfa_transition_v1.sql');
const hardening=read('supabase/migrations/20260824132703_harden_staff_mfa_closeout_v1.sql');
const recovery=read('supabase/migrations/20260824133655_add_super_admin_mfa_break_glass_recovery_v1.sql');
req(baseline,/auth\.jwt\(\)->>'aal'/,'AAL must originate from the authenticated JWT claim.');
req(hardening,/create table if not exists private\.staff_mfa_security_state/,'Staff MFA transition must use an explicit account security state.');
req(hardening,/state text not null check \(state in \('enrollment_required','enforced'\)\)/,'Staff MFA state must be deterministic and closed.');
req(hardening,/values\('mfa\.self_manage','mfa'/,'Canonical mfa.self_manage capability is missing.');
for(const role of['support','content_editor','operations','moderator','admin','super_admin'])req(hardening,new RegExp(`'${role}'`),`mfa.self_manage staff mapping must include ${role}.`);
req(hardening,/p_permission_key='mfa\.self_manage'/,'AAL1 staff minimum access must be limited to MFA self-management.');
req(hardening,/staff_mfa_state_v1\(\(select auth\.uid\(\)\)\)='enforced'/,'Privileged staff capability execution must require permanent enforced state.');
req(hardening,/current_authenticator_assurance_level_v1\(\)='aal2'/,'Privileged staff capability execution must require AAL2.');
forbid(hardening,/or not private\.user_has_verified_totp_factor_v1/,'No-factor staff must never bypass privileged MFA enforcement.');
req(hardening,/guard_last_staff_totp_factor_v1/,'Server-side last-factor deletion guard is missing.');
req(hardening,/last_verified_staff_totp_required/,'Last verified staff TOTP must fail closed.');
req(hardening,/mfa\.enrollment_started/,'MFA enrollment audit event is missing.');
req(hardening,/mfa\.factor_verified/,'MFA factor verification audit event is missing.');
req(hardening,/mfa\.transition_completed/,'MFA transition completion audit event is missing.');
req(hardening,/mfa\.challenge_started/,'MFA challenge start audit event is missing.');
req(hardening,/mfa\.challenge_succeeded/,'MFA challenge success audit event is missing.');
req(hardening,/mfa\.challenge_failed/,'MFA challenge failure audit event is missing.');
req(hardening,/mfa\.privileged_session_established/,'Privileged AAL2 session audit event is missing.');
forbid(hardening,/jsonb_build_object\([^\n]*(?:secret|otp_code|access_token|refresh_token)/i,'MFA audit payload must never serialize a secret, OTP or token.');

req(recovery,/auth\.role\(\)<>'service_role'/,'Super Admin MFA recovery must be service-role-only.');
req(recovery,/interval '10 minutes'/,'Break-glass factor reset must use a short fixed recovery window.');
req(recovery,/state='enforced'/,'Break-glass recovery must preserve enforced MFA state.');
req(recovery,/mfa\.break_glass_recovery_started/,'Break-glass recovery start must be audited.');
req(recovery,/mfa\.break_glass_factor_reset/,'Break-glass factor reset must be audited.');
forbid(recovery,/insert into private\.role_permissions|grant .*authenticated.*begin_super_admin_mfa_recovery/i,'Break-glass recovery must not grant application capabilities or authenticated access.');

const permissions=read('src/features/auth/permissions.ts');
req(permissions,/'mfa\.self_manage'/,'Frontend canonical permission contract must include mfa.self_manage.');
const adminCaps=read('src/admin/adminCapabilities.ts');
req(adminCaps,/'security-mfa':'mfa\.self_manage'/,'Personal MFA settings must be gated by mfa.self_manage rather than platform security.read.');
forbid(adminCaps,/'security-mfa':'security\.read'/,'Personal MFA settings must not depend on platform security.read.');

const api=read('src/features/auth/mfaApi.ts');
for(const method of['mfa.listFactors','mfa.enroll','mfa.challenge','mfa.verify','mfa.unenroll','refreshSession','getAuthenticatorAssuranceLevel'])req(api,new RegExp(method.replace('.','\\.')),`MFA client must use Supabase ${method}.`);
req(api,/TOTP_CODE_RE=\/\^\\d\{6\}\$\//,'TOTP input must be exactly six digits.');
req(api,/data:image\\\/svg\\\+xml/,'MFA QR source must be restricted to SVG data URLs.');
req(api,/currentLevel!=='aal2'/,'Successful verification must prove the refreshed session is AAL2.');
req(api,/mfa_record_self_event_v1/,'MFA client must write safe server-side challenge/session audit markers.');
req(api,/verified\.length<=1/,'Client UX must prevent last verified factor removal in addition to the database guard.');
forbid(api,/dangerouslySetInnerHTML/,'MFA QR must never be rendered through raw HTML injection.');
forbid(api,/console\.(?:log|info|debug).*secret/i,'MFA enrollment secrets must never be logged.');

const gate=read('src/features/auth/StaffMfaGate.tsx');
req(gate,/beginStaffTotpEnrollment/,'Staff MFA gate must support first-factor enrollment.');
req(gate,/verifyExistingStaffTotp/,'Staff MFA gate must challenge returning staff sessions.');
req(gate,/autoComplete="one-time-code"/,'TOTP input must expose one-time-code semantics.');
req(gate,/pattern="\[0-9\]\{6\}"/,'TOTP UI must constrain six numeric digits.');
req(gate,/Elle kurulum anahtarı/,'QR-inaccessible users must have a manual authenticator secret alternative.');
req(gate,/Güvenli çıkış yap/,'MFA gate must always provide a safe logout path.');
forbid(gate,/Atla|Şimdi değil|Sonra yap/i,'Mandatory staff MFA gate must not expose a bypass action.');

const authorization=read('src/features/auth/authorizationApi.ts');
for(const field of['staffMfaRequired','mfaFactorEnrolled','mfaSatisfied','mfaEnforcementActive','staffMfaState','staffMfaTransitionPending','authenticatorAssuranceLevel'])req(authorization,new RegExp(field),`Authorization snapshot must validate ${field}.`);
req(authorization,/permission!=='mfa\.self_manage'/,'Unsatisfied staff sessions must reject every capability except mfa.self_manage.');
req(authorization,/AAL1 personel oturumuna ayrıcalıklı capability sızdı/,'Client authorization must fail closed on AAL1 privilege leakage.');

const adminPage=read('src/pages/AdminPage.tsx');
req(adminPage,/StaffMfaGate/,'Admin workspace must mount the staff MFA gate.');
req(adminPage,/snapshot\?\.staffMfaRequired&&!snapshot\.mfaSatisfied/,'Admin workspace must gate unsatisfied staff MFA.');
const gateIndex=adminPage.indexOf("if(snapshot?.staffMfaRequired&&!snapshot.mfaSatisfied)");const fallbackIndex=adminPage.indexOf('const fallback=firstAllowedAdminTab(can);');if(gateIndex<0||fallbackIndex<0||gateIndex>fallbackIndex)failures.push('MFA gate must run before permission fallback.');

const staffE2E=read('scripts/staff-mfa-e2e.mjs');
for(const marker of['assertAal1StaffDenied','mfa-mod-a','mfa-mod-b','mfa-admin','mfa-super','other-user factor ID','last verified staff factor deletion','set-block','remove-staff-roles','Super Admin does not receive the complete active capability set'])req(staffE2E,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),`Live staff MFA E2E is missing ${marker}.`);
req(staffE2E,/decodeJwt\(.*\)\.aal,'Live MFA E2E must assert the JWT aal claim after verification.');
const customerE2E=read('scripts/customer-e2e.mjs');
req(customerE2E,/import\('\.\/staff-mfa-e2e\.mjs'\)/,'Mandatory authenticated E2E must run the live staff MFA matrix on the same CI commit.');

const edge=read('supabase/functions/ci-e2e-user/index.ts');
for(const marker of['EXPECTED_REPOSITORY_ID','EXPECTED_OWNER_ID','EXPECTED_WORKFLOW','runner_environment','provision-staff','remove-staff-roles','set-block','mfa-audit-summary'])req(edge,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`OIDC CI control is missing ${marker}.`);
req(edge,/STAFF_ROLES=new Set\(\["moderator","admin","super_admin"\]\)/,'Disposable staff provisioning must be restricted to test roles.');

if(failures.length){console.error('Golden Oremar staff MFA contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar staff MFA contract audit passed: explicit transition state, mfa.self_manage ownership boundary, AAL2 enforcement, last-factor guard, audited recovery and live OIDC MFA E2E are locked.');
