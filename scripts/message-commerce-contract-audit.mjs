import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(relative){const file=path.join(root,relative);if(!fs.existsSync(file)){failures.push(`Missing marketplace messaging contract file: ${relative}`);return'';}return fs.readFileSync(file,'utf8');}
function requirePattern(content,pattern,message){if(!pattern.test(content))failures.push(message);}
function forbid(content,pattern,message){if(pattern.test(content))failures.push(message);}

const api=read('src/features/account/messagesApi.ts');
if(api){
 requirePattern(api,/get_my_message_policy_v1/,'Messaging API must read the server-authoritative message policy.');
 requirePattern(api,/list_my_producer_conversations_v1/,'Seller messages must use the producer-scoped conversation RPC.');
 requirePattern(api,/scope:'all'\|'producer'/,'Canonical conversation listing must keep explicit all/producer scope.');
 requirePattern(api,/message_moderation_blocked:/,'Backend moderation violations must remain user-facing and categorized.');
 requirePattern(api,/globalThis\.crypto\.randomUUID\(\)_attachment\./,'Uploaded message attachment names must remain neutral and not expose original filenames.');
 requirePattern(api,/parsed\.protocol!=='https:'/,'Message attachment signed URLs must remain HTTPS-only.');
 forbid(api,/const\s+(EMAIL_RE|PHONE_RE|DIRECT_CHANNEL_RE)\b|containsDisallowedContactInformation/,'Client-side hardcoded off-platform filters must not override Super Admin policy.');
 forbid(api,/unwrap<any>/,'Messaging RPCs must not return raw any payloads.');
}

const question=read('src/features/account/ProducerQuestionComposer.tsx');
if(question){
 requirePattern(question,/getMyMessagePolicy/,'Producer question composer must read live attachment/message policy.');
 requirePattern(question,/startProducerProductConversation/,'Product questions must enter canonical producer conversations.');
 requirePattern(question,/startProducerOrderConversation/,'Post-purchase questions must enter canonical producer conversations.');
 requirePattern(question,/uploadMessageAttachment/,'Producer questions must support policy-controlled evidence attachments.');
 forbid(question,/containsDisallowedContactInformation|EMAIL_RE|PHONE_RE/,'Question UI must not duplicate backend moderation policy.');
}

const messages=read('src/features/account/MessagesPanel.tsx');
if(messages){
 requirePattern(messages,/scope\?:'all'\|'producer'/,'One canonical MessagesPanel must support customer and seller scopes.');
 requirePattern(messages,/listMyConversations\(CONVERSATION_PAGE_SIZE,0,scope\)/,'MessagesPanel must pass its canonical scope to the server list API.');
 requirePattern(messages,/getMyMessagePolicy/,'MessagesPanel attachment controls must follow live message policy.');
 forbid(messages,/allowedAccept=['"]|allowedTypes=new Set|20\*1024\*1024|en fazla 5 ek dosya/,'MessagesPanel must not reintroduce hardcoded attachment policy limits.');
}

const seller=read('src/features/account/SellerPanel.tsx');
if(seller){
 requirePattern(seller,/React\.lazy\(\(\)\s*=>\s*import\('\.\/MessagesPanel'\)\)/,'Seller panel must reuse the canonical MessagesPanel instead of a duplicate seller messenger.');
 requirePattern(seller,/scope="producer"/,'Seller customer questions must use producer-scoped messaging.');
 requirePattern(seller,/title="Müşteri Soruları"/,'Seller panel must expose the customer-question operation clearly.');
}

const product=read('src/features/catalog/ProductDetailScreen.tsx');
if(product){
 requirePattern(product,/>Soru sor<\/button>/,'Product detail must expose the canonical Soru sor entry point.');
 requirePattern(product,/ProducerQuestionComposer/,'Product detail questions must use the shared question composer.');
}

const producer=read('src/features/catalog/PublicProducerScreen.tsx');
if(producer){
 requirePattern(producer,/>Soru sor<\/button>/,'Producer product cards must use the standard Soru sor label.');
 requirePattern(producer,/ProducerQuestionComposer/,'Producer profile questions must use the shared question composer.');
 forbid(producer,/Bu ürün hakkında sor/,'Legacy product-question label must not return.');
}

const orders=read('src/features/account/OrdersPanel.tsx');
if(orders){
 requirePattern(orders,/i\.producerId\?<button/,'Post-purchase Soru sor must only appear for order items with a real producer id.');
 requirePattern(orders,/kind:'order'/,'Post-purchase questions must retain order context.');
 requirePattern(orders,/ProducerQuestionComposer/,'Orders must reuse the shared producer question composer.');
}

const adminApi=read('src/admin/messageModerationAdminApi.ts');
if(adminApi){
 requirePattern(adminApi,/admin_get_message_moderation_v1/,'Super Admin moderation settings must load from the private backend policy.');
 requirePattern(adminApi,/admin_update_message_moderation_v1/,'Super Admin moderation settings must save through the guarded backend RPC.');
}

const adminSettings=read('src/admin/AdminSettings.tsx');
if(adminSettings){
 requirePattern(adminSettings,/Mesaj Güvenliği/,'Admin settings must expose the message-security management surface.');
 requirePattern(adminSettings,/blockExternalPayments/,'Admin settings must retain the off-platform payment filter control.');
 requirePattern(adminSettings,/blockBankDetails/,'Admin settings must retain bank/IBAN filtering control.');
 requirePattern(adminSettings,/customBlockedPhrases/,'Admin settings must retain custom blocked-phrase management.');
 requirePattern(adminSettings,/maxAttachmentMb/,'Admin settings must retain configurable attachment size policy.');
}

const migration=read('supabase/migrations/20260819082925_add_super_admin_message_moderation.sql');
if(migration){
 requirePattern(migration,/create table if not exists private\.message_moderation_settings/,'Canonical migration must own the private moderation settings table.');
 requirePattern(migration,/private\.message_moderation_violation_v1/,'Canonical migration must own server-side marketplace moderation.');
 requirePattern(migration,/private\.has_role\('super_admin'\)/,'Moderation policy changes must remain Super Admin only.');
 requirePattern(migration,/private\.validate_message_attachments_v1/,'Canonical migration must enforce live attachment policy server-side.');
 requirePattern(migration,/private\.list_my_producer_conversations_v1/,'Canonical migration must preserve seller-scoped conversation listing.');
 requirePattern(migration,/private\.get_my_message_policy_v1/,'Canonical migration must expose only the sanitized authenticated message policy.');
}

if(failures.length){console.error('Golden Oremar marketplace messaging contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar marketplace messaging contract audit passed: questions, seller replies, attachments, server moderation and Super Admin policy remain canonical.');
