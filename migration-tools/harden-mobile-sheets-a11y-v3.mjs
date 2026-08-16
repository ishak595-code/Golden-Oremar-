import fs from 'node:fs';

const appFile='src/App.tsx';
let text=fs.readFileSync(appFile,'utf8');

function replaceOne(source,from,to,label){
 const count=source.split(from).length-1;
 if(count!==1)throw new Error(`${label}: expected one match, found ${count}: ${from.slice(0,150)}`);
 return source.replace(from,to);
}
function transformSection(startMarker,endMarker,label,transform){
 const start=text.indexOf(startMarker);
 const end=text.indexOf(endMarker,start+startMarker.length);
 if(start<0||end<0||end<=start)throw new Error(`${label}: section markers not found`);
 const original=text.slice(start,end);
 const next=transform(original);
 text=text.slice(0,start)+next+text.slice(end);
}

text=replaceOne(text,
 "import { useUnreadNotificationCount } from './features/account/useUnreadNotificationCount';",
 "import { useUnreadNotificationCount } from './features/account/useUnreadNotificationCount';import { useAccessibleDialog } from './features/accessibility/useAccessibleDialog';",
 'import');
text=replaceOne(text,
 "  const [voiceError, setVoiceError] = useState('');\n\n  const processVoiceCommand",
 "  const [voiceError, setVoiceError] = useState('');\n  const voiceDialogRef = useAccessibleDialog<HTMLDivElement>(isListening, () => setIsListening(false));\n  const filterDialogRef = useAccessibleDialog<HTMLDivElement>(isFilterPanelOpen, () => setIsFilterPanelOpen(false));\n  const sortDialogRef = useAccessibleDialog<HTMLDivElement>(isSortPanelOpen, () => setIsSortPanelOpen(false));\n\n  const processVoiceCommand",
 'dialog hooks');

transformSection('{isListening && (','{isFilterPanelOpen && (','voice',section=>{
 section=replaceOne(section,'animate-fade-in">','animate-fade-in motion-reduce:animate-none">','voice overlay motion');
 section=replaceOne(section,'          {/* Overlay closer */}\n          <div className="absolute inset-0" onClick={() => setIsListening(false)} />','          {/* Pointer convenience; explicit close button and Escape cover keyboard/screen-reader use. */}\n          <div aria-hidden="true" className="absolute inset-0" onClick={() => setIsListening(false)} />','voice overlay');
 section=replaceOne(section,'<div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-6 pb-12 flex flex-col items-center gap-6 animate-slide-up select-none z-10 transition-all duration-300">','<div ref={voiceDialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-search-title" aria-describedby="voice-search-description" tabIndex={-1} className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-6 pb-12 flex flex-col items-center gap-6 animate-slide-up motion-reduce:animate-none select-none z-10 transition-all duration-300">','voice dialog');
 section=replaceOne(section,'<div className="w-12 h-1 bg-gray-700 rounded-full" />','<div aria-hidden="true" className="w-12 h-1 bg-gray-700 rounded-full" />','voice handle');
 section=replaceOne(section,'onClick={() => setIsListening(false)}\n              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"','type="button"\n              onClick={() => setIsListening(false)}\n              aria-label="Sesli aramayı kapat"\n              className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center"','voice close');
 section=replaceOne(section,'<div className="absolute inset-0 rounded-full border border-brand-gold/25 animate-ping duration-1500 opacity-75" />','<div aria-hidden="true" className="absolute inset-0 rounded-full border border-brand-gold/25 animate-ping motion-reduce:animate-none duration-1500 opacity-75" />','voice ring1');
 section=replaceOne(section,'<div className="absolute -inset-4 rounded-full border border-gray-400/20 animate-ping duration-2000 opacity-50" />','<div aria-hidden="true" className="absolute -inset-4 rounded-full border border-gray-400/20 animate-ping motion-reduce:animate-none duration-2000 opacity-50" />','voice ring2');
 section=replaceOne(section,'<div className="absolute inset-2 bg-gradient-to-br from-brand-gold/10 to-transparent blur-xl rounded-full" />','<div aria-hidden="true" className="absolute inset-2 bg-gradient-to-br from-brand-gold/10 to-transparent blur-xl rounded-full" />','voice glow');
 section=replaceOne(section,'<Mic className="w-8 h-8 text-brand-gold animate-pulse" />','<Mic aria-hidden="true" className="w-8 h-8 text-brand-gold animate-pulse motion-reduce:animate-none" />','voice mic');
 section=replaceOne(section,'<h3 className="text-base font-bold text-white tracking-wide">Sizi dinliyoruz...</h3>','<h3 id="voice-search-title" className="text-base font-bold text-white tracking-wide">Sizi dinliyoruz...</h3>','voice title');
 section=replaceOne(section,'<p className="text-sm font-semibold text-[#CBD5E0] min-h-[3rem] px-4 py-2 bg-gray-900/40 rounded-xl border border-gray-850/50 break-words leading-relaxed max-h-32 overflow-y-auto font-mono">','<p id="voice-search-description" aria-live="polite" aria-atomic="true" className="text-sm font-semibold text-[#CBD5E0] min-h-[3rem] px-4 py-2 bg-gray-900/40 rounded-xl border border-gray-850/50 break-words leading-relaxed max-h-32 overflow-y-auto font-mono">','voice status');
 section=replaceOne(section,'<p className="text-xs text-red-500 font-medium animate-pulse">{voiceError}</p>','<p role="alert" className="text-xs text-red-500 font-medium animate-pulse motion-reduce:animate-none">{voiceError}</p>','voice error');
 return section;
});

