import fs from'node:fs';
import path from'node:path';
const root=process.cwd();const failures=[];
function read(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required bulk release file is missing: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function requireText(source,text,message){if(!source.includes(text))failures.push(message);}
function requirePattern(source,pattern,message){if(!pattern.test(source))failures.push(message);}
function forbidText(source,text,message){if(source.includes(text))failures.push(message);}
const migration=read('supabase/migrations/20260826115042_add_super_admin_bulk_product_moderation_v1.sql');
const panel=read('src/admin/SuperAdminBulkProductRelease.tsx');
const page=read('src/pages/AdminPage.tsx');
for(const permission of ["private.has_permission('product.moderate')","private.has_permission('product.publish')","private.has_permission('product.approve')","private.has_permission('product.reject')"])requireText(migration,permission,`Bulk moderation migration is missing ${permission}.`);
requireText(migration,"p.status='review'",'Bulk approval candidates must be limited to review state.');
requireText(migration,'cardinality(p_product_ids)>500','Bulk moderation must enforce a strict 500 product bound.');
requireText(migration,'private.admin_review_product_v4(','Bulk moderation must route every product through the canonical product review function.');
requireText(migration,"'product.bulk_approval_requested'",'Bulk moderation must audit the requested action.');
requireText(migration,"'product.bulk_approval_completed'",'Bulk moderation must audit the completed action.');
requireText(migration,'exception when others','Bulk moderation must isolate per-product failures rather than corrupt the batch result.');
for(const permission of ["p_permission_key:'product.publish'","p_permission_key:'product.health_manage'"])requireText(panel,permission,`Bulk release UI is missing ${permission}.`);
requireText(panel,"rpc('super_admin_product_publish_readiness_v1'",'Bulk release UI must load canonical publish readiness.');
requirePattern(panel,/item=>item\.readyToPublish&&item\.status==='review'/,'Bulk release UI must select only ready review products.');
requireText(panel,'YAYINLA ${ready.length}','Bulk release UI must require an explicit count-bound confirmation phrase.');
requireText(panel,"rpc('super_admin_bulk_review_products_v1'",'Bulk release UI must call the canonical bulk review RPC.');
requireText(panel,'p_product_ids:ids','Bulk release UI must submit an explicit UUID list.');
requireText(panel,"p_approve:true",'Bulk release UI must request approval explicitly.');
requireText(panel,'if(ids.length>500)','Bulk release UI must independently fail closed above the backend limit.');
forbidText(panel,'p_product_ids:null','Bulk release UI must never use the backend all-review shortcut.');
forbidText(panel,"p_product_ids:[]",'Bulk release UI must never submit an empty all-review shortcut.');
requireText(panel,'successCount+result.failureCount!==result.requestedCount','Bulk release response counters must be consistency checked.');
requireText(page,"import('../admin/SuperAdminBulkProductRelease')",'Admin page must lazy-load the Super Admin release control.');
requireText(page,'<SuperAdminBulkProductRelease onReleased={productsReleased}/>','Product moderation pages must expose the Super Admin release control.');
requireText(page,'productRefreshKey','Product list must refresh after a successful final release.');
if(failures.length){console.error('Super Admin bulk product release audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log('Super Admin bulk product release audit passed.');
