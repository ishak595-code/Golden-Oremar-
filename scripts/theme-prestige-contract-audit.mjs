import fs from'node:fs';

const failures=[];
const read=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):(failures.push(`Missing prestige contract file: ${file}`),'');
const expect=(value,message)=>{if(!value)failures.push(message);};

const css=read('src/index.css');
const theme=read('src/features/appearance/theme.ts');
const brand=read('src/features/appearance/brandAppearance.ts');
const perf=read('src/lib/performanceHints.ts');
const main=read('src/main.tsx');
const compactBrand=brand.replace(/\s+/g,'');

function rgb(hex){const value=hex.replace('#','');return[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255);}
function luminance(hex){return rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,index)=>sum+v*[.2126,.7152,.0722][index],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function token(body,name){const match=body.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));return match?.[1]?.toUpperCase()||'';}

const blocks=new Map();
for(const match of css.matchAll(/:root(?:\[data-theme="([^"]+)"\])?\s*\{([^}]+)\}/g))blocks.set(match[1]||'custom',match[2]);
for(const name of['custom','light','emerald','ruby','dark','champagne']){
 const body=blocks.get(name);expect(Boolean(body),`Prestige palette is missing: ${name}`);if(!body)continue;
 const values={background:token(body,'bg-main'),card:token(body,'bg-card'),text:token(body,'text-main'),muted:token(body,'text-muted'),gold:token(body,'brand-gold'),green:token(body,'brand-green'),onGold:token(body,'text-on-gold'),onGreen:token(body,'text-on-green')};
 for(const[key,value]of Object.entries(values))expect(/^#[0-9A-F]{6}$/.test(value),`${name} palette token is invalid: ${key}`);
 if(Object.values(values).some(value=>!value))continue;
 expect(contrast(values.text,values.background)>=4.5,`${name} text/background contrast is below WCAG AA.`);
 expect(contrast(values.muted,values.background)>=4.5,`${name} muted/background contrast is below WCAG AA.`);
 expect(contrast(values.text,values.card)>=4.5,`${name} text/card contrast is below WCAG AA.`);
 expect(contrast(values.onGold,values.gold)>=4.5,`${name} gold action contrast is below WCAG AA.`);
 expect(contrast(values.onGreen,values.green)>=4.5,`${name} green action contrast is below WCAG AA.`);
}

for(const marker of['Golden Oremar Marka Teması','Zümrüt Oremar','Yakut Prestige','Obsidyen Gece','İnci Beyazı','Şampanya Altın'])expect(theme.includes(marker),`Theme picker is missing prestige option: ${marker}`);
expect(brand.includes("get_public_brand_appearance_v1"),'Official custom appearance must remain database-driven.');
expect(brand.includes("super_admin_update_brand_appearance_v1"),'Super Admin must retain live brand appearance management.');
expect(compactBrand.includes('contrastRatio(tokens.text,tokens.background)<4.5'),'Dynamic brand text contrast must fail closed below WCAG AA.');
expect(compactBrand.includes('contrastRatio(tokens.onGreen,tokens.brandGreen)<4.5'),'Dynamic green action contrast must fail closed below WCAG AA.');
expect(compactBrand.includes('contrastRatio(tokens.onGold,tokens.brandGold)<4.5'),'Dynamic gold action contrast must fail closed below WCAG AA.');

expect(perf.includes('VITE_SUPABASE_URL'),'Backend performance hint must derive from the configured Supabase origin.');
expect(perf.includes("'preconnect'")&&perf.includes("'dns-prefetch'"),'Cold start must retain DNS and TLS connection warmup hints.');
expect(perf.includes("url.protocol!=='https:'"),'Backend warmup must reject non-HTTPS origins.');
expect(!/fetch\(|localStorage|sessionStorage/.test(perf),'Performance hints must not cache or prefetch business data.');
expect(main.indexOf('installBackendPerformanceHints();')>=0&&main.indexOf('installBackendPerformanceHints();')<main.indexOf('loadAndApplyBrandAppearance()'),'Backend warmup must be installed before live customer data initialization.');

if(failures.length){console.error('Golden Oremar prestige theme contract audit failed:');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('Golden Oremar prestige theme contract audit passed: all six palettes meet WCAG AA for primary/muted/action contrast, the official theme remains Super Admin dynamic, and HTTPS Supabase connection warmup does not cache business data.');