transformSection('{isFilterPanelOpen && (','{isSortPanelOpen && (','filter',section=>{
 section=replaceOne(section,'animate-fade-in">','animate-fade-in motion-reduce:animate-none">','filter overlay motion');
 section=replaceOne(section,'<div className="absolute inset-0" onClick={() => setIsFilterPanelOpen(false)} />','<div aria-hidden="true" className="absolute inset-0" onClick={() => setIsFilterPanelOpen(false)} />','filter overlay');
 section=replaceOne(section,'<div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up z-10 text-white">','<div ref={filterDialogRef} role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title" aria-describedby="filter-sheet-description" tabIndex={-1} className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up motion-reduce:animate-none z-10 text-white">','filter dialog');
 section=replaceOne(section,'<div className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />','<div aria-hidden="true" className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />','filter handle');
 section=replaceOne(section,'onClick={() => setIsFilterPanelOpen(false)}\n              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"','type="button"\n              onClick={() => setIsFilterPanelOpen(false)}\n              aria-label="Filtreleri kapat"\n              className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center"','filter close');
 section=replaceOne(section,'<h3 className="text-base font-bold text-white flex items-center gap-2">\n                <SlidersHorizontal className="w-4 h-4 text-brand-gold" /> Gelişmiş Filtreleme\n              </h3>','<h3 id="filter-sheet-title" className="text-base font-bold text-white flex items-center gap-2">\n                <SlidersHorizontal aria-hidden="true" className="w-4 h-4 text-brand-gold" /> Gelişmiş Filtreleme\n              </h3>','filter title');
 section=replaceOne(section,'<p className="text-xs text-gray-400">Kategori, köken ve fiyatla sonuçları daraltın.</p>','<p id="filter-sheet-description" className="text-xs text-gray-400">Kategori, köken ve fiyatla sonuçları daraltın.</p>','filter description');
 section=replaceOne(section,'className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!activeFilter ?','aria-pressed={!activeFilter}\n                    className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!activeFilter ?','filter all state');
 section=replaceOne(section,'className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeFilter === cat.name ?','aria-pressed={activeFilter === cat.name}\n                      className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeFilter === cat.name ?','filter category state');
 section=replaceOne(section,'className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeOrigin === originKey ?','aria-pressed={activeOrigin === originKey}\n                        className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeOrigin === originKey ?','filter origin state');
 section=replaceOne(section,'className={`py-2 rounded-xl text-xs font-semibold border transition-all ${priceRange === range.value ?','aria-pressed={priceRange === range.value}\n                      className={`min-h-11 py-2 rounded-xl text-xs font-semibold border transition-all ${priceRange === range.value ?','filter price state');
 section=replaceOne(section,'className="flex-1 py-3 rounded-xl border border-gray-800','className="flex-1 min-h-11 py-3 rounded-xl border border-gray-800','filter reset target');
 section=replaceOne(section,'className="flex-1 py-3 rounded-xl bg-brand-gold','className="flex-1 min-h-11 py-3 rounded-xl bg-brand-gold','filter apply target');
 return section;
});

