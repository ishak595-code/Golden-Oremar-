import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const src=path.join(root,'src');
const failures=[];
const extensions=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const retired=[
 'get_public_content_entry_v1','get_public_content_entry_v2',
 'get_public_home_catalog_v1','get_public_home_catalog_v2',
 'get_public_storefront_config_v1','list_public_categories_v1',
 'search_catalog_v1','search_catalog_v2',
 'list_my_producer_payouts_v1','list_my_producer_products_v1',
 'request_customer_return_v1','request_customer_return_v2',
 'update_my_producer_profile_v1',
 'super_admin_get_release_setup_v1','super_admin_update_release_setup_v1'
];
const required=new Map([
 ['src/features/content/api.ts',['get_public_content_entry_v3']],
 ['src/features/catalog/api.ts',['search_catalog_v3','list_public_categories_v2','get_public_home_catalog_v3']],
 ['src/features/storefront/api.ts',['get_public_storefront_config_v2']],
 ['src/features/producer-products/api.ts',['list_my_producer_products_v3','list_public_categories_v2']],
 ['src/features/producer-finance/api.ts',['list_my_producer_payouts_v2']],
 ['src/features/account/returnsApi.ts',['request_customer_return_v3']],
 ['src/admin/releaseSetupAdminApi.ts',['super_admin_get_release_setup_v2','super_admin_update_release_setup_v2']]
]);
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){walk(full);continue;}if(!extensions.has(path.extname(entry.name)))continue;const rel=path.relative(root,full).replaceAll(path.sep,'/'),body=fs.readFileSync(full,'utf8');for(const rpc of retired){const call=new RegExp(`supabase\\.rpc\\(\\s*['\"]${rpc}['\"]`);if(call.test(body))failures.push(`Retired public RPC runtime call ${rpc}: ${rel}`);}}}
if(!fs.existsSync(src))failures.push('src directory is missing.');else walk(src);
for(const[file,rpcs]of required){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`Canonical RPC client file is missing: ${file}`);continue;}const body=fs.readFileSync(full,'utf8');for(const rpc of rpcs){if(!new RegExp(`supabase\\.rpc\\(\\s*['\"]${rpc}['\"]`).test(body))failures.push(`Canonical RPC ${rpc} is missing from ${file}`);}}
if(failures.length){console.error('Golden Oremar public RPC contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar public RPC contract audit passed: runtime callers use canonical RPC versions and retired aliases are absent from src.');
