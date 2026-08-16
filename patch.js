const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/\.toLowerCase\(\)/g, '?.toLowerCase()');
fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx patched');
