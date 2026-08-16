import fs from 'node:fs';

const appFile='src/App.tsx';
let text=fs.readFileSync(appFile,'utf8');
function replaceExact(from,to,expected=1){
 const count=text.split(from).length-1;
 if(count!==expected)throw new Error(`Expected ${expected}, found ${count}: ${from.slice(0,180)}`);
 text=text.split(from).join(to);
}

replaceExact(
 "import { useUnreadNotificationCount } from './features/account/useUnreadNotificationCount';",
 "import { useUnreadNotificationCount } from './features/account/useUnreadNotificationCount';import { useAccessibleDialog } from './features/accessibility/useAccessibleDialog';"
);

replaceExact(
 "  const [voiceError, setVoiceError] = useState('');\n\n  const processVoiceCommand",
 "  const [voiceError, setVoiceError] = useState('');\n  const voiceDialogRef = useAccessibleDialog<HTMLDivElement>(isListening, () => setIsListening(false));\n  const filterDialogRef = useAccessibleDialog<HTMLDivElement>(isFilterPanelOpen, () => setIsFilterPanelOpen(false));\n  const sortDialogRef = useAccessibleDialog<HTMLDivElement>(isSortPanelOpen, () => setIsSortPanelOpen(false));\n\n  const processVoiceCommand"
);

// Voice dialog shell and semantics.
replaceExact(
 '        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">\n          {/* Overlay closer */}\n          <div className="absolute inset-0" onClick={() => setIsListening(false)} />',
 '        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none">\n          {/* Pointer convenience; keyboard and screen-reader users have an explicit close control. */}\n          <div aria-hidden="true" className="absolute inset-0" onClick={() => setIsListening(false)} />'
);
replaceExact(
 '          <div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-6 pb-12 flex flex-col items-center gap-6 animate-slide-up select-none z-10 transition-all duration-300">',
 '          <div ref={voiceDialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-search-title" aria-describedby="voice-search-description" tabIndex={-1} className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-6 pb-12 flex flex-col items-center gap-6 animate-slide-up motion-reduce:animate-none select-none z-10 transition-all duration-300">'
);
replaceExact('<div className="w-12 h-1 bg-gray-700 rounded-full" />','<div aria-hidden="true" className="w-12 h-1 bg-gray-700 rounded-full" />',1);
replaceExact(
 '              onClick={() => setIsListening(false)}\n              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"\n            >',
 '              type="button"\n              onClick={() => setIsListening(false)}\n              aria-label="Sesli aramayı kapat"\n              className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center"\n            >'
);
replaceExact('<div className="absolute inset-0 rounded-full border border-brand-gold/25 animate-ping duration-1500 opacity-75" />','<div aria-hidden="true" className="absolute inset-0 rounded-full border border-brand-gold/25 animate-ping motion-reduce:animate-none duration-1500 opacity-75" />');
replaceExact('<div className="absolute -inset-4 rounded-full border border-gray-400/20 animate-ping duration-2000 opacity-50" />','<div aria-hidden="true" className="absolute -inset-4 rounded-full border border-gray-400/20 animate-ping motion-reduce:animate-none duration-2000 opacity-50" />');
replaceExact('<div className="absolute inset-2 bg-gradient-to-br from-brand-gold/10 to-transparent blur-xl rounded-full" />','<div aria-hidden="true" className="absolute inset-2 bg-gradient-to-br from-brand-gold/10 to-transparent blur-xl rounded-full" />');
replaceExact('<Mic className="w-8 h-8 text-brand-gold animate-pulse" />','<Mic aria-hidden="true" className="w-8 h-8 text-brand-gold animate-pulse motion-reduce:animate-none" />');
replaceExact('<h3 className="text-base font-bold text-white tracking-wide">Sizi dinliyoruz...</h3>','<h3 id="voice-search-title" className="text-base font-bold text-white tracking-wide">Sizi dinliyoruz...</h3>');
replaceExact('<p className="text-sm font-semibold text-[#CBD5E0] min-h-[3rem] px-4 py-2 bg-gray-900/40 rounded-xl border border-gray-850/50 break-words leading-relaxed max-h-32 overflow-y-auto font-mono">','<p id="voice-search-description" aria-live="polite" aria-atomic="true" className="text-sm font-semibold text-[#CBD5E0] min-h-[3rem] px-4 py-2 bg-gray-900/40 rounded-xl border border-gray-850/50 break-words leading-relaxed max-h-32 overflow-y-auto font-mono">');
replaceExact('<p className="text-xs text-red-500 font-medium animate-pulse">{voiceError}</p>','<p role="alert" className="text-xs text-red-500 font-medium animate-pulse motion-reduce:animate-none">{voiceError}</p>');

