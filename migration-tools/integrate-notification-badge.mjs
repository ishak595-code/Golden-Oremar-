import fs from 'node:fs';

const file='src/App.tsx';
let text=fs.readFileSync(file,'utf8');
function replaceExact(from,to,expected=1){
 const count=text.split(from).length-1;
 if(count!==expected)throw new Error(`Expected ${expected} occurrence(s), found ${count}: ${from.slice(0,140)}`);
 text=text.split(from).join(to);
}

replaceExact(
 "import AccountCenter from './features/account/AccountCenter';",
 "import AccountCenter from './features/account/AccountCenter';import { useUnreadNotificationCount } from './features/account/useUnreadNotificationCount';"
);

replaceExact(
 "  const { settings, updateSettings, notifications, markNotificationAsRead, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();",
 "  const { settings, updateSettings, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();"
);

replaceExact(
 "  const authRecovery = useAuthRecoveryCoordinator();",
 "  const authRecovery = useAuthRecoveryCoordinator();\n  const { unreadCount, setUnreadCount } = useUnreadNotificationCount(!!currentUser);"
);

replaceExact("  const [showNotifications, setShowNotifications] = useState(false);\n",'');
replaceExact(
 "      if (showNotifications) {\n        setShowNotifications(false);\n        return;\n      }\n",
 ''
);
replaceExact(
 "  }, [tabHistory, currentTab, accountView, isSearchFocused, showGiftModal, showNotifications, isFilterPanelOpen, isSortPanelOpen, authRecovery.recoveryPending]);",
 "  }, [tabHistory, currentTab, accountView, isSearchFocused, showGiftModal, isFilterPanelOpen, isSortPanelOpen, authRecovery.recoveryPending]);"
);
replaceExact("\n  const unreadCount = notifications.filter(n => !n.read).length;\n",'\n');

replaceExact(
 "          onOpenNotificationAction={(url, metadata) => {",
 "          onUnreadNotificationCountChange={setUnreadCount}\n          onOpenNotificationAction={(url, metadata) => {"
);

replaceExact(
 '                aria-label="Bildirimler"',
 "                aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : 'Bildirimler'}",
 2
);

// Hide the visual number from assistive tech because the parent button label now includes it.
replaceExact(
 '                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-pulse">',
 '                  <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full shadow-md ring-1.5 ring-white dark:ring-gray-950 animate-pulse">'
);
replaceExact(
 '                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 animate-pulse">',
 '                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full shadow-md ring-2 ring-white dark:ring-gray-900 animate-pulse">'
);

if(text.includes('notifications.filter(n => !n.read)'))throw new Error('Legacy unread count survived');
if(text.includes('showNotifications'))throw new Error('Dead legacy notification modal state survived');
if(!text.includes('useUnreadNotificationCount(!!currentUser)'))throw new Error('Server unread hook missing');
if(!text.includes('onUnreadNotificationCountChange={setUnreadCount}'))throw new Error('Account unread callback missing');

fs.writeFileSync(file,text);
console.log('Notification badge integration applied.');
