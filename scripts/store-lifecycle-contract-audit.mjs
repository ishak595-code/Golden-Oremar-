import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Required store lifecycle file is missing: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function requireText(source,text,message){if(!source.includes(text))failures.push(message);}
function requirePattern(source,pattern,message){if(!pattern.test(source))failures.push(message);}
function forbidPattern(source,pattern,message){if(pattern.test(source))failures.push(message);}

const setupMigration=read('supabase/migrations/20260826164750_add_unified_storefront_setup_v1.sql');
const activationMigration=read('supabase/migrations/20260826165034_enforce_storefront_setup_before_seller_activation_v2.sql');
const lifecycleMigration=read('supabase/migrations/20260826171720_add_super_admin_store_directory_and_lifecycle_v1.sql');
const detailFixMigration=read('supabase/migrations/20260826173456_fix_super_admin_store_detail_website_v2.sql');
const directoryApi=read('src/admin/storeDirectoryAdminApi.ts');
const directoryUi=read('src/admin/SuperAdminStoreDirectory.tsx');
const vendorsUi=read('src/admin/AdminVendors.tsx');
const permissions=read('src/features/auth/permissions.ts');
const staffE2E=read('scripts/staff-mfa-e2e.mjs');

for(const token of ['storefront_status','storefront_contact_email','storefront_contact_phone','storefront_website_url','storefront_address_visibility','private.storefront_readiness_v1','private.publish_storefront_v1'])requireText(setupMigration,token,`Unified storefront setup migration is missing ${token}.`);
requireText(activationMigration,"status='pending',storefront_status='draft'",'Approved independent sellers must enter setup instead of bypassing storefront activation.');
requireText(activationMigration,"status='active',storefront_status='published'",'Storefront publication must activate a verified seller only after readiness succeeds.');

requireText(lifecycleMigration,'store_number text','Store records must have a human-searchable immutable store number.');
requireText(lifecycleMigration,"'GO-STORE-'||lpad(nextval('private.store_number_seq'",'Store number assignment must use the canonical sequence.');
requireText(lifecycleMigration,"new.store_number is distinct from old.store_number",'Store number must be immutable after creation.');
requireText(lifecycleMigration,"check (store_number ~ '^GO-STORE-[0-9]{8}$')",'Store number format constraint is missing.');
requireText(lifecycleMigration,'create unique index if not exists producers_store_number_key','Store number must be unique.');
requireText(lifecycleMigration,"values('super_admin','storefront.lifecycle_manage')",'Store lifecycle capability must be assigned only to Super Admin.');
requirePattern(lifecycleMigration,/delete from private\.role_permissions where permission_key='storefront\.lifecycle_manage';[\s\S]*values\('super_admin','storefront\.lifecycle_manage'\)/,'Store lifecycle capability must be reset before the Super Admin-only assignment.');
for(const rpc of ['private.super_admin_store_directory_v1','public.super_admin_store_directory_v1','private.super_admin_store_detail_v1','public.super_admin_store_detail_v1','private.super_admin_set_store_state_v1','public.super_admin_set_store_state_v1'])requireText(lifecycleMigration,rpc,`Store lifecycle RPC is missing ${rpc}.`);
for(const field of ['totalStores','openStores','setupPending','blockedStores','closedStores','archivedStores','officialStores','independentStores','totalProducts','publishedProducts','totalOrders'])requireText(lifecycleMigration,`'${field}'`,`Store directory summary is missing ${field}.`);
for(const searchFragment of ['lower(s.store_number)=q','lower(s.id::text)=q','lower(s.slug)=q',"lower(s.display_name) like '%'||q||'%'","lower(coalesce(s.storefront_contact_email,'')) like '%'||q||'%'","lower(coalesce(s.storefront_contact_phone,'')) like '%'||q||'%'"])requireText(lifecycleMigration,searchFragment,`Store directory search contract is missing ${searchFragment}.`);
for(const action of ["'open'","'block'","'close'","'archive'","'restore'"])requireText(lifecycleMigration,action,`Store lifecycle action is missing ${action}.`);
requireText(lifecycleMigration,"if p.store_kind='official' then raise exception 'official_store_state_protected'",'Official Golden Oremar store must be protected from destructive lifecycle actions.');
for(const guard of ['storefront_publish_required','storefront_readiness_required','store_verification_required','active_producer_trust_badge_required'])requireText(lifecycleMigration,guard,`Store opening gate is missing ${guard}.`);
requirePattern(lifecycleMigration,/action_value='archive'[\s\S]*update public\.producers set status='closed',deleted_at=timezone\('utc',now\(\)\)/,'Store deletion must use safe archival through deleted_at.');
forbidPattern(lifecycleMigration,/delete\s+from\s+public\.producers/i,'Store lifecycle migration must never physically delete producer/store records.');
requireText(lifecycleMigration,"'storefront.lifecycle.'||action_value",'Every store lifecycle mutation must be written to the admin audit log.');
requireText(lifecycleMigration,"trust_badge_status=case when trust_badge_status='active' then 'revoked'",'Blocking or archiving a store must revoke an active trust badge.');
requireText(lifecycleMigration,"raise exception 'storefront_media_legacy_retired'",'Legacy cross-store branding mutation path must remain retired.');

