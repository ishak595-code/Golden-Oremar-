# Golden Oremar Branch Envanteri - 2026-08

Referans taban: `security-cleanup-2026-08`.

Bu rapor 71 branch'in tamamının referans branch'e göre commit ve dosya farkı incelenerek hazırlanmıştır. `ahead=0` olan branch'lerde referans tabana taşınmamış benzersiz dosya değişikliği yoktur. Hiçbir branch silinmemiştir.

## Sonuç özeti

Konsolidasyona gerçek kaynak olan işler:

- `agent/final-auth-e2e-hardening` - 22 commit ileride, doğrudan tabanın devamı. GitHub OIDC authenticated E2E, disposable user control plane, ödeme Edge Function CORS sertleştirmeleri ve güvenlik migration düzeltmeleri.
- `release/main-postmerge-quality-hardening` - 18 commit ileride. Android 17 API 37.0, AGP 9.3, Gradle 9.5, built-in Kotlin ve native platform kalite kontratı. Eski service-role tabanlı E2E bölümü alınmadı, OIDC modeli korundu.
- `agent/search-header-accessibility` - eski branch olmasına rağmen arama overlay kimliği, Escape kapatma ve `aria-controls` / `aria-expanded` davranışı benzersiz fikir olarak kontrollü port edildi. Eski App gövdesi alınmadı.
- `agent/startup-performance-audit` - eski `migration-tools` implementasyonu alınmadı. Performans audit fikri modern `scripts/startup-performance-audit.mjs` olarak yeniden uygulandı.

Baseline içinde daha ileri sürümü zaten bulunan ve bu nedenle tekrar alınmayan işler:

- `agent/premium-themes-notification-sounds` - baseline daha geniş tema seti ve gerçek premium ses motoru içeriyor.
- `agent/product-safety-detail` - baseline daha kapsamlı ürün güvenliği paneli ve aynı güvenlik migration'larının sertleştirilmiş sürümünü içeriyor.
- `agent/faq-help-center` - baseline Supabase RPC tabanlı SSS API'si ve FAQ migration'ını zaten içeriyor.
- `agent/dependency-security-audit`, `agent/legacy-node-runtime-audit`, `agent/startup-datacontext-audit` - bağımsız workflow fikirleri mevcut release/security audit zinciri tarafından daha güçlü biçimde kapsanıyor.

Supersede edilen çakışmalı native branch'ler:

- `agent/capacitor-8-stable-quality`
- `agent/capacitor-85-delta`
- `agent/capacitor-85-mainline`

Bunların hiçbiri silinmedi. Android/iOS konsolidasyonunda daha güncel `release/main-postmerge-quality-hardening` esas alındı. Bunun nedeni API 37, AGP 9.3, Gradle 9.5, built-in Kotlin ve daha kapsamlı native contract audit içermesidir.

## 71 branch envanteri

