import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const runtimeRoots=['src','supabase/functions'];
const sourceExtensions=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const ignoredSegments=new Set(['node_modules','dist','build','.git']);

function runtimeFiles(directory){
 const full=path.join(root,directory);if(!fs.existsSync(full))return[];
 const files=[];
 function walk(current){
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
   if(ignoredSegments.has(entry.name))continue;
   const next=path.join(current,entry.name);
   if(entry.isDirectory()){walk(next);continue;}
   if(sourceExtensions.has(path.extname(entry.name)))files.push(next);
  }
 }
 walk(full);return files;
}

const files=runtimeRoots.flatMap(runtimeFiles);
for(const full of files){
 const relative=path.relative(root,full).replaceAll(path.sep,'/');
 const body=fs.readFileSync(full,'utf8');
 const checks=[
  [/\bTODO\b/i,'TODO marker'],
  [/\bFIXME\b/i,'FIXME marker'],
  [/\b(?:mock|fake|dummy|hardcoded)(?:Data|Product|Products|User|Users|Price|Prices|Stock|Inventory|Catalog|Order|Orders)?\b/i,'mock/fake/dummy/hardcoded runtime data marker'],
  [/\bplaceholder(?:Data|Product|Products|User|Users|Price|Prices|Stock|Inventory|Catalog|Order|Orders)\b/i,'placeholder runtime data marker'],
  [/\bconst\s+(?:mock\w*|fake\w*|dummy\w*|hardcoded\w*|placeholder(?:Data|Products?|Users?|Catalog|Inventory))\s*=/i,'static test-data declaration'],
  [/\bconst\s+(?:products|catalog|inventory|users|orders)\s*=\s*\[\s*\{/i,'hard-coded business entity array'],
  [/(?:^|[,{\s])(?:price|priceMinor|stock|availableQuantity|sellableQuantity|inventoryQuantity)\s*:\s*[1-9][0-9]*(?:\.[0-9]+)?\b/im,'hard-coded price/stock quantity in runtime object'],
  [/from\s+['"][^'"]*(?:\/data(?:\/|['"])|DataContext)/i,'legacy static data import'],
 ];
 for(const[pattern,label]of checks)if(pattern.test(body))failures.push(`${label}: ${relative}`);
}

const forbiddenPaths=[
 'src/data.ts','src/data','src/data/healthData.ts','src/mocks','src/mock','src/fixtures','src/demoData.ts','src/sampleData.ts'
];
for(const relative of forbiddenPaths)if(fs.existsSync(path.join(root,relative)))failures.push(`Static/demo data path must not exist: ${relative}`);

const contracts=[
 ['src/features/catalog/api.ts',/supabase\.(?:rpc|from)\(/,'Catalog API must remain Supabase-backed.'],
 ['src/features/storefront/api.ts',/supabase\.rpc\(/,'Storefront API must remain Supabase-backed.'],
 ['src/features/cart/api.ts',/supabase\.rpc\(/,'Cart API must remain Supabase-backed.'],
 ['src/features/account/faqApi.ts',/supabase\.rpc\(/,'FAQ must remain Supabase-backed.'],
 ['src/features/content/api.ts',/supabase\.rpc\(/,'Public content must remain Supabase-backed.'],
];
for(const[relative,pattern,message]of contracts){
 const full=path.join(root,relative);
 if(!fs.existsSync(full)){failures.push(`Required live-data module missing: ${relative}`);continue;}
 if(!pattern.test(fs.readFileSync(full,'utf8')))failures.push(message);
}

if(failures.length){console.error('Golden Oremar dynamic-data audit failed:');for(const failure of [...new Set(failures)])console.error(`- ${failure}`);process.exit(1);}
console.log(`Golden Oremar dynamic-data audit passed across ${files.length} runtime source files: no TODO/FIXME, mock/fake/dummy/placeholder business data, static business arrays, hard-coded price/stock objects, or legacy static data imports were found; key customer screens remain Supabase-backed.`);
