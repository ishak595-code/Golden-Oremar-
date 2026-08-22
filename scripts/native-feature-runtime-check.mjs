import fs from 'node:fs';
import path from 'node:path';

const platform=String(process.argv[2]||'').trim().toLowerCase();
const roots={
  android:'android/app/src/main/assets/public',
  ios:'ios/App/App/public',
};
const relativeRoot=roots[platform];
if(!relativeRoot){
  console.error('Usage: node scripts/native-feature-runtime-check.mjs <android|ios>');
  process.exit(2);
}

const root=path.resolve(process.cwd(),relativeRoot);
if(!fs.existsSync(root)||!fs.statSync(root).isDirectory()){
  console.error(`[native-feature-runtime] ${platform} synced asset directory is missing: ${relativeRoot}`);
  process.exit(1);
}
if(!fs.existsSync(path.join(root,'index.html'))){
  console.error(`[native-feature-runtime] ${platform} synced index.html is missing.`);
  process.exit(1);
}

const textFiles=[];
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory()){walk(full);continue;}
    if(/\.(?:js|mjs|html|css|json|webmanifest)$/i.test(entry.name))textFiles.push(full);
  }
}
walk(root);
if(textFiles.length<2){
  console.error(`[native-feature-runtime] ${platform} synced bundle is unexpectedly empty.`);
  process.exit(1);
}

const bundle=textFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const required=[
  ['premium-theme','Yakut Prestige'],
  ['premium-notification-sound','golden-oremar:notification-sound:v1'],
  ['faq-live-rpc','list_public_faq_v1'],
  ['product-safety-live-rpc','get_public_product_safety_v3'],
  ['search-accessibility-overlay','catalog-search-suggestions'],
  ['search-accessibility-expanded','aria-expanded'],
];
const missing=required.filter(([,marker])=>!bundle.includes(marker));
if(missing.length){
  console.error(`[native-feature-runtime] ${platform} synced bundle is missing consolidated feature markers:`);
  for(const[label,marker]of missing)console.error(`- ${label}: ${marker}`);
  process.exit(1);
}

console.log(`Native feature runtime check passed for ${platform}: premium theme/sound, FAQ, product safety and search accessibility are present in the synced native shell assets (${textFiles.length} text assets checked).`);
