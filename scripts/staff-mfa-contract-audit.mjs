import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing staff MFA contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function req(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const baseline=read('supabase/migrations/20260824124542_add_staff_totp_mfa_transition_v1.sql');
const hardening=read('supabase/migrations/20260824132703_harden_staff_mfa_closeout_v1.sql');
const recovery=read('supabase/migrations/20260824133655_add_super_admin_mfa_break_glass_recovery_v1.sql');
const auditIntegrity=read('supabase/migrations/20260824142118_harden_mfa_client_audit_integrity_v1.sql');
const recoveryControls=read('supabase/migrations/20260824142244_complete_super_admin_mfa_recovery_controls_v1.sql');
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

req(auditIntegrity,/user_requires_staff_mfa_v1\(uid\)/,'Client MFA audit markers must be staff-only.');
req(auditIntegrity,/mfa_factor_required/,'Client MFA audit markers must require an explicit factor ID.');
req(auditIntegrity,/f\.id=p_factor_id[\s\S]*f\.user_id=uid[\s\S]*factor_type::text='totp'/,'Client MFA audit markers must bind the factor to the current staff user and TOTP type.');
req(auditIntegrity,/event_key='mfa\.privileged_session_established'[\s\S]*factor_status<>'verified' or aal<>'aal2'/,'Privileged-session audit events must require a verified factor and AAL2.');
req(auditIntegrity,/recent_failures>=30/,'Client-observed failure audit markers must have an anti-flood ceiling.');
req(auditIntegrity,/'evidenceSource'/,'MFA audit details must disclose their evidence source.');
req(auditIntegrity,/'client_observed'/,'Challenge-failure audit evidence must be labelled client-observed.');
req(auditIntegrity,/'client_confirmed_after_auth_verify'/,'Privileged-session audit evidence must be labelled as post-Auth verification.');
forbid(auditIntegrity,/(?:secret|otp_code|access_token|refresh_token)\s*[,)]/i,'Hardened MFA client audit must never store authentication secrets or tokens.');

