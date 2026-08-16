import fs from 'node:fs';
const target=process.argv[2]||'src/App.tsx';
let source=fs.readFileSync(target,'utf8');

source=source.replace("onLoginRequired={() => { showToast('Üreticiyi takip etmek için hesabınıza giriş yapın.'); navigateToTab('account'); }}","onLoginRequired={() => { showToast('Bu işlem için hesabınıza giriş yapın.'); navigateToTab('account'); }}");

source=source.replace(/onAddToCart=\{async \(product\) => \{\s*await addToCart\(product, 1\);\s*\}\}/g,"onAddToCart={async (product, quantity) => {\n            await addToCart(product, quantity);\n          }}");
source=source.replace(/onAddToCart=\{async \(item\) => \{\s*await addToCart\(\{ id: item\.id, slug: item\.slug, name: item\.name, variantId: item\.variantId \}, 1\);\s*\}\}/g,"onAddToCart={async (item, quantity) => {\n            await addToCart({ id: item.id, slug: item.slug, name: item.name, variantId: item.variantId }, quantity);\n          }}");

source=source.replace(/(<PublicProducerScreen[\s\S]*?onLoginRequired=\{[\s\S]*?\}\}\n)(\s*onOpenProduct=)/g,(match,prefix,next)=>{
 if(prefix.includes('onOpenConversation='))return match;
 const route="          onOpenConversation={(conversationId) => { setAccountView(`messages:${conversationId}`); navigateToTab('account'); }}\n";
 return prefix+route+next;
});

const blocks=source.match(/<PublicProducerScreen[\s\S]*?\/>/g)||[];
if(blocks.length<1)throw new Error('PublicProducerScreen call sites not found.');
for(const block of blocks){if(!block.includes('onOpenConversation='))throw new Error('A producer screen call site is missing conversation routing.');}
if(source.includes('await addToCart(product, 1);'))throw new Error('Producer quantity-dropping callback remains.');
if(source.includes('variantId: item.variantId }, 1);'))throw new Error('Producer vendor quantity-dropping callback remains.');
fs.writeFileSync(target,source);
console.log('Producer customer relationship integrated into App.');
