// "Üreticiye soru sor" must reach someone who can answer:
//   - a producer without its own seller account is answered by the store
//     (active admins join the conversation) instead of failing with
//     producer_not_available;
//   - opening a conversation is a routed view (messages:<id>), so browser
//     and Android back go thread -> inbox -> previous screen.
import fs from 'node:fs';
const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };
const sql = read('supabase/migrations/20261004200000_producer_questions_store_answers_v1.sql');
const panel = read('src/features/account/MessagesPanel.tsx');
const account = read('src/features/account/AccountCenter.tsx');
need(/answered_by_store:=producer_row\.owner_user_id is null/.test(sql) && /'admin'/.test(sql) && /role\.user_id<>caller_id/.test(sql), 'Producer questions without a producer account must go to store admins (never re-roling the asker).');
need(/onOpenConversation\?:\(id:string\)=>void/.test(panel) && /if\(onOpenConversation\)onOpenConversation\(item\.id\)/.test(panel), 'MessagesPanel must open threads through the router when it can.');
need(/navigate\(`messages:\$\{id\}`\)/.test(account) && /onCloseConversation=\{\(\)=>\{if\(Number\(window\.history\.state\?\.goldenOremarDepth\)>0\)window\.history\.back\(\)/.test(account), 'AccountCenter must route thread open/close (back steps thread -> inbox).');
if (failures.length) { console.error(`Producer question contract audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Producer question contract audit passed.');