transformSection('{isSortPanelOpen && (','{toast.visible && (','sort',section=>{
 section=replaceOne(section,'animate-fade-in">','animate-fade-in motion-reduce:animate-none">','sort overlay motion');
 section=replaceOne(section,'<div className="absolute inset-0" onClick={() => setIsSortPanelOpen(false)} />','<div aria-hidden="true" className="absolute inset-0" onClick={() => setIsSortPanelOpen(false)} />','sort overlay');
 section=replaceOne(section,'<div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up z-10 text-white">','<div ref={sortDialogRef} role="dialog" aria-modal="true" aria-labelledby="sort-sheet-title" aria-describedby="sort-sheet-description" tabIndex={-1} className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up motion-reduce:animate-none z-10 text-white">','sort dialog');
 section=replaceOne(section,'<div className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />','<div aria-hidden="true" className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />','sort handle');
 section=replaceOne(section,'onClick={() => setIsSortPanelOpen(false)}\n              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"','type="button"\n              onClick={() => setIsSortPanelOpen(false)}\n              aria-label="Sıralamayı kapat"\n              className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center"','sort close');
 section=replaceOne(section,'<h3 className="text-base font-bold text-white flex items-center gap-2">\n                <ArrowDownUp className="w-4 h-4 text-brand-gold" /> Akıllı Sıralama\n              </h3>','<h3 id="sort-sheet-title" className="text-base font-bold text-white flex items-center gap-2">\n                <ArrowDownUp aria-hidden="true" className="w-4 h-4 text-brand-gold" /> Sıralama\n              </h3>','sort title');
 section=replaceOne(section,'<p className="text-xs text-gray-400">Ürünleri dilediğiniz öncelikte sıralayın.</p>','<p id="sort-sheet-description" className="text-xs text-gray-400">Ürünleri seçtiğiniz kritere göre sıralayın.</p>','sort description');
 section=replaceOne(section,"{ label: 'Önerilen Sürüm', value: 'featured' },\n                { label: 'En Popüler / En Çok Oy Alanlar', value: 'rating' },","{ label: 'Önerilen', value: 'featured' },\n                { label: 'En Yüksek Puan', value: 'rating' },",'sort labels');
 section=replaceOne(section,'className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${sortOption === opt.value ?','aria-pressed={sortOption === opt.value}\n                  className={`min-h-11 w-full text-left px-4 py-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${sortOption === opt.value ?','sort state');
 section=replaceOne(section,'{sortOption === opt.value && <div className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,1)]" />}','{sortOption === opt.value && <div aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,1)]" />}','sort dot');
 return section;
});

transformSection('{toast.visible && (','function App()','toast',section=>{
 section=replaceOne(section,'<div className="fixed left-1/2 -translate-x-1/2 bg-brand-green text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-in fade-in zoom-in duration-300 pointer-events-none"','<div role="status" aria-live="polite" aria-atomic="true" className="fixed left-1/2 -translate-x-1/2 bg-brand-green text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-in motion-reduce:animate-none fade-in zoom-in duration-300 pointer-events-none"','toast live');
 section=replaceOne(section,'<CheckCircle className="w-5 h-5 text-brand-gold" />','<CheckCircle aria-hidden="true" className="w-5 h-5 text-brand-gold" />','toast icon');
 return section;
});

for(const required of ['useAccessibleDialog<HTMLDivElement>(isListening','role="dialog" aria-modal="true" aria-labelledby="voice-search-title"','role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title"','role="dialog" aria-modal="true" aria-labelledby="sort-sheet-title"','aria-label="Filtreleri kapat"','aria-label="Sıralamayı kapat"','aria-pressed={priceRange === range.value}',"{ label: 'En Yüksek Puan', value: 'rating' }",'role="status" aria-live="polite" aria-atomic="true"']){
 if(!text.includes(required))throw new Error(`Accessibility requirement missing: ${required}`);
}
if(text.includes('En Popüler / En Çok Oy Alanlar'))throw new Error('Misleading rating label survived');
fs.writeFileSync(appFile,text);

const cssFile='src/index.css';
let css=fs.readFileSync(cssFile,'utf8');
const marker='/* Accessibility: respect the user’s reduced-motion preference. */';
if(!css.includes(marker)){
 css += `\n\n${marker}\n@media (prefers-reduced-motion: reduce) {\n  html:focus-within { scroll-behavior: auto; }\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n`;
}
fs.writeFileSync(cssFile,css);
console.log('Whitespace-independent mobile sheet accessibility hardening applied.');
