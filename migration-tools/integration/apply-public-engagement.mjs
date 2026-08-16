import fs from 'node:fs';

const target = process.argv[2] || 'src/App.tsx';
let source = fs.readFileSync(target, 'utf8');

const importAnchor = "import AccountCenter from './features/account/AccountCenter';";
if (!source.includes(importAnchor)) throw new Error('AccountCenter import missing; apply cumulative patches in order.');
for (const line of [
  "import PublicContactScreen from './features/engagement/PublicContactScreen';",
  "import PublicEventsScreen from './features/engagement/PublicEventsScreen';",
]) {
  if (!source.includes(line)) source = source.replace(importAnchor, `${importAnchor}\n${line}`);
}

// Replace only the mounted Events route. Old component definition can be removed later with the rest of legacy content code.
const eventsStart = source.indexOf("    if (currentTab === 'events') {");
const healthStart = source.indexOf("    if (currentTab === 'health') {", eventsStart);
if (eventsStart < 0 || healthStart <= eventsStart) throw new Error('Events route boundaries not found.');
const eventsBranch = `    if (currentTab === 'events') {
      return <PublicEventsScreen onBack={goBack} currentUser={currentUser} />;
    }

`;
source = source.slice(0, eventsStart) + eventsBranch + source.slice(healthStart);

// Replace the legacy contact simulation with the server-backed Edge Function form.
const contactStart = source.indexOf("    if (currentTab === 'contact') {");
const aboutStart = source.indexOf("    if (currentTab === 'about') {", contactStart);
if (contactStart < 0 || aboutStart <= contactStart) throw new Error('Contact route boundaries not found.');
const contactBranch = `    if (currentTab === 'contact') {
      return <PublicContactScreen onBack={goBack} currentUser={currentUser} locale={currentUser?.locale || 'tr'} />;
    }

`;
source = source.slice(0, contactStart) + contactBranch + source.slice(aboutStart);

if (source.includes("return <EventsPage />") || source.includes("return <ContactPage />")) {
  throw new Error('Legacy EventsPage/ContactPage is still mounted after engagement patch.');
}

fs.writeFileSync(target, source);
console.log(`Golden Oremar public contact + events integrated into ${target}`);
