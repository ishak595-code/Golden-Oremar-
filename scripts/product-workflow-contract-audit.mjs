import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function file(relative){const full=path.join(root,relative);if(!fs.existsSync(full)){failures.push(`Required product workflow file is missing: ${relative}`);return'';}return fs.readFileSync(full,'utf8');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

if(fs.existsSync(path.join(root,'src/features/product-editorial/ProductEditorialEditor.tsx')))failures.push('Product health/recipe fields must remain embedded in product creation; the retired standalone ProductEditorialEditor page must not return.');

const seller=file('src/features/producer-products/ProducerProductManager.tsx');
if(seller){
 requirePattern(seller,/\['Fotoğraf ve video','Ürün bilgileri','Fiyat ve stok','Açıklama ve özellikler','Sağlık ve tarif','Önizleme','Gönder'\]/,'Seller product wizard must keep media-first guided step order.');
 requirePattern(seller,/ProductCardDetailsFields/,'Seller product wizard must keep health, nutrition, allergen and recipe fields inside the product flow.');
 requirePattern(seller,/accept="image\/jpeg,image\/png,image\/webp,image\/avif"/,'Seller product images must be selected as device files.');
 requirePattern(seller,/accept="video\/mp4,video\/webm,video\/quicktime"/,'Seller product video must be selected as a device file.');
 requirePattern(seller,/ProductPreview/,'Seller product flow must keep a customer-facing preview before submission.');
 requirePattern(seller,/Kaydet ve Super Admin incelemesine gönder/,'Seller product flow must submit through Super Admin review rather than publishing directly.');
 forbid(seller,/type=["']url["']|https?:\/\/|videoUrl|imageUrl/,'Seller product wizard must not reintroduce link-based product media fields.');
 forbid(seller,/URL\.createObjectURL\([^)]*\)(?!;setUrl)/,'Seller media preview must not create unreclaimed object URLs directly during render.');
}

const sellerApi=file('src/features/producer-products/api.ts');
if(sellerApi){
 requirePattern(sellerApi,/rpc\('producer_upsert_product_v2'/,'Seller product writes must use the combined hardened v2 RPC.');
 requirePattern(sellerApi,/uploadProducerProductVideo/,'Seller API must keep Storage video upload support.');
 requirePattern(sellerApi,/video\/mp4.*video\/webm.*video\/quicktime/,'Seller API must restrict uploaded video MIME types.');
 forbid(sellerApi,/rpc\('producer_upsert_product_v1'/,'Seller client must not fall back to the retired direct v1 write path.');
}

const onboarding=file('src/features/producer-onboarding/ProducerApplicationFlow.tsx');
if(onboarding){
 requirePattern(onboarding,/countryCode:\s*'TR',\s*province:\s*'',\s*district:\s*'',\s*village:\s*''/,'Independent producer onboarding may default to the supported TR program, but must not invent province, district, or village.');
 requirePattern(onboarding,/sellerClassification:\s*''/,'Independent producer type must require an explicit applicant choice.');
 requirePattern(onboarding,/foodComplianceStatus:\s*''/,'Food compliance status must require an explicit applicant choice.');
 requirePattern(onboarding,/fulfillmentMethods:\s*\[\]/,'Fulfillment methods must start empty and come from the producer.');
 requirePattern(onboarding,/averageDispatchDays:\s*0/,'Dispatch days must start unselected rather than inventing a shipping promise.');
 requirePattern(onboarding,/plannedProducts:\s*\[\]/,'Product plan must start empty rather than inventing a product/source/unit/quantity.');
 requirePattern(onboarding,/organicClaimStatus:\s*''/,'Organic claim status must require an explicit applicant choice.');
 requirePattern(onboarding,/source_model:'',unit:'',estimated_quantity:0/,'New planned product rows must not preselect own production, kg, or a fake quantity.');
 requirePattern(onboarding,/<option value="" disabled>Seçin<\/option>\{sourceModels\.map/,'Product source model must keep an explicit unselected placeholder.');
 forbid(onboarding,/province:\s*'Hakk[âa]ri'|district:\s*'Yüksekova'/,'Golden Oremar official-store location must never leak into independent producer onboarding defaults.');
 forbid(onboarding,/fulfillmentMethods:\s*\['cargo'\]/,'Independent producers must not be auto-enrolled into cargo fulfillment.');
 forbid(onboarding,/source_model:'own_production',unit:'kg',estimated_quantity:1/,'Independent product plans must not receive invented source, unit, or quantity defaults.');
}

const admin=file('src/admin/AdminOfficialStoreProducts.tsx');
if(admin){
 requirePattern(admin,/\['Fotoğraf ve video','Ürün bilgileri','Fiyat ve stok','Açıklama ve kaynak','Sağlık ve tarif','Önizle ve kaydet','Yayınla'\]/,'Official store product wizard must keep media-first save-preview-publish order.');
 requirePattern(admin,/ProductCardDetailsFields/,'Official store health and recipe fields must stay inside the product wizard.');
 requirePattern(admin,/Taslağı kaydet ve yayın adımına geç/,'Official product flow must save the previewed draft before publication.');
 requirePattern(admin,/!savedAfterPreview\|\|!draft\.reference/,'Official product publish action must stay locked until a saved previewed draft exists.');
 forbid(admin,/type=["']url["']|https?:\/\/|videoUrl|imageUrl/,'Official product wizard must not reintroduce link-based media fields.');
}

const adminApi=file('src/admin/officialStoreProductApi.ts');
if(adminApi){
 requirePattern(adminApi,/rpc\('management_upsert_product_v2'/,'Official store writes must use the combined hardened v2 RPC.');
 requirePattern(adminApi,/uploadOfficialProductVideo/,'Official store API must keep Storage video upload support.');
 forbid(adminApi,/rpc\('management_upsert_product_v1'/,'Official store client must not return to the older direct v1 write path.');
}

const card=file('src/features/catalog/CatalogProductCard.tsx');
if(card){
 requirePattern(card,/producerBadgeTone==='ruby'/,'Official catalog card must understand the ruby verification tone.');
 requirePattern(card,/producerStoreKind==='official'\?'ruby':'blue'/,'Official store cards must default to ruby while independent verified sellers stay blue.');
 forbid(card,/producerStoreKind==='official'\?'emerald'/,'Official catalog verification must not regress to emerald.');
}

const storefront=file('src/features/catalog/PublicProducerScreen.tsx');
if(storefront){
 requirePattern(storefront,/StoreProductRow/,'Storefront products must remain a list that opens the full product detail.');
 requirePattern(storefront,/bg-rose-700/,'Official Golden Oremar storefront verification must stay ruby/red.');
}

const safety=file('src/features/content/ProductSafetyPanel.tsx');
if(safety){
 requirePattern(safety,/<video controls playsInline/,'Verified product video must play inside the product detail.');
 requirePattern(safety,/İçerik ve ürün bilgisi/,'Published product detail must keep ingredients and nutrition information.');
 requirePattern(safety,/Tarif/,'Published product detail must keep optional recipe information.');
 forbid(safety,/target=["']_blank["']|ExternalLink/,'Product safety references must not open an external website from the app.');
}

const combined=file('supabase/migrations/20260819190012_harden_combined_product_upsert_media_and_weight.sql');
if(combined){
 requirePattern(combined,/producer_upsert_product_v2/,'Combined seller product write migration is required.');
 requirePattern(combined,/video_value not like producer_id::text\|\|'\/products\/%'/,'Seller video path must remain scoped to the seller Storage directory.');
 requirePattern(combined,/admin_owned_product_video_required/,'New official product videos must remain scoped to the acting admin Storage directory.');
 requirePattern(combined,/shipping_weight_out_of_range/,'Combined product write path must validate shipping weight server-side.');
}

if(failures.length){console.error('Product workflow contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Product workflow contract audit passed.');
