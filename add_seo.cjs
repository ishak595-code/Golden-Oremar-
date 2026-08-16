const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const titleChangeRegex = /(document\.title = tabTitles\[currentTab\] \|\| 'Golden Oremar \| VIP Organik Ekosistem';)/;

const metaDynamic = `      document.title = tabTitles[currentTab] || 'Golden Oremar | VIP Organik Ekosistem';
      
      // Dinamik Meta Tag'leri
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      
      const tabDescriptions: Record<string, string> = {
        'home': 'Golden Oremar ile VIP organik ürünler, şifalı bitkiler ve eşsiz doğa hasatları.',
        'categories': 'Dağlık Oremar bölgesinden gelen özel bal, organik meyveler ve doğal şifa ürünleri kategorileri.',
        'cart': 'Özel siparişlerinizi ve Concierge teslimatlarınızı yönetin.',
        'profile': 'VIP müşteri profilinizi, geçmiş siparişlerinizi ve kişisel verilerinizi güvenle yönetin.',
      };
      
      metaDesc.setAttribute('content', tabDescriptions[currentTab] || 'Doğadan gelen en özel ürünler sadece sizin için özenle toplanır.');
      
      let metaOgTitle = document.querySelector('meta[property="og:title"]');
      if (!metaOgTitle) {
        metaOgTitle = document.createElement('meta');
        metaOgTitle.setAttribute('property', 'og:title');
        document.head.appendChild(metaOgTitle);
      }
      metaOgTitle.setAttribute('content', tabTitles[currentTab] || 'Golden Oremar');`;

if (content.match(titleChangeRegex)) {
  content = content.replace(titleChangeRegex, metaDynamic);
  console.log("SEO Meta Tags implemented");
} else {
  console.log("Could not find title insertion");
}

fs.writeFileSync('src/App.tsx', content);
