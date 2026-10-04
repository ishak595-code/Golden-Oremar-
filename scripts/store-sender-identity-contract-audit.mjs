// When store staff write on behalf of the official store, customers see the
// store ("Golden Oremar" + logo), never the admin's personal name: thread,
// inbox preview and the new-message notification (which also feeds push).
// Staff still see which admin wrote it (staffName); messages keep the author.
import fs from 'node:fs';
const failures = [];
const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : (failures.push(`${file} is missing.`), ''));
const need = (cond, message) => { if (!cond) failures.push(message); };
const sql = read('supabase/migrations/20261004210000_store_sender_identity_v1.sql');
const api = read('src/features/account/messagesApi.ts');
const panel = read('src/features/account/MessagesPanel.tsx');
need(/'senderName',case when sender\.participant_role='admin' then store_name else profile\.display_name end/.test(sql), 'Thread must name store messages after the store.');
need(/'staffName',case when caller_is_staff and sender\.participant_role='admin' then profile\.display_name else null end/.test(sql), 'Only staff may see which admin wrote a store message.');
need(/'lastMessageSender'/.test(sql) && /when last_message\.sender_role='admin' then store_name/.test(sql), 'Inbox preview must attribute store messages to the store.');
need(/store_name\|\|' yanıt verdi'/.test(sql) && /'senderIsStore',true,'senderName',store_name\)/.test(sql), 'Customer notifications must name the store and carry no staff id.');
need(/insert into public\.messages\(conversation_id,sender_user_id,/.test(sql), 'messages.sender_user_id must keep the real author for audit.');
need(/senderIsStore:value\.senderIsStore===true/.test(api) && /staffName:/.test(api) && /lastMessageSender:/.test(api), 'messagesApi must read senderIsStore, staffName and lastMessageSender.');
need(/message\.senderIsStore&&!message\.isMine\?<img src="\/logo\.svg"/.test(panel) && /item\.lastMessageSender\?/.test(panel) && /message\.staffName&&!message\.isMine/.test(panel), 'MessagesPanel must show the store logo/name, the preview sender and staffName for staff.');
if (failures.length) { console.error(`Store sender identity audit failed:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('Store sender identity contract audit passed.');
