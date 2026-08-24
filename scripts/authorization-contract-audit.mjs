import crypto from'node:crypto';import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing authorization contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function req(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}
function normalizedSha256(content){return crypto.createHash('sha256').update(content.trim().replace(/\s+/g,' ')).digest('hex');}

const permissions=read('src/features/auth/permissions.ts');
for(const role of['customer','producer','support','content_editor','operations','moderator','admin','super_admin'])req(permissions,new RegExp(`'${role}'`),`Canonical role missing: ${role}`);
for(const key of['admin.access','role.manage','refund.execute','payout.release','system.configure','security.manage','product.moderate'])req(permissions,new RegExp(`'${key.replace('.','\\.')}'`),`Critical permission missing: ${key}`);
forbid(permissions,/visitor|seller_candidate/,'Visitor and seller_candidate must not become canonical roles.');

const authApi=read('src/features/auth/authorizationApi.ts');req(authApi,/authorization_context_v1/,'Frontend authorization must hydrate from the canonical server context RPC.');req(authApi,/canAccessAdmin!==permissions\.includes\('admin\.access'\)/,'Frontend authorization context must fail closed on inconsistent admin capability.');
const provider=read('src/features/auth/AuthorizationContext.tsx');req(provider,/permissionSet\.has\(permission\)/,'Frontend can(permission) must use the server-returned effective capability set.');req(provider,/window\.addEventListener\('focus'/,'Authorization context should revalidate after returning to the app.');

const tabs=read('src/admin/adminCapabilities.ts');
for(const [tab,key] of Object.entries({'role-governance':'role.manage','payment-controls':'payment.manage','account-erasure':'user.erase','product-removal':'product.remove','store-follow-simulation':'system.configure','dashboard':'analytics.read','returns':'refund.approve'})){
  const property=/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tab)?`(?:['"]${tab}['"]|${tab})`:`['"]${tab}['"]`;
  req(tabs,new RegExp(`${property}\\s*:\\s*'${key.replace('.','\\.')}'`),`Admin tab ${tab} must require ${key}.`);
}
const layout=read('src/admin/AdminLayout.tsx');req(layout,/permissionForAdminTab/,'Admin navigation must use the central tab capability policy.');req(layout,/can\(permissionForAdminTab\(item\.id\)\)/,'Admin menu items must be filtered with can(permission).');forbid(layout,/superAdminOnly/,'Legacy superAdminOnly navigation flags must not remain the authorization model.');
const page=read('src/pages/AdminPage.tsx');req(page,/can\(permissionForAdminTab\(requested\)\)/,'Direct admin routes must be capability checked.');req(page,/firstAllowedAdminTab/,'Unauthorized admin routes must fail closed to a permitted destination.');
const users=read('src/admin/AdminUsers.tsx');for(const capability of['role.manage','user.suspend','user.restore','user.erase','security.manage'])req(users,new RegExp(`can\\('${capability.replace('.','\\.')}'\\)`),`Admin user action UI must require ${capability}.`);req(users,/moderator:\s*'Moderatör'/,'Moderator must be represented in AdminUsers.');forbid(users,/const\s+isSuperAdmin\s*=|sessionRoles\.includes\('super_admin'\)/,'Admin user mutations must not use a frontend role-name check as their authorization gate.');
const payouts=read('src/admin/AdminProducerPayouts.tsx');req(payouts,/can\('payout\.review'\)/,'Payout operational actions must require payout.review.');req(payouts,/can\('payout\.release'\)/,'Real payout release UI must require payout.release.');
const refundEdge=read('supabase/functions/admin-event-refunds/index.ts');req(refundEdge,/authorization_has_permission_v1/,'Refund Edge Function must use capability authorization.');req(refundEdge,/refund\.execute/,'Refund Edge Function must require refund.execute.');forbid(refundEdge,/super_admin_get_payment_control_v1/,'Refund Edge Function must not use an unrelated Super Admin role proxy as its authorization gate.');

