import fs from 'node:fs';
import ts from 'typescript';

const file=process.argv[2]||'src/App.tsx';
let text=fs.readFileSync(file,'utf8');
const deadNames=new Set(['NavButton','ProductDetail','AccordionItem','CartSection','FavoritesSection','EventsPage','HealthPage','ContactPage','AboutPage','VendorStorePage','CategoriesPage']);

function parse(source){return ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function declarations(sf){
 const map=new Map();
 for(const stmt of sf.statements){
  if(ts.isFunctionDeclaration(stmt)&&stmt.name)map.set(stmt.name.text,{node:stmt,start:stmt.getFullStart(),end:stmt.end,nameNode:stmt.name});
  else if(ts.isClassDeclaration(stmt)&&stmt.name)map.set(stmt.name.text,{node:stmt,start:stmt.getFullStart(),end:stmt.end,nameNode:stmt.name});
  else if(ts.isVariableStatement(stmt))for(const decl of stmt.declarationList.declarations){if(ts.isIdentifier(decl.name)&&decl.initializer&&(ts.isArrowFunction(decl.initializer)||ts.isFunctionExpression(decl.initializer)))map.set(decl.name.text,{node:stmt,start:stmt.getFullStart(),end:stmt.end,nameNode:decl.name});}
 }
 return map;
}

let sf=parse(text);let decls=declarations(sf);
for(const name of deadNames)if(!decls.has(name))throw new Error(`Expected dead declaration missing: ${name}`);
const deadRanges=[...deadNames].map(name=>({name,...decls.get(name)}));
function insideDead(pos){return deadRanges.find(r=>pos>=r.start&&pos<r.end)?.name||null;}
for(const name of deadNames){
 const info=decls.get(name);const outside=[];
 function visit(node){
  if(ts.isIdentifier(node)&&node.text===name&&node!==info.nameNode){const pos=node.getStart(sf);const owner=insideDead(pos);if(!owner)outside.push(pos);}
  ts.forEachChild(node,visit);
 }
 visit(sf);
 if(outside.length)throw new Error(`${name} still has references outside dead declarations: ${outside.join(',')}`);
}

const ranges=deadRanges.map(r=>({start:r.start,end:r.end,name:r.name})).sort((a,b)=>b.start-a.start);
for(const range of ranges)text=text.slice(0,range.start)+text.slice(range.end);

// Remove only import bindings that became unused after the proven dead-code removal.
sf=parse(text);
const identifierCounts=new Map();
function count(node){if(ts.isIdentifier(node))identifierCounts.set(node.text,(identifierCounts.get(node.text)||0)+1);ts.forEachChild(node,count);}count(sf);
const importEdits=[];
for(const stmt of sf.statements){
 if(!ts.isImportDeclaration(stmt)||!stmt.importClause)continue;
 const clause=stmt.importClause;const moduleText=stmt.moduleSpecifier.getText(sf);const keptNamed=[];let defaultName=clause.name?.text||null;let namespaceName=null;
 if(defaultName&&(identifierCounts.get(defaultName)||0)<=1)defaultName=null;
 const bindings=clause.namedBindings;
 if(bindings&&ts.isNamedImports(bindings))for(const el of bindings.elements){const local=el.name.text;if((identifierCounts.get(local)||0)>1)keptNamed.push(el.getText(sf));}
 else if(bindings&&ts.isNamespaceImport(bindings)){namespaceName=bindings.name.text;if((identifierCounts.get(namespaceName)||0)<=1)namespaceName=null;}
 let replacement='';
 if(defaultName||keptNamed.length||namespaceName){
  const typePrefix=clause.isTypeOnly?'type ':'';
  const parts=[];if(defaultName)parts.push(defaultName);if(namespaceName)parts.push(`* as ${namespaceName}`);if(keptNamed.length)parts.push(`{ ${keptNamed.join(', ')} }`);
  replacement=`import ${typePrefix}${parts.join(', ')} from ${moduleText};`;
 }
 importEdits.push({start:stmt.getFullStart(),end:stmt.end,replacement,module:stmt.moduleSpecifier.text});
}
for(const edit of importEdits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);

text=text.replace(/\n{4,}/g,'\n\n\n');
fs.writeFileSync(file,text);

const finalSf=parse(text);const finalDecls=declarations(finalSf);
for(const name of deadNames)if(finalDecls.has(name))throw new Error(`Dead declaration survived cleanup: ${name}`);
if(text.includes("./pages/VendorOnboarding"))throw new Error('Legacy VendorOnboarding import survived cleanup.');
console.log('Removed dead App declarations:',[...deadNames].join(', '));
console.log('Remaining firebase/firestore import is allowed only for still-active legacy admin code:',text.includes("from 'firebase/firestore'"));
console.log('Final App bytes:',Buffer.byteLength(text));
