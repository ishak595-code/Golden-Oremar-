import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const detail=read('src/features/catalog/ProductDetailScreen.tsx');
const configurator=read('src/features/catalog/PremiumOrderConfigurator.tsx');
const experience=read('src/features/catalog/productExperience.ts');
const cartApi=read('src/features/cart/api.ts');
const commerceMigration=read('supabase/migrations/20260902113000_add_product_commerce_lifecycle_v1.sql');
const orderMigration=read('supabase/migrations/20260902113500_preserve_server_validated_order_customization_v1.sql');
const catalogSeed=read('supabase/migrations/20260902114000_seed_hakkari_50_product_catalog_v1.sql');

const failures=[];
const requireText=(source,text,message)=>{if(!source.includes(text))failures.push(message);};
const requireMatch=(source,pattern,message)=>{if(!pattern.test(source))failures.push(message);};
const forbidMatch=(source,pattern,message)=>{if(pattern.test(source))failures.push(message);};

// Price-changing customer choices must resolve to a real server-owned variant.
requireText(commerceMigration,'Price-changing choices remain product_variants','Commerce schema must keep price-changing choices in product_variants.');
requireMatch(detail,/const variant=useMemo\([\s\S]*item\?\.id===variantId/,'Product detail must resolve the selected variant by variantId.');
requireText(detail,'const priceMinor=safeInteger(variant?.priceMinor);','Displayed product price must come from the selected variant.');
requireText(detail,'const compareAtPriceMinor=safeInteger(variant?.compareAtPriceMinor);','Compare-at price must come from the selected variant.');
requireMatch(detail,/detail\.variants\.length>1[\s\S]*value=\{variantId\}[\s\S]*setVariantId\(event\.target\.value\)/,'Multiple price variants must be customer-selectable.');
requireText(detail,'variantReference=safeReference(variant?.id,160)','Purchases must bind to the selected variant identity.');

// Preparation and packing preferences are a separate non-pricing contract.
requireText(experience,'buildOrderCustomization','Product experience must build an explicit order customization payload.');
requireText(detail,'selectedOptionsPayload()','Product detail must build selected options before cart writes.');
requireMatch(detail,/setCartItem\(\{variantId:variantReference,quantity,selectedOptions:selectedOptionsPayload\(\)\}\)/,'Add-to-cart must send the selected variant plus customization payload.');
requireText(configurator,'selectOrderOption','Configurator must mutate only allow-listed option choices.');
forbidMatch(commerceMigration,/priceDelta|price_delta|priceModifier|price_modifier/i,'Preparation option schema must not accept client-authored price modifiers.');

// The canonical product-owned option schema must remain the sole customization authority.
requireText(commerceMigration,'private.normalize_product_option_schema_v1','Commerce lifecycle must normalize the stored product option schema.');
requireMatch(commerceMigration,/select profile\.option_schema,profile\.updated_at[\s\S]*private\.normalize_product_option_schema_v1/,'Order customization must be validated against the stored product option schema.');
forbidMatch(orderMigration,/derived_kind|product_name|category_slug|haystack|order_customization_kind_mismatch/i,'Order preservation migration must not restore product-name or category heuristics.');
requireText(orderMigration,'must not replace that','Order preservation migration must document that the canonical schema validator cannot be replaced.');

// Cart is server authoritative and must retain the normalized customization.
requireText(cartApi,"supabase.rpc('set_my_cart_item_v1'",'Cart writes must use the canonical cart RPC.');
requireText(cartApi,'p_selected_options: selectedOptions','Cart API must pass selected options for server validation.');
requireText(orderMigration,'private.normalize_order_customization_v1','Order customization must be normalized server-side.');
requireMatch(orderMigration,/options_value:=coalesce\(variant_row\.option_values,'\{\}'::jsonb\)-'orderCustomization'/,'Cart must derive base selected options from server-owned variant option values.');
requireMatch(orderMigration,/p_selected_options \? 'orderCustomization'[\s\S]*private\.normalize_order_customization_v1/,'Client customization must be normalized before persistence.');
requireMatch(orderMigration,/insert into public\.cart_items\(cart_id,variant_id,quantity,selected_options\)/,'Normalized selected options must persist on the cart line.');

// Checkout must recover customization from the authenticated canonical cart, not trust checkout JSON.
requireMatch(orderMigration,/source_item:=source_item-'orderCustomization'/,'Checkout must discard client-supplied orderCustomization before canonical recovery.');
requireMatch(orderMigration,/from public\.carts c[\s\S]*join public\.cart_items ci[\s\S]*where c\.user_id=caller_id/,'Checkout must recover customization from the caller-owned active cart.');
requireMatch(orderMigration,/update public\.order_items[\s\S]*'\{selected_options\}'[\s\S]*orderCustomization/s,'Immutable order item snapshots must retain normalized order customization.');

// Catalog expansion stays draft until authentic media and publication gates are satisfied.
requireText(catalogSeed,'50 managed product records','The requested 50-product managed catalog checkpoint must remain represented in seed data.');
requireText(catalogSeed,'inactive drafts','New demo catalog rows must remain drafts until real media and production truth are verified.');
requireText(catalogSeed,'without bypassing the canonical product.publish + product-health + media integrity gates','Catalog seeding must not bypass publication and authentic-media gates.');

if(failures.length){
 console.error('Product commerce/order contract audit failed:');
 for(const failure of failures)console.error(`- ${failure}`);
 process.exit(1);
}

console.log('Product commerce/order contract audit passed.');
