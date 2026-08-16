import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(from, to);
}

{
  const path='src/App.tsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,"import { HERO_CATEGORIES } from './data';",'', 'Remove legacy data import');
  source=replaceOnce(source,"import { DataProvider, useData } from './context/DataContext';","import { useCustomerSession } from './features/auth/useCustomerSession';",'Replace DataContext import');
  source=replaceOnce(source,"import { query } from 'firebase/firestore';",'', 'Remove direct Firestore import');
  source=replaceOnce(source,"const AdminPage = React.lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));","const AdminPage = React.lazy(() => import('./pages/LegacyAdminEntry'));",'Lazy admin entry');
  source=replaceOnce(source,"  const { settings, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();\n  const { theme: appearanceTheme, setTheme: setAppearanceTheme } = useDeviceTheme();","  const { currentUser, setCurrentUser, authReady } = useCustomerSession();\n  const { theme: appearanceTheme, setTheme: setAppearanceTheme } = useDeviceTheme();",'Customer session source');
  source=replaceOnce(source,"      if (!currentUser) {\n        return <AuthScreen title=\"Golden Oremar Hesabı\" onAuthenticated={() => setAccountView('menu')} />;\n      }","      if (!authReady) return <RouteLoading label=\"Hesabınız doğrulanıyor\" />;\n      if (!currentUser) {\n        return <AuthScreen title=\"Golden Oremar Hesabı\" onAuthenticated={() => setAccountView('menu')} />;\n      }",'Account auth readiness');
  source=replaceOnce(source,"    if (currentTab === 'cart') {\n      if (!currentUser) {","    if (currentTab === 'cart') {\n      if (!authReady) return <RouteLoading label=\"Sepet oturumunuz doğrulanıyor\" />;\n      if (!currentUser) {",'Cart auth readiness');
  source=replaceOnce(source,"          <AdminPage \n            onBack={goBack}","          <AdminPage\n            currentUser={currentUser}\n            onBack={goBack}",'Pass verified user to lazy admin');
  source=source.replaceAll("<img src={settings.logoUrl || '/logo.svg'} alt=\"\"", "<img src=\"/logo.svg\" alt=\"\"");
  const oldWrapper=`export default function App() {\n  return (\n    <DataProvider>\n      <AppContent />\n    </DataProvider>\n  );\n}`;
  source=replaceOnce(source,oldWrapper,`export default function App() {\n  return <AppContent />;\n}`,'Remove global DataProvider wrapper');
  fs.writeFileSync(path,source);
}

{
  const path='src/context/DataContext.tsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,"export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {","export const DataProvider: React.FC<{ children: React.ReactNode; initialCurrentUser?: any }> = ({ children, initialCurrentUser = null }) => {",'DataProvider initial user prop');
  source=replaceOnce(source,"  const [currentUser, setCurrentUser] = useState<any>(null);\n  const [isAuthReady, setIsAuthReady] = useState(false);","  const [currentUser, setCurrentUser] = useState<any>(initialCurrentUser);\n  const [isAuthReady, setIsAuthReady] = useState(Boolean(initialCurrentUser));",'DataProvider initial user state');
  fs.writeFileSync(path,source);
}

{
  const path='src/pages/AdminPage.tsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,"  const userEmail = currentUser?.email?.toLowerCase() || '';\n  const isAuthenticated = currentUser && (['admin', 'super_admin', 'vendor'].includes(currentUser.role) || userEmail === 'ramcofero.yt@gmail.com' || userEmail === 'goldenoremar@gmail.com');","  const roles = Array.isArray(currentUser?.roles) ? currentUser.roles.map(String) : [];\n  const isAuthenticated = Boolean(currentUser && (roles.includes('admin') || roles.includes('super_admin')));",'Remove hardcoded admin identity bypass');
  fs.writeFileSync(path,source);
}

console.log('Customer shell detached from legacy Firebase DataProvider.');
