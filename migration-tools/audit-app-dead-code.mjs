import fs from 'node:fs';
import ts from 'typescript';

const file=process.argv[2]||'src/App.tsx';
const sourceText=fs.readFileSync(file,'utf8');
const sf=ts.createSourceFile(file,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);

const topLevel=new Map();
for(const stmt of sf.statements){
  if(ts.isFunctionDeclaration(stmt)&&stmt.name){topLevel.set(stmt.name.text,{kind:'function',node:stmt,start:stmt.getStart(sf),end:stmt.end});}
  else if(ts.isClassDeclaration(stmt)&&stmt.name){topLevel.set(stmt.name.text,{kind:'class',node:stmt,start:stmt.getStart(sf),end:stmt.end});}
  else if(ts.isVariableStatement(stmt)){
    for(const decl of stmt.declarationList.declarations){
      if(ts.isIdentifier(decl.name)&&decl.initializer&&(ts.isArrowFunction(decl.initializer)||ts.isFunctionExpression(decl.initializer))){topLevel.set(decl.name.text,{kind:'variable-function',node:decl,start:stmt.getStart(sf),end:stmt.end});}
    }
  }
}

const refs=new Map([...topLevel.keys()].map(k=>[k,new Set()]));
const allUses=new Map();
for(const name of topLevel.keys())allUses.set(name,[]);

function visit(node,current){
  if(ts.isIdentifier(node)&&topLevel.has(node.text)){
    const decl=topLevel.get(node.text);
    const isDecl=node===decl.node.name||node.parent===decl.node&&node===decl.node.name;
    if(!isDecl){
      allUses.get(node.text).push(node.getStart(sf));
      if(current&&current!==node.text)refs.get(current)?.add(node.text);
    }
  }
  let next=current;
  if(ts.isFunctionDeclaration(node)&&node.name&&topLevel.has(node.name.text))next=node.name.text;
  if(ts.isClassDeclaration(node)&&node.name&&topLevel.has(node.name.text))next=node.name.text;
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&topLevel.has(node.name.text))next=node.name.text;
  ts.forEachChild(node,child=>visit(child,next));
}
visit(sf,null);

const roots=new Set(['AppContent','App']);
for(const stmt of sf.statements){
  if(ts.isExportAssignment(stmt)){
    const text=stmt.expression.getText(sf);
    if(topLevel.has(text))roots.add(text);
  }
}
const reachable=new Set();
const stack=[...roots].filter(x=>topLevel.has(x));
while(stack.length){const name=stack.pop();if(reachable.has(name))continue;reachable.add(name);for(const dep of refs.get(name)||[])stack.push(dep);}

const dead=[...topLevel.entries()].filter(([name])=>!reachable.has(name)).map(([name,v])=>({name,kind:v.kind,start:v.start,end:v.end,useCount:allUses.get(name)?.length||0}));
console.log('TOP_LEVEL_COUNT',topLevel.size);
console.log('REACHABLE_COUNT',reachable.size);
console.log('DEAD_COUNT',dead.length);
console.log('DEAD_TOP_LEVEL',JSON.stringify(dead,null,2));

const imports=[];
for(const stmt of sf.statements){
  if(!ts.isImportDeclaration(stmt)||!stmt.importClause)continue;
  const module=stmt.moduleSpecifier.text;
  const names=[];
  if(stmt.importClause.name)names.push(stmt.importClause.name.text);
  const bindings=stmt.importClause.namedBindings;
  if(bindings&&ts.isNamedImports(bindings))for(const el of bindings.elements)names.push(el.name.text);
  if(bindings&&ts.isNamespaceImport(bindings))names.push(bindings.name.text);
  for(const name of names){
    let count=0;
    function countUse(node){if(ts.isIdentifier(node)&&node.text===name)count++;ts.forEachChild(node,countUse);}countUse(sf);
    imports.push({module,name,totalIdentifierCount:count});
  }
}
console.log('UNUSED_IMPORT_CANDIDATES',JSON.stringify(imports.filter(x=>x.totalIdentifierCount<=1),null,2));
