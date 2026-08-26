import fs from'node:fs';
import path from'node:path';
const root=process.cwd();const failures=[];
function read(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Required customer search file is missing: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function requireText(source,text,message){if(!source.includes(text))failures.push(message);}
function requirePattern(source,pattern,message){if(!pattern.test(source))failures.push(message);}
function forbidText(source,text,message){if(source.includes(text))failures.push(message);}
const app=read('src/App.tsx');const overlay=read('src/features/catalog/CatalogSearchOverlay.tsx');const results=read('src/features/catalog/CatalogSearchResults.tsx');const facets=read('src/features/catalog/catalogSearchExperienceApi.ts');const migration=read('supabase/migrations/20260826111335_add_catalog_facets_and_publish_readiness_v1.sql');
requireText(facets,"rpc('catalog_search_facets_v1'",'Customer search must use the canonical live catalog facets RPC.');
for(const field of ['p_category_slug','p_producer_id','p_province','p_district','p_village','p_min_price_minor','p_max_price_minor','p_in_stock','p_featured'])requireText(facets,field,`Facet API is missing ${field}.`);
requireText(facets,'UUID_RE','Producer facet input must be UUID validated.');
requireText(facets,'Number.isSafeInteger','Facet numeric values must be bounded safe integers.');
for(const token of ['private.catalog_search_facets_v1','api_public_bridge.catalog_search_facets_v1','public.catalog_search_facets_v1'])requireText(migration,token,`Canonical catalog facet migration is missing ${token}.`);
requireText(overlay,'golden-oremar.catalog-search-history.v1','Search overlay must maintain bounded recent search history.');
requireText(overlay,'HISTORY_LIMIT=8','Search history must have a strict size bound.');
requireText(overlay,'Sesli ara','Search overlay must expose a visible voice-search action.');
requireText(overlay,'Golden Oremar ham ses kaydı saklamaz','Search overlay must explain voice data handling.');
requireText(overlay,'onVoiceSearch','Search overlay voice control must call the canonical App voice-search handler instead of creating a second recognizer.');
requireText(overlay,'Katalogda keşfet','Empty search state must support catalog discovery instead of a blank suggestion box.');
for(const token of ['facets.categories','facets.producers','facets.inStockCount'])requireText(overlay,token,`Search discovery overlay is missing ${token}.`);
for(const token of ['categorySlug:category||null','producerId:producer||null','province:province||null','district:district||null','village:village||null','minPriceMinor','maxPriceMinor','inStock','featured:featured?true:null'])requireText(results,token,`Search results are missing live filter ${token}.`);
for(const label of ['Kategori','Üretici','İl','İlçe','Köy / mahalle','Minimum fiyat (TL)','Maksimum fiyat (TL)','Sadece stokta','Öne çıkan ürünler'])requireText(results,label,`Customer filter UI is missing ${label}.`);
requireText(results,'Tüm filtreleri temizle','Zero-result experience must allow users to clear filters.');
requireText(app,'window.webkitSpeechRecognition','Voice search must preserve WebKit SpeechRecognition compatibility.');
requireText(app,"recognition.lang='tr-TR'",'Voice search must use Turkish recognition.');
requireText(app,"['sepete ekle','sepetine ekle','satın al']",'Voice search must preserve direct cart commands.');
requireText(app,'onVoiceSearch={triggerVoiceSearch}','Search overlay must reuse the canonical voice handler.');
requirePattern(app,/onClick=\{triggerVoiceSearch\}[\s\S]*aria-label="Sesli arama"|aria-label="Sesli arama"[\s\S]*onClick=\{triggerVoiceSearch\}/,'Header microphone must remain independently available.');
forbidText(app,"onClick={searchQuery?()=>setSearchQuery(''):triggerVoiceSearch}",'Typed text must not replace the microphone button with the clear action.');
requirePattern(app,/searchQuery\?<button[\s\S]*setSearchQuery\(''\)/,'Typed text must have a separate clear control.');
forbidText(overlay,'SpeechRecognition','Search overlay must not duplicate the canonical speech recognizer.');
forbidText(overlay,'localStorage.setItem(HISTORY_KEY,JSON.stringify([speechText','Raw or interim speech text must never be persisted as voice telemetry.');
if(failures.length){console.error('Customer search contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log('Customer search contract audit passed.');
