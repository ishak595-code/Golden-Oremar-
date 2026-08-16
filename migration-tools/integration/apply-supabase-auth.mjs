import fs from 'node:fs';

const appTarget = process.argv[2] || 'src/App.tsx';
const dataContextTarget = process.argv[3] || 'src/context/DataContext.tsx';
let app = fs.readFileSync(appTarget, 'utf8');
let context = fs.readFileSync(dataContextTarget, 'utf8');

const authImport = "import AuthScreen from './features/auth/AuthScreen';";
if (!app.includes(authImport)) {
  const accountImport = "import AccountCenter from './features/account/AccountCenter';";
  if (!app.includes(accountImport)) throw new Error('AccountCenter import not found. Apply cumulative account patch first.');
  app = app.replace(accountImport, `${accountImport}\n${authImport}`);
}

// Firebase Auth must no longer drive the active customer session in App.tsx.
app = app.replace("import { auth, db } from './firebase';", "import { db } from './firebase';");
app = app.replace(/import \{ signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, signInWithPopup, updateProfile \} from 'firebase\/auth';\n?/, '');

// Admin status comes from server-backed roles, never from a hard-coded email.
app = app.replace(
  "if (currentUser?.role === 'admin') {\n      setIsAdminLoggedIn(true);",
  "if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {\n      setIsAdminLoggedIn(true);"
);

// Gate account/customer-sensitive screens with the Supabase-backed DataContext user.
const accountBranch = "    if (currentTab === 'account') {\n";
if (!app.includes("title=\"Golden Oremar Hesabı\"")) {
  const pos = app.indexOf(accountBranch);
  if (pos < 0) throw new Error('Account branch not found for auth gate.');
  const insertAt = pos + accountBranch.length;
  const gate = `      if (!currentUser) {\n        return <AuthScreen title=\"Golden Oremar Hesabı\" onAuthenticated={() => setAccountView('menu')} />;\n      }\n\n`;
  app = app.slice(0, insertAt) + gate + app.slice(insertAt);
}

const cartBranch = "    if (currentTab === 'cart') {\n";
if (!app.includes('Sepetinizi kullanmak için hesabınıza giriş yapın.')) {
  const pos = app.indexOf(cartBranch);
  if (pos < 0) throw new Error('Cart branch not found for auth gate.');
  const insertAt = pos + cartBranch.length;
  const gate = `      if (!currentUser) {\n        return <AuthScreen title=\"Sepetinizi kullanmak için hesabınıza giriş yapın.\" description=\"Sepetiniz, stok rezervasyonunuz ve siparişiniz hesabınıza güvenli şekilde bağlanır.\" />;\n      }\n\n`;
  app = app.slice(0, insertAt) + gate + app.slice(insertAt);
}

// Do not open gift checkout anonymously.
const oldGiftOpen = `  const openGiftModal = (product: any) => {\n    setGiftProduct(product);\n    setShowGiftModal(true);\n  };`;
if (app.includes(oldGiftOpen)) {
  app = app.replace(oldGiftOpen, `  const openGiftModal = (product: any) => {\n    if (!currentUser) {\n      setGiftProduct(product);\n      showToast('Hediye siparişi için hesabınıza giriş yapın.');\n      navigateToTab('account');\n      return;\n    }\n    setGiftProduct(product);\n    setShowGiftModal(true);\n  };`);
}

// DataContext: keep Firestore temporarily for legacy content, but replace Firebase Auth session/role logic.
context = context.replace("import { onAuthStateChanged } from 'firebase/auth';", "import { supabase } from '../lib/supabase';\nimport { buildCurrentUserFromSession } from '../features/auth/api';");

const authEffectStart = context.indexOf("  useEffect(() => {\n    let unsubUser: (() => void) | null = null;");
const nextMarker = context.indexOf("  const isFirstLoadProducts = useRef(true);", authEffectStart);
if (authEffectStart < 0 || nextMarker < 0) throw new Error('Firebase auth effect boundaries not found in DataContext.');

const newAuthEffect = `  useEffect(() => {\n    let active = true;\n    let hydrationSequence = 0;\n\n    const hydrateSession = async (session: any) => {\n      const sequence = ++hydrationSequence;\n      if (!session?.user) {\n        if (active && sequence === hydrationSequence) {\n          setCurrentUser(null);\n          setIsAuthReady(true);\n        }\n        return;\n      }\n      try {\n        const nextUser = await buildCurrentUserFromSession(session);\n        if (active && sequence === hydrationSequence) setCurrentUser(nextUser);\n      } catch (error) {\n        console.error('Supabase session hydration failed', error);\n        if (active && sequence === hydrationSequence) setCurrentUser(null);\n      } finally {\n        if (active && sequence === hydrationSequence) setIsAuthReady(true);\n      }\n    };\n\n    supabase.auth.getSession().then(({ data, error }) => {\n      if (error) {\n        console.error('Supabase initial session failed', error);\n        if (active) setIsAuthReady(true);\n        return;\n      }\n      void hydrateSession(data.session);\n    });\n\n    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {\n      // Run backend profile/role hydration after the auth callback returns.\n      setTimeout(() => { void hydrateSession(session); }, 0);\n    });\n\n    return () => {\n      active = false;\n      subscription.unsubscribe();\n    };\n  }, []);\n\n`;
context = context.slice(0, authEffectStart) + newAuthEffect + context.slice(nextMarker);

// Assert the dangerous hard-coded role escalation is gone from active source.
for (const forbidden of ['goldenoremar@gmail.com', 'ramcofero.yt@gmail.com', 'onAuthStateChanged(auth']) {
  if (context.includes(forbidden)) throw new Error(`Unsafe legacy auth marker still present after patch: ${forbidden}`);
}

fs.writeFileSync(appTarget, app);
fs.writeFileSync(dataContextTarget, context);
console.log(`Supabase Auth integrated into ${appTarget} and ${dataContextTarget}`);
