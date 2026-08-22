import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptsDir=path.join(process.cwd(),'scripts');
const audits=fs.readdirSync(scriptsDir)
 .filter(name=>name.endsWith('-audit.mjs'))
 .sort((a,b)=>a.localeCompare(b));

if(!audits.length){console.error('No *-audit.mjs scripts found.');process.exit(1);}
console.log(`Running ${audits.length} Golden Oremar audit scripts...`);
for(const name of audits){
 console.log(`\n=== ${name} ===`);
 const result=spawnSync(process.execPath,[path.join(scriptsDir,name)],{stdio:'inherit',env:process.env});
 if(result.error){console.error(result.error);process.exit(1);}
 if(result.status!==0){console.error(`Audit failed: ${name}`);process.exit(result.status||1);}
}
console.log(`\nAll ${audits.length} Golden Oremar audit scripts passed.`);
