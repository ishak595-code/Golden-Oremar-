import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const failures=[];
function read(file){const absolute=path.join(root,file);if(!fs.existsSync(absolute)){failures.push(`Missing required file: ${file}`);return'';}return fs.readFileSync(absolute,'utf8');}
function requireText(content,text,message){if(!content.includes(text))failures.push(message);}
function forbid(content,re,message){if(re.test(content))failures.push(message);}

const main=read('src/main.tsx');
const css=read('src/features/customer-experience/homeOneRowPremium.css');
const home=read('src/features/home/HomeSection.tsx');

requireText(main,"import './features/customer-experience/homeOneRowPremium.css';",'Premium one-row home CSS must stay loaded.');
const upgradeIndex=main.indexOf("import './features/customer-experience/homeMerchandisingUpgrade.css';");
const oneRowIndex=main.indexOf("import './features/customer-experience/homeOneRowPremium.css';");
if(upgradeIndex<0||oneRowIndex<0||oneRowIndex<upgradeIndex)failures.push('One-row premium CSS must load after earlier home merchandising styles.');

requireText(css,'.go-reference-home .go-reference-product-list {','Home product list surface contract is missing.');
requireText(css,'.go-reference-home .go-reference-product-row {','Home product row contract is missing.');
requireText(css,'grid-template-columns: 5.25rem minmax(0,1fr) 6rem;','Desktop/tablet product rows must remain one horizontal row.');
requireText(css,'grid-template-columns: 4.55rem minmax(0,1fr) 5.1rem;','Mobile product rows must remain one horizontal row.');
requireText(css,'.go-reference-product-row__signals','Decision-signal styling must remain visible in home rows.');
requireText(css,'.go-reference-product-row__ruby','Ruby verification styling must remain visible in home rows.');
requireText(css,'.go-reference-product-row__previous','Verified comparison-price styling must remain available.');
forbid(css,/\.go-reference-home\s+\.go-reference-product-row\s*\{[^}]*grid-template-columns\s*:\s*1fr\s*;/s,'Home product rows must not collapse into a vertical single-column card.');

requireText(home,'go-reference-product-row__pitch','Home rows must render the short decision-support copy.');
requireText(home,'go-reference-product-row__signals','Home rows must render verified decision signals.');
requireText(home,'go-reference-product-row__ruby','Home rows must render Ruby verification when eligible.');
requireText(home,'go-reference-product-row__price','Home rows must render price permanently.');
requireText(home,'go-reference-product-row__previous','Home rows must support a real comparison price when supplied by the catalog.');

if(failures.length){console.error('Golden Oremar one-row home contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar one-row home contract audit passed: each storefront product remains a single horizontal row with image, decision copy, verified signals, Ruby trust state and price.');
