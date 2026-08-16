const fs = require('fs');

let content = fs.readFileSync('src/data.ts', 'utf-8');

// Change Yayık Ayranı category
content = content.replace(/(name:\s*'Taze Yayık Ayranı[\s\S]*?category:\s*)'Süt & Şarküteri'/, "$1'Yöresel İçecekler'");

// Change Kan Kırmızı Yabani Kızılcık Şurubu Seti category (currently unknown, let's see its current category)
content = content.replace(/(name:\s*'Kan Kırmızı Yabani Kızılcık Şurubu Seti'[\s\S]*?category:\s*)'[^']+'/, "$1'Yöresel İçecekler'");

fs.writeFileSync('src/data.ts', content);
