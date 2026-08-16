import fs from 'node:fs';
import ts from 'typescript';

const file=process.argv[2]||'src/App.tsx';
let text=fs.readFileSync(file,'utf8');

// Remove only AST-audited legacy tab literals.
text=text.replace("type Tab = 'home' | 'categories' | 'favorites' | 'cart' | 'account' | 'product-detail' | 'search-results' | 'producer-profile' | 'events' | 'health' | 'contact' | 'about' | 'admin' | 'vendor-store';","type Tab = 'home' | 'categories' | 'cart' | 'account' | 'product-detail' | 'search-results' | 'producer-profile' | 'events' | 'health' | 'contact' | 'about' | 'admin';\nconst SUPPORTED_TABS = new Set<Tab>(['home','categories','cart','account','product-detail','search-results','producer-profile','events','health','contact','about','admin']);\nconst isSupportedTab = (value: string | null): value is Tab => !!value && SUPPORTED_TABS.has(value as Tab);");
if(text.includes("'favorites' |")||text.includes("| 'vendor-store'"))throw new Error('Legacy tab literals remain in Tab union.');
if(!text.includes('const SUPPORTED_TABS'))throw new Error('Supported tab allowlist was not added.');

// Harden browser URL input. Never cast arbitrary ?tab= values into app state.
const oldRouting=`  useEffect(() => {\n    const handlePopState = () => {\n      const params = new URLSearchParams(window.location.search);\n      const tabFromUrl = params.get('tab');\n      if (tabFromUrl && tabFromUrl !== currentTab) {\n         setCurrentTab(tabFromUrl);\n      }\n    };\n    window.addEventListener('popstate', handlePopState);\n    \n    // Initial check\n    const params = new URLSearchParams(window.location.search);\n    const tabFromUrl = params.get('tab');\n    if (tabFromUrl && tabFromUrl !== currentTab) {\n       setCurrentTab(tabFromUrl);\n    }\n    return () => window.removeEventListener('popstate', handlePopState);\n  }, []);`;
const newRouting=`  useEffect(() => {\n    const applyUrlTab = () => {\n      const params = new URLSearchParams(window.location.search);\n      const rawTab = params.get('tab');\n      const nextTab: Tab = isSupportedTab(rawTab) ? rawTab : 'home';\n      setCurrentTab(previous => previous === nextTab ? previous : nextTab);\n    };\n    window.addEventListener('popstate', applyUrlTab);\n    applyUrlTab();\n    return () => window.removeEventListener('popstate', applyUrlTab);\n  }, []);`;
if(!text.includes(oldRouting))throw new Error('URL routing block differs from audited source; refusing unsafe patch.');
text=text.replace(oldRouting,newRouting);

// Remove the orphaned selectedVendor state only if its setter is still declaration-only.
let sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let setterCount=0;
function countSetter(node){if(ts.isIdentifier(node)&&node.text==='setSelectedVendor')setterCount++;ts.forEachChild(node,countSetter);}countSetter(sf);
if(setterCount!==1)throw new Error(`setSelectedVendor has ${setterCount} identifiers; refusing to remove state.`);
text=text.replace("  const [selectedVendor, setSelectedVendor] = useState<any>(null);\n",'');

// Remove the now-unreachable vendor-store render branch using its AST span.
sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let vendorIf=null;
function findVendorIf(node){
 if(ts.isIfStatement(node)&&node.expression.getText(sf).includes("currentTab === 'vendor-store'"))vendorIf=node;
 ts.forEachChild(node,findVendorIf);
}
findVendorIf(sf);
if(!vendorIf)throw new Error('Audited vendor-store render branch not found.');
text=text.slice(0,vendorIf.getFullStart())+text.slice(vendorIf.end);

// Remove stale route title entry.
text=text.replace("        'vendor-store': 'Mağaza | Golden Oremar',\n",'');

// Final AST / source assertions.
sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(text.includes("currentTab === 'vendor-store'"))throw new Error('vendor-store render route survived cleanup.');
if(text.includes('selectedVendor'))throw new Error('selectedVendor legacy state/reference survived cleanup.');
if(text.includes("setCurrentTab(tabFromUrl)"))throw new Error('Unsafe arbitrary URL tab assignment survived.');
if(text.includes("'favorites' |")||text.includes("| 'favorites'"))throw new Error('favorites legacy tab survived.');
if(!text.includes("const nextTab: Tab = isSupportedTab(rawTab) ? rawTab : 'home';"))throw new Error('URL allowlist fallback missing.');

fs.writeFileSync(file,text.replace(/\n{4,}/g,'\n\n\n'));
console.log('Route/tab hardening applied.');
