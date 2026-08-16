const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf-8');

let regex301 = /productId:\s*'301'[\s\S]*?content:\s*'[^']+'/
let repl301 = `productId: '301',
    title: 'Avaşin Deresi Canlı Alabalığı (Özel Hasat) - Sağlığa Faydaları',
    content: 'Bu eşsiz kırmızı benekli alabalık, doğal dağ sularının tüm minerallerini bünyesinde barındırır. Serbest ve vahşi ortamda yetiğştiği için etindeki Omega-3 ve saf protein oranı, endüstriyel balıklara kıyasla dört kat daha yüksektir. Düzenli tüketildiğinde kalp damar sağlığını zirveye taşır, sinir sistemini yapılandırır ve ruhsal zindelik sağlar. Bu şifa kaynağının damağınızda bırakacağı hafif ve temiz tat, tamamen doğanın bir armağanıdır.'`;

if (content.match(regex301)) {
    content = content.replace(regex301, repl301);
}

fs.writeFileSync('src/data.ts', content);
