import fs from'node:fs';import path from'node:path';
const dir=path.join(process.cwd(),'supabase','migrations');
const required=['20260828143027_add_canonical_home_experience_v1.sql','20260828143150_split_home_initial_and_deferred_sections_v2.sql','20260828174048_derive_home_sales_readiness_from_live_controls_v3.sql'];
const retired=['20260828143000_add_canonical_home_experience_v1.sql','20260828144500_split_home_initial_and_deferred_sections_v2.sql'];
const files=new Set(fs.readdirSync(dir));const failures=[];
for(const file of required)if(!files.has(file))failures.push(`Canonical Home commerce migration missing: ${file}`);
for(const file of retired)if(files.has(file))failures.push(`Retired Home commerce migration identity must stay absent: ${file}`);
if(failures.length){console.error('Home commerce migration tail contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log('Home commerce migration tail contract audit passed: source identities match live Supabase Home versions 20260828143027, 20260828143150 and 20260828174048.');