req(recovery,/auth\.role\(\)<>'service_role'/,'Super Admin MFA recovery must be service-role-only.');
req(recovery,/interval '10 minutes'/,'Break-glass factor reset must use a short fixed recovery window.');
req(recovery,/state='enforced'/,'Break-glass recovery must preserve enforced MFA state.');
req(recovery,/mfa\.break_glass_recovery_started/,'Break-glass recovery start must be audited.');
req(recovery,/mfa\.break_glass_factor_reset/,'Break-glass factor reset must be audited.');
forbid(recovery,/insert into private\.role_permissions|grant .*authenticated.*begin_super_admin_mfa_recovery/i,'Break-glass recovery must not grant application capabilities or authenticated access.');
req(recoveryControls,/cancel_super_admin_mfa_recovery_for_service_v1/,'Break-glass recovery must have an explicit cancellation path.');
req(recoveryControls,/get_super_admin_mfa_recovery_status_for_service_v1/,'Break-glass recovery must expose a safe service-only status check.');
req(recoveryControls,/mfa\.break_glass_recovery_cancelled/,'Break-glass cancellation must be audited.');
for(const fn of['cancel_super_admin_mfa_recovery_for_service_v1','get_super_admin_mfa_recovery_status_for_service_v1'])req(recoveryControls,new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*grant execute on function public\\.${fn}[\\s\\S]*to service_role`),`${fn} must remain service-role-only.`);

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
req(gate,/enterKeyHint="done"/,'TOTP input must expose a mobile completion keyboard hint.');
req(gate,/pattern="\[0-9\]\{6\}"/,'TOTP UI must constrain six numeric digits.');
req(gate,/aria-live="assertive"/,'MFA verification errors must be announced assertively.');
req(gate,/aria-errormessage=\{hasError\?'staff-mfa-error':undefined\}/,'TOTP input must be programmatically associated with verification errors.');
req(gate,/tabIndex=\{-1\}/,'MFA gate must provide deterministic heading focus on entry.');
req(gate,/focus-visible:ring-2/,'MFA controls must retain visible keyboard focus.');
req(gate,/Elle kurulum anahtarı/,'QR-inaccessible users must have a manual authenticator secret alternative.');
req(gate,/Güvenli çıkış yap/,'MFA gate must always provide a safe logout path.');
forbid(gate,/Atla|Şimdi değil|Sonra yap/i,'Mandatory staff MFA gate must not expose a bypass action.');

const securityUi=read('src/admin/AdminMfaSecurity.tsx');
req(securityUi,/beginBackupStaffTotpEnrollment/,'Staff security UI must allow an AAL2 user to enroll a backup authenticator.');
req(securityUi,/removeVerifiedStaffTotpFactor/,'Staff security UI must use the guarded verified-factor removal path.');
req(securityUi,/factors\.length<=1/,'Staff security UI must disable last-factor removal.');
req(securityUi,/en az bir yedek authenticator önerilir/i,'Staff security UI must explicitly recommend backup authenticator recovery.');

const authorization=read('src/features/auth/authorizationApi.ts');
for(const field of['staffMfaRequired','mfaFactorEnrolled','mfaSatisfied','mfaEnforcementActive','staffMfaState','staffMfaTransitionPending','authenticatorAssuranceLevel'])req(authorization,new RegExp(field),`Authorization snapshot must validate ${field}.`);
req(authorization,/permission!=='mfa\.self_manage'/,'Unsatisfied staff sessions must reject every capability except mfa.self_manage.');
req(authorization,/AAL1 personel oturumuna ayrıcalıklı capability sızdı/,'Client authorization must fail closed on AAL1 privilege leakage.');

const adminPage=read('src/pages/AdminPage.tsx');
req(adminPage,/StaffMfaGate/,'Admin workspace must mount the staff MFA gate.');
req(adminPage,/snapshot\?\.staffMfaRequired&&!snapshot\.mfaSatisfied/,'Admin workspace must gate unsatisfied staff MFA.');
req(adminPage,/case'security-mfa':return<AdminMfaSecurity\/>/,'Admin workspace must expose the personal MFA management surface.');
const gateIndex=adminPage.indexOf("if(snapshot?.staffMfaRequired&&!snapshot.mfaSatisfied)");const fallbackIndex=adminPage.lastIndexOf('const fallback=firstAllowedAdminTab(can);');if(gateIndex<0||fallbackIndex<0||gateIndex>fallbackIndex)failures.push('MFA gate must run before the render-time permission fallback.');

const staffE2E=read('scripts/staff-mfa-e2e.mjs');
for(const marker of['assertAal1StaffDenied','mfa-mod-a','mfa-mod-b','mfa-admin','mfa-super','other-user factor ID','last verified staff factor deletion','set-block','remove-staff-roles','Super Admin does not receive the complete active capability set','AAL1/unverified factor forged privileged-session audit event','mfa.challenge_failed'])req(staffE2E,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),`Live staff MFA E2E is missing ${marker}.`);
req(staffE2E,/decodeJwt\(.*\)\.aal/,'Live MFA E2E must assert the JWT aal claim after verification.');
req(staffE2E,/mfa-audit-summary',\{slot:'mfa-mod-a'\}/,'Live MFA audit persistence must be read from the same moderator that generated the failure event.');
const customerE2E=read('scripts/customer-e2e.mjs');
req(customerE2E,/import\('\.\/staff-mfa-e2e\.mjs'\)/,'Mandatory authenticated E2E must run the live staff MFA matrix on the same CI commit.');

const edge=read('supabase/functions/ci-e2e-user/index.ts');
for(const marker of['EXPECTED_REPOSITORY_ID','EXPECTED_OWNER_ID','EXPECTED_WORKFLOW','runner_environment','provision-staff','remove-staff-roles','set-block','mfa-audit-summary','authorization_negative_customer_mfa_audit_forgery'])req(edge,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`OIDC CI control is missing ${marker}.`);
req(edge,/STAFF_ROLES=new Set\(\["moderator","admin","super_admin"\]\)/,'Disposable staff provisioning must be restricted to test roles.');
req(edge,/mfa_record_self_event_v1[\s\S]*p_event:"mfa\.privileged_session_established"[\s\S]*p_factor_id:null/,'Disposable customer negative test must prove non-staff cannot forge MFA audit entries.');

const recoveryUtility=read('scripts/super-admin-mfa-recovery.mjs');
req(recoveryUtility,/auth\.admin\.mfa\.listFactors\(\{userId\}\)/,'Recovery utility must list factors through the official Supabase Auth Admin MFA API.');
req(recoveryUtility,/auth\.admin\.mfa\.deleteFactor\(\{userId,id:factor\.id\}\)/,'Recovery utility must delete factors through the official Supabase Auth Admin MFA API.');
req(recoveryUtility,/MFA_RECOVERY_CONFIRM/,'Recovery utility must require an explicit per-user destructive confirmation.');
req(recoveryUtility,/state!=='enforced'/,'Recovery utility must refuse resets outside enforced state.');
req(recoveryUtility,/after\.state!=='enforced'\|\|after\.active\|\|after\.verifiedTotpFactorCount!==0/,'Recovery utility must prove fail-closed post-reset invariants.');
req(recoveryUtility,/cancel_super_admin_mfa_recovery_for_service_v1/,'Recovery utility must attempt to cancel an opened window on abort.');
forbid(recoveryUtility,/console\.log\([^\n]*(?:serviceRole|secret|access_token|refresh_token|factor\.id)/i,'Recovery utility must not log credentials, tokens, secrets or factor IDs.');

const runbook=read('docs/security/staff-mfa-recovery.md');
for(const marker of['super-admin-mfa-recovery.mjs status','super-admin-mfa-recovery.mjs reset-all','super-admin-mfa-recovery.mjs cancel','MFA_RECOVERY_CONFIRM','Do not manually delete rows from `auth.mfa_factors`','Mandatory post-recovery sequence','Prohibited shortcuts'])req(runbook,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),`MFA recovery runbook is missing ${marker}.`);

if(failures.length){console.error('Golden Oremar staff MFA contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar staff MFA contract audit passed: explicit transition state, mfa.self_manage ownership, AAL2 enforcement, audit integrity, backup-factor UX, last-factor guard, reversible service-only recovery and live OIDC MFA attack tests are locked.');
