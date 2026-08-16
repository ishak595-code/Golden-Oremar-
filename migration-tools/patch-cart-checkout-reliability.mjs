import fs from 'node:fs';

const file='src/features/cart/CartCheckoutFlow.tsx';
let text=fs.readFileSync(file,'utf8');
function one(from,to,label){const n=text.split(from).length-1;if(n!==1)throw new Error(`${label}: expected 1, found ${n}`);text=text.replace(from,to);}

one(
`import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from 'lucide-react';`,
`import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from 'lucide-react';\nimport { useAccessibleDialog } from '../accessibility/useAccessibleDialog';`,
'import dialog hook');

one(
`  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const idempotencyRef = useRef<string | null>(null);`,
`  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const idempotencyRef = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const clearDialogRef = useAccessibleDialog<HTMLDivElement>(clearConfirmOpen, () => { if (!clearBusy) setClearConfirmOpen(false); });

  useEffect(() => {
    if (!error) return;
    queueMicrotask(() => errorRef.current?.focus({ preventScroll: false }));
  }, [error]);`,
'cart reliability states');

one(
`  async function updateQuantity(item: CartSnapshot['items'][number], nextQuantity: number) {
    try {
      setError('');
      const maxAllowed = item.sellableQuantity != null ? Math.max(0, Number(item.sellableQuantity)) : null;
      if (maxAllowed != null && nextQuantity > maxAllowed) {
        setError(\`Bu ürün için en fazla \${maxAllowed} adet sepete eklenebilir.\`);
        return;
      }
      if (nextQuantity <= 0) {
        setCart(await removeCartItem(item.cartItemId));
      } else {
        setCart(await setCartItem({
          variantId: item.variantId,
          quantity: nextQuantity,
          selectedOptions: item.selectedOptions || {},
        }));
      }
    } catch (e: any) {
      setError(e?.message || 'Sepet güncellenemedi.');
    }
  }

  async function remove(item: CartSnapshot['items'][number]) {
    try { setError(''); setCart(await removeCartItem(item.cartItemId)); }
    catch (e: any) { setError(e?.message || 'Ürün sepetten çıkarılamadı.'); }
  }

  async function emptyCart() {
    try { setError(''); setCart(await clearCart()); setPreview(null); }
    catch (e: any) { setError(e?.message || 'Sepet temizlenemedi.'); }
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    setAppliedCoupon(code);
    await refreshPreview(code);
  }`,
`  async function updateQuantity(item: CartSnapshot['items'][number], nextQuantity: number) {
    if (rowBusyId) return;
    try {
      setRowBusyId(item.cartItemId);
      setError('');
      setActionStatus('');
      const maxAllowed = item.sellableQuantity != null ? Math.max(0, Number(item.sellableQuantity)) : null;
      if (maxAllowed != null && nextQuantity > maxAllowed) {
        setError(\`Bu ürün için en fazla \${maxAllowed} adet sepete eklenebilir.\`);
        return;
      }
      if (nextQuantity <= 0) {
        setCart(await removeCartItem(item.cartItemId));
        setActionStatus(\`\${item.productName} sepetten çıkarıldı.\`);
      } else {
        setCart(await setCartItem({
          variantId: item.variantId,
          quantity: nextQuantity,
          selectedOptions: item.selectedOptions || {},
        }));
        setActionStatus(\`\${item.productName} adedi \${nextQuantity} olarak güncellendi.\`);
      }
    } catch (e: any) {
      setError(e?.message || 'Sepet güncellenemedi.');
    } finally {
      setRowBusyId(null);
    }
  }

  async function remove(item: CartSnapshot['items'][number]) {
    if (rowBusyId) return;
    try {
      setRowBusyId(item.cartItemId);
      setError('');
      setActionStatus('');
      setCart(await removeCartItem(item.cartItemId));
      setActionStatus(\`\${item.productName} sepetten çıkarıldı.\`);
    } catch (e: any) {
      setError(e?.message || 'Ürün sepetten çıkarılamadı.');
    } finally {
      setRowBusyId(null);
    }
  }

  async function confirmEmptyCart() {
    if (clearBusy) return;
    try {
      setClearBusy(true);
      setError('');
      setActionStatus('');
      setCart(await clearCart());
      setPreview(null);
      setClearConfirmOpen(false);
      setActionStatus('Sepet temizlendi.');
    } catch (e: any) {
      setClearConfirmOpen(false);
      setError(e?.message || 'Sepet temizlenemedi.');
    } finally {
      setClearBusy(false);
    }
  }

  async function applyCoupon() {
    if (previewBusy) return;
    const code = couponInput.trim().toUpperCase();
    setAppliedCoupon(code);
    await refreshPreview(code);
  }`,
'cart row and clear actions');

