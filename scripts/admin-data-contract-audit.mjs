import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function requireFile(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`Required admin contract file is missing: ${relative}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function forbid(content, pattern, message) {
  if (pattern.test(content)) failures.push(message);
}

function requirePattern(content, pattern, message) {
  if (!pattern.test(content)) failures.push(message);
}

if (fs.existsSync(path.join(root, 'backend'))) {
  failures.push('Retired backend/ migration mirror must not return; Supabase migrations belong under supabase/migrations/.');
}

const consolidatedMigrationFiles = [
  'supabase/migrations/20260816062936_add_my_product_batch_editor_v1.sql',
  'supabase/migrations/20260816120247_add_atomic_customer_return_evidence_v3.sql',
  'supabase/migrations/20260816120431_complete_return_options_and_admin_evidence_detail.sql',
  'supabase/migrations/20260816123842_add_public_producer_product_inventory_truth.sql',
  'supabase/migrations/20260816125511_add_secure_producer_order_fulfillment_v1.sql',
  'supabase/migrations/20260816185944_fix_public_storefront_brand_name_v1.sql',
];
for (const relative of consolidatedMigrationFiles) requireFile(relative);

const accountApi = requireFile('src/features/account/api.ts');
if (accountApi) {
  requirePattern(accountApi, /customer['"],\s*['"]producer['"],\s*['"]support['"],\s*['"]content_editor['"],\s*['"]operations['"],\s*['"]admin['"],\s*['"]super_admin/, 'Customer account role contract must preserve the full live role lifecycle.');
  forbid(accountApi, /ACCOUNT_ROLES[^\n]*(?:['"]user['"]|['"]vendor['"])/, 'Customer account API must not reintroduce retired user/vendor role aliases.');
  requirePattern(accountApi, /return normalizeAccountOverview\(unwrap<unknown>\(data,error\)\)/, 'Account overview must pass through the canonical strict normalizer.');
  requirePattern(accountApi, /return normalizeOrdersPage\(unwrap<unknown>\(data,error\)\)/, 'Customer order list must remain strictly normalized.');
  requirePattern(accountApi, /return normalizeOrderDetail\(unwrap<unknown>\(data,error\)\)/, 'Customer order detail must remain strictly normalized.');
  requirePattern(accountApi, /return normalizeFavorites\(unwrap<unknown>\(data,error\)\)/, 'Favorites must remain strictly normalized.');
  requirePattern(accountApi, /return normalizeFollowedProducers\(unwrap<unknown>\(data,error\)\)/, 'Followed producers must remain strictly normalized.');
  requirePattern(accountApi, /return normalizeGiftOrders\(unwrap<unknown>\(data,error\)\)/, 'Gift orders must remain strictly normalized.');
  requirePattern(accountApi, /lineTotalMinor!==unitPriceMinor\*quantity-itemDiscount\+itemTax/, 'Order item totals must remain arithmetically verified at the account API boundary.');
  requirePattern(accountApi, /ORDER_ITEM_FULFILLMENT_STATUSES/, 'Order item fulfillment statuses must remain bound to the live database lifecycle.');
  requirePattern(accountApi, /SHIPMENT_STATUSES/, 'Shipment statuses must remain bound to the live database lifecycle.');
  requirePattern(accountApi, /RETURN_STATUSES/, 'Return statuses must remain bound to the live database lifecycle.');
  requirePattern(accountApi, /REFUND_STATUSES/, 'Refund statuses must remain bound to the live database lifecycle.');
  requirePattern(accountApi, /return normalizePaymentActivity\(unwrap<unknown>\(data,error\)\)/, 'Customer payment activity must remain strictly normalized.');
  requirePattern(accountApi, /return normalizeNotifications\(unwrap<unknown>\(data,error\)\)/, 'Customer notification list must remain strictly normalized.');
  requirePattern(accountApi, /return dateTime\(unwrap<unknown>\(data,error\),['"]Bildirim okunma tarihi['"]\)/, 'Notification read mutation must keep the server timestamp authoritative.');
}

const accountCenter = requireFile('src/features/account/AccountCenter.tsx');
if (accountCenter) {
  forbid(accountCenter, /function normalizeOverview\(/, 'AccountCenter must not create a second account overview normalizer.');
  forbid(accountCenter, /const accountRoles=new Set\(\[['"]user['"],['"]vendor['"]/, 'AccountCenter must not filter live roles through retired user/vendor aliases.');
  requirePattern(accountCenter, /const next=await getAccountOverview\(\);setOverview\(next\)/, 'AccountCenter must consume the canonical account API result directly.');
  requirePattern(accountCenter, /const roles=overview\.roles/, 'AccountCenter authorization UI must use the validated server role set directly.');
}

const notificationUi = requireFile('src/features/account/NotificationsPanel.tsx');
if (notificationUi) {
  forbid(notificationUi, /Başlıksız bildirim|Bildirim içeriği doğrulanamadı/, 'Notification UI must not invent missing title or message content.');
  forbid(notificationUi, /fallback:\$\{/, 'Notification UI keys must not fall back to synthetic record identities.');
  requirePattern(notificationUi, /AccountNotification,NotificationsPage/, 'Notification UI must consume strict account notification types.');
  requirePattern(notificationUi, /const readAt=await markNotificationRead\(item\.id\)/, 'Notification UI must use the server-returned read timestamp.');
}

const paymentUi = requireFile('src/features/account/PaymentsPanel.tsx');
if (paymentUi) {
  forbid(paymentUi, /fallback:\$\{/, 'Payment history keys must not fall back to synthetic record identities.');
  forbid(paymentUi, /processedAt/, 'Payment history must not read fields outside the strict payment activity contract.');
  forbid(paymentUi, /Sipariş numarası doğrulanamadı|Tutar doğrulanamadı/, 'Payment history must not invent fallback content after strict API normalization.');
  requirePattern(paymentUi, /PaymentActivityItem,PaymentActivityPage/, 'Payment history UI must consume strict payment activity types.');
  requirePattern(paymentUi, /useState<PaymentActivityPage\|null>/, 'Payment history state must keep the strict page type.');
  requirePattern(paymentUi, /new Map<string,PaymentActivityItem>\(\)/, 'Payment history pagination must deduplicate by validated payment ids.');
  requirePattern(paymentUi, /key=\{p\.id\}/, 'Payment history rows must use the validated payment id directly.');
  requirePattern(paymentUi, /<Money minor=\{p\.amountMinor\} currency=\{p\.currency\}\/>/, 'Payment history money display must use validated server amount and currency directly.');
}

const orderUi = requireFile('src/features/account/OrdersPanel.tsx');
if (orderUi) {
  forbid(orderUi, /fallback:\$\{|Sipariş numarası doğrulanamadı|Ürün bilgisi doğrulanamadı|['"]Standart['"]/, 'Order UI must not invent identities, order numbers, product names, or variant names after strict API normalization.');
  requirePattern(orderUi, /type OrdersPageData=Awaited<ReturnType<typeof listOrders>>/, 'Order UI must derive its page type from the canonical account API.');
  requirePattern(orderUi, /type OrderDetailData=Awaited<ReturnType<typeof getOrderDetail>>/, 'Order detail UI must derive its type from the canonical account API.');
  requirePattern(orderUi, /unpaid:['"]Ödenmedi['"]/, 'Order UI must use the live order payment status lifecycle rather than payment-record statuses.');
  requirePattern(orderUi, /key=\{o\.id\}/, 'Order rows must use validated order ids directly.');
  requirePattern(orderUi, /<Money minor=\{o\.totalMinor\} currency=\{o\.currency\}\/>/, 'Order list money display must use validated amount and currency directly.');
  requirePattern(orderUi, /new Map<string,OrdersPageData\['items'\]\[number\]>\(\)/, 'Order pagination must deduplicate by validated order ids.');
}

const favoritesUi = requireFile('src/features/account/FavoritesPanel.tsx');
if (favoritesUi) {
  forbid(favoritesUi, /useState<any\[\]>|Fiyat doğrulanamadı|displayName\s*=.*\|\|\s*['"]Ürün['"]|favorite-\$\{/, 'Favorites UI must not rebuild strict product truth with any or synthetic fallback data.');
  requirePattern(favoritesUi, /useState<FavoriteItem\[\] \| null>/, 'Favorites UI must consume the strict FavoriteItem contract.');
  requirePattern(favoritesUi, /key=\{i\.productId\}/, 'Favorite cards must use the validated product id directly.');
  requirePattern(favoritesUi, /if \(result\.isFavorite\) throw new Error/, 'Favorite removal must verify the server mutation result.');
}

const followedUi = requireFile('src/features/account/FollowedProducersPanel.tsx');
if (followedUi) {
  forbid(followedUi, /useState<any\[\]>|Puan bilgisi doğrulanamadı|\|\|['"]Üretici['"]|producer['"]\}-\$\{index/, 'Followed producer UI must not invent identities, names, or rating fallback data.');
  requirePattern(followedUi, /useState<FollowedProducerItem\[\]\|null>/, 'Followed producer UI must consume the strict FollowedProducerItem contract.');
  requirePattern(followedUi, /key=\{p\.id\}/, 'Followed producer cards must use the validated producer id directly.');
  requirePattern(followedUi, /if\(result\.following\)throw new Error/, 'Unfollow must verify the server mutation result.');
}

const giftUi = requireFile('src/features/account/GiftsPanel.tsx');
if (giftUi) {
  forbid(giftUi, /useState<any\[\]>|fallback:\$\{|Alıcı bilgisi doğrulanamadı|Sipariş numarası doğrulanamadı|['"]Standart['"]/, 'Gift UI must not invent gift identity, recipient, order, or variant data.');
  requirePattern(giftUi, /useState<GiftOrder\[\]\|null>/, 'Gift UI must consume the strict GiftOrder contract.');
  requirePattern(giftUi, /key=\{g\.orderId\}/, 'Gift cards must use the validated order id directly.');
  requirePattern(giftUi, /<Money minor=\{g\.totalMinor\} currency=\{g\.currency\}\/>/, 'Gift money display must use validated server amount and currency directly.');
}

const categoryApi = requireFile('src/admin/categoryAdminApi.ts');
if (categoryApi) {
  forbid(categoryApi, /İsimsiz kategori/, 'Category admin API must not invent missing category names.');
  forbid(categoryApi, /Array\.isArray\(rows\)\s*\?\s*rows\s*:\s*\[\]/, 'Category admin API must not hide malformed list payloads as an empty list.');
  requirePattern(categoryApi, /rows\.map\(normalizeCategory\)/, 'Category admin list must pass every row through the strict normalizer.');
  requirePattern(categoryApi, /result\s*!==\s*true/, 'Category archive result must remain explicitly verified.');
}

const eventApi = requireFile('src/admin/eventAdminApi.ts');
if (eventApi) {
  forbid(eventApi, /İsimsiz etkinlik|['"]Misafir['"]/, 'Event admin API must not invent event or guest names.');
  forbid(eventApi, /reservation_code[^\n]*(?:\|\||\?)[^\n]*\.id/, 'Event reservation code must not fall back to a record id.');
  requirePattern(eventApi, /events:\s*raw\.events\.map\(normalizeEvent\)/, 'Event list must use the strict event normalizer.');
  requirePattern(eventApi, /reservations:\s*raw\.reservations\.map\(normalizeReservation\)/, 'Event reservations must use the strict reservation normalizer.');
  requirePattern(eventApi, /result\s*!==\s*true/, 'Event archive and reservation cancellation results must remain explicitly verified.');
}

const returnApi = requireFile('src/admin/returnAdminApi.ts');
if (returnApi) {
  forbid(returnApi, /['"]Müşteri['"]|['"]Ürün['"]/, 'Return admin API must not invent customer or product names.');
  forbid(returnApi, /\|\|\s*['"]TRY['"]/, 'Return admin API must not invent TRY when currency is missing.');
  requirePattern(returnApi, /currencyCode\(value\.currency\)/, 'Return list currency must remain validated at the API boundary.');
  requirePattern(returnApi, /return normalizeDetail\(unwrap<unknown>\(data, error\)\)/, 'Return detail must remain strictly normalized.');
  requirePattern(returnApi, /normalizeMutationResult\(unwrap<unknown>\(data, error\), input\.status\)/, 'Return mutation responses must remain bound to the requested status.');
  requirePattern(returnApi, /parsed\.protocol\s*!==\s*['"]https:['"]/, 'Return evidence preview URLs must remain HTTPS-only.');
}

const inventoryApi = requireFile('src/admin/inventoryAdminApi.ts');
if (inventoryApi) {
  forbid(inventoryApi, /Standart|İsimsiz ürün|Bilinmeyen üretici/, 'Inventory admin API must not invent variant, product, or producer names.');
  forbid(inventoryApi, /\|\|\s*['"]TRY['"]/, 'Inventory admin API must not invent TRY when currency is missing.');
  requirePattern(inventoryApi, /pending['"],\s*['"]active['"],\s*['"]suspended['"],\s*['"]rejected['"],\s*['"]closed/, 'Inventory producer status contract must include the full live lifecycle.');
  requirePattern(inventoryApi, /sellable\s*!==\s*expectedSellable/, 'Inventory summary must retain sellable-stock arithmetic validation.');
  requirePattern(inventoryApi, /rows\.map\(normalizeRow\)/, 'Inventory list must pass every row through the strict normalizer.');
}

const producerApi = requireFile('src/admin/producerAdminApi.ts');
if (producerApi) {
  forbid(producerApi, /İsimsiz mağaza/, 'Producer admin API must not invent missing store names.');
  forbid(producerApi, /row\.status\s*===\s*['"]suspended['"]\s*\?\s*['"]suspended['"]\s*:\s*['"]active['"]/, 'Producer admin API must not collapse lifecycle statuses into active.');
  requirePattern(producerApi, /pending['"],\s*['"]active['"],\s*['"]suspended['"],\s*['"]rejected['"],\s*['"]closed/, 'Producer admin status contract must include the full live lifecycle.');
  requirePattern(producerApi, /producerStatus\(value\.status\)/, 'Producer rows must validate the server status instead of defaulting it.');
  requirePattern(producerApi, /commissionBasisPoints[^\n]*!==\s*basisPoints|integer\(result\.commissionBasisPoints/, 'Producer commission mutation must verify the returned basis points.');
}

const producerApplicationApi = requireFile('src/admin/producerApplicationAdminApi.ts');
if (producerApplicationApi) {
  forbid(producerApplicationApi, /İsimsiz mağaza/, 'Producer application API must not invent a store name.');
  forbid(producerApplicationApi, /verification_status[^\n]*\|\|\s*['"]pending['"]/, 'Producer documents must not default missing verification status to pending.');
  requirePattern(producerApplicationApi, /expired['"]?\]/, 'Producer document contract must preserve expired verification state.');
  requirePattern(producerApplicationApi, /production_village_is_custom/, 'Producer application contract must preserve structured village provenance.');
  requirePattern(producerApplicationApi, /normalizeSensitive\(unwrap<unknown>\(data, error\), id\)/, 'Sensitive producer KYC responses must remain strictly normalized.');
  requirePattern(producerApplicationApi, /result\s*!==\s*true/, 'Producer document review result must remain explicitly verified.');
}

const producerDocumentApi = requireFile('src/admin/producerDocumentApi.ts');
if (producerDocumentApi) {
  requirePattern(producerDocumentApi, /parsed\.protocol\s*!==\s*['"]https:['"]/, 'Producer document preview URLs must remain HTTPS-only.');
  requirePattern(producerDocumentApi, /producer-documents/, 'Producer document preview must stay on the private producer-documents bucket.');
}

const producerUi = requireFile('src/admin/AdminVendors.tsx');
if (producerUi) {
  requirePattern(producerUi, /option value="pending"/, 'Producer status filter must expose pending records truthfully.');
  requirePattern(producerUi, /option value="rejected"/, 'Producer status filter must expose rejected records truthfully.');
  requirePattern(producerUi, /option value="closed"/, 'Producer status filter must expose closed records truthfully.');
  requirePattern(producerUi, /selected\.status\s*===\s*['"]suspended['"]\s*\?/, 'Only suspended producers may receive the direct reactivate action.');
}

const applicationUi = requireFile('src/admin/AdminVendorApplications.tsx');
if (applicationUi) {
  requirePattern(applicationUi, /expired:\s*['"]Süresi doldu['"]/, 'Expired producer documents must be labeled as expired, not pending.');
  requirePattern(applicationUi, /production_village_is_custom/, 'Producer application UI must expose whether the village name was entered manually.');
  requirePattern(applicationUi, /option value="draft"/, 'Producer application filters must include draft applications.');
}

const inventoryMigration = requireFile('supabase/migrations/20260819055042_fix_admin_inventory_variant_filter.sql');
if (inventoryMigration) {
  forbid(inventoryMigration, /variant\.deleted_at/, 'Inventory RPC migration must not reference the nonexistent product_variants.deleted_at column.');
  requirePattern(inventoryMigration, /from public\.product_variants variant/, 'Inventory RPC migration must read the canonical product_variants table.');
}

const applicationLocationMigration = requireFile('supabase/migrations/20260819055617_extend_admin_producer_application_location_snapshot.sql');
if (applicationLocationMigration) {
  requirePattern(applicationLocationMigration, /production_country_code/, 'Producer application admin snapshot must include country code.');
  requirePattern(applicationLocationMigration, /production_province/, 'Producer application admin snapshot must include province.');
  requirePattern(applicationLocationMigration, /production_district/, 'Producer application admin snapshot must include district.');
  requirePattern(applicationLocationMigration, /production_village/, 'Producer application admin snapshot must include village.');
}

if (failures.length) {
  console.error('Golden Oremar admin data contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Golden Oremar data contract audit passed: canonical customer account, notification, payment, order, favorite, followed-producer, gift, migration, category, event, return, inventory, producer, producer-application and private document contracts remain fail-closed.');