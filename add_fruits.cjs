const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf-8');

// Also update data.ts with new fruit/veg products
const productsRegex = /export const PRODUCTS = \[/;

const newProducts = `
  {
    id: 801,
    homeSection: 'new_arrivals',
    name: 'Hakkari Dağ Elması (İlaçsız)',
    description: 'Yüksek rakımda, gece ve gündüz sıcaklık farkının verdiği aromayla olgunlaşan, sert ve sulu dağ elması.',
    price: 150,
    pricePrefix: 'Kg',
    category: 'Taze Meyve & Sebze',
    tags: ['İlaçsız Tarım', 'Yerel Cins'],
    reviews: 14,
    rating: 4.9,
    stock: 50,
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?auto=format&fit=crop&q=80&w=1200',
    story: 'Bu elmalar standart bahçe ürünü değildir; dağ yamaçlarında rüzgar yiyerek büyür. İçine hapsolduğu yoğun şeker ve asidite, her ısırıkta kulaklarınızı çınlatacak bir gevreklik sunar. Doğal koruma mumuna sahiptir.',
    features: ['Tamamen İlaçsız', 'Rakım: 2000m+', 'Yüksek Aroma'],
    producer: 'Yeşiltaş Köyü Çiftçileri',
    origin: 'Dağlıca Meraları',
    unit: '1 kg File',
    weight: 1000
  },
  {
    id: 802,
    homeSection: 'regular',
    name: 'Yüksekova Yayla Domatesi',
    description: 'Aromasını güneşin ve yayla rüzgarının keskinliğinden alan, asiditesi yüksek, pembe kabuklu yerli domates.',
    price: 90,
    pricePrefix: 'Kg',
    category: 'Taze Meyve & Sebze',
    tags: ['Günlük Hasat', 'Ata Tohumu'],
    reviews: 42,
    rating: 4.8,
    stock: 80,
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=1200',
    story: 'Pazardaki su deposu domatesleri unutun. Ata tohumundan üretilen, içi etli ve çekirdekleri canlı olan bu domates, sadece bir miktar tuzla bile sofranın baş köşesine geçebilecek kadar lezzetlidir.',
    features: ['Toprakta Doğal Yetişim', 'Suni Gübresiz', 'Gerçek Domates Kokusu'],
    producer: 'Hakkari Organik Tarım Koperatifi',
    origin: 'Yüksekova',
    unit: '1 kg Seçme',
    weight: 1000
  },
`;

if (content.match(productsRegex)) {
  content = content.replace(productsRegex, `export const PRODUCTS = [\n${newProducts}`);
  console.log('Added fruits and veg.');
}

fs.writeFileSync('src/data.ts', content);