// Filter dialog shell.
replaceExact(
 '        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">\n          <div className="absolute inset-0" onClick={() => setIsFilterPanelOpen(false)} />',
 '        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none">\n          <div aria-hidden="true" className="absolute inset-0" onClick={() => setIsFilterPanelOpen(false)} />',1
);
replaceExact(
 '          <div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up z-10 text-white">',
 '          <div ref={filterDialogRef} role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title" aria-describedby="filter-sheet-description" tabIndex={-1} className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up motion-reduce:animate-none z-10 text-white">',1
);
replaceExact('<div className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />','<div aria-hidden="true" className="w-12 h-1 bg-gray-700 mx-auto rounded-full" />',2);
replaceExact(
 '              onClick={() => setIsFilterPanelOpen(false)}\n              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"\n            >',
 '              type="button"\n              onClick={() => setIsFilterPanelOpen(false)}\n              aria-label="Filtreleri kapat"\n              className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center"\n            >'
);
replaceExact('<h3 className="text-base font-bold text-white flex items-center gap-2">\n                <SlidersHorizontal className="w-4 h-4 text-brand-gold" /> Gelişmiş Filtreleme\n              </h3>','<h3 id="filter-sheet-title" className="text-base font-bold text-white flex items-center gap-2">\n                <SlidersHorizontal aria-hidden="true" className="w-4 h-4 text-brand-gold" /> Gelişmiş Filtreleme\n              </h3>');
replaceExact('<p className="text-xs text-gray-400">Kategori, köken ve fiyatla sonuçları daraltın.</p>','<p id="filter-sheet-description" className="text-xs text-gray-400">Kategori, köken ve fiyatla sonuçları daraltın.</p>');

// Filter controls: expose selected state and 44px minimum targets.
replaceExact('className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!activeFilter ?','aria-pressed={!activeFilter}\n                    className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!activeFilter ?');
replaceExact('onClick={() => setActiveFilter(cat.name)}\n                        className={`px-3 py-1.5 rounded-xl','onClick={() => setActiveFilter(cat.name)}\n                        aria-pressed={activeFilter === cat.name}\n                        className={`min-h-11 px-3 py-1.5 rounded-xl');
replaceExact('onClick={() => setActiveOrigin(originKey)}\n                        className={`px-3 py-1.5 rounded-xl','onClick={() => setActiveOrigin(originKey)}\n                        aria-pressed={activeOrigin === originKey}\n                        className={`min-h-11 px-3 py-1.5 rounded-xl');
replaceExact('onClick={() => setPriceRange(range.value)}\n                      className={`py-2 rounded-xl','onClick={() => setPriceRange(range.value)}\n                      aria-pressed={priceRange === range.value}\n                      className={`min-h-11 py-2 rounded-xl');
replaceExact('className="flex-1 py-3 rounded-xl border border-gray-800','className="flex-1 min-h-11 py-3 rounded-xl border border-gray-800');
replaceExact('className="flex-1 py-3 rounded-xl bg-brand-gold','className="flex-1 min-h-11 py-3 rounded-xl bg-brand-gold');

