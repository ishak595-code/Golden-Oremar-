import fs from 'node:fs';
import ts from 'typescript';
const file=process.argv[2]||'src/App.tsx';const text=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const union=[];const rendered=new Set();const navigated=new Set();let selectedVendorSetterUses=0;
function visit(node){
 if(ts.isTypeAliasDeclaration(node)&&node.name.text==='Tab'&&ts.isUnionTypeNode(node.type))for(const t of node.type.types)if(ts.isLiteralTypeNode(t)&&ts.isStringLiteral(t.literal))union.push(t.literal.text);
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsEqualsEqualsToken){const a=node.left,b=node.right;if(ts.isIdentifier(a)&&a.text==='currentTab'&&ts.isStringLiteral(b))rendered.add(b.text);if(ts.isIdentifier(b)&&b.text==='currentTab'&&ts.isStringLiteral(a))rendered.add(a.text);}
 if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='navigateToTab'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))navigated.add(node.arguments[0].text);
 if(ts.isIdentifier(node)&&node.text==='setSelectedVendor')selectedVendorSetterUses++;
 ts.forEachChild(node,visit);
}
visit(sf);
console.log('TAB_UNION',JSON.stringify(union));console.log('RENDERED_TABS',JSON.stringify([...rendered]));console.log('NAVIGATED_TABS',JSON.stringify([...navigated]));console.log('NO_RENDER_BRANCH',JSON.stringify(union.filter(x=>!rendered.has(x))));console.log('SELECTED_VENDOR_SETTER_IDENTIFIER_COUNT',selectedVendorSetterUses);
