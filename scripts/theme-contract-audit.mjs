// Theme contract audit.
//
// Tailwind's `dark:` variant must follow the colour scheme actually in effect,
// not only a theme literally named "dark". The default theme is "custom", and
// it is dark. When the variant was keyed to data-theme="dark" alone, every one
// of the app's `dark:` classes stayed off for customers on the default theme.
// Measured in a headless browser on 2026-09-25 across six screens: 39 colour
// contrast failures, including a sign-in form whose labels, placeholder text
// and "Hesap Aç" button were effectively invisible - white text on a white
// card. Re-keying the variant took that to zero. This audit keeps the three
// pieces wired together.

import fs from 'node:fs';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const css = fs.readFileSync('src/index.css', 'utf8');
const variant = css.match(/@custom-variant\s+dark\s*\(([^;]*)\);/)?.[1] || '';
check(Boolean(variant), 'src/index.css must define the dark custom variant.');
check(/\[data-color-scheme="dark"\]/.test(variant), 'The dark variant must match [data-color-scheme="dark"], the scheme actually in effect.');

const theme = fs.readFileSync('src/features/appearance/theme.ts', 'utf8');
check(/export function setDocumentColorScheme/.test(theme), 'theme.ts must expose setDocumentColorScheme.');
check(/setAttribute\('data-color-scheme',\s*scheme\)/.test(theme), 'setDocumentColorScheme must write data-color-scheme on <html>.');
check(/applyThemeToDocument[\s\S]{0,300}setDocumentColorScheme\(/.test(theme), 'applyThemeToDocument must set the colour scheme through setDocumentColorScheme.');
check(/theme === 'custom'/.test(theme.match(/export function isDarkTheme[\s\S]*?\n\}/)?.[0] || ''), 'isDarkTheme must keep treating the custom theme as dark until the brand appearance says otherwise.');

const brand = fs.readFileSync('src/features/appearance/brandAppearance.ts', 'utf8');
check(/setDocumentColorScheme\(activeAppearance\.colorScheme\)/.test(brand), 'The brand appearance must apply its colour scheme through setDocumentColorScheme, so an admin switching the custom theme to light also turns the dark variant off.');
check(!/documentElement\.style\.colorScheme\s*=/.test(brand), 'brandAppearance.ts must not set style.colorScheme directly; that would bypass data-color-scheme.');

// Readability in every theme (scripts/browser/theme-contrast-check.mjs runs
// axe across all five). These are the rules that broke in the light themes.
{
  const mobile = fs.readFileSync('src/features/customer-experience/premiumMobileV2.css', 'utf8');
  check(/nav\[aria-label="Ana gezinme"\] button span\.truncate\{color:inherit!important;\}/.test(mobile), 'Tab bar labels must follow the dark bar colour in every theme.');
  const index = fs.readFileSync('src/index.css', 'utf8');
  check(/--color-gray-500: #566960;/.test(index), 'gray-500 must stay dark enough for 4.5:1 on the light theme surfaces.');
  check(/\[data-theme="dark"\]\) \.text-gray-500:not\(\[class\*="dark:text-"\]\)/.test(index), 'gray-500 must follow the muted token in the dark scheme.');
  const reference = fs.readFileSync('src/features/customer-experience/videoReferencePremium.css', 'utf8');
  check(/background: var\(--go-forest-800\) !important;/.test(reference), 'The home search field keeps its dark surface in every theme.');
  // One <main> landmark: the app shell's. Screens render inside it.
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  const nested = walk('src').filter(f => f.endsWith('.tsx') && f !== 'src/App.tsx' && /<main[\s>]/.test(fs.readFileSync(f, 'utf8')));
  check(!nested.length, `Only App.tsx may render <main>; screens render inside it (found in ${nested.join(', ')}).`);
}

if (failures.length) {
  console.error('Theme contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Theme contract audit passed: the dark variant follows the colour scheme in effect, set in one place by both the theme and the brand appearance.');
