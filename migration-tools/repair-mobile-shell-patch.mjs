import fs from 'node:fs';

const file = 'migration-tools/patch-mobile-shell-accessibility-v2.mjs';
let text = fs.readFileSync(file, 'utf8');

function replaceCount(from, to, expected, label) {
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected}, found ${count}`);
  text = text.split(from).join(to);
}

replaceCount(
  "aria-label={cart.length > 0 ? `Sepetim, ${cart.length} ürün` : 'Sepetim'}",
  "aria-label={cart.length > 0 ? 'Sepetim, ' + cart.length + ' ürün' : 'Sepetim'}",
  2,
  'cart aria labels',
);
replaceCount(
  "accessibilityLabel={cart.length > 0 ? `Sepetim, ${cart.length} ürün` : 'Sepetim'}",
  "accessibilityLabel={cart.length > 0 ? 'Sepetim, ' + cart.length + ' ürün' : 'Sepetim'}",
  1,
  'bottom cart accessibility label',
);
replaceCount(
  "accessibilityLabel={unreadCount > 0 ? `Hesabım, ${unreadCount} okunmamış bildirim` : 'Hesabım'}",
  "accessibilityLabel={unreadCount > 0 ? 'Hesabım, ' + unreadCount + ' okunmamış bildirim' : 'Hesabım'}",
  1,
  'bottom account accessibility label',
);

fs.writeFileSync(file, text);
console.log('Mobile shell patch escaping repaired.');
