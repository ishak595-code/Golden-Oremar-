import fs from 'node:fs';

const appPath=process.argv[2]||'src/App.tsx';
const contextPath=process.argv[3]||'src/context/DataContext.tsx';
let app=fs.readFileSync(appPath,'utf8');
let context=fs.readFileSync(contextPath,'utf8');

// App: import narrow server-authoritative admin session helpers.
const authScreenImport="import AuthScreen from './features/auth/AuthScreen';";
const authApiImport="import { getAdminSessionStatus, signOutCurrentSession } from './features/auth/api';";
if(!app.includes(authApiImport)){
  if(!app.includes(authScreenImport))throw new Error('AuthScreen import anchor missing.');
  app=app.replace(authScreenImport,authScreenImport+'\n'+authApiImport);
}

// App: replace cached role-derived admin flag with live admin_session_status.
const legacyAdminBlock=`  const [accountView, setAccountView] = useState<string>('menu');\n  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);\n\n  useEffect(() => {\n    if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {\n      setIsAdminLoggedIn(true);\n    } else {\n      setIsAdminLoggedIn(false);\n    }\n  }, [currentUser]);`;
const secureAdminBlock=`  const [accountView, setAccountView] = useState<string>('menu');\n  const [adminSession, setAdminSession] = useState<{ checked: boolean; isAdmin: boolean; roles: string[] }>({ checked: false, isAdmin: false, roles: [] });\n  const isAdminLoggedIn = adminSession.checked && adminSession.isAdmin;\n\n  useEffect(() => {\n    let active = true;\n    if (!currentUser?.id) {\n      setAdminSession({ checked: true, isAdmin: false, roles: [] });\n      return () => { active = false; };\n    }\n    setAdminSession(previous => ({ ...previous, checked: false }));\n    getAdminSessionStatus()\n      .then(status => {\n        if (active) setAdminSession({ checked: true, isAdmin: status.is_admin === true, roles: status.roles });\n      })\n      .catch(error => {\n        console.error('Supabase admin session verification failed', error);\n        if (active) setAdminSession({ checked: true, isAdmin: false, roles: [] });\n      });\n    return () => { active = false; };\n  }, [currentUser?.id]);`;
if(app.includes(legacyAdminBlock))app=app.replace(legacyAdminBlock,secureAdminBlock);
if(!app.includes('getAdminSessionStatus()'))throw new Error('Secure App admin verification not integrated.');

// App: block navigation before changing tabs.
const legacyNavigate=`  const navigateToTab = (tab: Tab) => {\n    if (tab !== currentTab) {\n      setTabHistory(prev => [...prev, tab]);\n      setCurrentTab(tab);\n    }\n  };`;
const secureNavigate=`  const navigateToTab = (tab: Tab) => {\n    if (tab === 'admin' && !isAdminLoggedIn) {\n      showToast(adminSession.checked ? 'Bu alan için doğrulanmış yönetici yetkisi gerekiyor.' : 'Yönetici yetkisi doğrulanıyor.');\n      if (currentTab !== 'account') {\n        setTabHistory(prev => [...prev, 'account']);\n        setCurrentTab('account');\n      }\n      return;\n    }\n    if (tab !== currentTab) {\n      setTabHistory(prev => [...prev, tab]);\n      setCurrentTab(tab);\n    }\n  };`;
if(app.includes(legacyNavigate))app=app.replace(legacyNavigate,secureNavigate);
if(!app.includes("tab === 'admin' && !isAdminLoggedIn"))throw new Error('Admin navigation guard missing.');

// App: direct URLs must not render AdminPage without verified server status.
app=app.replace("      currentTab === 'admin' ? (","      currentTab === 'admin' && isAdminLoggedIn ? (");
if(!app.includes("currentTab === 'admin' && isAdminLoggedIn ? ("))throw new Error('Admin render guard missing.');

// App: use Supabase session logout, not legacy HTTP auth endpoint.
app=app.replace("            await fetch('/api/auth/logout', { method: 'POST' });\n            setCurrentUser(null);\n            setIsAdminLoggedIn(false); ","            await signOutCurrentSession();\n            setCurrentUser(null);\n            setAdminSession({ checked: true, isAdmin: false, roles: [] }); ");
if(app.includes("fetch('/api/auth/logout'"))throw new Error('Legacy admin logout endpoint remains in App.');

