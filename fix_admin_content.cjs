const fs = require('fs');
let content = fs.readFileSync('src/admin/AdminContent.tsx', 'utf-8');
content = content.replace(/setActiveTab\('blog'\)/g, "setActiveTabLocal('blog')");
content = content.replace(/setActiveTab\('recipes'\)/g, "setActiveTabLocal('recipes')");
content = content.replace(/setActiveTab\('productHealth'\)/g, "setActiveTabLocal('productHealth')");
content = content.replace(/setActiveTab\('pages'\)/g, "setActiveTabLocal('pages')");
content = content.replace(/setActiveTab\('faq'\)/g, "setActiveTabLocal('faq')");
content = content.replace(/setActiveTab\('contact'\)/g, "setActiveTabLocal('contact')");
fs.writeFileSync('src/admin/AdminContent.tsx', content);
