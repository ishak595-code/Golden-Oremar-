import fs from'node:fs';import path from'node:path';
const root=process.cwd(),failures=[];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Missing authorization contract file: ${file}`);return'';}return fs.readFileSync(full,'utf8');}
function req(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const permissions=read('src/features/auth/permissions.ts');
for(const role of['customer','producer','support','content_editor','operations','moderator','admin','super_admin'])req(permissions,new RegExp(`'${role}'`),`Canonical role missing: ${role}`);
for(const key of['admin.access','role.manage','refund.execute','payout.release','system.configure','security.manage','product.moderate'])req(permissions,new RegExp(`'${key.replace('.','\\.')}'`),`Critical permission missing: ${key}`);
forbid(permissions,/visitor|seller_candidate/,'Visitor and seller_candidate must not become canonical roles.');

const authApi=read('src/features/auth/authorizationApi.ts');req(authApi,/authorization_context_v1/,'Frontend authorization must hydrate from the canonical server context RPC.');req(authApi,/canAccessAdmin!==permissions\.includes\('admin\.access'\)/,'Frontend authorization context must fail closed on inconsistent admin capability.');
const provider=read('src/features/auth/AuthorizationContext.tsx');req(provider,/permissionSet\.has\(permission\)/,'Frontend can(permission) must use the server-returned effective capability set.');req(provider,/window\.addEventListener\('focus'/,'Authorization context should revalidate after returning to the app.');

const tabs=read('src/admin/adminCapabilities.ts');
for(const [tab,key] of Object.entries({'role-governance':'role.manage','payment-controls':'payment.manage','account-erasure':'user.erase','product-removal':'product.remove','store-follow-simulation':'system.configure','dashboard':'analytics.read','returns':'refund.approve'}))req(tabs,new RegExp(`'${tab}'\\s*:\s*'${key.replace('.','\\.')}'`),`Admin tab ${tab} must require ${key}.`);
const layout=read('src/admin/AdminLayout.tsx');req(layout,/permissionForAdminTab/,'Admin navigation must use the central tab capability policy.');req(layout,/can\(permissionForAdminTab\(item\.id\)\)/,'Admin menu items must be filtered with can(permission).');forbid(layout,/superAdminOnly/,'Legacy superAdminOnly navigation flags must not remain the authorization model.');
const page=read('src/pages/AdminPage.tsx');req(page,/can\(permissionForAdminTab\(requested\)\)/,'Direct admin routes must be capability checked.');req(page,/firstAllowedAdminTab/,'Unauthorized admin routes must fail closed to a permitted destination.');
const payouts=read('src/admin/AdminProducerPayouts.tsx');req(payouts,/can\('payout\.review'\)/,'Payout operational actions must require payout.review.');req(payouts,/can\('payout\.release'\)/,'Real payout release UI must require payout.release.');
const edge=read('supabase/functions/admin-event-refunds/index.ts');req(edge,/authorization_has_permission_v1/,'Refund Edge Function must use capability authorization.');req(edge,/refund\.execute/,'Refund Edge Function must require refund.execute.');forbid(edge,/super_admin_get_payment_control_v1/,'Refund Edge Function must not use an unrelated Super Admin role proxy as its authorization gate.');

const core=read('supabase/migrations/20260824101926_add_capability_authorization_core_v1.sql');req(core,/private\.permissions/,'Canonical permission table migration is missing.');req(core,/private\.role_permissions/,'Canonical role-permission table migration is missing.');req(core,/private\.has_permission/,'Server has_permission helper is missing.');req(core,/moderator/,'Moderator role must be represented in the canonical matrix.');
const breakGlass=read('supabase/migrations/20260824103018_add_super_admin_break_glass_bootstrap_v1.sql');req(breakGlass,/service_role/,'Break-glass Super Admin bootstrap must remain service-role only.');req(breakGlass,/pg_advisory_xact_lock/,'Break-glass bootstrap must remain concurrency protected.');
const lastGuard=read('supabase/migrations/20260824102532_harden_role_governance_v1.sql');req(lastGuard,/protect_last_super_admin_role_v1/,'Last Super Admin protection trigger must remain present.');
for(const file of fs.existsSync(path.join(root,'supabase/migrations'))?fs.readdirSync(path.join(root,'supabase/migrations')).filter(name=>name.startsWith('2026082410')&&name.endsWith('.sql')):[])forbid(read(`supabase/migrations/${file}`),/drop\s+table\s+(?:if\s+exists\s+)?private\.user_roles/i,`AŞAMA 1 must not destructively drop private.user_roles: ${file}`);

if(failures.length){console.error('Golden Oremar authorization contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log('Golden Oremar authorization contract audit passed: canonical roles, capability navigation, sensitive action separation, Edge enforcement and break-glass invariants are intact.');
