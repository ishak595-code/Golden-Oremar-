import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
function read(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required admin-user contract file is missing: ${relative}`);return '';}return fs.readFileSync(file,'utf8');}
function compact(value){return value.replace(/\s+/g,'');}
function need(content,needle,message){if(!compact(content).includes(needle))failures.push(message);}
function match(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const api=read('src/admin/userAdminApi.ts');
const ui=read('src/admin/AdminUsers.tsx');
const canonicalMigration=read('supabase/migrations/20260821070927_canonicalize_admin_user_role_contract_v3.sql');
const retirementMigration=read('supabase/migrations/20260821071233_retire_legacy_admin_user_role_entrypoints_v4.sql');
const authorityMigration=read('supabase/migrations/20260821071307_harden_admin_role_assignment_authority_v5.sql');
const enforcementMigration=read('supabase/migrations/20260821071515_harden_admin_enforcement_wrapper_v2.sql');
const linterAlignmentMigration=read('supabase/migrations/20260821071908_align_admin_user_wrappers_with_supabase_linter_v6.sql');
const capabilityMigration=read('supabase/migrations/20260824101926_add_capability_authorization_core_v1.sql');
const roleGovernanceMigration=read('supabase/migrations/20260824102532_harden_role_governance_v1.sql');

if(api){
  match(api,/'customer'[\s\S]*'producer'[\s\S]*'support'[\s\S]*'content_editor'[\s\S]*'operations'[\s\S]*'moderator'[\s\S]*'admin'[\s\S]*'super_admin'/,'Admin user API must preserve all eight canonical live roles including moderator.');
  match(api,/moderator:\s*4[\s\S]*content_editor:\s*5[\s\S]*support:\s*6[\s\S]*producer:\s*7[\s\S]*customer:\s*8/,'Frontend role priority must match the server-authoritative moderator-aware order.');
  forbid(api,/AdminPlatformUserRole\s*=\s*[^;]*(?:'user'|'vendor')/,'Admin user API must not restore retired user/vendor aliases.');
  need(api,"supabase.rpc('admin_list_platform_users_v3')",'Admin user list must use canonical v3 RPC.');
  need(api,"supabase.rpc('admin_set_platform_user_role_v2'",'Admin role mutation must use canonical v2 RPC.');
  need(api,"supabase.rpc('admin_enforce_platform_user_v1'",'Admin enforcement must use the hardened public RPC.');
  need(api,"!normalized.includes('customer')",'Every normalized account role set must retain the customer baseline.');
  need(api,'primaryRole!==expectedPrimary','Admin user API must verify the server-authoritative primary role ordering.');
  need(api,'returnedRoles.length!==expectedRoles.length','Role mutation results must verify the exact returned role set.');
  need(api,'action!==input.action||returnedStatus!==expectedStatus','Account enforcement results must verify action and resulting account status.');
  forbid(api,/admin_list_platform_users_v[12]['"]|admin_set_platform_user_role_v1['"]/,'Frontend must not call retired admin user-role RPC versions.');
}

if(ui){
  need(ui,'ADMIN_PLATFORM_USER_ROLES.map','Admin users UI must render the canonical role registry.');
  need(ui,"moderator:'Moderatör'",'Admin users UI must label the moderator role explicitly.');
  need(ui,"can('role.manage')",'Role mutation UI must use role.manage capability.');
  need(ui,"can('user.suspend')",'Account block UI must use user.suspend capability.');
  need(ui,"can('user.restore')",'Account restore UI must use user.restore capability.');
  need(ui,"can('user.erase')",'Permanent account closure UI must use user.erase capability.');
  need(ui,"can('security.manage')",'Advanced security controls must use security.manage capability.');
  need(ui,'user.primaryRole!==roleFilter','Admin users UI must filter by canonical primaryRole.');
  need(ui,"user.roles.includes('admin')||user.roles.includes('super_admin')",'Admin users UI must detect protected management accounts from canonical roles.');
  need(ui,"nextRole==='producer'&&!user.producerId",'Producer role assignment must require a real linked producer profile.');
  need(ui,'selectedUser.id===currentUserId','Admin users UI must protect the signed-in administrator from self-role changes.');
  forbid(ui,/const\s+isSuperAdmin\s*=|sessionRoles\.includes\('super_admin'\)/,'Admin user actions must not use a frontend role-name check as the authorization gate.');
  forbid(ui,/<option[^>]+value=['"](?:user|vendor)['"]/,'Admin users UI must not expose retired user/vendor role filters.');
}

if(canonicalMigration){
  match(canonicalMigration,/create or replace function private\.admin_list_platform_users_v3\(\)/i,'Historical canonical migration must define private admin_list_platform_users_v3.');
  match(canonicalMigration,/create or replace function public\.admin_list_platform_users_v3\(\)/i,'Historical canonical migration must define public admin_list_platform_users_v3.');
  match(canonicalMigration,/create or replace function private\.admin_set_platform_user_role_v2/i,'Historical canonical migration must define private admin_set_platform_user_role_v2.');
  match(canonicalMigration,/'customer','producer','support','content_editor','operations','admin','super_admin'/,'Historical v3 migration baseline must remain intact instead of being rewritten retroactively.');
  match(canonicalMigration,/insert into private\.admin_audit_logs/i,'Role changes must remain audit logged.');
}

if(capabilityMigration){
  match(capabilityMigration,/role in \('customer','producer','support','content_editor','operations','moderator','admin','super_admin'\)/,'Capability overlay must extend the database role constraint to all eight live roles.');
  match(capabilityMigration,/\('moderator','product\.moderate'\)/,'Moderator must receive product moderation capability through the canonical matrix.');
  match(capabilityMigration,/role_count<>8/,'Authorization self-test must require exactly eight configured roles.');
}
if(roleGovernanceMigration){
  match(roleGovernanceMigration,/normalized_role not in \('customer','producer','support','content_editor','operations','moderator','admin','super_admin'\)/,'Live role mutation must accept exactly the eight canonical roles.');
  match(roleGovernanceMigration,/last_super_admin_cannot_be_demoted/,'Live role governance must protect the final active Super Admin.');
}

if(retirementMigration){for(const marker of['drop function if exists public.admin_list_platform_users_v1()','drop function if exists public.admin_list_platform_users_v2()','drop function if exists public.admin_set_platform_user_role_v1(uuid, text, text)','drop function if exists private.admin_list_platform_users_v1()','drop function if exists private.admin_list_platform_users_v2()','drop function if exists private.admin_set_platform_user_role_v1(uuid, text, text)'])if(!retirementMigration.includes(marker))failures.push(`Retired admin role entrypoint is not removed: ${marker}`);}
if(authorityMigration){match(authorityMigration,/cannot_change_current_user_role/i,'Role mutation must fail closed on self-role changes.');match(authorityMigration,/last_super_admin_cannot_be_demoted/i,'Historical last Super Admin protection must remain intact.');}
if(enforcementMigration){match(enforcementMigration,/create or replace function public\.admin_enforce_platform_user_v1/i,'Account enforcement public wrapper migration is missing.');match(enforcementMigration,/grant execute on function public\.admin_enforce_platform_user_v1[\s\S]*to authenticated/i,'Authenticated users must receive only the public enforcement entrypoint.');}
if(linterAlignmentMigration){
  for(const signature of[/create or replace function public\.admin_list_platform_users_v3\(\)[\s\S]*security invoker/i,/create or replace function public\.admin_set_platform_user_role_v2[\s\S]*security invoker/i,/create or replace function public\.admin_enforce_platform_user_v1[\s\S]*security invoker/i])match(linterAlignmentMigration,signature,'Exposed admin user-management wrappers must end in SECURITY INVOKER mode.');
  forbid(linterAlignmentMigration,/^\s*security definer\s*;?\s*$/im,'Final exposed admin wrapper alignment must not declare SECURITY DEFINER.');
}

if(failures.length){console.error('Golden Oremar admin user-role contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar admin user-role contract audit passed: eight canonical roles, moderator support, capability-gated UI actions, protected owner authority and hardened RPC boundaries are intact.');