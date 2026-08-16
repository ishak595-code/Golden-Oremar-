const fs = require('fs');
let content = fs.readFileSync('src/admin/AdminContent.tsx', 'utf-8');

content = content.replace(
  /setIsBlogModalOpen\(false\);/g, 
  "setIsBlogModalOpen(false); alert('İçerik başarıyla kaydedildi!'); if (setParentTab) setParentTab('dashboard');"
);

content = content.replace(
  /setIsProductHealthModalOpen\(false\);/g, 
  "setIsProductHealthModalOpen(false); alert('Ürün faydası kaydedildi!'); if (setParentTab) setParentTab('dashboard');"
);

fs.writeFileSync('src/admin/AdminContent.tsx', content);
