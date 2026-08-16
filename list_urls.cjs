const fs = require('fs');
const content = fs.readFileSync('src/data.ts', 'utf-8');
const urls = [...content.matchAll(/image:\s*'(https:\/\/images\.unsplash\.com\/[^']+)'/g)].map(m => m[1]);
console.log(urls.join('\\n'));
