// Help centre: Yardım ve destek, Sık sorulan sorular, Geri bildirim, Gizlilik
// and Politikalar ve yasal bilgiler are real list -> detail screens.
//   - they open without login (rendered before the account sign-in gate,
//     and listed on the guest account screen);
//   - each screen has its own address, so browser/Android back steps back;
//   - the FAQ is an accordion that opens downward under its question;
//   - feedback is stored through contact-submit (private.contact_messages)
//     and only then shows the success message;
//   - legal documents are the published markdown, rendered as elements;
//   - help, FAQ and legal stay readable while the backend is down;
//   - there is one help centre (the old SupportPanel is gone).
import fs from 'node:fs';

const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };

const help = read('src/features/help/HelpCenter.tsx');
const app = read('src/App.tsx');
const url = read('src/features/navigation/appUrl.ts');
const auth = read('src/features/auth/AuthScreen.tsx');
const faq = read('src/features/account/FaqPanel.tsx');
const body = read('src/features/content/SafePublishedBody.tsx');
const api = read('src/features/engagement/api.ts');
const offline = read('src/lib/offlineCatalog.ts');
const manifest = JSON.parse(read('scripts/offline-catalog/manifest.json') || '{"files":{}}');
const account = read('src/features/account/AccountCenter.tsx');

need(/React\.lazy\(\(\)=>import\('\.\/features\/help\/HelpCenter'\)\)/.test(app), 'HelpCenter must be lazy-loaded in App.tsx.');
const helpRender = app.indexOf('<HelpCenter');
const gate = app.indexOf('if(!currentUser)return<AuthScreen title="Golden Oremar Hesabı"');
need(helpRender > 0 && gate > 0 && helpRender < gate, 'HelpCenter must render before the account sign-in gate, so guests can open it.');
need(/accountView==='support'/.test(app), "The old 'support' address must open the help centre.");
need(/onOpenHelp=\{openAccount\}/.test(app), 'The guest account screen must link into the help centre.');
for (const view of ['faq', 'feedback', 'legal', 'legal:terms', 'legal:privacy', 'legal:returns', 'legal:about']) need(url.includes(`'${view}'`), `appUrl.ts must accept help:${view}.`);
need(/prefix === 'help' && HELP_SUBVIEWS\.has\(suffix\)/.test(url), 'appUrl.ts must validate help subviews.');
for (const label of ['Yardım ve destek', 'Sık sorulan sorular', 'Geri bildirim', 'Gizlilik', 'Politikalar ve yasal bilgiler']) {
  need(auth.includes(`'${label}'`), `Guest help list must offer "${label}".`);
  need(help.includes(label), `Help centre must show "${label}".`);
}
need(/aria-label="Geri"/.test(help) && /window\.history\.back\(\)/.test(help) && /parentOf\(view\)/.test(help), 'Help screens need a back button that steps back one screen (history, else the parent screen).');
need(/<details[^>]*className=\{`group/.test(faq) && /group-open:rotate-180/.test(faq) && /ChevronDown/.test(faq), 'FAQ must be a details accordion with a chevron that turns when it opens downward.');
need(/submitContactForm\(\{[\s\S]{0,300}source: 'app-feedback'/.test(help), "Feedback must be stored via submitContactForm with source 'app-feedback'.");
need(/source:input\.source\|\|'mobile-app'/.test(api), 'submitContactForm must pass the source through.');
const success = help.indexOf('Teşekkürler! Geri bildiriminiz alındı.');
need(success > 0 && /await submitContactForm[\s\S]{0,400}setSent\(true\)/.test(help), 'The feedback success message may appear only after the server accepted it.');
need(/name="website"/.test(help), 'Feedback form keeps the honeypot field.');
need(/export function MarkdownBody/.test(body) && !/dangerouslySetInnerHTML/.test(body), 'Published markdown must render as React elements, never as raw HTML.');
need(/hideLeadingTitle/.test(help), 'Legal detail must not repeat the document title.');
need(!fs.existsSync('src/features/account/SupportPanel.tsx') && !/SupportPanel/.test(account), 'There must be one help centre: SupportPanel is retired.');
need(/list_public_faq_v1: args =>/.test(offline) && /get_account_help_content_v1: args =>/.test(offline), 'FAQ and legal documents must open from the shipped copy while the backend is down.');
need(manifest.files?.['faq_tr.json'] && manifest.files?.['help_tr.json'], 'faq_tr.json and help_tr.json must be listed in the offline manifest.');

if (failures.length) {
  console.error('Help centre contract audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Help centre contract audit passed: help, FAQ, feedback, privacy and legal pages open without login, step back one screen at a time, store feedback before thanking, and stay readable while the backend is down.');
