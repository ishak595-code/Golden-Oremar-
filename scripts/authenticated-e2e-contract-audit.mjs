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
 requirePattern(journey,/getByRole\('button',\{name:'Hesap Oluştur',exact:true\}\)\.click\(\)/,'Customer E2E must submit the real registration form.');
 requirePattern(journey,/ciControl\('confirm'\)/,'Customer E2E must be able to confirm a disposable account through the protected CI control plane.');
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
 requirePattern(control,/SUPABASE_SERVICE_ROLE_KEY/,'CI control must keep Auth admin operations server-side.');
 requirePattern(control,/emailForRun\(runId\)/,'CI control must derive the disposable account email from the verified run id.');
 requirePattern(control,/action === "delete"/,'CI control must support idempotent hard cleanup.');
}
if(controlConfig){
 requirePattern(controlConfig,/"jose":\s*"npm:jose@6\.2\.9"/,'CI control JWT verification dependency must stay pinned.');
}

if(failures.length){console.error('Golden Oremar authenticated E2E contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar authenticated E2E contract audit passed: real signup/login is mandatory, GitHub OIDC gates server-side confirmation/cleanup, and service-role credentials never enter Actions.');
