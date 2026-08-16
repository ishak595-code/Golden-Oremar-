const fs = require('fs');
let content = fs.readFileSync('src/admin/AdminProducts.tsx', 'utf-8');

content = content.replace(
  /setIsModalOpen\(false\);/g, 
  "setIsModalOpen(false); alert('Ürün başarıyla kaydedildi!'); if (setParentTab) setParentTab('dashboard');"
);

fs.writeFileSync('src/admin/AdminProducts.tsx', content);
