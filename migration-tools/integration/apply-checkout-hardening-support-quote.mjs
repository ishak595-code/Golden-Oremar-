import fs from 'node:fs';

const target=process.argv[2]||'src/features/cart/CartCheckoutFlow.tsx';
let source=fs.readFileSync(target,'utf8');

if(!source.includes('startShippingQuoteSupport,')){
 const needle='  setCartItem,\n  type CartSnapshot,';
 if(!source.includes(needle))throw new Error('Cart API import anchor not found.');
 source=source.replace(needle,'  setCartItem,\n  startShippingQuoteSupport,\n  type CartSnapshot,');
}

if(!source.includes('const [quoteBusy')){
 const needle="  const [submitting, setSubmitting] = useState(false);\n  const [error, setError] = useState('');";
 if(!source.includes(needle))throw new Error('Checkout state anchor not found.');
 source=source.replace(needle,"  const [submitting, setSubmitting] = useState(false);\n  const [quoteBusy, setQuoteBusy] = useState(false);\n  const [quoteSent, setQuoteSent] = useState(false);\n  const [error, setError] = useState('');");
}

if(!source.includes('Bu ürün için en fazla')){
 const needle="  async function updateQuantity(item: CartSnapshot['items'][number], nextQuantity: number) {\n    try {\n      setError('');\n      if (nextQuantity <= 0) {";
 if(!source.includes(needle))throw new Error('Quantity update anchor not found.');
 const replacement="  async function updateQuantity(item: CartSnapshot['items'][number], nextQuantity: number) {\n    try {\n      setError('');\n      const maxAllowed = item.sellableQuantity != null ? Math.max(0, Number(item.sellableQuantity)) : null;\n      if (maxAllowed != null && nextQuantity > maxAllowed) {\n        setError(`Bu ürün için en fazla ${maxAllowed} adet sepete eklenebilir.`);\n        return;\n      }\n      if (nextQuantity <= 0) {";
 source=source.replace(needle,replacement);
}

if(source.includes("`checkout_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_-]/g, '')")){
 source=source.replace("`checkout_${Date.now()}_${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_-]/g, '')","`checkout_${globalThis.crypto.randomUUID().replace(/-/g, '')}`");
}

if(!source.includes('async function requestShippingQuote')){
 const needle='\n  if (loading) return <div role="status"';
 const pos=source.indexOf(needle);
 if(pos<0)throw new Error('Checkout render anchor not found.');
 const fn=`\n  async function requestShippingQuote() {\n    if (!cart?.items?.length || quoteBusy || quoteSent) return;\n    try {\n      setQuoteBusy(true);\n      setError('');\n      const cityLabel = [checkoutAddress?.district, checkoutAddress?.province].filter(Boolean).join(' / ');\n      await startShippingQuoteSupport({ countryCode, cityLabel, cart, preview });\n      setQuoteSent(true);\n    } catch (e: any) {\n      setError(e?.message || 'Kargo teklif talebi oluşturulamadı.');\n    } finally {\n      setQuoteBusy(false);\n    }\n  }\n`;
 source=source.slice(0,pos)+fn+source.slice(pos);
}

if(!source.includes('Kargo teklifi talebini gönder')){
 const needle="      {preview && !preview.canCheckout ? <div role=\"alert\" className=\"mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900\">{friendlyReason(preview.blockingReason)}</div> : null}";
 if(!source.includes(needle))throw new Error('Checkout blocking alert anchor not found.');
 const replacement=`      {preview && !preview.canCheckout ? <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{friendlyReason(preview.blockingReason)}</div> : null}\n      {preview && !preview.canCheckout && countryCode !== 'TR' && ['manual_shipping_quote_required','shipping_rate_not_configured','shipping_zone_not_configured','international_shipping_weight_missing'].includes(preview.blockingReason || '') ? <div className="mt-3 rounded-xl border border-brand-green/30 bg-brand-green/5 p-3">\n        <p className="text-sm text-gray-700 dark:text-gray-200">Otomatik fiyat verilemiyorsa destek ekibine bu sepet ve hedef ülke bilgisiyle kargo teklif talebi gönderebilirsiniz.</p>\n        <button onClick={() => void requestShippingQuote()} disabled={quoteBusy || quoteSent} className="mt-3 min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">{quoteSent ? 'Kargo teklif talebi gönderildi' : quoteBusy ? 'Talep gönderiliyor…' : 'Kargo teklifi talebini gönder'}</button>\n        {quoteSent ? <p role="status" aria-live="polite" className="mt-2 text-xs text-green-700">Talebiniz güvenli destek konuşmasına iletildi. Destek ekibi hedef ülke ve ürün koşullarını inceleyecek.</p> : null}\n      </div> : null}`;
 source=source.replace(needle,replacement);
}

if(!source.includes('disabled={(!item.available')){
 const needle='<button onClick={() => updateQuantity(item, item.quantity + 1)} aria-label="Adedi artır" className="min-h-11 min-w-11 p-2"><Plus className="mx-auto h-4 w-4" /></button>';
 if(!source.includes(needle))throw new Error('Cart increment button anchor not found.');
 source=source.replace(needle,'<button onClick={() => updateQuantity(item, item.quantity + 1)} disabled={(!item.available) || (item.sellableQuantity != null && item.quantity >= Number(item.sellableQuantity))} aria-label="Adedi artır" className="min-h-11 min-w-11 p-2 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="mx-auto h-4 w-4" /></button>');
}

if(source.includes('Math.random().toString(36)'))throw new Error('Legacy checkout random idempotency remains.');
if(!source.includes('startShippingQuoteSupport'))throw new Error('Shipping quote support integration missing.');
if(!source.includes('globalThis.crypto.randomUUID'))throw new Error('Strong checkout idempotency integration missing.');

fs.writeFileSync(target,source);
console.log('Checkout hardening and shipping quote support integrated.');