one(
`  async function submit() {
    if (!cart?.items?.length) return;
    const addressIssue = validateAddress();
    if (addressIssue) { setError(addressIssue); return; }
    const currentPreview = await previewCheckout(countryCode, appliedCoupon || null).catch((e: any) => {
      setError(e?.message || 'Sipariş son kez doğrulanamadı.');
      return null;
    });
    if (!currentPreview) return;
    setPreview(currentPreview);
    if (!currentPreview.canCheckout) {
      setError(friendlyReason(currentPreview.blockingReason) || 'Sipariş şu anda oluşturulamıyor.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      if (!idempotencyRef.current) {
        idempotencyRef.current = \`checkout_\${globalThis.crypto.randomUUID().replace(/-/g, '')}\`;
      }
      const result = await createOrder({
        items: cart.items,
        shippingAddress: checkoutAddress,
        customerNote,
        couponCode: appliedCoupon || null,
        idempotencyKey: idempotencyRef.current,
      });
      setSuccess(result);
      setCart({ cartId: null, currency: cart.currency, itemCount: 0, subtotalMinor: 0, items: [] });
      setPreview(null);
      idempotencyRef.current = null;
      onOrderCreated?.(result);
    } catch (e: any) {
      const raw = e?.message || 'Sipariş oluşturulamadı.';
      setError(friendlyReason(raw.split(':')[0]) || raw);
    } finally {
      setSubmitting(false);
    }
  }`,
`  async function submit() {
    if (submitting || !cart?.items?.length) return;
    setSubmitting(true);
    setError('');
    setActionStatus('');
    try {
      const addressIssue = validateAddress();
      if (addressIssue) { setError(addressIssue); return; }
      const currentPreview = await previewCheckout(countryCode, appliedCoupon || null).catch((e: any) => {
        setError(e?.message || 'Sipariş son kez doğrulanamadı.');
        return null;
      });
      if (!currentPreview) return;
      setPreview(currentPreview);
      if (!currentPreview.canCheckout) {
        setError(friendlyReason(currentPreview.blockingReason) || 'Sipariş şu anda oluşturulamıyor.');
        return;
      }
      if (!idempotencyRef.current) {
        idempotencyRef.current = \`checkout_\${globalThis.crypto.randomUUID().replace(/-/g, '')}\`;
      }
      const result = await createOrder({
        items: cart.items,
        shippingAddress: checkoutAddress,
        customerNote,
        couponCode: appliedCoupon || null,
        idempotencyKey: idempotencyRef.current,
      });
      setSuccess(result);
      setCart({ cartId: null, currency: cart.currency, itemCount: 0, subtotalMinor: 0, items: [] });
      setPreview(null);
      idempotencyRef.current = null;
      onOrderCreated?.(result);
    } catch (e: any) {
      const raw = e?.message || 'Sipariş oluşturulamadı.';
      setError(friendlyReason(raw.split(':')[0]) || raw);
    } finally {
      setSubmitting(false);
    }
  }`,
'checkout submit lock');

one(
`        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />`,
`        <CheckCircle2 aria-hidden="true" className="mx-auto h-14 w-14 text-green-600" />`,
'success icon');
one(
`        <button onClick={onBack} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white">Alışverişe dön</button>`,
`        <button type="button" onClick={onBack} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Alışverişe dön</button>`,
'success back');
one(
`      <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />`,
`      <ShoppingCart aria-hidden="true" className="mx-auto h-12 w-12 text-gray-300" />`,
'empty icon');
one(
`      <button onClick={onBack} className="mt-5 min-h-12 rounded-xl bg-brand-green px-6 font-bold text-white">Ürünleri keşfet</button>`,
`      <button type="button" onClick={onBack} className="mt-5 min-h-12 rounded-xl bg-brand-green px-6 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünleri keşfet</button>`,
'empty back');

one(
`        {onBack ? <button onClick={onBack} aria-label="Alışverişe dön" className="min-h-11 min-w-11 rounded-xl border p-2"><ArrowLeft className="mx-auto h-5 w-5" /></button> : null}`,
`        {onBack ? <button type="button" onClick={onBack} aria-label="Alışverişe dön" className="min-h-11 min-w-11 rounded-xl border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mx-auto h-5 w-5" /></button> : null}`,
'header back');
one(
`      <button onClick={emptyCart} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700">Sepeti temizle</button>`,
`      <button type="button" onClick={() => { setError(''); setActionStatus(''); setClearConfirmOpen(true); }} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Sepeti temizle</button>`,
'clear trigger');
one(
`    {error ? <div role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}`,
`    {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
    {actionStatus ? <div role="status" aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{actionStatus}</div> : null}`,
'error and action status');

one(
`      <div className="space-y-4">{cart.items.map(item => <article key={item.cartItemId} className="flex gap-3 border-b pb-4 last:border-b-0 last:pb-0">`,
`      <div className="space-y-4">{cart.items.map(item => { const rowBusy = rowBusyId === item.cartItemId; return <article key={item.cartItemId} aria-busy={rowBusy} className="flex gap-3 border-b pb-4 last:border-b-0 last:pb-0">`,
'row busy map start');
one(
`      </article>)}</div>`,
`      </article>; })}</div>`,
'row busy map end');

