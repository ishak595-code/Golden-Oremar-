const fs = require('fs');

function applyFix(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  if (!content.includes('setActiveTab: setParentTab')) {
    content = content.replace(
      /export function ([A-Za-z]+)\(\) \{/,
      "export function $1({ setActiveTab: setParentTab }: { setActiveTab?: (tab: string) => void }) {"
    );
  }

  // AdminEvents uses handleSaveEvent
  if (filePath.includes('AdminEvents') && content.includes('setIsEventModalOpen(false);')) {
    content = content.replace(
      /setIsEventModalOpen\(false\);/g,
      "setIsEventModalOpen(false); alert('Etkinlik başarıyla kaydedildi!'); if (setParentTab) setParentTab('dashboard');"
    );
  }

  fs.writeFileSync(filePath, content);
}

applyFix('src/admin/AdminEvents.tsx');
