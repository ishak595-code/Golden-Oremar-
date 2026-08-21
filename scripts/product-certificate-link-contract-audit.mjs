import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=(relative)=>{const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Missing certificate contract file: ${relative}`);return'';}return fs.readFileSync(full,'utf8');};
const requirePattern=(content,pattern,message)=>{if(!pattern.test(content))failures.push(message);};
const forbid=(content,pattern,message)=>{if(pattern.test(content))failures.push(message);};

const migration=read('supabase/migrations/20260819201044_retire_external_product_certificate_verification_urls.sql');
if(migration){
  requirePattern(migration,/update public\.product_certifications set verification_url=null/i,'Existing external certificate verification URLs must be cleared.');
  requirePattern(migration,/product_certifications_no_external_verification_url/i,'Database must reject future external certificate verification URLs.');
  requirePattern(migration,/jsonb_build_object\('verificationUrl',null\)/i,'Public product detail must fail closed and return no certificate verification URL.');
}

const certificateApi=read('src/admin/officialProductCertificationApi.ts');
if(certificateApi){
  requirePattern(certificateApi,/createSignedUrl\(normalized,300\)/,'Private certificate evidence preview must stay short-lived and in-app.');
  forbid(certificateApi,/verificationUrl|verification_url|target=["']_blank["']/,'Certificate evidence client must not depend on an external verification URL.');
}

const certificateUi=read('src/admin/OfficialProductCertificateVerification.tsx');
if(certificateUi){
  requirePattern(certificateUi,/Belgeyi uygulama içinde gör/,'Certificate evidence must be reviewed inside the app.');
  forbid(certificateUi,/target=["']_blank["']|window\.open|type=["']url["']/,'Certificate evidence UI must not open or accept external verification links.');
}

if(failures.length){console.error('Product certificate link contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Product certificate link contract audit passed.');
