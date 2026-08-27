import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
const read=(relative)=>{const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Required atomic publication file is missing: ${relative}`);return'';}return fs.readFileSync(full,'utf8');};
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};
const requirePattern=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};
const forbidPattern=(source,pattern,message)=>{if(pattern.test(source))failures.push(message);};

const v1=read('supabase/migrations/20260826233501_add_atomic_super_admin_bulk_product_publication_v1.sql');
const v2=read('supabase/migrations/20260826233642_align_atomic_bulk_publication_response_v2.sql');
const notificationBoundary=read('supabase/migrations/20260826234521_separate_official_store_moderation_notifications_v1.sql');
const v3=read('supabase/migrations/20260826234917_fix_atomic_bulk_publication_audit_signature_v3.sql');
const v4=read('supabase/migrations/20260826235432_activate_approved_products_and_add_official_catalog_recovery_v4.sql');
const client=read('src/admin/productBulkModerationApi.ts');

for(const migration of [v1,v2,v3]){
  requireText(migration,'private.super_admin_bulk_publish_products_atomic_v1','Atomic bulk publish function must remain defined in every canonical function migration.');
  for(const permission of ["private.has_permission('product.moderate')","private.has_permission('product.publish')","private.has_permission('product.approve')"])requireText(migration,permission,`Atomic publication is missing ${permission}.`);
  requireText(migration,'for update','Atomic publication must lock the exact product set before publishing.');
  requireText(migration,'duplicate_product_ids','Atomic publication must reject duplicate product identifiers.');
  requireText(migration,'bulk_product_set_mismatch','Atomic publication must fail when the locked set differs from the request.');
  requireText(migration,'product_not_reviewable','Atomic publication must fail if any selected product is no longer in review.');
  requireText(migration,'private.admin_review_product_v4','Atomic publication must use the canonical v4 moderation core.');
  forbidPattern(migration,/exception\s+when\s+others/i,'Atomic publication must never swallow per-product errors.');
}

for(const schema of ['private','public']){
  requirePattern(v1,new RegExp(`revoke all on function ${schema}\\.super_admin_bulk_publish_products_atomic_v1\\(uuid\\[\\],text\\) from public,anon,authenticated,service_role`,'i'),`${schema} atomic publication privileges must be reset explicitly.`);
  requirePattern(v1,new RegExp(`grant execute on function ${schema}\\.super_admin_bulk_publish_products_atomic_v1\\(uuid\\[\\],text\\) to authenticated,service_role`,'i'),`${schema} atomic publication must not be anonymous-callable.`);
}
requireText(v2,"'name',coalesce(product_name,'Ürün')",'Atomic response must retain product names.');
requireText(v2,"'atomic',true",'Atomic response must identify its all-or-nothing contract.');
requireText(notificationBoundary,"producer_row.store_kind='producer'",'Producer notifications must be limited to independent producer stores.');
requireText(notificationBoundary,'producer_row.owner_user_id is not null','Producer notifications must require a real owner recipient.');
requirePattern(v3,/product\.bulk_atomic_approval_completed'[\s\S]*jsonb_build_object\('mode','super_admin_bulk_atomic','reason',clean_reason\),null/s,'Atomic completion audit must use the live seven-argument audit contract.');

requireText(v4,"jsonb_build_object('is_approved',true,'is_active',true)",'Approved products must become active in the same canonical moderation write.');
requireText(v4,'private.super_admin_activate_official_catalog_products_atomic_v1','v4 must provide the official-catalog recovery RPC.');
for(const permission of ["private.has_permission('product.moderate')","private.has_permission('product.publish')","private.has_permission('product.approve')"])requireText(v4,permission,`Official-catalog recovery is missing ${permission}.`);
requireText(v4,"pr.store_kind='official'",'Recovery must be restricted to the official store.');
requireText(v4,"p.status='published'",'Recovery must only activate already-published products.');
requireText(v4,'p.is_active=false','Recovery must only target inactive products.');
requireText(v4,'for update of p','Recovery must row-lock the exact activation set.');
requireText(v4,'official_catalog_activation_set_mismatch','Recovery must reject a mismatched product set.');
requireText(v4,'official_catalog_activation_readiness_failed','Recovery must re-check publication readiness before activation.');
requireText(v4,'private.product_media_integrity_ok_v1','Recovery must fail closed on media integrity.');
requireText(v4,"d.status='approved'",'Recovery must require approved editorial state.');
requireText(v4,"'product.official_catalog_activation_requested'",'Recovery must audit the requested activation.');
requireText(v4,"'product.official_catalog_activation_completed'",'Recovery must audit the completed activation.');
for(const schema of ['private','public']){
  requirePattern(v4,new RegExp(`revoke all on function ${schema}\\.super_admin_activate_official_catalog_products_atomic_v1\\(uuid\\[\\],text\\) from public,anon,authenticated,service_role`,'i'),`${schema} recovery privileges must be reset explicitly.`);
  requirePattern(v4,new RegExp(`grant execute on function ${schema}\\.super_admin_activate_official_catalog_products_atomic_v1\\(uuid\\[\\],text\\) to authenticated,service_role`,'i'),`${schema} recovery must not be anonymous-callable.`);
}
forbidPattern(v4,/disable trigger|session_replication_role|alter table[^;]*disable/i,'Recovery must never bypass publication triggers.');

requirePattern(client,/input\.approve[\s\S]*super_admin_bulk_publish_products_atomic_v1/,'Admin bulk approval must route through the atomic publication RPC.');
requirePattern(client,/super_admin_bulk_review_products_v1[\s\S]*p_approve:false/,'Admin bulk rejection may retain detailed non-atomic results.');
forbidPattern(client,/super_admin_bulk_review_products_v1[^\n]*p_approve:input\.approve/,'Admin approval must not return to the partial-result bulk RPC.');
requireText(client,'Atomik toplu yayın için ürün seçimi gerekiyor.','Atomic publication must reject implicit all-products publication.');

if(failures.length){console.error('Atomic bulk publication contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Atomic bulk publication contract audit passed: approval publishes active products, recovery is exact-set/AAL2-gated and trigger-preserving, and all publication writes remain all-or-nothing.');