// Sort dialog shell and truthful rating label.
replaceExact(
 '        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">\n          <div className="absolute inset-0" onClick={() => setIsSortPanelOpen(false)} />',
 '        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none">\n          <div aria-hidden="true" className="absolute inset-0" onClick={() => setIsSortPanelOpen(false)} />',1
);
replaceExact(
 '          <div className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up z-10 text-white">',
 '          <div ref={sortDialogRef} role="dialog" aria-modal="true" aria-labelledby="sort-sheet-title" aria-describedby="sort-sheet-description" tabIndex={-1} className="relative w-full max-w-lg bg-[#111418] rounded-t-[24px] border-t border-gray-800 p-6 pb-12 flex flex-col gap-6 animate-slide-up motion-reduce:animate-none z-10 text-white">',1
);
replaceExact(
 '              onClick={() => setIsSortPanelOpen(false)}\n              className="absolute top-5 right-5 p-1 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors"\n            >',
 '              type="button"\n              onClick={() => setIsSortPanelOpen(false)}\n              aria-label="Sıralamayı kapat"\n              className="absolute top-4 right-4 min-h-11 min-w-11 p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center"\n            >'
);
replaceExact('<h3 className="text-base font-bold text-white flex items-center gap-2">\n                <ArrowDownUp className="w-4 h-4 text-brand-gold" /> Akıllı Sıralama\n              </h3>','<h3 id="sort-sheet-title" className="text-base font-bold text-white flex items-center gap-2">\n                <ArrowDownUp aria-hidden="true" className="w-4 h-4 text-brand-gold" /> Sıralama\n              </h3>');
replaceExact('<p className="text-xs text-gray-400">Ürünleri dilediğiniz öncelikte sıralayın.</p>','<p id="sort-sheet-description" className="text-xs text-gray-400">Ürünleri seçtiğiniz kritere göre sıralayın.</p>');
replaceExact("{ label: 'Önerilen Sürüm', value: 'featured' },\n                { label: 'En Popüler / En Çok Oy Alanlar', value: 'rating' },","{ label: 'Önerilen', value: 'featured' },\n                { label: 'En Yüksek Puan', value: 'rating' },");
replaceExact('onClick={() => {\n                    setSortOption(opt.value);\n                    setIsSortPanelOpen(false);\n                  }}\n                  className={`w-full text-left px-4 py-3.5 rounded-xl','onClick={() => {\n                    setSortOption(opt.value);\n                    setIsSortPanelOpen(false);\n                  }}\n                  aria-pressed={sortOption === opt.value}\n                  className={`min-h-11 w-full text-left px-4 py-3.5 rounded-xl');
replaceExact('{sortOption === opt.value && <div className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,1)]" />}','{sortOption === opt.value && <div aria-hidden="true" className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,1)]" />}');

// Toast must be announced but not steal focus.
replaceExact('<div className="fixed left-1/2 -translate-x-1/2 bg-brand-green text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-in fade-in zoom-in duration-300 pointer-events-none" style={{ top: \'calc(4rem + env(safe-area-inset-top))\' }}>','<div role="status" aria-live="polite" aria-atomic="true" className="fixed left-1/2 -translate-x-1/2 bg-brand-green text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-in motion-reduce:animate-none fade-in zoom-in duration-300 pointer-events-none" style={{ top: \'calc(4rem + env(safe-area-inset-top))\' }}>');
replaceExact('<CheckCircle className="w-5 h-5 text-brand-gold" />','<CheckCircle aria-hidden="true" className="w-5 h-5 text-brand-gold" />',1);

for(const required of ['useAccessibleDialog<HTMLDivElement>(isListening','role="dialog" aria-modal="true" aria-labelledby="voice-search-title"','aria-label="Filtreleri kapat"','aria-label="Sıralamayı kapat"','aria-pressed={priceRange === range.value}',"{ label: 'En Yüksek Puan', value: 'rating' }",'role="status" aria-live="polite" aria-atomic="true"']){
 if(!text.includes(required))throw new Error(`Accessibility requirement missing: ${required}`);
}
if(text.includes("En Popüler / En Çok Oy Alanlar"))throw new Error('Misleading rating label survived');

fs.writeFileSync(appFile,text);

const cssFile='src/index.css';
let css=fs.readFileSync(cssFile,'utf8');
const marker='/* Accessibility: respect the user’s reduced-motion preference. */';
if(!css.includes(marker)){
 css += `\n\n${marker}\n@media (prefers-reduced-motion: reduce) {\n  html:focus-within { scroll-behavior: auto; }\n  *, *::before, *::after {\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.01ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n`;
}
fs.writeFileSync(cssFile,css);
console.log('Mobile sheet accessibility hardening applied.');
