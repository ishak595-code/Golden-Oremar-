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
const client=read('src/admin/productBulkModerationApi.ts');

for(const migration of [v1,v2]){
  requireText(migration,'private.super_admin_bulk_publish_products_atomic_v1','Atomic bulk publish function must remain defined in both canonical migrations.');
  requireText(migration,"private.has_permission('product.moderate')",'Atomic publication must require product.moderate.');
  requireText(migration,"private.has_permission('product.publish')",'Atomic publication must require product.publish.');
  requireText(migration,"private.has_permission('product.approve')",'Atomic publication must require product.approve.');
  requireText(migration,'for update','Atomic publication must lock the exact product set before publishing.');
  requireText(migration,'duplicate_product_ids','Atomic publication must reject duplicate product identifiers.');
  requireText(migration,'bulk_product_set_mismatch','Atomic publication must fail when the locked set differs from the request.');
  requireText(migration,'product_not_reviewable','Atomic publication must fail if any selected product is no longer in review.');
  requireText(migration,'private.admin_review_product_v4','Atomic publication must use the canonical v4 product and editorial moderation core.');
  requireText(migration,"'product.bulk_atomic_approval_requested'",'Atomic publication must audit the requested transaction.');
  requireText(migration,"'product.bulk_atomic_approval_completed'",'Atomic publication must audit successful transaction completion.');
  forbidPattern(migration,/exception\s+when\s+others/i,'Atomic publication must never swallow per-product errors because that would allow partial publication.');
}

requirePattern(v1,/revoke all on function private\.super_admin_bulk_publish_products_atomic_v1\(uuid\[\],text\) from public,anon,authenticated,service_role/i,'Private atomic function privileges must be reset explicitly.');
requirePattern(v1,/grant execute on function private\.super_admin_bulk_publish_products_atomic_v1\(uuid\[\],text\) to authenticated,service_role/i,'Private atomic function must be executable only by authenticated and service roles after capability checks.');
requirePattern(v1,/revoke all on function public\.super_admin_bulk_publish_products_atomic_v1\(uuid\[\],text\) from public,anon,authenticated,service_role/i,'Public wrapper privileges must be reset explicitly.');
requirePattern(v1,/grant execute on function public\.super_admin_bulk_publish_products_atomic_v1\(uuid\[\],text\) to authenticated,service_role/i,'Public atomic wrapper must not be anonymous-callable.');

requireText(v2,"'name',coalesce(product_name,'Ürün')",'Atomic response must retain the product name required by the admin client contract.');
requireText(v2,"'errorCode',null",'Atomic success response must retain the normalized errorCode field.');
requireText(v2,"'error',null",'Atomic success response must retain the normalized error field.');
requireText(v2,"'atomic',true",'Atomic response must identify the all-or-nothing transaction contract.');

requireText(notificationBoundary,"producer_row.store_kind='producer'",'Producer moderation notifications must be limited to independent producer stores.');
requireText(notificationBoundary,'producer_row.owner_user_id is not null','Producer moderation notifications must require a real owner recipient.');
requirePattern(notificationBoundary,/if producer_row\.store_kind='producer' and producer_row\.owner_user_id is not null then[\s\S]*insert into public\.notifications/i,'Official-store moderation must not attempt a producer notification with a null recipient.');
requireText(notificationBoundary,"insert into private.outbox_events",'Official-store publication must retain the canonical outbox event even when producer notification is skipped.');
requireText(notificationBoundary,"insert into private.product_moderation_events",'Official-store publication must retain moderation audit evidence.');

requirePattern(client,/input\.approve[\s\S]*super_admin_bulk_publish_products_atomic_v1/,'Admin bulk approval must route through the atomic publication RPC.');
requirePattern(client,/super_admin_bulk_review_products_v1[\s\S]*p_approve:false/,'Admin bulk rejection may retain the detailed non-atomic moderation RPC.');
forbidPattern(client,/super_admin_bulk_review_products_v1[^\n]*p_approve:input\.approve/,'Admin client must not route approval back through the partial-result bulk RPC.');
requireText(client,'Atomik toplu yayın için ürün seçimi gerekiyor.','Atomic publication must reject implicit all-products publication from the client.');

if(failures.length){
  console.error('Atomic bulk publication contract audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Atomic bulk publication contract audit passed: Super Admin approval is explicit-set, capability/AAL2-gated, row-locked and all-or-nothing; official-store moderation skips producer-owner notifications while retaining audit/outbox evidence.');
