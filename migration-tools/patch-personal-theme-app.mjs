import fs from 'node:fs';

const file = 'src/App.tsx';
let text = fs.readFileSync(file, 'utf8');

function replaceOne(from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  text = text.replace(from, to);
}

replaceOne(
  `import { syncNativeAppearance } from './native';`,
  `import { useDeviceTheme } from './features/appearance/useDeviceTheme';`,
  'appearance import',
);

replaceOne(
  `  const { settings, updateSettings, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();\n  const [currentTab, setCurrentTab] = useState<Tab>('home');`,
  `  const { settings, addNotification, currentUser, setCurrentUser, products, recipes, productHealthInfo, blogPosts, staticContent, contactInfo, events, seedDatabase, heroCategories, homeSections } = useData();\n  const { theme: appearanceTheme, setTheme: setAppearanceTheme } = useDeviceTheme();\n  const [currentTab, setCurrentTab] = useState<Tab>('home');`,
  'App theme state',
);

replaceOne(
`  // Effects
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    void syncNativeAppearance(settings.theme).catch(error => {
      console.warn('Native appearance sync failed', error);
    });
  }, [settings.theme]);

  // Audio Helper`,
`  // Audio Helper`,
  'remove legacy global theme effect',
);

replaceOne(
`          theme={settings.theme}
          onThemeChange={(nextTheme) => updateSettings({ theme: nextTheme })}`,
`          theme={appearanceTheme}
          onThemeChange={setAppearanceTheme}`,
  'Account personal appearance props',
);

fs.writeFileSync(file, text);
console.log('App personal appearance integration applied.');
