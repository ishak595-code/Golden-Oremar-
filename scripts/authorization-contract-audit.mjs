import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing authorization contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function req(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const permissions=read('src/features/auth/permissions.ts');
for(const role of['customer','producer','support','content_editor','operations','moderator','admin','super_admin'])req(permissions,new RegExp(`'${role}'`),`Canonical role missing: ${role}`);
for(const key of['admin.access','role.manage','refund.execute','payout.release','system.configure','security.manage','product.moderate'])req(permissions,new RegExp(`'${key.replace('.','\\.')}'`),`Critical permission missing: ${key}`);
forbid(permissions,/visitor|seller_candidate/,'Visitor and seller_candidate must not become canonical roles.');

const authApi=read('src/features/auth/authorizationApi.ts');
req(authApi,/authorization_context_v1/,'Frontend authorization must hydrate from the canonical server context RPC.');
req(authApi,/canAccessAdmin!==permissions\.includes\('admin\.access'\)/,'Frontend authorization context must fail closed on inconsistent admin capability.');
const provider=read('src/features/auth/AuthorizationContext.tsx');
req(provider,/permissionSet\.has\(permission\)/,'Frontend can(permission) must use the server-returned effective capability set.');
req(provider,/window\.addEventListener\('focus'/,'Authorization context should revalidate after returning to the app.');

const tabs=read('src/admin/adminCapabilities.ts');
for(const [tab,key] of Object.entries({'role-governance':'role.manage','payment-controls':'payment.manage','account-erasure':'user.erase','product-removal':'product.remove','store-follow-simulation':'system.configure','dashboard':'analytics.read','returns':'refund.approve'})){
  const property=/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tab)?`(?:['"]${tab}['"]|${tab})`:`['"]${tab}['"]`;
  req(tabs,new RegExp(`${property}\\s*:\\s*'${key.replace('.','\\.')}'`),`Admin tab ${tab} must require ${key}.`);
}
const layout=read('src/admin/AdminLayout.tsx');
req(layout,/permissionForAdminTab/,'Admin navigation must use the central tab capability policy.');
req(layout,/can\(permissionForAdminTab\(item\.id\)\)/,'Admin menu items must be filtered with can(permission).');
forbid(layout,/superAdminOnly/,'Legacy superAdminOnly navigation flags must not remain the authorization model.');
const page=read('src/pages/AdminPage.tsx');
req(page,/can\(permissionForAdminTab\(requested\)\)/,'Direct admin routes must be capability checked.');
req(page,/firstAllowedAdminTab/,'Unauthorized admin routes must fail closed to a permitted destination.');

const users=read('src/admin/AdminUsers.tsx');
for(const capability of['role.manage','user.suspend','user.restore','user.erase','security.manage'])req(users,new RegExp(`can\\('${capability.replace('.','\\.')}'\\)`),`Admin user action UI must require ${capability}.`);
req(users,/moderator:\s*'Moderatör'/,'Moderator must be represented in AdminUsers.');
forbid(users,/const\s+isSuperAdmin\s*=|sessionRoles\.includes\('super_admin'\)/,'Admin user mutations must not use a frontend role-name check as their authorization gate.');

const payouts=read('src/admin/AdminProducerPayouts.tsx');
req(payouts,/can\('payout\.review'\)/,'Payout operational actions must require payout.review.');
req(payouts,/can\('payout\.release'\)/,'Real payout release UI must require payout.release.');
const refundEdge=read('supabase/functions/admin-event-refunds/index.ts');
req(refundEdge,/authorization_has_permission_v1/,'Refund Edge Function must use capability authorization.');
req(refundEdge,/refund\.execute/,'Refund Edge Function must require refund.execute.');
forbid(refundEdge,/super_admin_get_payment_control_v1/,'Refund Edge Function must not use an unrelated Super Admin role proxy as its authorization gate.');

const ciEdge=read('supabase/functions/ci-e2e-user/index.ts');
req(ciEdge,/EXPECTED_WORKFLOW\s*=\s*"Mobile Quality Gate"/,'CI provisioning must stay scoped to the existing mandatory Mobile Quality Gate.');
forbid(ciEdge,/Authorization Quality Gate/,'CI provisioning must not broaden OIDC trust to a redundant authorization workflow.');
req(ciEdge,/SUPABASE_ANON_KEY/,'CI authorization test must authenticate through the anonymous client boundary.');
req(ciEdge,/signInWithPassword/,'CI authorization test must obtain a real Supabase customer JWT.');
req(ciEdge,/authorization_context_v1/,'CI provisioning must test the canonical authorization context with a real JWT.');
req(ciEdge,/authorization_has_permission_v1/,'CI provisioning must test a critical capability denial with a real JWT.');
req(ciEdge,/admin_list_platform_users_v3/,'CI provisioning must attempt a direct privileged RPC and require denial.');
for(const capability of['admin.access','role.manage','refund.execute','payout.release','system.configure','payment.manage','security.manage','user.erase','product.remove'])req(ciEdge,new RegExp(`"${capability.replace('.','\\.')}"`),`Real-JWT CI negative test must deny ${capability}.`);
req(ciEdge,/authorizationNegativeVerified:\s*true/,'CI provisioning must only report success after the authorization negative test passes.');
req(ciEdge,/deleteUser\(data\.user\.id/,'Failed authorization verification must delete the disposable CI user.');
const mobileWorkflow=read('.github/workflows/mobile-quality.yml');
req(mobileWorkflow,/id-token:\s*write/,'Mandatory Mobile Quality Gate must retain OIDC permission.');
req(mobileWorkflow,/audience=golden-oremar-ci-e2e/,'Mandatory Mobile Quality Gate must request the pinned CI audience.');
req(mobileWorkflow,/node scripts\/customer-e2e\.mjs/,'Mandatory authenticated customer E2E must remain enabled.');

const core=read('supabase/migrations/20260824101926_add_capability_authorization_core_v1.sql');
req(core,/private\.permissions/,'Canonical permission table migration is missing.');
req(core,/private\.role_permissions/,'Canonical role-permission table migration is missing.');
req(core,/private\.has_permission/,'Server has_permission helper is missing.');
req(core,/moderator/,'Moderator role must be represented in the canonical matrix.');
req(core,/protect_last_super_admin_role_v1/,'Last Super Admin protection trigger must remain present in the authorization core.');
req(core,/authorization_policy_self_test_v1/,'Authorization policy self-test must remain present.');

const review=read('supabase/migrations/20260824102413_enforce_review_capabilities_v1.sql');
req(review,/review\.moderate/,'Review moderation must remain capability gated.');
req(review,/review\.publish/,'Review publishing must remain separately capability gated.');
req(review,/review\.reject/,'Review rejection must remain separately capability gated.');
req(review,/review\.remove/,'Review hiding/removal must remain separately capability gated.');
const money=read('supabase/migrations/20260824102454_enforce_refund_payout_capabilities_v1.sql');
req(money,/refund\.execute/,'Refund execution capability gate must remain present.');
req(money,/payout\.review/,'Payout review capability gate must remain present.');
req(money,/payout\.release/,'Payout release capability gate must remain present.');
const governance=read('supabase/migrations/20260824102532_harden_role_governance_v1.sql');
req(governance,/role\.manage/,'Role mutation must remain capability gated.');
req(governance,/last_super_admin_cannot_be_demoted/,'Role governance must protect the final active Super Admin.');
const ownership=read('supabase/migrations/20260824102940_enforce_producer_capability_and_ownership_v1.sql');
req(ownership,/product\.archive/,'Producer archive flow must require product.archive.');
req(ownership,/order\.manage/,'Producer fulfillment flow must require order.manage.');
req(ownership,/payout\.request/,'Producer payout requests must require payout.request.');
const breakGlass=read('supabase/migrations/20260824103018_add_super_admin_break_glass_bootstrap_v1.sql');
req(breakGlass,/service_role/,'Break-glass Super Admin bootstrap must remain service-role only.');
req(breakGlass,/pg_advisory_xact_lock/,'Break-glass bootstrap must remain concurrency protected.');
req(breakGlass,/super_admin_already_configured/,'Break-glass bootstrap must refuse execution while an active Super Admin exists.');
const finalCleanup=read('supabase/migrations/20260824114642_close_final_coarse_authorization_gates_v1.sql');
req(finalCleanup,/has_permission\('role\.manage'\)/,'Final user target-owner protection must use role.manage capability.');
req(finalCleanup,/drop function if exists public\.admin_set_review_status/,'Deprecated coarse review mutation must be retired.');

const invoker=read('supabase/migrations/20260824120406_harden_authorization_public_invoker_boundaries_v1.sql');
for(const signature of[/create or replace function public\.authorization_context_v1\(\)[\s\S]*security invoker/i,/create or replace function public\.authorization_has_permission_v1\(p_permission_key text\)[\s\S]*security invoker/i,/create or replace function public\.admin_list_reviews\(\)[\s\S]*security invoker/i])req(invoker,signature,'Exposed authorization and review wrappers must remain SECURITY INVOKER.');
req(invoker,/private\.authorization_context_core_v1/,'Authorization context must keep a private core.');
req(invoker,/private\.admin_list_reviews_core_v1/,'Review list must keep a private capability-gated core.');
req(invoker,/revoke all on function public\.authorization_policy_self_test_v1\(\) from public,anon,authenticated,service_role/i,'Authorization policy self-test must be removed from client execution.');
req(invoker,/revoke all on function public\.authorization_enforcement_self_test_v1\(\) from public,anon,authenticated,service_role/i,'Authorization enforcement self-test must be removed from client execution.');
req(invoker,/grant execute on function public\.authorization_policy_self_test_v1\(\) to service_role/i,'Authorization policy self-test must remain service-role maintenance only.');
req(invoker,/grant execute on function public\.authorization_enforcement_self_test_v1\(\) to service_role/i,'Authorization enforcement self-test must remain service-role maintenance only.');

const roleIndexes=read('supabase/migrations/20260824120541_index_role_permission_foreign_keys_v1.sql');
req(roleIndexes,/role_permissions_permission_key_idx[\s\S]*private\.role_permissions\(permission_key\)/i,'Role-permission permission-key foreign key must retain its covering index.');
req(roleIndexes,/role_permissions_granted_by_idx[\s\S]*private\.role_permissions\(granted_by\)/i,'Role-permission grant-actor foreign key must retain its covering index.');

for(const file of fs.existsSync(path.join(root,'supabase/migrations'))?fs.readdirSync(path.join(root,'supabase/migrations')).filter(name=>name.startsWith('20260824')&&name.endsWith('.sql')):[]){
  const content=read(`supabase/migrations/${file}`);
  forbid(content,/drop\s+table\s+(?:if\s+exists\s+)?private\.user_roles/i,`AŞAMA 1 must not destructively drop private.user_roles: ${file}`);
}

if(failures.length){console.error('Golden Oremar authorization contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar authorization contract audit passed: eight canonical roles, capability-gated UI and RPCs, invoker-safe public boundaries, real-JWT CI denial checks, indexed authorization foreign keys, owner protections and break-glass invariants are intact.');