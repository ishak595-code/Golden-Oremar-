import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Missing required authenticated E2E file: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(body,re,message){if(!re.test(body))failures.push(message);}
function forbidPattern(body,re,message){if(re.test(body))failures.push(message);}

const workflow=read('.github/workflows/mobile-quality.yml');
const premiumWorkflow=read('.github/workflows/premium-mobile-ui-v2.yml');
const journey=read('scripts/customer-e2e.mjs');
const control=read('supabase/functions/ci-e2e-user/index.ts');
const controlConfig=read('supabase/functions/ci-e2e-user/deno.json');

if(workflow){
 requirePattern(workflow,/id-token:\s*write/,'Mobile Quality Gate must request GitHub OIDC id-token permission.');
 requirePattern(workflow,/audience=golden-oremar-ci-e2e/,'Mobile Quality Gate must request the dedicated Golden Oremar E2E OIDC audience.');
 requirePattern(workflow,/E2E_CI_CONTROL_URL:\s*https:\/\/rmfcziawxjgcnxexbrvw\.supabase\.co\/functions\/v1\/ci-e2e-user/,'Customer E2E must target the canonical Supabase CI control function.');
 requirePattern(workflow,/Run mandatory authenticated customer Chromium journey/,'Authenticated customer journey must remain a mandatory quality-gate step.');
 forbidPattern(workflow,/SUPABASE_SERVICE_ROLE_KEY/,'GitHub Actions must never receive the Supabase service-role credential for E2E.');
}
if(premiumWorkflow){
 requirePattern(premiumWorkflow,/name:\s*Premium Mobile UI V2/,'Premium Mobile workflow identity must remain pinned for OIDC authorization.');
 requirePattern(premiumWorkflow,/id-token:\s*write/,'Premium Mobile workflow must request GitHub OIDC only for the authenticated runtime gate.');
 requirePattern(premiumWorkflow,/audience=golden-oremar-ci-e2e/,'Premium Mobile workflow must request the dedicated Golden Oremar E2E OIDC audience.');
 requirePattern(premiumWorkflow,/release\/ux-professionalization-2026-08/,'Premium Mobile workflow must remain scoped to the UX professionalization release branch while this release gate is active.');
 requirePattern(premiumWorkflow,/Verify critical customer runtime with real data[\s\S]*node scripts\/customer-e2e\.mjs/,'Premium Mobile workflow must execute the real authenticated customer runtime gate.');
 forbidPattern(premiumWorkflow,/SUPABASE_SERVICE_ROLE_KEY/,'Premium Mobile workflow must never receive the Supabase service-role credential.');
}

