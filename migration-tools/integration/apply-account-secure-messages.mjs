import fs from 'node:fs';

const accountPath=process.argv[2]||'src/features/account/AccountCenter.tsx';
const appPath=process.argv[3]||'src/App.tsx';
let account=fs.readFileSync(accountPath,'utf8');
let app=fs.readFileSync(appPath,'utf8');

if(!account.includes("import MessagesPanel from'./MessagesPanel';")){
 const needle="import NotificationsPanel from'./NotificationsPanel';";
 if(!account.includes(needle))throw new Error('AccountCenter notification import anchor missing.');
 account=account.replace(needle,needle+"\nimport MessagesPanel from'./MessagesPanel';");
}

if(!account.includes("['messages','Mesajlarım'")){
 const needle=" ['notifications','Bildirimler',Bell,'Sipariş, ödeme, kargo ve sistem bildirimleri'],";
 if(!account.includes(needle))throw new Error('Account menu notifications anchor missing.');
 account=account.replace(needle," ['messages','Mesajlarım',MessageCircle,'Destek ve üretici konuşmaları'],\n"+needle);
}

if(!account.includes('messageConversationId')){
 const needle="const[overview,setOverview]=useState<AccountOverview|null>(null);const[view,setView]=useState<AccountView>('home');const[loading,setLoading]=useState(true);const[error,setError]=useState('');";
 if(!account.includes(needle))throw new Error('Account state anchor missing.');
 account=account.replace(needle,needle+"const[messageConversationId,setMessageConversationId]=useState('');");
}

if(!account.includes("requestedView.startsWith('messages:')")){
 const needle='  if(!requestedView)return;\n  if(requestedView===\'contact\'){onOpenContact?.();return;}';
 if(!account.includes(needle))throw new Error('Account requestedView anchor missing.');
 account=account.replace(needle,"  if(!requestedView)return;\n  if(requestedView.startsWith('messages:')){setMessageConversationId(requestedView.slice('messages:'.length));setView('messages');return;}\n  if(requestedView==='messages'){setMessageConversationId('');setView('messages');return;}\n  if(requestedView==='contact'){onOpenContact?.();return;}");
}

if(!account.includes("if(view==='messages')")){
 const needle="  if(view==='notifications')return<NotificationsPanel onOpenAction={onOpenNotificationAction}/>;";
 if(!account.includes(needle))throw new Error('Account notifications body anchor missing.');
 account=account.replace(needle,needle+"\n  if(view==='messages')return<MessagesPanel initialConversationId={messageConversationId}/>;");
}

const supportOld="  if(view==='support')return<SupportPanel locale={overview.profile.locale} onOpenMessages={onOpenMessages}/>;";
if(account.includes(supportOld))account=account.replace(supportOld,"  if(view==='support')return<SupportPanel locale={overview.profile.locale} onOpenMessages={()=>setView('messages')}/>;");

if(app.includes("if (url?.includes('/messages/')) setAccountView('support');")){
 app=app.replace("onOpenNotificationAction={(url) => {\n            if (url?.includes('/messages/')) setAccountView('support');","onOpenNotificationAction={(url, metadata) => {\n            if (url?.includes('/messages/')) {\n              const conversationId = metadata?.conversationId || url.split('/messages/')[1]?.split(/[?#/]/)[0] || '';\n              setAccountView(conversationId ? `messages:${conversationId}` : 'messages');\n            }");
}

if(!account.includes("<MessagesPanel initialConversationId={messageConversationId}"))throw new Error('MessagesPanel not integrated.');
if(!account.includes("['messages','Mesajlarım'"))throw new Error('Messages menu not integrated.');
if(!app.includes("setAccountView(conversationId ? `messages:${conversationId}` : 'messages')"))throw new Error('Message notification routing not integrated.');

fs.writeFileSync(accountPath,account);
fs.writeFileSync(appPath,app);
console.log('Secure account messages integrated.');
