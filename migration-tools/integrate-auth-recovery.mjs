import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

function replaceExact(from, to, expected = 1) {
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} occurrences, found ${count}: ${from.slice(0, 120)}`);
  text = text.split(from).join(to);
}

replaceExact(
  "import AuthScreen from './features/auth/AuthScreen';import { getAdminSessionStatus, signOutCurrentSession } from './features/auth/api';",
  "import AuthScreen from './features/auth/AuthScreen';import PasswordRecoveryScreen from './features/auth/PasswordRecoveryScreen';import { useAuthRecoveryCoordinator } from './features/auth/useAuthRecoveryCoordinator';import { getAdminSessionStatus, signOutCurrentSession } from './features/auth/api';"
);

replaceExact(
  "  const [accountView, setAccountView] = useState<string>('menu');\n  const [adminSession, setAdminSession]",
  "  const [accountView, setAccountView] = useState<string>('menu');\n  const authRecovery = useAuthRecoveryCoordinator();\n\n  useEffect(() => {\n    if (!authRecovery.callbackHandled) return;\n    setCurrentTab('account');\n    setAccountView('menu');\n    setTabHistory(previous => previous[previous.length - 1] === 'account' ? previous : [...previous, 'account']);\n    if (!authRecovery.recoveryPending) authRecovery.acknowledgeCallback();\n  }, [authRecovery.callbackHandled, authRecovery.recoveryPending, authRecovery.acknowledgeCallback]);\n\n  const [adminSession, setAdminSession]"
);

replaceExact(
  "    void CapApp.addListener('backButton', () => {\n      if (isSearchFocused) {",
  "    void CapApp.addListener('backButton', () => {\n      if (authRecovery.recoveryPending) {\n        return;\n      }\n      if (isSearchFocused) {"
);

replaceExact(
  "  }, [tabHistory, currentTab, accountView, isSearchFocused, showGiftModal, showNotifications, isFilterPanelOpen, isSortPanelOpen]);",
  "  }, [tabHistory, currentTab, accountView, isSearchFocused, showGiftModal, showNotifications, isFilterPanelOpen, isSortPanelOpen, authRecovery.recoveryPending]);"
);

replaceExact(
  "  const showToast = useCallback((message: string) => {\n    setToast({ message, visible: true });\n    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);\n  }, []);\n\n  useEffect(() => {",
  "  const showToast = useCallback((message: string) => {\n    setToast({ message, visible: true });\n    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);\n  }, []);\n\n  useEffect(() => {\n    if (!authRecovery.error) return;\n    showToast(authRecovery.error);\n    authRecovery.clearError();\n  }, [authRecovery.error, authRecovery.clearError, showToast]);\n\n  useEffect(() => {"
);

replaceExact(
  "    if (currentTab === 'account') {\n      if (!currentUser) {",
  "    if (currentTab === 'account') {\n      if (authRecovery.recoveryPending) {\n        return (\n          <PasswordRecoveryScreen\n            onCompleted={() => {\n              authRecovery.finishRecovery();\n              setAccountView('menu');\n              showToast('Şifreniz güvenle güncellendi.');\n            }}\n            onCancelled={() => {\n              authRecovery.finishRecovery();\n              setCurrentUser(null);\n              setAccountView('menu');\n              showToast('Şifre sıfırlama işlemi iptal edildi.');\n            }}\n          />\n        );\n      }\n\n      if (!currentUser) {"
);

if (!text.includes('PasswordRecoveryScreen')) throw new Error('Password recovery screen integration missing');
if (!text.includes('useAuthRecoveryCoordinator')) throw new Error('Auth recovery coordinator integration missing');
if (!text.includes('authRecovery.recoveryPending')) throw new Error('Recovery state integration missing');

fs.writeFileSync(file, text);
console.log('Auth recovery App integration applied.');
