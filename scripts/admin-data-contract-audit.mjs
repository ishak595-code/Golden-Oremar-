import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required data contract file is missing: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function c(value){return value.replace(/\s+/g,'');}
function need(content,needle,message){if(!c(content).includes(needle))failures.push(message);}
function match(content,re,message){if(!re.test(content))failures.push(message);}
function forbid(content,re,message){if(re.test(content))failures.push(message);}

if(fs.existsSync(path.join(root,'backend')))failures.push('Retired backend/ migration mirror must not return.');
for(const file of[
 'supabase/migrations/20260816062936_add_my_product_batch_editor_v1.sql',
 'supabase/migrations/20260816120247_add_atomic_customer_return_evidence_v3.sql',
 'supabase/migrations/20260816120431_complete_return_options_and_admin_evidence_detail.sql',
 'supabase/migrations/20260816123842_add_public_producer_product_inventory_truth.sql',
 'supabase/migrations/20260816125511_add_secure_producer_order_fulfillment_v1.sql',
 'supabase/migrations/20260816185944_fix_public_storefront_brand_name_v1.sql',
 'supabase/migrations/20260819055042_fix_admin_inventory_variant_filter.sql',
 'supabase/migrations/20260819055617_extend_admin_producer_application_location_snapshot.sql',
])read(file);

