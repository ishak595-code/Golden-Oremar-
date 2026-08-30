import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=file=>{
 const full=path.join(root,file);
 if(!fs.existsSync(full)){failures.push(`Missing required Home data file: ${file}`);return'';}
 return fs.readFileSync(full,'utf8');
};
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};
const forbidText=(source,text,message)=>{if(source.includes(text))failures.push(message);};

const home=read('src/features/home/HomeSection.tsx');
const client=read('src/features/home/homeExperienceApi.ts');
const hook=read('src/features/home/useHomeExperience.ts');
const storefront=read('src/features/storefront/api.ts');
const admin=read('src/admin/homeExperienceAdminApi.ts');
const canonical=read('supabase/migrations/20260828143027_add_canonical_home_experience_v1.sql');
const deferred=read('supabase/migrations/20260828143150_split_home_initial_and_deferred_sections_v2.sql');
const adminMigration=read('supabase/migrations/20260819092107_add_super_admin_home_interface_management.sql');

requireText(home,'useHomeExperience','Home must use the canonical Home experience data source.');
forbidText(home,'useLiveHomeCatalog','Home must not rebuild merchandising from the entire catalog on the client.');
forbidText(home,'usePublicStorefrontConfig','Home composition authority must not be split across a second client read.');
requireText(home,'experience.categoryOrder','Home must honor server-managed category order.');
requireText(home,'experience.sections','Home must render server-managed product sections.');

requireText(client,'get_public_home_experience_v1','Home initial composition must use the canonical public Home RPC.');
requireText(client,'get_public_home_section_v1','Deferred Home sections must use the bounded section RPC.');
requireText(client,'normalizeExperience','Home payload must be normalized before rendering.');
requireText(client,'normalizeSection','Home section payloads must be normalized before rendering.');

requireText(hook,'compositionMaxAgeSeconds','Home cache lifetime must remain server controlled.');
requireText(hook,'sectionCache','Deferred Home section requests must be deduplicated.');
requireText(hook,'NETWORK_RESTORED_EVENT','Home must refresh after network restoration.');

requireText(storefront,'StorefrontEventSpotlight','Storefront API must retain managed event spotlight data.');
requireText(storefront,'heroCategories','Storefront API must retain managed category ordering data.');
requireText(storefront,'normalizeEventSpotlight','Malformed event spotlight data must be normalized fail-closed.');

requireText(admin,'admin_update_home_interface_v1','Home interface updates must use the dedicated admin RPC.');
requireText(admin,"getPublicStorefrontConfig('tr')",'Home admin reads must use the canonical storefront contract.');

requireText(canonical,'catalog_public_card_rows_v1','Canonical Home migration must use the shared public product projection.');
requireText(canonical,'search_catalog_v4','Search and Home must remain on the shared product projection.');
requireText(canonical,'list_public_categories_v3','Categories and Home must remain on the shared product projection.');
requireText(deferred,'home_section_projection_v1','Deferred Home sections must use the bounded section projection.');
requireText(deferred,'get_public_home_section_v1','Deferred Home section RPC must remain migration backed.');
requireText(adminMigration,"private.has_role('super_admin')",'Home management mutations must remain restricted to Super Admin.');
requireText(adminMigration,'admin_update_home_interface_v1','Home management RPC must remain migration backed.');

if(failures.length){
 console.error('Golden Oremar Home data contract audit failed:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}
console.log('Golden Oremar Home data contract audit passed: composition remains server-owned and normalized without enforcing presentation, wording or card geometry.');
