import fs from 'node:fs';

const accountPath=process.argv[2]||'src/features/account/AccountCenter.tsx';
const appPath=process.argv[3]||'src/App.tsx';
let account=fs.readFileSync(accountPath,'utf8');
let app=fs.readFileSync(appPath,'utf8');

if(!account.includes('orderDetailId')){
 const needle="const[overview,setOverview]=useState<AccountOverview|null>(null);const[view,setView]=useState<AccountView>('home');const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[messageConversationId,setMessageConversationId]=useState('');";
 if(!account.includes(needle))throw new Error('Account state anchor missing.');
 account=account.replace(needle,needle+"const[orderDetailId,setOrderDetailId]=useState('');");
}

if(!account.includes("requestedView.startsWith('orders:')")){
 const needle="  if(requestedView.startsWith('messages:')){setMessageConversationId(requestedView.slice('messages:'.length));setView('messages');return;}";
 if(!account.includes(needle))throw new Error('Requested view messages anchor missing.');
 account=account.replace(needle,"  if(requestedView.startsWith('orders:')){setOrderDetailId(requestedView.slice('orders:'.length));setView('orders');return;}\n  if(requestedView==='orders'){setOrderDetailId('');setView('orders');return;}\n"+needle);
}

account=account.replace("  if(view==='orders')return<OrdersPanel/>;","  if(view==='orders')return<OrdersPanel initialOrderId={orderDetailId||null}/>;");
if(!account.includes('initialOrderId={orderDetailId||null}'))throw new Error('OrdersPanel deep-link prop missing.');

const menuNeedle="{menu.map(([key,label,Icon,description])=><button key={key} onClick={()=>{if(key==='contact'){onOpenContact?.();return;} setView(key as AccountView);}}";
if(account.includes(menuNeedle)){
 account=account.replace(menuNeedle,"{menu.map(([key,label,Icon,description])=><button key={key} onClick={()=>{if(key==='contact'){onOpenContact?.();return;} if(key==='orders')setOrderDetailId(''); setView(key as AccountView);}}");
}

if(!app.includes("metadata?.orderId")){
 const needle="            else if (url?.includes('producer')) setAccountView('seller');";
 if(!app.includes(needle))throw new Error('Notification producer routing anchor missing.');
 app=app.replace(needle,"            else if (metadata?.orderId) setAccountView(`orders:${metadata.orderId}`);\n"+needle);
}

if(!app.includes("setAccountView(`orders:${metadata.orderId}`)"))throw new Error('Order notification routing missing.');
if(!account.includes("requestedView.startsWith('orders:')"))throw new Error('Account order requestedView routing missing.');

fs.writeFileSync(accountPath,account);
fs.writeFileSync(appPath,app);
console.log('Order notification deep-link integrated.');
