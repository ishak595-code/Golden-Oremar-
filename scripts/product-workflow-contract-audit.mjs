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
 requirePattern(admin,/OfficialProductCertificateVerification/,'Certified-organic evidence verification must stay embedded in the official product publish step.');
 requirePattern(admin,/draft\.organicClaim==='certified_organic'&&!certificateReady/,'Certified-organic publication must remain blocked until certificate evidence is verified.');
 forbid(admin,/type=["']url["']|https?:\/\/|videoUrl|imageUrl/,'Official product wizard must not reintroduce link-based media fields.');
}

const adminApi=file('src/admin/officialStoreProductApi.ts');
if(adminApi){
 requirePattern(adminApi,/rpc\('management_upsert_product_v2'/,'Official store writes must use the combined hardened v2 RPC.');
 requirePattern(adminApi,/uploadOfficialProductVideo/,'Official store API must keep Storage video upload support.');
 forbid(adminApi,/rpc\('management_upsert_product_v1'/,'Official store client must not return to the older direct v1 write path.');
}

const certificateComponent=file('src/admin/OfficialProductCertificateVerification.tsx');
if(certificateComponent){
 requirePattern(certificateComponent,/accept="application\/pdf,image\/jpeg,image\/png,image\/webp"/,'Organic certificate evidence must be selected as a local file.');
 requirePattern(certificateComponent,/reviewConfirmed/,'Organic certificate publication must retain explicit Super Admin evidence review confirmation.');
 requirePattern(certificateComponent,/createOfficialProductCertificateDocumentUrl/,'Private certificate evidence must be previewed with a short-lived signed URL inside the app.');
 forbid(certificateComponent,/type=["']url["']|target=["']_blank["']/,'Certificate evidence verification must not expose an external URL input or external-window workflow.');
}

const certificateApi=file('src/admin/officialProductCertificationApi.ts');
if(certificateApi){
 requirePattern(certificateApi,/product-certificates/,'Certificate evidence must remain in the private product-certificates bucket.');
 requirePattern(certificateApi,/admin_record_product_organic_certificate_v1/,'Certificate evidence must be finalized through the server-authoritative verification RPC.');
 requirePattern(certificateApi,/createSignedUrl\(normalized,300\)/,'Private certificate previews must remain short-lived.');
 forbid(certificateApi,/verification_url|p_verification_url/,'The product certificate client must not depend on an external verification URL.');
}

const moderation=file('src/admin/AdminProducts.tsx');
if(moderation){
 requirePattern(moderation,/listPendingProductEditorialReviews/,'Product moderation must load the submitted health/content/recipe package.');
 requirePattern(moderation,/EditorialModerationSummary/,'Super Admin must see the full editorial package in the same product moderation dialog.');
 requirePattern(moderation,/autoApproveReady=automatedReady&&Boolean\(selectedEditorial\)/,'Product approval must stay blocked when the submitted editorial package is missing.');
 requirePattern(moderation,/Kartın tamamını onayla ve yayınla/,'Product and editorial moderation must remain one approval decision.');
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

const unifiedModeration=file('supabase/migrations/20260819192518_unify_product_and_editorial_moderation_and_retire_v1_writes.sql');
if(unifiedModeration){
 requirePattern(unifiedModeration,/product_editorial_review_required/,'Product approval must fail closed when the editorial review package is missing.');
 requirePattern(unifiedModeration,/drop function if exists public\.producer_upsert_product_v1/,'Legacy public seller product v1 writes must remain retired.');
 requirePattern(unifiedModeration,/drop function if exists public\.management_upsert_product_v1/,'Legacy public management product v1 writes must remain retired.');
}

const certificateMigration=file('supabase/migrations/20260819194602_add_private_product_certificate_evidence_and_admin_verification.sql');
if(certificateMigration){
 requirePattern(certificateMigration,/values\('product-certificates','product-certificates',false/,'Organic certificate evidence bucket must stay private.');
 requirePattern(certificateMigration,/verified_product_certificate_path_v1/,'Organic certificate evidence must be validated against a real Storage object.');
 requirePattern(certificateMigration,/document_value not like 'admin\/'\|\|caller_id::text\|\|'\/%'/,'New verified certificate evidence must remain scoped to the acting Super Admin.');
 requirePattern(certificateMigration,/p_expires_at<current_date/,'Expired organic certificates must never be accepted as valid evidence.');
}

const publicDetail=file('supabase/migrations/20260819195437_fail_closed_expired_organic_claim_and_ruby_product_detail.sql');
if(publicDetail){
 requirePattern(publicDetail,/organicClaim.*certified_organic.*not certified/s,'Public product detail must fail closed if a certified-organic claim has no currently valid certificate.');
 requirePattern(publicDetail,/badgeTone.*ruby/s,'Official product detail must expose ruby verification rather than emerald.');
}
const topLevelBadges=file('supabase/migrations/20260819200312_align_top_level_product_detail_badges_with_ruby_official_store.sql');
if(topLevelBadges){
 requirePattern(topLevelBadges,/official_store','verified_origin/,'Top-level official-store and origin badges must remain ruby.');
}

if(failures.length){console.error('Product workflow contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Product workflow contract audit passed.');
