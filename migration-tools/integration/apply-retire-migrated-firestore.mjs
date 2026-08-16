import fs from 'node:fs';

const appTarget = process.argv[2] || 'src/App.tsx';
const dataTarget = process.argv[3] || 'src/context/DataContext.tsx';

let app = fs.readFileSync(appTarget, 'utf8');
let data = fs.readFileSync(dataTarget, 'utf8');

// Account product links should use the server reference directly so customer flows never depend on Firestore products.
const oldAccountProductOpen = `          onOpenProduct={(slug) => {
            const product = products.find((item: any) =>
              item.slug === slug || String(item.id) === slug
            );
            if (product) {
              handleProductClick(product);
            } else {
              showToast('Ürün güncel katalogda bulunamadı.');
            }
          }}`;
if (app.includes(oldAccountProductOpen)) {
  app = app.replace(oldAccountProductOpen, `          onOpenProduct={(slug) => {
            setSelectedProduct(null);
            setSelectedProductReference(slug);
            navigateToTab('product-detail');
          }}`);
}

// The synthetic test context is intentionally minimal. If the legacy listeners are absent, do nothing.
const hasLegacyListeners = data.includes('// Listen to Products') && data.includes('// Listen to Recipes');
if (hasLegacyListeners) {
  const modeAnchor = `    isFirstLoadProducts.current = true;\n    isFirstLoadOrders.current = true;`;
  if (!data.includes('const legacyAdminContentMode')) {
    if (!data.includes(modeAnchor)) throw new Error('Legacy listener mode anchor not found.');
    data = data.replace(modeAnchor, `${modeAnchor}\n    const legacyAdminContentMode = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';`);
  }

  function wrapSection(startMarker, endMarker, variableName) {
    const start = data.indexOf(startMarker);
    const end = data.indexOf(endMarker, start + startMarker.length);
    if (start < 0 || end <= start) throw new Error(`Listener boundaries not found for ${variableName}`);
    const original = data.slice(start, end);
    if (original.includes(`let ${variableName} = () => {};`)) return;
    const assignmentToken = `const ${variableName} = onSnapshot`;
    if (!original.includes(assignmentToken)) throw new Error(`Listener assignment not found for ${variableName}`);
    let body = original.slice(startMarker.length);
    body = body.replace(assignmentToken, `${variableName} = onSnapshot`);
    const wrapped = `${startMarker}\n    let ${variableName} = () => {};\n    if (legacyAdminContentMode) {${body}    }\n\n`;
    data = data.slice(0, start) + wrapped + data.slice(end);
  }

  // These collections now have complete Supabase customer/public replacements. Keep legacy reads only for old admin screens.
  wrapSection('    // Listen to Products', '    // Listen to Categories', 'unsubProducts');
  wrapSection('    // Listen to Categories', '    // Listen to Orders based on role', 'unsubCategories');

  // Customer and producer order screens are Supabase-backed. Old order listener remains for the legacy admin only.
  const ordersStart = data.indexOf('    // Listen to Orders based on role');
  const usersStart = data.indexOf('    // Listen to Users if admin', ordersStart);
  if (ordersStart < 0 || usersStart <= ordersStart) throw new Error('Order listener boundaries not found.');
  let ordersBlock = data.slice(ordersStart, usersStart);
  if (!ordersBlock.includes('if (legacyAdminContentMode)')) {
    const currentUserIf = '    if (currentUser) {';
    if (!ordersBlock.includes(currentUserIf)) throw new Error('Order currentUser guard not found.');
    ordersBlock = ordersBlock.replace(currentUserIf, '    if (legacyAdminContentMode) {');
    data = data.slice(0, ordersStart) + ordersBlock + data.slice(usersStart);
  }

  wrapSection('    // Listen to Recipes', '    // Listen to Blog Posts', 'unsubRecipes');
  wrapSection('    // Listen to Blog Posts', '    // Listen to Product Health Info', 'unsubBlogPosts');
  wrapSection('    // Listen to Product Health Info', '    // Listen to Events', 'unsubProductHealthInfo');
  wrapSection('    // Listen to Events', '    // Listen to Static Content', 'unsubEvents');

  // Settings/static content migrated for public storefront; keep legacy Firestore versions only for old admin editing screens.
  wrapSection('    // Listen to Static Content', '    const unsubHeroCategories = onSnapshot', 'unsubStaticContent');

  function wrapBareListener(startToken, endToken, variableName) {
    const start = data.indexOf(startToken);
    const end = data.indexOf(endToken, start + startToken.length);
    if (start < 0 || end <= start) throw new Error(`Bare listener boundaries not found for ${variableName}`);
    const original = data.slice(start, end);
    if (original.includes(`let ${variableName} = () => {};`)) return;
    let body = original.replace(`const ${variableName} = onSnapshot`, `${variableName} = onSnapshot`);
    const wrapped = `    let ${variableName} = () => {};\n    if (legacyAdminContentMode) {\n${body}    }\n\n`;
    data = data.slice(0, start) + wrapped + data.slice(end);
  }

  wrapBareListener('    const unsubHeroCategories = onSnapshot', '    const unsubHomeSections = onSnapshot', 'unsubHeroCategories');
  wrapBareListener('    const unsubHomeSections = onSnapshot', '    // Listen to Contact Info', 'unsubHomeSections');
  wrapSection('    // Listen to Contact Info', '    // Listen to General Settings', 'unsubContactInfo');
}

fs.writeFileSync(appTarget, app);
fs.writeFileSync(dataTarget, data);
console.log('Golden Oremar migrated Firestore customer/public listeners retired; legacy admin compatibility retained.');