if(journey){
 requirePattern(journey,/AUTHENTICATED_E2E_REQUIRES_GITHUB_OIDC/,'Customer E2E must fail closed when GitHub OIDC is unavailable.');
 requirePattern(journey,/inspectRegistrationUi\(page\)/,'Customer E2E must exercise the real registration UI contract before provisioning.');
 requirePattern(journey,/locator\('#auth-display-name'\)\.fill\(displayName\)/,'Customer E2E must fill the real registration display-name field.');
 requirePattern(journey,/locator\('#auth-phone'\)\.fill\(phone\)/,'Customer E2E must fill the real registration phone field.');
 requirePattern(journey,/locator\('#auth-email'\)\.fill\(email\)/,'Customer E2E must fill the real registration email field.');
 requirePattern(journey,/locator\('#auth-password'\)\.fill\(authSecret\)/,'Customer E2E must fill the real registration password field.');
 requirePattern(journey,/getByRole\('button',\{name:'Hesap Oluştur',exact:true\}\)\.waitFor/,'Customer E2E must verify the real registration submit control is available.');
 requirePattern(journey,/ciControl\('provision',\{password:authSecret,displayName,phone\}\)/,'Customer E2E must provision a disposable confirmed account through the protected OIDC control plane.');
 requirePattern(journey,/provisioned\.provisioned!==true\|\|provisioned\.emailConfirmed!==true/,'Customer E2E must fail if OIDC provisioning does not return a confirmed disposable account.');
 requirePattern(journey,/getByRole\('button',\{name:'Giriş Yap',exact:true\}\)\.click\(\)/,'Customer E2E must authenticate through the real login UI.');
 requirePattern(journey,/ciControl\('delete'\)/,'Customer E2E must hard-delete its disposable Auth user.');
 requirePattern(journey,/profile_update_roundtrip/,'Customer E2E must verify profile persistence.');
 requirePattern(journey,/favorite_roundtrip/,'Customer E2E must verify favorite persistence.');
 requirePattern(journey,/buy_now_to_cart/,'Customer E2E must verify Buy Now to cart routing.');
 requirePattern(journey,/import\('\.\/staff-mfa-e2e\.mjs'\)/,'Authenticated customer E2E must execute the real staff MFA attack matrix on the same run.');
 forbidPattern(journey,/createClient\([^\n]*serviceRole|SUPABASE_SERVICE_ROLE_KEY/,'Browser E2E code must not receive or use service-role credentials.');
}

if(control){
 requirePattern(control,/EXPECTED_REPOSITORY_ID\s*=\s*"1335636205"/,'CI control must pin the immutable Golden Oremar repository id.');
 requirePattern(control,/EXPECTED_OWNER_ID\s*=\s*"233486723"/,'CI control must pin the immutable repository owner id.');
 requirePattern(control,/EXPECTED_AUDIENCE\s*=\s*"golden-oremar-ci-e2e"/,'CI control must pin the dedicated OIDC audience.');
 requirePattern(control,/jwtVerify\s*<[^>]+>\s*\(\s*token\s*,\s*GITHUB_JWKS/,'CI control must cryptographically verify GitHub OIDC tokens.');
 requirePattern(control,/TRUSTED_WORKFLOW_PATHS\s*=\s*new Map<string,string>\s*\(\s*\[[\s\S]*"Mobile Quality Gate"[\s\S]*\.github\/workflows\/mobile-quality\.yml@[\s\S]*"Premium Mobile UI V2"[\s\S]*\.github\/workflows\/premium-mobile-ui-v2\.yml@[\s\S]*\]\s*\)/,'CI control must allow only the two exact repository workflow identities used for authenticated E2E.');
 requirePattern(control,/TRUSTED_WORKFLOW_PATHS\.get\(workflow\)[\s\S]*if\(!expectedWorkflowPath\)throw new Error\("github_workflow_not_allowed"\)[\s\S]*workflowRef\.startsWith\(expectedWorkflowPath\)/,'CI control must bind workflow name to its exact workflow path before accepting OIDC.');
 requirePattern(control,/TRUSTED_BRANCH_REFS\s*=\s*new Set\s*\(\s*\[[\s\S]*"refs\/heads\/main"[\s\S]*"refs\/heads\/integration\/full-consolidation-2026-08"[\s\S]*"refs\/heads\/release\/store-readiness-2026-08"[\s\S]*"refs\/heads\/release\/ux-professionalization-2026-08"[\s\S]*\]\s*\)/,'Push/workflow-dispatch E2E must be restricted to explicitly trusted branches, including the active UX release branch.');
 requirePattern(control,/PULL_REQUEST_REF_RE\s*=\s*\/\^refs\\\/pull\\\/\\d\{1,12\}\\\/merge\$\//,'Pull-request E2E must require a canonical refs/pull/<id>/merge ref.');
 requirePattern(control,/eventName\s*===\s*"pull_request"[\s\S]*PULL_REQUEST_REF_RE\.test\(ref\)/,'Pull-request OIDC events must validate their ref.');
 requirePattern(control,/eventName\s*===\s*"push"\s*\|\|\s*eventName\s*===\s*"workflow_dispatch"[\s\S]*TRUSTED_BRANCH_REFS\.has\(ref\)/,'Push and workflow-dispatch OIDC events must fail closed outside trusted branch refs.');
 requirePattern(control,/verifyEventAndRef\(payload\)/,'CI control must validate GitHub event and ref after cryptographic claim checks.');
 for(const action of['provision','confirm','delete','provision-staff','remove-staff-roles','set-block','mfa-audit-summary'])requirePattern(control,new RegExp(`type Action=[^;]*"${action.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`),`CI control Action union must include ${action}.`);
 requirePattern(control,/action===?"provision"\|\|action===?"provision-staff"/,'CI control must implement protected customer and staff provisioning.');
 requirePattern(control,/admin\.auth\.admin\.createUser/,'CI control must create disposable Auth users server-side.');
 requirePattern(control,/email_confirm:\s*true/,'CI control must provision disposable E2E users as email-confirmed.');
 requirePattern(control,/SUPABASE_SERVICE_ROLE_KEY/,'CI control must keep Auth admin operations server-side.');
 requirePattern(control,/emailForRun\(runId,slot\)/,'CI control must derive disposable account identity from verified run id plus constrained slot.');
 requirePattern(control,/if\(action==="delete"\)[\s\S]*deleteCiUser\(admin,String\(existing\.id\)\)/,'CI control must perform strict idempotent cleanup through the canonical delete helper.');
 requirePattern(control,/async function removeCiStaffRoles\([\s\S]*await admin\.rpc\("ci_remove_e2e_staff_roles_for_service_v1"[\s\S]*if\(error\)throw error/,'CI role cleanup must await and inspect the Supabase RPC result explicitly.');
 requirePattern(control,/async function deleteCiUser\([\s\S]*removeCiStaffRoles\(admin,userId\)[\s\S]*admin\.auth\.admin\.deleteUser\(userId,false\)/,'CI user cleanup must remove disposable staff roles before Auth hard deletion.');
 forbidPattern(control,/admin\.rpc\([^;\n]+\)\.catch\s*\(/,'Supabase RPC builders must not be treated as native Promises with .catch(); await and inspect their error result instead.');
 requirePattern(control,/authorization_negative_customer_mfa_audit_forgery/,'Disposable customer provisioning must prove non-staff cannot forge MFA audit events.');
 requirePattern(control,/runner_environment/,'CI control must pin execution to GitHub-hosted runners.');
}

if(controlConfig){
 requirePattern(controlConfig,/"jose":\s*"npm:jose@6\.2\.9"/,'CI control JWT verification dependency must stay pinned.');
}

if(failures.length){console.error('Golden Oremar authenticated E2E contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar authenticated E2E contract audit passed: real customer and staff journeys are mandatory, both approved workflow identities are path-bound, GitHub OIDC is cryptographically pinned, disposable identities are server-provisioned, Supabase RPC cleanup semantics are correct, cleanup is strict, and service-role credentials never enter Actions.');
