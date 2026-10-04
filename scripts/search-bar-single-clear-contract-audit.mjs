// The search box shows one clear button ("Aramayı temizle") and one voice
// button. The browser's built-in search "x" is hidden so the box never shows
// two crosses (reported 2026-10-04), and the suggestions list must not be
// clipped by the header.
import fs from 'node:fs';
const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };
const input = read('src/features/catalog/CatalogSearchInput.tsx');
const css = read('src/features/customer-experience/premiumMobileV2.css');
need((input.match(/aria-label="Aramayı temizle"/g) || []).length === 1, 'CatalogSearchInput must have exactly one "Aramayı temizle" button.');
need((input.match(/className="go-search-bar__voice"/g) || []).length === 1, 'CatalogSearchInput must have exactly one voice button.');
need(/\.go-search-bar input\[type="search"\]::-webkit-search-cancel-button[\s\S]{0,200}display:none/.test(css), 'The native search cancel button must be hidden inside .go-search-bar.');
// The suggestions panel hangs below the header; a paint-containing header
// clipped it on the home tab (suggestions were in the page but invisible).
need(!/header\{[^}]*contain:[^;}]*paint/.test(css), 'The home header must not use contain: paint (it clips the search suggestions).');
if (failures.length) { console.error(`Search bar single-clear audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Search bar single-clear audit passed.');