requireText(detailFixMigration,"'website',p.storefront_website_url",'Super Admin store detail must use the canonical storefront website column.');
forbidPattern(detailFixMigration,/p\.storefront_website\b(?!_url)/,'Store detail website fix must not reference the retired/nonexistent storefront_website field.');

for(const rpc of ["rpc('super_admin_store_directory_v1'","rpc('super_admin_store_detail_v1'","rpc('super_admin_set_store_state_v1'"])requireText(directoryApi,rpc,`Validated store admin API is missing ${rpc}.`);
requireText(directoryApi,"const STORE_NUMBER_RE=/^GO-STORE-[0-9]{8}$/",'Frontend API must validate canonical store numbers.');
requireText(directoryApi,"const STATES=new Set<SuperAdminStoreState>(['all','open','setup','blocked','closed','archived'])",'Frontend API must validate the full store filter state set.');
requireText(directoryApi,"const ACTIONS=new Set<SuperAdminStoreAction>(['open','block','close','archive','restore'])",'Frontend API must validate the full store lifecycle action set.');
requireText(directoryApi,'10 ile 1000 karakter','Frontend lifecycle API must enforce meaningful management reasons for destructive state changes.');

for(const label of ['Toplam mağaza','Açık mağaza','Engelli','Kapalı','Arşiv','Toplam ürün','Kurulum bekleyen','Yayındaki ürün','Toplam sipariş'])requireText(directoryUi,label,`Super Admin store dashboard is missing numeric metric ${label}.`);
requireText(directoryUi,'GO-STORE-00000001, UUID','Store search UI must advertise both human store number and UUID lookup.');
requireText(directoryUi,'aria-expanded={expanded}','Each compact store row must expose an expandable detail state.');
requireText(directoryUi,'onClick={onToggle}','Each store row must open its detail inline on click.');
for(const actionLabel of ['Mağazayı aç','Mağazayı engelle','Mağazayı kapat','Güvenli sil / arşivle','Arşivden çıkar'])requireText(directoryUi,actionLabel,`Super Admin store UI is missing lifecycle control ${actionLabel}.`);
requireText(directoryUi,'Sipariş, ödeme, denetim ve muhasebe geçmişi korunur.','Store archive UI must explicitly preserve financial and audit history.');
requireText(directoryUi,'Resmi mağaza korumalı.','Official store lifecycle protection must be visible to Super Admin.');
requireText(directoryUi,'productCount','Compact store rows must expose per-store product counts.');
requireText(directoryUi,'publishedProductCount','Compact store rows must expose published-product counts.');
requireText(directoryUi,'orderCount','Compact store rows must expose per-store order counts.');

requireText(vendorsUi,"roles.includes('super_admin')?<SuperAdminStoreDirectory",'Super Admin vendor navigation must route into the unified store governance console.');
requireText(permissions,"'storefront.lifecycle_manage'",'Frontend canonical permission contract must include storefront.lifecycle_manage.');

requirePattern(staffE2E,/assertAal1StaffDenied[\s\S]*storefront\.lifecycle_manage/,'AAL1 staff sessions must explicitly deny store lifecycle authority.');
requirePattern(staffE2E,/moderator AAL2 leaked[\s\S]*storefront\.lifecycle_manage|storefront\.lifecycle_manage[\s\S]*moderator AAL2 leaked/,'Moderator AAL2 must explicitly deny store lifecycle authority.');
requireText(staffE2E,"['product.publish','product.health_manage','role.manage','payout.release','system.configure','security.manage','storefront.lifecycle_manage']",'Admin AAL2 must explicitly deny store lifecycle authority.');
requireText(staffE2E,"'storefront.lifecycle_manage'],[]",'Super Admin AAL2 must explicitly receive store lifecycle authority.');
requireText(staffE2E,"rpc('super_admin_store_directory_v1'",'Real MFA E2E must directly probe the store directory RPC.');
requireText(staffE2E,'assertStoreDirectoryAllowed(owner.client)','Real MFA E2E must prove Super Admin can read the store directory.');
requireText(staffE2E,'owner.snapshot.permissions.length>=78','Super Admin capability cardinality must include the new lifecycle permission.');

if(failures.length){console.error('Store lifecycle contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Store lifecycle contract audit passed.');
