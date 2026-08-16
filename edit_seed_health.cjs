const fs = require('fs');

let content = fs.readFileSync('src/context/DataContext.tsx', 'utf-8');

// Add PRODUCT_HEALTH_INFO to imports from data
if (content.includes('import {') && !content.includes('PRODUCT_HEALTH_INFO')) {
    content = content.replace(/(import \{[\s\S]*?)(\} from '\.\.\/data';)/, '$1, PRODUCT_HEALTH_INFO$2');
}

// Modify seedDatabase clearing
const clearTargetRegex = /(const deleteBlogPromises = blogSnapshot\.docs\.map\(doc => deleteDoc\(doc\.ref\)\);)/;
const clearReplacement = `$1\n\n      const healthInfoSnapshot = await getDocs(collection(db, 'productHealthInfo'));\n      const deleteHealthInfoPromises = healthInfoSnapshot.docs.map(doc => deleteDoc(doc.ref));`;

if (content.match(clearTargetRegex)) {
    content = content.replace(clearTargetRegex, clearReplacement);
}

const allPromisesRegex = /(await Promise\.all\(\[\s*\.\.\.deletePromises,\s*\.\.\.deleteCategoriesPromises,\s*\.\.\.deleteRecipesPromises,\s*\.\.\.deleteBlogPromises)(\s*\]\);)/;
if (content.match(allPromisesRegex)) {
    content = content.replace(allPromisesRegex, '$1,\n        ...deleteHealthInfoPromises$2');
}

// Modify seedDatabase populating
const populateTargetRegex = /(for \(const b of BLOG_POSTS\) \{\s*await addDoc\(collection\(db, 'blogPosts'\), b\);\s*\})/;
const populateReplacement = `$1\n\n      for (const info of PRODUCT_HEALTH_INFO) {\n        await addDoc(collection(db, 'productHealthInfo'), info);\n      }`;

if (content.match(populateTargetRegex)) {
    content = content.replace(populateTargetRegex, populateReplacement);
}

fs.writeFileSync('src/context/DataContext.tsx', content);
console.log('Done!');
