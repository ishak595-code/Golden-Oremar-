import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function requireFile(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required data contract file is missing: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function compact(value){return value.replace(/\s+/g,'');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}
function requireCompact(content,needle,message){if(!compact(content).includes(needle))failures.push(message);}

if(fs.existsSync(path.join(root,'backend')))failures.push('Retired backend/ migration mirror must not return; Supabase migrations belong under supabase/migrations/.');

for(const relative of[
 'supabase/migrations/20260816062936_add_my_product_batch_editor_v1.sql',
 'supabase/migrations/20260816120247_add_atomic_customer_return_evidence_v3.sql',
 'supabase/migrations/20260816120431_complete_return_options_and_admin_evidence_detail.sql',
 'supabase/migrations/20260816123842_add_public_producer_product_inventory_truth.sql',
 'supabase/migrations/20260816125511_add_secure_producer_order_fulfillment_v1.sql',
 'supabase/migrations/20260816185944_fix_public_storefront_brand_name_v1.sql',
 'supabase/migrations/20260819055042_fix_admin_inventory_variant_filter.sql',
 'supabase/migrations/20260819055617_extend_admin_producer_application_location_snapshot.sql',
])requireFile(relative);

const accountApi=requireFile('src/features/account/api.ts');
if(accountApi){
 requirePattern(accountApi,/customer['"],\s*['"]producer['"],\s*['"]support['"],\s*['"]content_editor['"],\s*['"]operations['"],\s*['"]admin['"],\s*['"]super_admin/,'Customer account role contract must preserve the full live role lifecycle.');
 forbid(accountApi,/ACCOUNT_ROLES[^\n]*(?:['"]user['"]|['"]vendor['"])/,'Customer account API must not reintroduce retired user/vendor role aliases.');
 for(const[needle,message]of[
  ['returnnormalizeAccountOverview(unwrap<unknown>(data,error))','Account overview must pass through the canonical strict normalizer.'],
  ['returnnormalizeProfileUpdate(unwrap<unknown>(data,error),expected)','Profile mutations must verify the server result.'],
  ['constnormalized=normalizeAddressInput(address)','Address mutations must validate request data.'],
  ['constresult=normalizeAddress(unwrap<unknown>(data,error),0)','Address mutations must validate the returned canonical address.'],
  ['returnnormalizeOrdersPage(unwrap<unknown>(data,error))','Customer order list must remain strictly normalized.'],
  ['returnnormalizeOrderDetail(unwrap<unknown>(data,error))','Customer order detail must remain strictly normalized.'],
  ['returnnormalizeGiftOrders(unwrap<unknown>(data,error))','Gift orders must remain strictly normalized.'],
  ['returnnormalizePaymentActivity(unwrap<unknown>(data,error))','Payment activity must remain strictly normalized.'],
  ['returnnormalizeNotifications(unwrap<unknown>(data,error))','Notification list must remain strictly normalized.'],
  ['returnnormalizeClosureRequest(unwrap<unknown>(data,error))','Account closure requests must validate the server result.'],
  ['returnnormalizeClosureCancel(unwrap<unknown>(data,error))','Account closure cancellation must validate the server result.'],
  ['returnnormalizeNewsletterSummary(unwrap<unknown>(data,error))','Newsletter status must use the canonical strict normalizer.'],
  ['returnnormalizePushRegistration(unwrap<unknown>(data,error),input)','Native push registration must verify the server result.'],
  ['returnnormalizeHelpContent(unwrap<unknown>(data,error))','Account help content must use the strict published-content normalizer.'],
 ])requireCompact(accountApi,needle,message);
 requirePattern(accountApi,/lineTotalMinor!==unitPriceMinor\*quantity-itemDiscount\+itemTax/,'Order item totals must remain arithmetically verified.');
 for(const marker of['ORDER_ITEM_FULFILLMENT_STATUSES','SHIPMENT_STATUSES','RETURN_STATUSES','REFUND_STATUSES'])if(!accountApi.includes(marker))failures.push(`Account API lifecycle marker missing: ${marker}`);
 requirePattern(accountApi,/bounced['"],\s*['"]complained/,'Newsletter contract must preserve bounced and complained lifecycle states.');
 forbid(accountApi,/getAccountHelpContent[^\n]*unwrap<any>/,'Account help content must not return raw any payloads.');
}

const accountCenter=requireFile('src/features/account/AccountCenter.tsx');
if(accountCenter){forbid(accountCenter,/function normalizeOverview\(/,'AccountCenter must not create a second account overview normalizer.');forbid(accountCenter,/['"]vendor['"]/,'AccountCenter must not reintroduce retired vendor role aliases.');requireCompact(accountCenter,'constnext=awaitgetAccountOverview();setOverview(next)','AccountCenter must consume the canonical account API result directly.');requireCompact(accountCenter,'constroles=overview.roles','AccountCenter authorization UI must use the validated server role set directly.');}

const notificationUi=requireFile('src/features/account/NotificationsPanel.tsx');
if(notificationUi){forbid(notificationUi,/Başlıksız bildirim|Bildirim içeriği doğrulanamadı|fallback:\$\{/,'Notification UI must not invent notification content or identities.');requirePattern(notificationUi,/AccountNotification,NotificationsPage/,'Notification UI must consume strict notification types.');requireCompact(notificationUi,'constreadAt=awaitmarkNotificationRead(item.id)','Notification UI must use the server-returned read timestamp.');}

const paymentUi=requireFile('src/features/account/PaymentsPanel.tsx');
if(paymentUi){forbid(paymentUi,/fallback:\$\{|processedAt|Sipariş numarası doğrulanamadı|Tutar doğrulanamadı/,'Payment history must not invent or re-normalize strict data.');requirePattern(paymentUi,/PaymentActivityItem,PaymentActivityPage/,'Payment history UI must consume strict payment types.');requireCompact(paymentUi,'useState<PaymentActivityPage|null>','Payment history state must keep the strict page type.');requireCompact(paymentUi,'newMap<string,PaymentActivityItem>()','Payment pagination must deduplicate by validated ids.');requireCompact(paymentUi,'key={p.id}','Payment rows must use validated ids.');}

const orderUi=requireFile('src/features/account/OrdersPanel.tsx');
if(orderUi){forbid(orderUi,/fallback:\$\{|Sipariş numarası doğrulanamadı|Ürün bilgisi doğrulanamadı|['"]Standart['"]/,'Order UI must not invent identities or server data.');requireCompact(orderUi,'typeOrdersPageData=Awaited<ReturnType<typelistOrders>>','Order UI must derive its page type from the canonical API.');requireCompact(orderUi,'typeOrderDetailData=Awaited<ReturnType<typeofgetOrderDetail>>','Order detail UI must derive its type from the canonical API.');requirePattern(orderUi,/unpaid:['"]Ödenmedi['"]/,'Order UI must preserve the live payment lifecycle.');requireCompact(orderUi,'key={o.id}','Order rows must use validated order ids.');}

const favoritesUi=requireFile('src/features/account/FavoritesPanel.tsx');
const favoritesApi=requireFile('src/features/account/favoriteProductsApi.ts');
if(favoritesUi&&favoritesApi){
 forbid(favoritesUi,/useState<any\[\]>|Fiyat doğrulanamadı|favorite-\$\{/,'Favorites UI must not rebuild strict product truth with any or synthetic identities.');
 requirePattern(favoritesUi,/FavoriteProductItem/,'Favorites UI must consume the dedicated strict FavoriteProductItem contract.');
 requireCompact(favoritesUi,'useState<FavoriteProductItem[]|null>','Favorites state must keep the dedicated strict type.');
 requireCompact(favoritesUi,'key={item.productId}','Favorite cards must use the validated product id directly.');
 requireCompact(favoritesUi,'awaitremoveFavoriteProduct(item.slug)','Favorites UI must use the canonical mutation API.');
 requirePattern(favoritesApi,/function normalize\([^)]*\):FavoriteProductItem/,'Favorite API must strictly normalize each product.');
 requireCompact(favoritesApi,'returndata.map(normalize)','Favorite list must pass every row through the strict normalizer.');
 requireCompact(favoritesApi,"typeofdata.isFavorite!=='boolean'||data.isFavorite!==false",'Favorite removal must reject any server result that is not explicitly unfavorited.');
}

const followedUi=requireFile('src/features/account/FollowedProducersPanel.tsx');
const followedApi=requireFile('src/features/account/followedProducersApi.ts');
if(followedUi&&followedApi){
 forbid(followedUi,/useState<any\[\]>|Puan bilgisi doğrulanamadı|producer['"]\}-\$\{index/,'Followed producer UI must not invent identities or rating data.');
 requirePattern(followedUi,/FollowedProducerStoreItem/,'Followed producer UI must consume the dedicated strict store contract.');
 requireCompact(followedUi,'useState<FollowedProducerStoreItem[]|null>','Followed producer state must keep the dedicated strict type.');
 requireCompact(followedUi,'key={p.id}','Followed producer cards must use the validated producer id.');
 requireCompact(followedUi,'awaitunfollowProducerStore(producer.id)','Followed producer UI must use the canonical mutation API.');
 requirePattern(followedApi,/function normalize\([^)]*\):FollowedProducerStoreItem/,'Followed producer API must strictly normalize every store.');
 requireCompact(followedApi,'returndata.map(normalize)','Followed producer list must pass every row through the strict normalizer.');
 requireCompact(followedApi,"uuid(data.producerId,'Üreticikimliği')!==id||data.following!==false",'Unfollow must verify producer identity and an explicit false following result.');
}

const giftUi=requireFile('src/features/account/GiftsPanel.tsx');
if(giftUi){forbid(giftUi,/useState<any\[\]>|fallback:\$\{|Alıcı bilgisi doğrulanamadı|Sipariş numarası doğrulanamadı|['"]Standart['"]/,'Gift UI must not invent gift data.');requireCompact(giftUi,'useState<GiftOrder[]|null>','Gift UI must consume the strict GiftOrder contract.');requireCompact(giftUi,'key={g.orderId}','Gift cards must use the validated order id.');}

const settingsUi=requireFile('src/features/account/SettingsPanel.tsx');
if(settingsUi){forbid(settingsUi,/function normalizeNewsletter\(/,'Settings UI must not create a second newsletter normalizer.');forbid(settingsUi,/under_review|approved|scheduled/,'Account closure UI must not invent lifecycle states.');requirePattern(settingsUi,/requested['"],\s*['"]processing['"],\s*['"]ready_for_auth_deletion/,'Settings must preserve the live account-closure lifecycle.');if(!settingsUi.includes('bounced')||!settingsUi.includes('complained'))failures.push('Settings must expose bounced and complained newsletter states.');}

const profileUi=requireFile('src/features/account/ProfilePanel.tsx');
if(profileUi){requirePattern(profileUi,/phoneDigits\.length < 10 \|\| phoneDigits\.length > 15/,'Profile phone validation must match the live backend constraint.');forbid(profileUi,/5-20 rakam|5 ile 20 rakam/,'Profile UI must not reintroduce the retired phone rule.');requireCompact(profileUi,'setLocale(p.locale)','Profile locale must come from the validated profile.');}

const addressUi=requireFile('src/features/account/AddressesPanel.tsx');
if(addressUi){forbid(addressUi,/Alıcı doğrulanamadı|Ülke doğrulanamadı|address-\$\{index\}/,'Address UI must not invent server data or synthetic identities.');requirePattern(addressUi,/phoneDigits\.length < 10 \|\| phoneDigits\.length > 15/,'Address phone validation must match the live backend constraint.');requirePattern(addressUi,/line\.length < 10 \|\| line\.length > 1000/,'Address line validation must match the live backend constraint.');requirePattern(addressUi,/postal\.length > 20/,'Address postal-code validation must match the live backend limit.');requireCompact(addressUi,'key={a.id}','Saved address rows must use validated ids.');}

const supportUi=requireFile('src/features/account/SupportPanel.tsx');
if(supportUi){forbid(supportUi,/function publishedItem\(|useState<any>/,'Support UI must not create a second raw help-content normalizer.');requirePattern(supportUi,/AccountHelpContent/,'Support UI must consume strict AccountHelpContent.');requireCompact(supportUi,'setData(awaitgetAccountHelpContent(locale))','Support UI must consume canonical published help content directly.');requirePattern(supportUi,/Geçici veya uydurma hukuki metin gösterilmiyor/,'Support UI must remain fail-closed when legal copy is unavailable.');}

const nativePush=requireFile('src/features/notifications/nativePush.ts');
if(nativePush){forbid(nativePush,/String\(registered\?\.id\s*\|\|\s*['"]['"]\)/,'Native push adapter must not re-normalize a strict registration id.');requirePattern(nativePush,/const deviceId = registered\.id;/,'Native push adapter must consume the validated registration id directly.');}

const categoryApi=requireFile('src/admin/categoryAdminApi.ts');
if(categoryApi){forbid(categoryApi,/İsimsiz kategori|Array\.isArray\(rows\)\s*\?\s*rows\s*:\s*\[\]/,'Category API must fail closed instead of inventing or hiding malformed data.');requirePattern(categoryApi,/rows\.map\(normalizeCategory\)/,'Category list must use the strict normalizer.');requirePattern(categoryApi,/result\s*!==\s*true/,'Category archive result must be explicitly verified.');}

const eventApi=requireFile('src/admin/eventAdminApi.ts');
if(eventApi){forbid(eventApi,/İsimsiz etkinlik|['"]Misafir['"]/,'Event API must not invent event or guest names.');forbid(eventApi,/reservation_code[^\n]*(?:\|\||\?)[^\n]*\.id/,'Reservation code must not fall back to a record id.');requirePattern(eventApi,/events:\s*raw\.events\.map\(normalizeEvent\)/,'Event list must use the strict event normalizer.');requirePattern(eventApi,/reservations:\s*raw\.reservations\.map\(normalizeReservation\)/,'Event reservations must use the strict normalizer.');}

const returnApi=requireFile('src/admin/returnAdminApi.ts');
if(returnApi){forbid(returnApi,/['"]Müşteri['"]|['"]Ürün['"]|\|\|\s*['"]TRY['"]/,'Return API must not invent customer, product, or currency data.');requirePattern(returnApi,/currencyCode\(value\.currency\)/,'Return currency must remain validated.');requirePattern(returnApi,/parsed\.protocol\s*!==\s*['"]https:['"]/,'Return evidence preview URLs must remain HTTPS-only.');}

const inventoryApi=requireFile('src/admin/inventoryAdminApi.ts');
if(inventoryApi){forbid(inventoryApi,/Standart|İsimsiz ürün|Bilinmeyen üretici|\|\|\s*['"]TRY['"]/,'Inventory API must not invent variant, product, producer, or currency data.');requirePattern(inventoryApi,/pending['"],\s*['"]active['"],\s*['"]suspended['"],\s*['"]rejected['"],\s*['"]closed/,'Inventory producer status contract must preserve the full lifecycle.');requirePattern(inventoryApi,/sellable\s*!==\s*expectedSellable/,'Inventory summary must retain sellable-stock arithmetic validation.');requirePattern(inventoryApi,/rows\.map\(normalizeRow\)/,'Inventory list must use the strict normalizer.');}

const producerApi=requireFile('src/admin/producerAdminApi.ts');
if(producerApi){forbid(producerApi,/İsimsiz mağaza/,'Producer API must not invent store names.');forbid(producerApi,/row\.status\s*===\s*['"]suspended['"]\s*\?\s*['"]suspended['"]\s*:\s*['"]active['"]/,'Producer API must not collapse lifecycle states.');requirePattern(producerApi,/pending['"],\s*['"]active['"],\s*['"]suspended['"],\s*['"]rejected['"],\s*['"]closed/,'Producer status contract must preserve the full lifecycle.');requirePattern(producerApi,/producerStatus\(value\.status\)/,'Producer rows must validate server status.');}

const producerApplicationApi=requireFile('src/admin/producerApplicationAdminApi.ts');
if(producerApplicationApi){const c=compact(producerApplicationApi);forbid(producerApplicationApi,/İsimsiz mağaza|verification_status[^\n]*\|\|\s*['"]pending['"]/,'Producer application API must not invent a store name or document status.');requirePattern(producerApplicationApi,/expired['"]?\]/,'Producer document contract must preserve expired state.');requirePattern(producerApplicationApi,/production_village_is_custom/,'Producer application contract must preserve structured village provenance.');if(!c.includes('normalizesensitive(unwrap<unknown>(data,error),id)'))failures.push('Sensitive producer KYC responses must remain strictly normalized.');requirePattern(producerApplicationApi,/result\s*!==\s*true/,'Producer document review result must remain explicitly verified.');}

const producerDocumentApi=requireFile('src/admin/producerDocumentApi.ts');
if(producerDocumentApi){requirePattern(producerDocumentApi,/parsed\.protocol\s*!==\s*['"]https:['"]/,'Producer document preview URLs must remain HTTPS-only.');requirePattern(producerDocumentApi,/producer-documents/,'Producer document preview must stay on the private bucket.');}

const producerUi=requireFile('src/admin/AdminVendors.tsx');
if(producerUi){for(const value of['pending','rejected','closed'])requirePattern(producerUi,new RegExp(`option value=["']${value}["']`),`Producer status filter must expose ${value} records.`);requirePattern(producerUi,/selected\.status\s*===\s*['"]suspended['"]\s*\?/,'Only suspended producers may receive the direct reactivate action.');}

const applicationUi=requireFile('src/admin/AdminVendorApplications.tsx');
if(applicationUi){requirePattern(applicationUi,/expired:\s*['"]Süresi doldu['"]/,'Expired producer documents must be labeled as expired.');requirePattern(applicationUi,/production_village_is_custom/,'Producer application UI must expose village-name provenance.');requirePattern(applicationUi,/Köy kayıt biçimi/,'Producer application UI must make village provenance visible to reviewers.');requirePattern(applicationUi,/option value="draft"/,'Producer application filters must include drafts.');}

const inventoryMigration=requireFile('supabase/migrations/20260819055042_fix_admin_inventory_variant_filter.sql');
if(inventoryMigration){forbid(inventoryMigration,/variant\.deleted_at/,'Inventory RPC migration must not reference nonexistent product_variants.deleted_at.');requirePattern(inventoryMigration,/from public\.product_variants variant/,'Inventory RPC migration must read canonical product_variants.');}
const applicationLocationMigration=requireFile('supabase/migrations/20260819055617_extend_admin_producer_application_location_snapshot.sql');
if(applicationLocationMigration){for(const marker of['production_country_code','production_province','production_district','production_village'])if(!applicationLocationMigration.includes(marker))failures.push(`Producer application admin snapshot missing ${marker}.`);}

if(failures.length){console.error('Golden Oremar admin data contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar data contract audit passed: customer account, support, notification, payment, order, dedicated favorite/followed-store, gift, newsletter, closure, native-push, category, event, return, inventory, producer, KYC, village provenance and private-document contracts remain strict and fail-closed.');
