import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import baseConfig from '../vite.config';

const reportFile=process.env.BUNDLE_REPORT_FILE||'bundle-route-report.json';
const plugin:Plugin={
 name:'golden-oremar-route-split-audit',
 generateBundle(_options,bundle){
  const chunks=Object.values(bundle).filter((item):item is Extract<typeof item,{type:'chunk'}>=>item.type==='chunk').map(chunk=>({
   fileName:chunk.fileName,isEntry:chunk.isEntry,codeBytes:Buffer.byteLength(chunk.code),imports:chunk.imports,dynamicImports:chunk.dynamicImports,
   modules:Object.entries(chunk.modules).map(([id,info])=>({id,renderedLength:info.renderedLength??0})).sort((a,b)=>b.renderedLength-a.renderedLength)
  })).sort((a,b)=>b.codeBytes-a.codeBytes);
  fs.writeFileSync(reportFile,JSON.stringify({chunks},null,2));
  const entry=chunks.find(c=>c.isEntry);
  console.log('ROUTE_SPLIT_ENTRY',JSON.stringify(entry?{fileName:entry.fileName,codeBytes:entry.codeBytes,moduleCount:entry.modules.length,dynamicImports:entry.dynamicImports.length}:null));
 }
};

export default defineConfig(async env=>{
 const resolved=typeof baseConfig==='function'?await baseConfig(env):baseConfig;
 return {...resolved,plugins:[...(resolved.plugins||[]),plugin]};
});
