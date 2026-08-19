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

console.log('Golden Oremar admin data contract audit passed: category, event, return, inventory, producer, producer-application and private document contracts remain fail-closed.');
