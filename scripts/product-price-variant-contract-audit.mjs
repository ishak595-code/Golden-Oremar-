import fs from'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260903205000_add_product_price_variant_management_v1.sql','utf8');
const api=fs.readFileSync('src/admin/productCommerceAdminApi.ts','utf8');
const manager=fs.readFileSync('src/admin/AdminProductCommerceManager.tsx','utf8');
const editor=fs.readFileSync('src/admin/ProductPriceVariantEditor.tsx','utf8');

const checks=[
 ['server save RPC',migration.includes('management_save_product_price_variants_v1')],
 ['published pricing approval gate',migration.includes("product_row.status='published'")&&migration.includes('permission_required:product.approve')],
 ['stale edit protection',migration.includes('stale_product_price_variant')&&migration.includes("errcode='40001'")],
 ['one active default server invariant',migration.includes('exactly_one_active_default_product_price_variant_required')],
 ['default price drives product price',migration.includes('set base_price_minor=default_price')],
 ['omitted variants deactivate rather than delete',migration.includes('set is_active=false,is_default=false')&&!migration.includes('delete from public.product_variants')],
 ['new variants receive inventory rows',migration.includes('insert into public.product_inventory')],
 ['editor payload exposes variants',migration.includes("'variants',private.product_price_variants_payload_v1")],
 ['live price permission surfaced',migration.includes("'canManageLivePricing'")],
 ['client RPC uses canonical server save',api.includes("supabase.rpc('management_save_product_price_variants_v1'")],
 ['client enforces one active default',api.includes('rows.filter(row=>row.active&&row.default).length!==1')],
 ['admin renders price variant editor',manager.includes('<ProductPriceVariantEditor')],
 ['admin has explicit variant save',manager.includes('saveProductPriceVariants')&&manager.includes('Fiyat ve paket varyantlarını kaydet')],
 ['UI separates price variants from prep choices',editor.includes('Fiyatı değiştiren gramaj ve paket seçenekleri')],
 ['existing variants deactivate instead of client deletion',editor.includes("if(!row.id)")&&editor.includes("patch(index,{active:false,default:false})")],
];
for(const[label,ok]of checks)if(!ok){console.error(`Product price variant contract failed: ${label}`);process.exit(1);}
console.log('Product price variant contract audit passed.');
