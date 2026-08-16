const fs = require('fs');

let content = fs.readFileSync('src/admin/AdminProducts.tsx', 'utf-8');

// Also need to add setActiveTab prop to AdminProducts
content = content.replace(
  /export function AdminProducts\(\) \{/,
  "export function AdminProducts({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {"
);

// find handleSave
let handleSaveRegex = /(const handleSave = \(\) => \{[\s\S]*?setIsModalOpen\(false\);)/;

if (content.match(handleSaveRegex)) {
  content = content.replace(handleSaveRegex, "$1 alert('Ürün başarıyla kaydedildi!'); if (setParentTab) setParentTab('dashboard');");
  console.log("Updated AdminProducts handleSave");
} else {
  console.log("Could not find HandleSave in AdminProducts");
}

fs.writeFileSync('src/admin/AdminProducts.tsx', content);

