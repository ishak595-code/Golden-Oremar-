import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const scriptsDir=path.join(process.cwd(),'scripts');

// Release CI is explicit. Presentation experiments never become blocking merely
// because of a file name. Durable product-owner structural contracts are listed
// here only when they are deliberate invariants.
const audits=[
 'account-navigation-stability-contract-audit.mjs',
 'admin-data-contract-audit.mjs',
 'admin-user-role-contract-audit.mjs',
 'api-public-bridge-contract-audit.mjs',
 'app-update-contract-audit.mjs',
 'atomic-bulk-publication-contract-audit.mjs',
 'authenticated-e2e-contract-audit.mjs',
 'authorization-contract-audit.mjs',
 'catalog-media-dimensions-contract-audit.mjs',
 'ci-e2e-garbage-collection-contract-audit.mjs',
 'customer-event-contract-audit.mjs',
 'customer-return-contract-audit.mjs',
 'customer-review-contract-audit.mjs',
 'dependency-runtime-boundary-audit.mjs',
 'dependency-update-governance-audit.mjs',
 'dynamic-data-contract-audit.mjs',
 'home-commerce-migration-tail-contract-audit.mjs',
 'home-data-contract-audit.mjs',
 'home-product-row-contract-audit.mjs',
 'message-commerce-contract-audit.mjs',
 'migration-history-contract-audit.mjs',
 'mobile-platform-contract-audit.mjs',
 'payment-contract-audit.mjs',
 'producer-account-contract-audit.mjs',
 'product-certificate-link-contract-audit.mjs',
 'product-commerce-lifecycle-contract-audit.mjs',
 'product-commerce-order-contract-audit.mjs',
 'product-media-integrity-contract-audit.mjs',
 'product-media-intake-contract-audit.mjs',
 'product-media-storyboard-contract-audit.mjs',
 'product-owner-governance-contract-audit.mjs',
 'product-owner-media-contract-audit.mjs',
 'product-price-variant-contract-audit.mjs',
 'product-workflow-contract-audit.mjs',
 'public-rpc-contract-audit.mjs',
 'public-rpc-security-boundary-audit.mjs',
 'release-setup-contract-audit.mjs',
 'rls-role-helper-contract-audit.mjs',
 'security-contract-audit.mjs',
 'staff-mfa-contract-audit.mjs',
 'startup-performance-audit.mjs',
 'store-follow-simulation-contract-audit.mjs',
 'store-readiness-contract-audit.mjs',
 'vercel-runtime-config-audit.mjs',
];

for(const name of audits){
 const file=path.join(scriptsDir,name);
 if(!fs.existsSync(file)){
  console.error(`Required core audit is missing: ${name}`);
  process.exit(1);
 }
}

console.log(`Running ${audits.length} explicit Golden Oremar core audits...`);
for(const name of audits){
 console.log(`\n=== ${name} ===`);
 const result=spawnSync(process.execPath,[path.join(scriptsDir,name)],{stdio:'inherit',env:process.env});
 if(result.error){console.error(result.error);process.exit(1);}
 if(result.status!==0){console.error(`Audit failed: ${name}`);process.exit(result.status||1);}
}
console.log(`\nAll ${audits.length} explicit Golden Oremar core audits passed.`);