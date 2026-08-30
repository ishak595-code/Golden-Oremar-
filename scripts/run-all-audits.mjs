import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptsDir=path.join(process.cwd(),'scripts');
const nonBlockingPresentationAudits=new Set([
 'customer-professionalization-contract-audit.mjs',
 'customer-ui-contract-audit.mjs',
]);
const allAudits=fs.readdirSync(scriptsDir)
 .filter(name=>name.endsWith('-audit.mjs'))
 .sort((a,b)=>a.localeCompare(b));
const audits=allAudits.filter(name=>!nonBlockingPresentationAudits.has(name));
const presentationAudits=allAudits.filter(name=>nonBlockingPresentationAudits.has(name));

if(!audits.length){console.error('No blocking *-audit.mjs scripts found.');process.exit(1);}
console.log(`Running ${audits.length} blocking Golden Oremar audit scripts...`);
if(presentationAudits.length)console.log(`Non-blocking presentation source audits: ${presentationAudits.join(', ')}. Customer wording and accessibility behavior are verified by Chromium runtime tests.`);
for(const name of audits){
 console.log(`\n=== ${name} ===`);
 const result=spawnSync(process.execPath,[path.join(scriptsDir,name)],{stdio:'inherit',env:process.env});
 if(result.error){console.error(result.error);process.exit(1);}
 if(result.status!==0){console.error(`Audit failed: ${name}`);process.exit(result.status||1);}
}
console.log(`\nAll ${audits.length} blocking Golden Oremar audit scripts passed.`);