const ciEdge=read('supabase/functions/ci-e2e-user/index.ts');req(ciEdge,/EXPECTED_WORKFLOW\s*=\s*"Mobile Quality Gate"/,'CI provisioning must stay scoped to the existing mandatory Mobile Quality Gate.');forbid(ciEdge,/Authorization Quality Gate/,'CI provisioning must not broaden OIDC trust to a redundant authorization workflow.');req(ciEdge,/SUPABASE_ANON_KEY/,'CI authorization test must authenticate through the anonymous client boundary.');req(ciEdge,/signInWithPassword/,'CI authorization test must obtain a real Supabase customer JWT.');req(ciEdge,/authorization_context_v1/,'CI provisioning must test the canonical authorization context with a real JWT.');req(ciEdge,/authorization_has_permission_v1/,'CI provisioning must test a critical capability denial with a real JWT.');req(ciEdge,/admin_list_platform_users_v3/,'CI provisioning must attempt a direct privileged RPC and require denial.');for(const capability of['admin.access','role.manage','refund.execute','payout.release','system.configure','payment.manage','security.manage','user.erase','product.remove'])req(ciEdge,new RegExp(`"${capability.replace('.','\\.')}"`),`Real-JWT CI negative test must deny ${capability}.`);req(ciEdge,/authorizationNegativeVerified:\s*true/,'CI provisioning must only report success after the authorization negative test passes.');req(ciEdge,/deleteUser\(data\.user\.id/,'Failed authorization verification must delete the disposable CI user.');
const mobileWorkflow=read('.github/workflows/mobile-quality.yml');req(mobileWorkflow,/id-token:\s*write/,'Mandatory Mobile Quality Gate must retain OIDC permission.');req(mobileWorkflow,/audience=golden-oremar-ci-e2e/,'Mandatory Mobile Quality Gate must request the pinned CI audience.');req(mobileWorkflow,/node scripts\/customer-e2e\.mjs/,'Mandatory authenticated customer E2E must remain enabled.');

const core=read('supabase/migrations/20260824101926_add_capability_authorization_core_v1.sql');req(core,/private\.permissions/,'Canonical permission table migration is missing.');req(core,/private\.role_permissions/,'Canonical role-permission table migration is missing.');req(core,/private\.has_permission/,'Server has_permission helper is missing.');req(core,/moderator/,'Moderator role must be represented in the canonical matrix.');
const breakGlass=read('supabase/migrations/20260824103018_add_super_admin_break_glass_bootstrap_v1.sql');req(breakGlass,/service_role/,'Break-glass Super Admin bootstrap must remain service-role only.');req(breakGlass,/pg_advisory_xact_lock/,'Break-glass bootstrap must remain concurrency protected.');
const lastGuard=read('supabase/migrations/20260824102532_harden_role_governance_v1.sql');req(lastGuard,/protect_last_super_admin_role_v1/,'Last Super Admin protection trigger must remain present.');
const finalCleanup=read('supabase/migrations/20260824114642_close_final_coarse_authorization_gates_v1.sql');req(finalCleanup,/has_permission\('role\.manage'\)/,'Final user target-owner protection must use role.manage capability.');req(finalCleanup,/drop function if exists public\.admin_set_review_status/,'Deprecated coarse review mutation must be retired.');

const liveMirror=new Map([
['20260824101926_add_capability_authorization_core_v1.sql','ed7c6f79745446ea640947d5224c7970f7491a2887a94fe7b23addae757f321a'],
['20260824102300_enforce_capability_guards_generic_v1.sql','9649f11438d7a77ec918628c30e90e1d49610f000c2deda79163b151e8a9e628'],
['20260824102400_enforce_product_seller_capabilities_v1.sql','925969dc41515d18ef5a2c2561a4efa16f69497736108a2599bd7c656c73fe5c'],
['20260824102413_enforce_review_capabilities_v1.sql','7e01e7e21cbf22d4463f64b39546aa88e8adae4406f4430678ddface353b420e'],
['20260824102454_enforce_refund_payout_capabilities_v1.sql','3bc8e55f42e9485d9e528fdfa4c7cba4cab1f068a1cb8363efbfb018f59bd559'],
['20260824102532_harden_role_governance_v1.sql','23887fc3f7b8061c6e12244004cf9cafda0750000be5484dc59b58ea6457a618'],
['20260824102543_enforce_user_security_capabilities_v1.sql','e9bcf631b8430576b628263d73b686a3a68ca6474d7599695541c0bcd6a5d93e'],
['20260824102628_map_super_admin_operations_to_capabilities_v1.sql','e3741af8cd19f21f57df796eea049b50075bf46ee2048ccba6ccafaeab0eff62'],
['20260824102831_enforce_service_actor_capabilities_v1.sql','dd8838e7a7926a8ec5ac47a7a20f1d9fd735ecd5826f19ed32e5e97210d48140'],
['20260824102940_enforce_producer_capability_and_ownership_v1.sql','3121242f18a47310419f285f9606c730eef4cb30caadfa5876f5645d3a99bcc4'],
['20260824102955_enforce_producer_traceability_capability_v1.sql','a75e688361d277f2a12c7130f361e4c2b54534f40520803485f99cc1716403e8'],
['20260824103018_add_super_admin_break_glass_bootstrap_v1.sql','34940cf26bb5ec42f273f11c06bc5b4c646434a93c23e61b2f2c0cf2f3e429a5'],
['20260824103133_close_remaining_management_role_gates_v1.sql','fd6e72581ab1f834e15d0d2856e4ba33725781abc6851eae55bf869398243ce7'],
['20260824103227_remove_legacy_role_authority_leaks_v1.sql','6bb30bea57e483ef039ea62c7fe4435c8a437e9c6cc675f131bf3feb6e43a1af'],
['20260824103347_capability_admin_session_compatibility_v1.sql','4c1085138d46f646d1a6680f2ea6443092e2524b9ba385b3c16292b4ccf7dd87'],
['20260824104610_capability_admin_shell_compatibility_v2.sql','36285aa03d1ed239ab6bc856c20f9a2970d43a08b16150decc54aa1cb00e7663'],
['20260824105316_align_admin_dashboard_with_analytics_capability_v1.sql','879989fc40e48f6f459fd40a96ee2c9f04a792df1fb3db7f0442ccd5cdc7b821'],
['20260824105823_fix_producer_archive_ownership_variable_collision_v1.sql','73117c271410ace948ba874a63d5b69fa50d65b1cbb30dd858b433170e1602f9'],
['20260824105922_add_authorization_enforcement_self_test_v1.sql','7013bfbbff4bc705c5058c5e4b7b68f046c71767814017f9ff2e85d515a3d3ce'],
['20260824105954_fix_authorization_enforcement_self_test_v2.sql','e66aa7d1a2ca615450a3d833b78efb675fcbcab1de561d8b99c5071304009600'],
['20260824114642_close_final_coarse_authorization_gates_v1.sql','1d1f0b1a52510ef1d8d5a784b47eacb05843b0e3cf1e6e18abd860804b9bf4a3'],
]);
for(const [file,expected] of liveMirror){const content=read(`supabase/migrations/${file}`);if(content&&normalizedSha256(content)!==expected)failures.push(`Live authorization migration mirror drift detected: ${file}`);}
for(const file of fs.existsSync(path.join(root,'supabase/migrations'))?fs.readdirSync(path.join(root,'supabase/migrations')).filter(name=>name.startsWith('20260824')&&name.endsWith('.sql')):[])forbid(read(`supabase/migrations/${file}`),/drop\s+table\s+(?:if\s+exists\s+)?private\.user_roles/i,`AŞAMA 1 must not destructively drop private.user_roles: ${file}`);

if(failures.length){console.error('Golden Oremar authorization contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log('Golden Oremar authorization contract audit passed: eight canonical roles, capability-gated UI, real-JWT CI denial tests, production-mirrored migrations and owner break-glass invariants are intact.');