import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Missing required authenticated E2E file: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(body,re,message){if(!re.test(body))failures.push(message);}
function forbidPattern(body,re,message){if(re.test(body))failures.push(message);}

const workflow=read('.github/workflows/mobile-quality.yml');
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
 forbidPattern(journey,/createClient\([^\n]*serviceRole|SUPABASE_SERVICE_ROLE_KEY/,'Browser E2E code must not receive or use service-role credentials.');
}
if(control){
 requirePattern(control,/EXPECTED_REPOSITORY_ID\s*=\s*"1335636205"/,'CI control must pin the immutable Golden Oremar repository id.');
 requirePattern(control,/EXPECTED_OWNER_ID\s*=\s*"233486723"/,'CI control must pin the immutable repository owner id.');
 requirePattern(control,/EXPECTED_AUDIENCE\s*=\s*"golden-oremar-ci-e2e"/,'CI control must pin the dedicated OIDC audience.');
 requirePattern(control,/jwtVerify<.*>\(token, GITHUB_JWKS/,'CI control must cryptographically verify GitHub OIDC tokens.');
 requirePattern(control,/type Action = "provision" \| "confirm" \| "delete"/,'CI control must expose the provision and cleanup actions required by the authenticated E2E model.');
 requirePattern(control,/action === "provision"/,'CI control must implement protected disposable-user provisioning.');
 requirePattern(control,/admin\.auth\.admin\.createUser/,'CI control must create the disposable Auth user server-side.');
 requirePattern(control,/email_confirm:\s*true/,'CI control must provision the disposable E2E user as email-confirmed.');
 requirePattern(control,/SUPABASE_SERVICE_ROLE_KEY/,'CI control must keep Auth admin operations server-side.');
 requirePattern(control,/emailForRun\(runId\)/,'CI control must derive the disposable account email from the verified run id.');
 requirePattern(control,/action === "delete"/,'CI control must support idempotent hard cleanup.');
}
if(controlConfig){
 requirePattern(controlConfig,/"jose":\s*"npm:jose@6\.2\.9"/,'CI control JWT verification dependency must stay pinned.');
}

if(failures.length){console.error('Golden Oremar authenticated E2E contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar authenticated E2E contract audit passed: the real registration UI contract is exercised, GitHub OIDC provisions a confirmed disposable account, login runs through the real UI, cleanup is mandatory, and service-role credentials never enter Actions.');