| Branch | Ahead | Behind | Sınıf | Referansa göre benzersiz dosyalar / karar |
|---|---:|---:|---|---|
| agent/account-destructive-dialog-reliability | 0 | 1229 | contained | Yok - baseline içinde |
| agent/account-faq-help | 0 | 1284 | contained | Yok - baseline içinde |
| agent/account-lists-reliability-premium | 0 | 1219 | contained | Yok - baseline içinde |
| agent/account-navigation-address-accessibility | 0 | 1256 | contained | Yok - baseline içinde |
| agent/account-secure-messages-integration | 0 | 1445 | contained | Yok - baseline içinde |
| agent/admin-supabase-retire-node | 0 | 0 | identical | Yok - baseline ile aynı |
| agent/bootstrap-golden-oremar | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-check | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-final | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-main | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-merge | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-one | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-pr | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-ready | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-review | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/bootstrap-golden-oremar-submit | 0 | 1492 | historical | Yok - bootstrap tarihsel kolu |
| agent/capacitor-8-stable-quality | 13 | 1335 | superseded | `.github/workflows/mobile-quality.yml`, Android build files, iOS project/AppDelegate/Info/SceneDelegate/SPM, `package.json`, lockfile. Superseded by release branch. |
| agent/capacitor-85-delta | 7 | 1327 | superseded | Mobile quality workflow, Android build files, iOS project/AppDelegate/Info/SceneDelegate, `package.json`, lockfile, status doc. Superseded by release branch. |
| agent/capacitor-85-mainline | 0 | 1315 | contained | Yok - eski Capacitor hattı |
| agent/cart-checkout-interaction-reliability | 0 | 1213 | contained | Yok - baseline içinde |
| agent/catalog-resilience-images | 0 | 1186 | contained | Yok - baseline içinde |
| agent/catalog-trust-failsafe | 0 | 1190 | contained | Yok - baseline içinde |
| agent/category-canonical-card-visual-finalization | 0 | 1278 | contained | Yok - baseline içinde |
| agent/checkout-hardening-support-quote | 0 | 1453 | contained | Yok - baseline içinde |
| agent/customer-copy-truth | 0 | 1352 | contained | Yok - baseline içinde |
| agent/customer-returns-v3 | 0 | 1470 | contained | Yok - baseline içinde |
| agent/customer-shell-firebase-split | 0 | 1170 | contained | Yok - baseline içinde |
| agent/dependency-security-audit | 1 | 1165 | superseded | `.github/workflows/audit-dependency-security.yml` - mevcut kalite kapısındaki production dependency audit daha güçlü |
| agent/dynamic-product-producer-metrics | 0 | 1317 | contained | Yok - baseline içinde |
| agent/faq-help-center | 5 | 1291 | already-evolved | `SupportPanel.tsx`, `faqApi.ts`, `20260816163725_add_public_faq_content_v1.sql`. Baseline daha ileri sürümü içeriyor. |
| agent/final-auth-e2e-hardening | 22 | 0 | integrate | Mobile quality, authenticated E2E/audits, customer E2E, `ci-e2e-user`, payment Edge Functions ve iki 20260822 privilege-repair migration'ı. Entegrasyon branch'inin ilk ileri alınan kaynağı. |
| agent/home-storefront-dynamic-premium-finalization | 0 | 1271 | contained | Yok - baseline içinde |
| agent/legacy-dead-code-cleanup | 0 | 1411 | contained | Yok - baseline içinde |
| agent/legacy-node-runtime-audit | 1 | 1162 | superseded | `.github/workflows/audit-legacy-node-runtime.yml` - release audit aynı riski fail-closed denetliyor |
| agent/mobile-platform-social-auth | 0 | 1328 | contained | Yok - baseline içinde |
| agent/mobile-sheet-accessibility | 0 | 1339 | contained | Yok - baseline içinde |
| agent/mobile-shell-accessibility-premium | 0 | 1264 | contained | Yok - baseline içinde |
| agent/native-auth-recovery | 0 | 1375 | contained | Yok - baseline içinde |
| agent/native-identity-shell-hardening | 0 | 1395 | contained | Yok - baseline içinde |
| agent/nonbreaking-dependency-security-fix | 0 | 1159 | contained | Yok - baseline içinde |
| agent/notification-badge-sync | 0 | 1368 | contained | Yok - baseline içinde |
| agent/offline-reconnect-resilience | 0 | 1181 | contained | Yok - baseline içinde |
| agent/order-notification-deeplink | 0 | 1419 | contained | Yok - baseline içinde |
| agent/persist-safety-contract-history | 0 | 1290 | contained | Yok - baseline içinde |
| agent/personal-appearance-theme | 0 | 1245 | contained | Yok - baseline içinde |
| agent/premium-settings-themes-sounds | 0 | 1203 | contained | Yok - baseline içinde |
| agent/premium-themes-notification-sounds | 14 | 1203 | already-evolved | Theme/account/notification sound files ve docs. Baseline daha kapsamlı tema ve ses motoru içeriyor. |
| agent/producer-customer-relationship | 0 | 1436 | contained | Yok - baseline içinde |
| agent/producer-order-fulfillment | 0 | 1424 | contained | Yok - baseline içinde |
| agent/product-card-truthful-dynamic | 0 | 1463 | contained | Yok - baseline içinde |
| agent/product-detail-dynamic-complete | 0 | 1458 | contained | Yok - baseline içinde |
| agent/product-detail-quantity-stepper | 0 | 1311 | contained | Yok - baseline içinde |
| agent/product-safety-detail | 12 | 1310 | already-evolved | Product detail/safety/API ve `20260816162848`, `20260816163025` migration'ları. Baseline daha kapsamlı güvenlik modeli içeriyor. |
| agent/public-content-screen-reliability | 0 | 1204 | contained | Yok - baseline içinde |
| agent/public-metadata-trust | 0 | 1362 | contained | Yok - baseline içinde |
| agent/pwa-customer-precache-budget | 0 | 1166 | contained | Yok - baseline içinde |
| agent/remove-unused-risky-dependencies | 0 | 1163 | contained | Yok - baseline içinde |
| agent/route-tab-hardening | 0 | 1405 | contained | Yok - baseline içinde |
| agent/search-header-accessibility | 7 | 1338 | selective-port | `src/App.tsx`, `src/features/catalog/CatalogSearchOverlay.tsx`. Yalnız erişilebilirlik davranışı güncel overlay'e port edildi. |
| agent/secure-admin-session-gate | 0 | 1431 | contained | Yok - baseline içinde |
| agent/seller-traceability-finance | 0 | 1483 | contained | Yok - baseline içinde |
| agent/settings-async-reliability | 0 | 1239 | contained | Yok - baseline içinde |
| agent/startup-datacontext-audit | 1 | 1180 | superseded | `.github/workflows/audit-startup-datacontext.yml` - release ve yeni startup audit tarafından kapsanıyor |
| agent/startup-performance-audit | 2 | 1361 | selective-port | Eski workflow + `migration-tools/vite.performance-audit.config.ts`. `migration-tools` geri getirilmedi, fikir modern `scripts/startup-performance-audit.mjs` olarak port edildi. |
| agent/startup-route-splitting | 0 | 1357 | contained | Yok - baseline içinde |
| agent/structured-product-safety-content | 0 | 1292 | contained | Yok - baseline içinde |
| main | 23 | 0 | protected-target | Final-auth hattının merge edilmiş hali. Konsolidasyon kaynağı olarak kullanılmadı, `main`e bu görevde yazılmayacak. |
| release/main-postmerge-quality-hardening | 18 | 0 | integrate-selectively | Mobile quality, Android app/root/wrapper/variables, `package.json`, `scripts/mobile-platform-contract-audit.mjs`. API37/AGP9.3/Gradle9.5 taşındı; eski service-role E2E alınmadı. |
| repo-state-cleanup-2026-08 | 0 | 0 | identical | Yok - baseline ile aynı |
| security/supabase-public-wrapper-hardening-2026-08 | 0 | 0 | identical | Yok - baseline ile aynı |
| security-cleanup-2026-08 | 0 | 0 | baseline | Konsolidasyonun başlangıç tabanı |

