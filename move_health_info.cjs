const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Find the Health Info section
const healthInfoRegex = /\s*\/\* Health Info Section \*\/[\s\S]*?(?=\{\/\* Recipes Section \*\/)/;
const healthMatch = content.match(healthInfoRegex);

if (healthMatch) {
  const healthBlock = healthMatch[0];
  content = content.replace(healthInfoRegex, '\n            ');
  
  // Insert below accordion "Hikayesi ve Yapım Süreci"
  const targetRegex = /(<AccordionItem title="Hikayesi ve Yapım Süreci"[\s\S]*?<\/AccordionItem>)/;
  
  content = content.replace(targetRegex, `$1\n${healthBlock}\n`);
  
  fs.writeFileSync('src/App.tsx', content);
  console.log("Moved Health Info Section.");
} else {
  console.log("Health Info Section not found.");
}