// App: if a direct/admin history URL survives until verification completes, redirect once status is known.
const toastBlock=`  const showToast = useCallback((message: string) => {\n    setToast({ message, visible: true });\n    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);\n  }, []);`;
const adminRedirect=`\n\n  useEffect(() => {\n    if (currentTab === 'admin' && adminSession.checked && !adminSession.isAdmin) {\n      setCurrentTab('account');\n      setAccountView('home');\n      showToast('Bu alan için doğrulanmış yönetici yetkisi gerekiyor.');\n    }\n  }, [currentTab, adminSession.checked, adminSession.isAdmin, showToast]);`;
if(!app.includes('adminSession.checked && !adminSession.isAdmin')){
  if(!app.includes(toastBlock))throw new Error('showToast anchor missing.');
  app=app.replace(toastBlock,toastBlock+adminRedirect);
}

// DataContext: import admin session status.
context=context.replace("import { buildCurrentUserFromSession } from '../features/auth/api';","import { buildCurrentUserFromSession, getAdminSessionStatus } from '../features/auth/api';");
if(!context.includes('getAdminSessionStatus'))throw new Error('DataContext admin helper import missing.');

// DataContext: keep a fail-closed server-verified admin flag.
const contextState=`  const [currentUser, setCurrentUser] = useState<any>(null);\n  const [isAuthReady, setIsAuthReady] = useState(false);`;
const secureContextState=`  const [currentUser, setCurrentUser] = useState<any>(null);\n  const [isAuthReady, setIsAuthReady] = useState(false);\n  const [isPrivilegedAdminSession, setIsPrivilegedAdminSession] = useState(false);`;
if(context.includes(contextState))context=context.replace(contextState,secureContextState);
if(!context.includes('isPrivilegedAdminSession'))throw new Error('DataContext privileged admin state missing.');

const authEffectEnd=`  }, []);\n\n  const isFirstLoadProducts = useRef(true);`;
const adminVerificationEffect=`  }, []);\n\n  useEffect(() => {\n    let active = true;\n    if (!currentUser?.id) {\n      setIsPrivilegedAdminSession(false);\n      return () => { active = false; };\n    }\n    getAdminSessionStatus()\n      .then(status => { if (active) setIsPrivilegedAdminSession(status.is_admin === true); })\n      .catch(error => {\n        console.error('Supabase privileged admin verification failed', error);\n        if (active) setIsPrivilegedAdminSession(false);\n      });\n    return () => { active = false; };\n  }, [currentUser?.id]);\n\n  const isFirstLoadProducts = useRef(true);`;
if(!context.includes("console.error('Supabase privileged admin verification failed'")){
  if(!context.includes(authEffectEnd))throw new Error('DataContext auth effect end anchor missing.');
  context=context.replace(authEffectEnd,adminVerificationEffect);
}

// Replace only current-session authorization checks, not roles displayed for other users.
context=context.replace("const legacyAdminContentMode = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';","const legacyAdminContentMode = isPrivilegedAdminSession;");
context=context.replaceAll("currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'vendor')","currentUser && (isPrivilegedAdminSession || currentUser.role === 'vendor')");
context=context.replaceAll("currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')","currentUser && isPrivilegedAdminSession");
context=context.replaceAll("currentUser.role === 'admin' || currentUser.role === 'super_admin'","isPrivilegedAdminSession");
context=context.replaceAll("currentUser?.role === 'admin' || currentUser?.role === 'super_admin'","isPrivilegedAdminSession");
context=context.replace("}, [isAuthReady, currentUser]);","}, [isAuthReady, currentUser, isPrivilegedAdminSession]);");

// Fail build if old current-session admin role checks remain.
if(context.includes("currentUser.role === 'admin'")||context.includes("currentUser?.role === 'admin'"))throw new Error('Legacy currentUser admin authorization check remains in DataContext.');
if(context.includes("const legacyAdminContentMode = currentUser"))throw new Error('Legacy admin listener gate remains.');
if(!context.includes('const isApproved = isPrivilegedAdminSession;'))throw new Error('Legacy product approval gate was not secured.');

fs.writeFileSync(appPath,app);
fs.writeFileSync(contextPath,context);
console.log('Secure admin session gating integrated into App and DataContext.');