const accountApi=read('src/features/account/api.ts');
if(accountApi){
 match(accountApi,/customer['"],\s*['"]producer['"],\s*['"]support['"],\s*['"]content_editor['"],\s*['"]operations['"],\s*['"]admin['"],\s*['"]super_admin/,'Account role contract must preserve the live role lifecycle.');
 forbid(accountApi,/ACCOUNT_ROLES[^\n]*(?:['"]user['"]|['"]vendor['"])/,'Retired user/vendor role aliases must not return.');
 for(const[needle,message]of[
  ['returnnormalizeAccountOverview(unwrap<unknown>(data,error))','Account overview must be strictly normalized.'],
  ['returnnormalizeProfileUpdate(unwrap<unknown>(data,error),expected)','Profile mutation result must be verified.'],
  ['constnormalized=normalizeAddressInput(address)','Address writes must validate input.'],
  ['constresult=normalizeAddress(unwrap<unknown>(data,error),0)','Address mutation result must be normalized.'],
  ['returnnormalizeOrdersPage(unwrap<unknown>(data,error))','Order list must be strictly normalized.'],
  ['returnnormalizeOrderDetail(unwrap<unknown>(data,error))','Order detail must be strictly normalized.'],
  ['returnnormalizeGiftOrders(unwrap<unknown>(data,error))','Gift orders must be strictly normalized.'],
  ['returnnormalizePaymentActivity(unwrap<unknown>(data,error))','Payment activity must be strictly normalized.'],
  ['returnnormalizeNotifications(unwrap<unknown>(data,error))','Notifications must be strictly normalized.'],
  ['returnnormalizeClosureRequest(unwrap<unknown>(data,error))','Closure request result must be verified.'],
  ['returnnormalizeNewsletterSummary(unwrap<unknown>(data,error))','Newsletter state must be strictly normalized.'],
  ['returnnormalizePushRegistration(unwrap<unknown>(data,error),input)','Push registration result must be verified.'],
  ['returnnormalizeHelpContent(unwrap<unknown>(data,error))','Help content must be strictly normalized.'],
 ])need(accountApi,needle,message);
 for(const marker of['ORDER_ITEM_FULFILLMENT_STATUSES','SHIPMENT_STATUSES','RETURN_STATUSES','REFUND_STATUSES'])if(!accountApi.includes(marker))failures.push(`Account lifecycle marker missing: ${marker}`);
 forbid(accountApi,/getAccountHelpContent[^\n]*unwrap<any>/,'Help content must not return raw any payloads.');
}

const ordersUi=read('src/features/account/OrdersPanel.tsx');
if(ordersUi){
 forbid(ordersUi,/fallback:\$\{|Sipariş numarası doğrulanamadı|Ürün bilgisi doğrulanamadı|['"]Standart['"]/,'Order UI must not invent server data.');
 need(ordersUi,'typeOrdersPageData=Awaited<ReturnType<typelistOrders>>'.replace('<type','<typeof'),'Order list UI must derive its type from listOrders.');
 need(ordersUi,'typeOrderDetailData=Awaited<ReturnType<typeofgetOrderDetail>>','Order detail UI must derive its type from getOrderDetail.');
 need(ordersUi,'key={o.id}','Order rows must use validated ids.');
}

const favoritesUi=read('src/features/account/FavoritesPanel.tsx');
const favoritesApi=read('src/features/account/favoriteProductsApi.ts');
if(favoritesUi&&favoritesApi){
 forbid(favoritesUi,/useState<any\[\]>|favorite-\$\{/,'Favorites UI must not use raw any or synthetic identities.');
 match(favoritesUi,/FavoriteProductItem/,'Favorites UI must use the dedicated strict product contract.');
 need(favoritesUi,'useState<FavoriteProductItem[]|null>','Favorite state must be strongly typed.');
 need(favoritesUi,'key={item.productId}','Favorite cards must use validated product ids.');
 need(favoritesUi,'awaitremoveFavoriteProduct(item.slug)','Favorite removal must use the canonical mutation API.');
 match(favoritesApi,/function normalize\([^)]*\):FavoriteProductItem/,'Favorite API must normalize each row.');
 need(favoritesApi,'returndata.map(normalize)','Favorite list must pass through the strict normalizer.');
 need(favoritesApi,"typeofdata.isFavorite!=='boolean'||data.isFavorite!==false",'Favorite removal must verify explicit false server state.');
}

const followedUi=read('src/features/account/FollowedProducersPanel.tsx');
const followedApi=read('src/features/account/followedProducersApi.ts');
if(followedUi&&followedApi){
 forbid(followedUi,/useState<any\[\]>|producer['"]\}-\$\{index/,'Followed-store UI must not use raw any or synthetic identities.');
 match(followedUi,/FollowedProducerStoreItem/,'Followed-store UI must use the dedicated strict store contract.');
 need(followedUi,'useState<FollowedProducerStoreItem[]|null>','Followed-store state must be strongly typed.');
 need(followedUi,'key={p.id}','Followed-store cards must use validated ids.');
 need(followedUi,'awaitunfollowProducerStore(producer.id)','Unfollow must use the canonical mutation API.');
 match(followedApi,/function normalize\([^)]*\):FollowedProducerStoreItem/,'Followed-store API must normalize each row.');
 need(followedApi,'returndata.map(normalize)','Followed-store list must pass through the strict normalizer.');
 need(followedApi,"uuid(data.producerId,'Üreticikimliği')!==id||data.following!==false",'Unfollow must verify producer identity and explicit false state.');
}

const supportUi=read('src/features/account/SupportPanel.tsx');
if(supportUi){
 forbid(supportUi,/function publishedItem\(|useState<any>/,'Support UI must not create a second raw help-content normalizer.');
 match(supportUi,/AccountHelpContent/,'Support UI must use AccountHelpContent.');
 need(supportUi,'setData(awaitgetAccountHelpContent(locale))','Support UI must consume canonical help content directly.');
 match(supportUi,/Geçici veya uydurma hukuki metin gösterilmiyor/,'Support UI must fail closed instead of inventing legal copy.');
}

const notificationUi=read('src/features/account/NotificationsPanel.tsx');
if(notificationUi){forbid(notificationUi,/Başlıksız bildirim|Bildirim içeriği doğrulanamadı|fallback:\$\{/,'Notification UI must not invent content or ids.');match(notificationUi,/AccountNotification,NotificationsPage/,'Notification UI must use strict notification types.');}
const paymentUi=read('src/features/account/PaymentsPanel.tsx');
if(paymentUi){forbid(paymentUi,/fallback:\$\{|processedAt|Sipariş numarası doğrulanamadı|Tutar doğrulanamadı/,'Payment UI must not invent or re-normalize server data.');match(paymentUi,/PaymentActivityItem,PaymentActivityPage/,'Payment UI must use strict payment types.');}
const giftUi=read('src/features/account/GiftsPanel.tsx');
if(giftUi){forbid(giftUi,/useState<any\[\]>|fallback:\$\{|Alıcı bilgisi doğrulanamadı|Sipariş numarası doğrulanamadı/,'Gift UI must not invent server data.');need(giftUi,'useState<GiftOrder[]|null>','Gift state must remain strongly typed.');}
const settingsUi=read('src/features/account/SettingsPanel.tsx');
if(settingsUi){forbid(settingsUi,/function normalizeNewsletter\(/,'Settings UI must not create a second newsletter normalizer.');forbid(settingsUi,/under_review|approved|scheduled/,'Closure UI must not invent lifecycle states.');if(!settingsUi.includes('bounced')||!settingsUi.includes('complained'))failures.push('Settings must preserve bounced and complained newsletter states.');}
const profileUi=read('src/features/account/ProfilePanel.tsx');
if(profileUi){match(profileUi,/phoneDigits\.length < 10 \|\| phoneDigits\.length > 15/,'Profile phone validation must match backend constraints.');forbid(profileUi,/5-20 rakam|5 ile 20 rakam/,'Retired phone rule must not return.');}
const addressUi=read('src/features/account/AddressesPanel.tsx');
if(addressUi){forbid(addressUi,/Alıcı doğrulanamadı|Ülke doğrulanamadı|address-\$\{index\}/,'Address UI must not invent server data or ids.');match(addressUi,/phoneDigits\.length < 10 \|\| phoneDigits\.length > 15/,'Address phone validation must match backend constraints.');match(addressUi,/line\.length < 10 \|\| line\.length > 1000/,'Address line validation must match backend constraints.');}

const categoryApi=read('src/admin/categoryAdminApi.ts');
if(categoryApi){forbid(categoryApi,/İsimsiz kategori|Array\.isArray\(rows\)\s*\?\s*rows\s*:\s*\[\]/,'Category API must fail closed.');match(categoryApi,/rows\.map\(normalizeCategory\)/,'Category rows must be normalized.');}
const eventApi=read('src/admin/eventAdminApi.ts');
if(eventApi){forbid(eventApi,/İsimsiz etkinlik|['"]Misafir['"]/,'Event API must not invent names.');match(eventApi,/events:\s*raw\.events\.map\(normalizeEvent\)/,'Event rows must be normalized.');match(eventApi,/reservations:\s*raw\.reservations\.map\(normalizeReservation\)/,'Event reservations must be normalized.');}
const returnApi=read('src/admin/returnAdminApi.ts');
if(returnApi){forbid(returnApi,/['"]Müşteri['"]|['"]Ürün['"]|\|\|\s*['"]TRY['"]/,'Return API must not invent user, product, or currency data.');match(returnApi,/currencyCode\(value\.currency\)/,'Return currency must be validated.');match(returnApi,/parsed\.protocol\s*!==\s*['"]https:['"]/,'Return evidence preview must remain HTTPS-only.');}
const inventoryApi=read('src/admin/inventoryAdminApi.ts');
if(inventoryApi){forbid(inventoryApi,/Standart|İsimsiz ürün|Bilinmeyen üretici|\|\|\s*['"]TRY['"]/,'Inventory API must not invent server data.');match(inventoryApi,/pending['"],\s*['"]active['"],\s*['"]suspended['"],\s*['"]rejected['"],\s*['"]closed/,'Inventory producer status contract must preserve the full lifecycle.');match(inventoryApi,/sellable\s*!==\s*expectedSellable/,'Inventory arithmetic validation must remain intact.');}
const producerApi=read('src/admin/producerAdminApi.ts');
if(producerApi){forbid(producerApi,/İsimsiz mağaza/,'Producer API must not invent store names.');match(producerApi,/pending['"],\s*['"]active['"],\s*['"]suspended['"],\s*['"]rejected['"],\s*['"]closed/,'Producer status contract must preserve the full lifecycle.');match(producerApi,/producerStatus\(value\.status\)/,'Producer server status must be validated.');}

const applicationApi=read('src/admin/producerApplicationAdminApi.ts');
if(applicationApi){
 forbid(applicationApi,/İsimsiz mağaza|verification_status[^\n]*\|\|\s*['"]pending['"]/,'Producer application API must not invent store names or document state.');
 match(applicationApi,/production_village_is_custom/,'Producer application contract must preserve village provenance.');
 need(applicationApi,'normalizeSensitive(unwrap<unknown>(data,error),id)','Sensitive KYC responses must pass through the strict normalizer.');
 match(applicationApi,/result\s*!==\s*true/,'Producer document review result must be explicitly verified.');
}
const applicationUi=read('src/admin/AdminVendorApplications.tsx');
if(applicationUi){match(applicationUi,/production_village_is_custom/,'Admin application UI must preserve village provenance.');match(applicationUi,/Köy kayıt biçimi/,'Admin application UI must visibly expose village provenance.');match(applicationUi,/expired:\s*['"]Süresi doldu['"]/,'Expired documents must be labeled truthfully.');}
const producerDocumentApi=read('src/admin/producerDocumentApi.ts');
if(producerDocumentApi){match(producerDocumentApi,/parsed\.protocol\s*!==\s*['"]https:['"]/,'Producer document preview must remain HTTPS-only.');match(producerDocumentApi,/producer-documents/,'Producer document preview must stay on the private bucket.');}

const inventoryMigration=read('supabase/migrations/20260819055042_fix_admin_inventory_variant_filter.sql');
if(inventoryMigration){forbid(inventoryMigration,/variant\.deleted_at/,'Inventory RPC must not reference nonexistent product_variants.deleted_at.');match(inventoryMigration,/from public\.product_variants variant/,'Inventory RPC must use canonical product_variants.');}
const locationMigration=read('supabase/migrations/20260819055617_extend_admin_producer_application_location_snapshot.sql');
if(locationMigration){for(const marker of['production_country_code','production_province','production_district','production_village'])if(!locationMigration.includes(marker))failures.push(`Producer application location snapshot missing ${marker}.`);}

if(failures.length){console.error('Golden Oremar admin data contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar admin data contract audit passed: account, commerce, dedicated favorite/followed-store, support/legal, notification, payment, order, producer, KYC, village provenance, inventory and private-document boundaries remain strict and fail-closed.');
