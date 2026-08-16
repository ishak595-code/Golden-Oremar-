import fs from 'node:fs';

const file='src/App.tsx';
let text=fs.readFileSync(file,'utf8');

const oldBlock=`  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      const newUrl = \`${'${window.location.pathname}'}?${'${params.toString()}'}\`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      
      // Dinamik SEO / Başlık Yönetimi
      const tabTitles: Record<string, string> = {
        'home': 'Golden Oremar',
        'categories': 'Kategoriler | Golden Oremar',
        'cart': 'Sepetim | Golden Oremar',
        'profile': 'Hesabım | Golden Oremar',
        'admin': 'Yönetim | Golden Oremar',
      };
            document.title = tabTitles[currentTab] || 'Golden Oremar | VIP Organik Ekosistem';
      
      // Dinamik Meta Tag'leri
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      
      const tabDescriptions: Record<string, string> = {
        'home': 'Golden Oremar ile doğrulanmış köy ürünleri, şifalı bitkiler ve seçkin doğa hasatları.',
        'categories': 'Oremar bölgesinden gelen özel bal, köy ürünleri ve doğal ürün kategorileri.',
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
      metaOgTitle.setAttribute('content', tabTitles[currentTab] || 'Golden Oremar');
    }
  }, [currentTab]);`;

const newBlock=`  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== currentTab) {
      params.set('tab', currentTab);
      const newUrl = \`${'${window.location.pathname}'}?${'${params.toString()}'}\`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }

    const tabTitles: Partial<Record<Tab, string>> = {
      home: 'Golden Oremar | Doğrulanmış Üreticilerden Köy Ürünleri',
      categories: 'Ürün Kategorileri | Golden Oremar',
      cart: 'Sepetim | Golden Oremar',
      account: 'Hesabım | Golden Oremar',
      admin: 'Yönetim | Golden Oremar',
    };
    const tabDescriptions: Partial<Record<Tab, string>> = {
      home: 'Doğrulanmış üreticilerden köy ve yöresel ürünleri keşfedin; ürün ve menşe bilgilerini şeffaf biçimde inceleyin.',
      categories: 'Golden Oremar ürün kategorilerini ve doğrulanmış üretici ürünlerini keşfedin.',
      cart: 'Sepetinizdeki ürün, varyant ve adetleri kontrol ederek güvenli sipariş akışına devam edin.',
      account: 'Sipariş, favori, mesaj, adres ve hesap ayarlarınızı yönetin.',
    };
    const title = tabTitles[currentTab] || 'Golden Oremar';
    const description = tabDescriptions[currentTab] || 'Golden Oremar köy ve yöresel ürünler pazaryeri.';

    document.title = title;

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
      let element = document.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMeta('meta[name="title"]', 'name', 'title', title);
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  }, [currentTab]);`;

const count=text.split(oldBlock).length-1;
if(count!==1)throw new Error(`Expected one legacy metadata block, found ${count}`);
text=text.replace(oldBlock,newBlock);

for(const banned of ['VIP Organik Ekosistem','şifalı bitkiler','Doğadan gelen en özel ürünler','profile\': \'Hesabım']){
  if(text.includes(banned))throw new Error(`Legacy metadata text survived: ${banned}`);
}
if(!text.includes("account: 'Hesabım | Golden Oremar'"))throw new Error('Account title metadata missing');
if(!text.includes("meta[name=\"twitter:description\"]"))throw new Error('Dynamic Twitter description sync missing');

fs.writeFileSync(file,text);
console.log('Public dynamic metadata hardened.');