## Çakışma çözüm notları

1. Capacitor/native: `release/main-postmerge-quality-hardening` seçildi. Eski Capacitor branch'leri daha düşük Android toolchain ve daha dar kalite kontrolü taşıdığı için supersede edildi.
2. E2E güvenliği: release branch'teki GitHub secret üzerinden Supabase service-role kullanan müşteri E2E modeli reddedildi. `agent/final-auth-e2e-hardening` içindeki kısa ömürlü GitHub OIDC control-plane modeli korundu.
3. Android Gradle: release branch'in API37/AGP9.3/Gradle9.5 modern DSL'i alındı. Mevcut release audit ile uyumluluk için canonical `applicationId` semantiği korunarak audit ayrıca modern sözdizimini kabul edecek native kontratla güçlendirildi.
4. Premium tema, SSS, ürün güvenliği: eski branch dosyalarının wholesale merge edilmesi baseline'deki daha ileri davranışı gerileteceği için yapılmadı.
5. Arama erişilebilirliği: eski App dosyası alınmadı. Overlay ID, `aria-controls`, `aria-expanded` ve Escape kapanış davranışı güncel canlı katalog bileşenine uyarlanarak port edildi.
6. Startup performance: eski `migration-tools` dizini release policy ile çeliştiği için alınmadı. Aynı amaç dependency-free contract audit olarak yeniden uygulandı.

## Arşiv politikası

Supersede, contained ve historical olarak işaretlenen branch'lerin hiçbiri silinmemiştir. Geri dönüş veya adli karşılaştırma için branch'ler arşiv niteliğinde korunmaktadır.
