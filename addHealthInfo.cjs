const fs = require('fs');
let code = fs.readFileSync('src/data.ts', 'utf-8');

const regex = /id: (\d+).*?name: '([^']+)'/gs;
let match;
const products = [];
while ((match = regex.exec(code)) !== null) {
  products.push({ id: match[1], name: match[2] });
}

let healthInfoStr = '';
for(let p of products) {
  healthInfoStr += `  {
    productId: '${p.id}',
    title: '${p.name} - Sağlığa Faydaları',
    content: 'Bu eşsiz doğa harikası ürün, modern yaşamın getirdiği stres ve bağışıklık sorunlarına karşı bedeninizi doğal bir zırh gibi korur. Kimyasal katkılardan uzak, doğrudan üreticiden sofranıza gelen bu şifa kaynağını düzenli tüketmek, hücre yenilenmesini destekler ve genel vücut direncinizin artmasına yardımcı olur.'
  },\n`;
}

code = code.replace(/export const PRODUCT_HEALTH_INFO = \[.*?\];/s, `export const PRODUCT_HEALTH_INFO = [\n${healthInfoStr}];`);

fs.writeFileSync('src/data.ts', code);