one(
`              <button onClick={() => updateQuantity(item, item.quantity - 1)} aria-label="Adedi azalt" className="min-h-11 min-w-11 p-2"><Minus className="mx-auto h-4 w-4" /></button>`,
`              <button type="button" disabled={rowBusy} onClick={() => void updateQuantity(item, item.quantity - 1)} aria-label="Adedi azalt" className="min-h-11 min-w-11 p-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Minus aria-hidden="true" className="mx-auto h-4 w-4" /></button>`,
'decrease button');
one(
`              <button onClick={() => updateQuantity(item, item.quantity + 1)} disabled={(!item.available) || (item.sellableQuantity != null && item.quantity >= Number(item.sellableQuantity))} aria-label="Adedi artır" className="min-h-11 min-w-11 p-2 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="mx-auto h-4 w-4" /></button>`,
`              <button type="button" onClick={() => void updateQuantity(item, item.quantity + 1)} disabled={rowBusy || (!item.available) || (item.sellableQuantity != null && item.quantity >= Number(item.sellableQuantity))} aria-label="Adedi artır" className="min-h-11 min-w-11 p-2 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Plus aria-hidden="true" className="mx-auto h-4 w-4" /></button>`,
'increase button');
one(
`              <button onClick={() => remove(item)} aria-label={\`\${item.productName} ürününü sepetten çıkar\`} className="min-h-11 min-w-11 rounded-xl border border-red-200 p-2 text-red-700"><Trash2 className="mx-auto h-4 w-4" /></button>`,
`              <button type="button" disabled={rowBusy} onClick={() => void remove(item)} aria-label={\`\${item.productName} ürününü sepetten çıkar\`} className="min-h-11 min-w-11 rounded-xl border border-red-200 p-2 text-red-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"><Trash2 aria-hidden="true" className="mx-auto h-4 w-4" /></button>`,
'remove button');

one(
`        {onOpenAddresses ? <button onClick={onOpenAddresses} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Adreslerimi yönet</button> : null}`,
`        {onOpenAddresses ? <button type="button" onClick={onOpenAddresses} className="min-h-11 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Adreslerimi yönet</button> : null}`,
'address management button');
one(
`        <button onClick={applyCoupon} disabled={previewBusy} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50">{previewBusy ? 'Kontrol…' : 'Uygula'}</button>`,
`        <button type="button" onClick={() => void applyCoupon()} disabled={previewBusy || submitting} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{previewBusy ? 'Kontrol…' : 'Uygula'}</button>`,
'coupon button');
one(
`      {appliedCoupon ? <button onClick={() => { setCouponInput(''); setAppliedCoupon(''); }} className="mt-2 min-h-11 text-sm font-semibold text-red-700">Kuponu kaldır</button> : null}`,
`      {appliedCoupon ? <button type="button" disabled={previewBusy || submitting} onClick={() => { setCouponInput(''); setAppliedCoupon(''); }} className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Kuponu kaldır</button> : null}`,
'remove coupon');
one(
`        <button onClick={() => void requestShippingQuote()} disabled={quoteBusy || quoteSent} className="mt-3 min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">`,
`        <button type="button" onClick={() => void requestShippingQuote()} disabled={quoteBusy || quoteSent || submitting} className="mt-3 min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">`,
'quote button');
one(
`      <div className="mt-4 flex gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-green" /><p>Fiyat, stok, kargo ve indirim sunucudan hesaplanır. “Siparişi oluştur” dediğinizde her şey yeniden doğrulanır.</p></div>`,
`      <div className="mt-4 flex gap-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-green" /><p>Fiyat, stok, kargo ve indirim sunucudan hesaplanır. “Siparişi oluştur” dediğinizde her şey yeniden doğrulanır.</p></div>`,
'trust icon');
one(
`      <button onClick={submit} disabled={submitting || previewBusy || !preview?.canCheckout} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">`,
`      <button type="button" onClick={() => void submit()} disabled={submitting || previewBusy || rowBusyId !== null || !preview?.canCheckout} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">`,
'submit button');

one(
`    </section>
  </main>;
}`,
`    </section>

    {clearConfirmOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"><div ref={clearDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="clear-cart-title" aria-describedby="clear-cart-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900"><h2 id="clear-cart-title" className="text-lg font-bold">Sepetin tamamı temizlensin mi?</h2><p id="clear-cart-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Sepetinizdeki {cart.itemCount} ürün satırı kaldırılacak. Ürünleri daha sonra yeniden ekleyebilirsiniz.</p><div aria-live="polite" className="sr-only">{clearBusy ? 'Sepet temizleniyor.' : ''}</div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={clearBusy} onClick={() => setClearConfirmOpen(false)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button><button type="button" disabled={clearBusy} onClick={() => void confirmEmptyCart()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{clearBusy ? 'Temizleniyor…' : 'Sepeti Temizle'}</button></div></div></div> : null}
  </main>;
}`,
'clear confirm modal');

fs.writeFileSync(file,text);
console.log('Cart checkout interaction reliability patch applied.');
