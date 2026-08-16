const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Find where to insert the Routing Sync
const targetRegex = /(const \[tabHistory, setTabHistory\] = useState<Tab\[\]>\(\['home'\]\);)/;

const routingCode = `  // URL Routing & SEO Sync (Added by System Architect)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get('tab');
      if (tabFromUrl && tabFromUrl !== currentTab) {
         setCurrentTab(tabFromUrl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Initial check
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && tabFromUrl !== currentTab) {
       setCurrentTab(tabFromUrl);
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      const newUrl = \`\${window.location.pathname}?\${params.toString()}\`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      // Dinamik SEO / Başlık Yönetimi
      const tabTitles: Record<string, string> = {
        'home': 'Ana Sayfa | Golden Oremar',
        'categories': 'Kategoriler | Doğal Şifa',
        'cart': 'Sepetim | Özel Sipariş',
        'profile': 'Benim Hesabım | VIP Müşteri',
        'admin': 'Sistem Yönetimi',
        'vendor-store': 'Üretici Mağazası',
      };
      document.title = tabTitles[currentTab] || 'Golden Oremar | VIP Organik Ekosistem';
    }
  }, [currentTab]);`;

if (content.match(targetRegex)) {
  content = content.replace(targetRegex, `$1\n\n${routingCode}`);
  console.log("Added Routing & SEO sync.");
} else {
  console.log("Could not find insertion point.");
}

fs.writeFileSync('src/App.tsx', content);
