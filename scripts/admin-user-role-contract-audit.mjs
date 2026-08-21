import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`Required admin-user contract file is missing: ${relative}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function compact(value) {
  return value.replace(/\s+/g, '');
}

function need(content, needle, message) {
  if (!compact(content).includes(needle)) failures.push(message);
}

function match(content, pattern, message) {
  if (!pattern.test(content)) failures.push(message);
}

function forbid(content, pattern, message) {
  if (pattern.test(content)) failures.push(message);
}

const api = read('src/admin/userAdminApi.ts');
const ui = read('src/admin/AdminUsers.tsx');
const canonicalMigration = read('supabase/migrations/20260821070927_canonicalize_admin_user_role_contract_v3.sql');
const retirementMigration = read('supabase/migrations/20260821071233_retire_legacy_admin_user_role_entrypoints_v4.sql');
const authorityMigration = read('supabase/migrations/20260821071307_harden_admin_role_assignment_authority_v5.sql');
const enforcementMigration = read('supabase/migrations/20260821071515_harden_admin_enforcement_wrapper_v2.sql');

if (api) {
  match(
    api,
    /'customer'[\s\S]*'producer'[\s\S]*'support'[\s\S]*'content_editor'[\s\S]*'operations'[\s\S]*'admin'[\s\S]*'super_admin'/,
    'Admin user API must preserve every canonical live role.',
  );
  forbid(api, /AdminPlatformUserRole\s*=\s*[^;]*(?:'user'|'vendor')/, 'Admin user API must not restore retired user/vendor aliases.');
  need(api, "supabase.rpc('admin_list_platform_users_v3')", 'Admin user list must use canonical v3 RPC.');
  need(api, "supabase.rpc('admin_set_platform_user_role_v2'", 'Admin role mutation must use canonical v2 RPC.');
  need(api, "supabase.rpc('admin_enforce_platform_user_v1'", 'Admin enforcement must use the hardened public RPC.');
  need(api, "!normalized.includes('customer')", 'Every normalized account role set must retain the customer baseline.');
  need(api, 'primaryRole!==expectedPrimary', 'Admin user API must verify the server-authoritative primary role ordering.');
  need(api, 'returnedRoles.length!==expectedRoles.length', 'Role mutation results must verify the exact returned role set.');
  need(api, 'action!==input.action||returnedStatus!==expectedStatus', 'Account enforcement results must verify action and resulting account status.');
  forbid(api, /admin_list_platform_users_v[12]['"]|admin_set_platform_user_role_v1['"]/, 'Frontend must not call retired admin user-role RPC versions.');
}

if (ui) {
  need(ui, 'ADMIN_PLATFORM_USER_ROLES.map', 'Admin users UI must render the canonical role registry.');
  need(ui, 'user.primaryRole!==roleFilter', 'Admin users UI must filter by canonical primaryRole.');
  need(ui, "user.roles.includes('admin')||user.roles.includes('super_admin')", 'Admin users UI must detect protected management accounts from canonical roles.');
  need(ui, "nextRole==='producer'&&!user.producerId", 'Producer role assignment must require a real linked producer profile.');
  need(ui, 'selectedUser.id===currentUserId', 'Admin users UI must protect the signed-in administrator from self-role changes.');
  forbid(ui, /<option[^>]+value=['"](?:user|vendor)['"]/, 'Admin users UI must not expose retired user/vendor role filters.');
}

if (canonicalMigration) {
  match(canonicalMigration, /create or replace function private\.admin_list_platform_users_v3\(\)/i, 'Canonical migration must define private admin_list_platform_users_v3.');
  match(canonicalMigration, /create or replace function public\.admin_list_platform_users_v3\(\)/i, 'Canonical migration must define public admin_list_platform_users_v3.');
  match(canonicalMigration, /create or replace function private\.admin_set_platform_user_role_v2/i, 'Canonical migration must define private admin_set_platform_user_role_v2.');
  match(canonicalMigration, /'customer','producer','support','content_editor','operations','admin','super_admin'/, 'Canonical migration must accept only live database roles.');
  match(canonicalMigration, /insert into private\.admin_audit_logs/i, 'Role changes must remain audit logged.');
}

if (retirementMigration) {
  for (const marker of [
    'drop function if exists public.admin_list_platform_users_v1()',
    'drop function if exists public.admin_list_platform_users_v2()',
    'drop function if exists public.admin_set_platform_user_role_v1(uuid, text, text)',
    'drop function if exists private.admin_list_platform_users_v1()',
    'drop function if exists private.admin_list_platform_users_v2()',
    'drop function if exists private.admin_set_platform_user_role_v1(uuid, text, text)',
  ]) {
    if (!retirementMigration.includes(marker)) failures.push(`Retired admin role entrypoint is not removed: ${marker}`);
  }
  match(retirementMigration, /security definer/i, 'Canonical public admin role wrappers must execute through a controlled SECURITY DEFINER boundary.');
  match(retirementMigration, /revoke all on function private\.admin_list_platform_users_v3\(\)/i, 'Direct private admin user-list execution must stay revoked.');
}

if (authorityMigration) {
  match(authorityMigration, /if p_user_id = caller_id then[\s\S]*cannot_change_current_user_role/i, 'Role mutation must fail closed on self-role changes.');
  match(authorityMigration, /target_is_admin or target_is_super_admin[\s\S]*not caller_is_super_admin/i, 'Ordinary admins must not alter administrator accounts.');
  match(authorityMigration, /normalized_role in \('admin','super_admin'\)[\s\S]*not caller_is_super_admin/i, 'Only super admins may assign admin or super-admin roles.');
  match(authorityMigration, /last_super_admin_cannot_be_demoted/i, 'The last active super admin protection must remain intact.');
}

if (enforcementMigration) {
  match(enforcementMigration, /create or replace function public\.admin_enforce_platform_user_v1/i, 'Hardened account enforcement public wrapper is missing.');
  match(enforcementMigration, /security definer/i, 'Account enforcement wrapper must use the controlled SECURITY DEFINER boundary.');
  match(enforcementMigration, /revoke all on function private\.admin_enforce_platform_user_v1/i, 'Direct private account enforcement execution must remain revoked.');
  match(enforcementMigration, /grant execute on function public\.admin_enforce_platform_user_v1[\s\S]*to authenticated/i, 'Only authenticated clients should receive the public enforcement entrypoint.');
}

if (failures.length) {
  console.error('Golden Oremar admin user-role contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Golden Oremar admin user-role contract audit passed: canonical roles, protected administrator authority, retired aliases, strict mutation verification and private RPC boundaries are intact.');
