import fs from 'node:fs';

const file='src/App.tsx';
let text=fs.readFileSync(file,'utf8');
function replaceExact(from,to,expected=1){
 const count=text.split(from).length-1;
 if(count!==expected)throw new Error(`Expected ${expected}, found ${count}: ${from.slice(0,180)}`);
 text=text.split(from).join(to);
}

replaceExact(
 "  const [isSearchFocused, setIsSearchFocused] = useState(false);\n  const [toast, setToast]",
 "  const [isSearchFocused, setIsSearchFocused] = useState(false);\n  const handleSearchBlur = (event: React.FocusEvent<HTMLInputElement>) => {\n    const next = event.relatedTarget;\n    if (next instanceof HTMLElement && next.closest('[data-catalog-search-overlay=\"true\"]')) return;\n    setIsSearchFocused(false);\n  };\n  const [toast, setToast]"
);

for(const id of ['mobile-search-input','unified-search-input']){
 const marker=`                id="${id}"\n                type="text"`;
 const replacement=`                id="${id}"\n                type="text"\n                aria-label="Katalogda ara"\n                aria-controls="catalog-search-suggestions"\n                aria-expanded={isSearchFocused}`;
 replaceExact(marker,replacement);
}

replaceExact('                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}','                onBlur={handleSearchBlur}',2);
replaceExact(
 "                onKeyDown={(event) => {\n                  if (event.key === 'Enter' && searchQuery.trim()) {",
 "                onKeyDown={(event) => {\n                  if (event.key === 'Escape') {\n                    event.preventDefault();\n                    setIsSearchFocused(false);\n                    return;\n                  }\n                  if (event.key === 'Enter' && searchQuery.trim()) {",
 2
);

replaceExact(
 '            open={isSearchFocused}\n            onQueryChange={setSearchQuery}',
 '            open={isSearchFocused}\n            onRequestClose={() => setIsSearchFocused(false)}\n            onQueryChange={setSearchQuery}'
);

replaceExact('className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-colors focus:outline-none"','className="min-h-11 min-w-11 p-2 flex items-center justify-center text-[#A0AEC0] hover:text-brand-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-lg"',1);
replaceExact('className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-colors focus:outline-none" ','className="min-h-11 min-w-11 p-2 flex items-center justify-center text-[#A0AEC0] hover:text-brand-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-lg" ',1);
replaceExact('className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus:outline-none"','className="min-h-11 min-w-11 p-2 flex items-center justify-center text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-lg"',1);
replaceExact('className="p-1 text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus:outline-none" ','className="min-h-11 min-w-11 p-2 flex items-center justify-center text-[#A0AEC0] hover:text-brand-gold transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-lg" ',1);

replaceExact('className="relative p-2 text-gray-500 dark:text-gray-440 hover:text-brand-gold hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-full transition-all focus:outline-none group"','className="relative min-h-11 min-w-11 p-2 flex items-center justify-center text-gray-500 dark:text-gray-440 hover:text-brand-gold hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold group"',2);
replaceExact('className="relative p-3 text-gray-500 dark:text-gray-450 hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-all group focus:outline-none"','className="relative min-h-11 min-w-11 p-3 flex items-center justify-center text-gray-500 dark:text-gray-450 hover:text-brand-gold hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"',2);

replaceExact('<span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-gold text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-bounce duration-1000">','<span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-gold text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-bounce duration-1000">');
replaceExact('<span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-brand-gold text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 shadow-sm">','<span aria-hidden="true" className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-brand-gold text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 shadow-sm">');

replaceExact('                onClick={() => setIsFilterPanelOpen(true)}\n                className="flex-1 flex items-center justify-center gap-2 py-2 px-3','                onClick={() => setIsFilterPanelOpen(true)}\n                aria-haspopup="dialog"\n                className="flex-1 min-h-11 flex items-center justify-center gap-2 py-2 px-3');
replaceExact('                onClick={() => setIsSortPanelOpen(true)}\n                className="flex-1 flex items-center justify-center gap-2 py-2 px-3','                onClick={() => setIsSortPanelOpen(true)}\n                aria-haspopup="dialog"\n                className="flex-1 min-h-11 flex items-center justify-center gap-2 py-2 px-3');

replaceExact('<Search className="h-[18px] w-[18px] text-[#A0AEC0] transition-colors" />','<Search aria-hidden="true" className="h-[18px] w-[18px] text-[#A0AEC0] transition-colors" />');
replaceExact('<Search className="h-5 w-5 text-[#A0AEC0] transition-colors" />','<Search aria-hidden="true" className="h-5 w-5 text-[#A0AEC0] transition-colors" />');
replaceExact('<SlidersHorizontal className="w-4 h-4 text-brand-gold" />','<SlidersHorizontal aria-hidden="true" className="w-4 h-4 text-brand-gold" />',1);
replaceExact('<ArrowDownUp className="w-4 h-4 text-brand-gold" />','<ArrowDownUp aria-hidden="true" className="w-4 h-4 text-brand-gold" />',1);

for(const required of ['aria-label="Katalogda ara"','aria-controls="catalog-search-suggestions"','onBlur={handleSearchBlur}','onRequestClose={() => setIsSearchFocused(false)}','aria-haspopup="dialog"','min-h-11 min-w-11'])if(!text.includes(required))throw new Error(`Missing search/header accessibility contract: ${required}`);
if(text.includes('setTimeout(() => setIsSearchFocused(false), 200)'))throw new Error('Legacy delayed search blur survived');

fs.writeFileSync(file,text);
console.log('Search/header accessibility integration applied.');
