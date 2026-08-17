import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from 'lucide-react';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';
import {
  clearCart,
  createOrder,
  getCart,
  getCheckoutAccountOverview,
  previewCheckout,
  publicCatalogUrl,
  removeCartItem,
  setCartItem,
  startShippingQuoteSupport,
  type CartSnapshot,
  type CheckoutPreview,
} from './api';

function Money({ minor, currency }: { minor: number; currency: string }) {
  return <>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(Number(minor || 0) / 100)}</>;
}

function friendlyReason(reason?: string | null) {
  switch (reason) {
    case 'cart_empty': return 'Sepetiniz boş.';
    case 'product_not_available': return 'Sepette artık satışta olmayan bir ürün var. Lütfen sepetinizi güncelleyin.';
    case 'insufficient_stock': return 'Sepetteki ürünlerden biri için yeterli stok kalmadı.';
    case 'international_shipping_weight_missing': return 'Yurt dışı gönderim için bir veya daha fazla ürünün doğrulanmış kargo ağırlığı eksik.';
    case 'manual_shipping_quote_required': return 'Bu ülke için kargo fiyatı manuel olarak belirlenmelidir.';
    case 'shipping_rate_not_configured': return 'Bu ülke için otomatik kargo tarifesi henüz tanımlanmadı.';
    case 'shipping_zone_not_configured': return 'Bu ülkeye gönderim bölgesi henüz tanımlanmadı.';
    case 'coupon_invalid_or_unavailable': return 'Kupon kodu geçersiz veya artık kullanılamıyor.';
    case 'coupon_usage_limit_reached': return 'Bu kuponun kullanım hakkı dolmuş.';
    case 'coupon_not_applicable': return 'Bu kupon mevcut sepet koşullarına uygulanamıyor.';
    default: return reason ? `Checkout şu anda tamamlanamıyor: ${reason}` : '';
  }
}

function normalizeSavedAddress(a: any) {
  return {
    label: a.label || 'Teslimat',
    recipient_name: a.recipient_name,
    phone: a.phone,
    country_code: a.country_code || 'TR',
    province: a.province || '',
    district: a.district || '',
    neighborhood: a.neighborhood || '',
    address_line: a.address_line || '',
    postal_code: a.postal_code || '',
    delivery_notes: a.delivery_notes || '',
  };
}

const blankAddress = {
  label: 'Teslimat', recipient_name: '', phone: '', country_code: 'TR', province: '', district: '',
  neighborhood: '', address_line: '', postal_code: '', delivery_notes: '',
};

const manualAddressFields = [
  { key: 'recipient_name', label: 'Teslim alacak kişi', autoComplete: 'name', required: true, maxLength: 120 },
  { key: 'phone', label: 'Telefon', autoComplete: 'tel', inputMode: 'tel' as const, required: true, maxLength: 30 },
  { key: 'country_code', label: 'Ülke kodu', autoComplete: 'country', inputMode: 'text' as const, required: true, maxLength: 2 },
  { key: 'province', label: 'İl/Bölge', autoComplete: 'address-level1', required: false, maxLength: 120 },
  { key: 'district', label: 'Şehir/İlçe', autoComplete: 'address-level2', required: true, maxLength: 120 },
  { key: 'neighborhood', label: 'Mahalle/Köy', autoComplete: 'address-level3', required: false, maxLength: 160 },
  { key: 'postal_code', label: 'Posta kodu', autoComplete: 'postal-code', inputMode: 'text' as const, required: false, maxLength: 24 },
] as const;

export default function CartCheckoutFlow({
  onBack,
  onOrderCreated,
  onOpenAddresses,
  onCartChanged,
}: {
  onBack?: () => void;
  onOrderCreated?: (order: any) => void;
  onOpenAddresses?: () => void;
  onCartChanged?: (cart: CartSnapshot) => void;
}) {
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [manualAddress, setManualAddress] = useState<any>(blankAddress);
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [error, setError] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const idempotencyRef = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const clearDialogRef = useAccessibleDialog<HTMLDivElement>(clearConfirmOpen, () => { if (!clearBusy) setClearConfirmOpen(false); });

  function applyCart(next: CartSnapshot) {
    setCart(next);
    onCartChanged?.(next);
    return next;
  }

  useEffect(() => {
    if (!error) return;
    queueMicrotask(() => errorRef.current?.focus({ preventScroll: false }));
  }, [error]);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [nextCart, nextOverview] = await Promise.all([getCart(), getCheckoutAccountOverview()]);
      applyCart(nextCart);
      setOverview(nextOverview);
      const addresses = nextOverview?.addresses || [];
      const defaultAddress = addresses.find((a: any) => a.is_default) || addresses[0];
      if (defaultAddress && !selectedAddressId) setSelectedAddressId(defaultAddress.id);
      if (!defaultAddress) {
        setUseManualAddress(true);
        setManualAddress((prev: any) => ({
          ...prev,
          recipient_name: nextOverview?.profile?.display_name || '',
          phone: nextOverview?.profile?.phone || '',
        }));
      }
    } catch (e: any) {
      setError(e?.message || 'Sepet yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedSavedAddress = useMemo(
    () => overview?.addresses?.find((a: any) => a.id === selectedAddressId) || null,
    [overview, selectedAddressId]
  );
  const checkoutAddress = useManualAddress ? manualAddress : (selectedSavedAddress ? normalizeSavedAddress(selectedSavedAddress) : null);
  const countryCode = (checkoutAddress?.country_code || 'TR').toUpperCase();

  async function refreshPreview(nextCoupon = appliedCoupon) {
    if (!cart?.items?.length) {
      setPreview(null);
      return;
    }
    try {
      setPreviewBusy(true);
      setError('');
      const p = await previewCheckout(countryCode, nextCoupon || null);
      setPreview(p);
    } catch (e: any) {
      setPreview(null);
      setError(e?.message || 'Sipariş özeti hesaplanamadı.');
    } finally {
      setPreviewBusy(false);
    }
  }

  useEffect(() => {
    if (!loading && cart?.items?.length) void refreshPreview(appliedCoupon);
  }, [countryCode, cart?.subtotalMinor, cart?.itemCount, appliedCoupon, loading]);

  async function updateQuantity(item: CartSnapshot['items'][number], nextQuantity: number) {
    if (rowBusyId) return;
    try {
      setRowBusyId(item.cartItemId);
      setError('');
      setActionStatus('');
      const maxAllowed = item.sellableQuantity != null ? Math.max(0, Number(item.sellableQuantity)) : null;
      if (maxAllowed != null && nextQuantity > maxAllowed) {
        setError(`Bu ürün için en fazla ${maxAllowed} adet sepete eklenebilir.`);
        return;
      }
      if (nextQuantity <= 0) {
        applyCart(await removeCartItem(item.cartItemId));
        setActionStatus(`${item.productName} sepetten çıkarıldı.`);
      } else {
        applyCart(await setCartItem({
          variantId: item.variantId,
          quantity: nextQuantity,
          selectedOptions: item.selectedOptions || {},
        }));
        setActionStatus(`${item.productName} adedi ${nextQuantity} olarak güncellendi.`);
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
      applyCart(await removeCartItem(item.cartItemId));
      setActionStatus(`${item.productName} sepetten çıkarıldı.`);
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
      applyCart(await clearCart());
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
  }

  function validateAddress() {
    if (!checkoutAddress) return 'Teslimat adresi seçin.';
    if ((checkoutAddress.recipient_name || '').trim().length < 2) return 'Teslim alacak kişinin adını yazın.';
    if ((checkoutAddress.phone || '').trim().length < 7) return 'Teslimat telefonu geçersiz.';
    if (!/^[A-Z]{2}$/.test(countryCode)) return 'Ülke kodu geçersiz.';
    const city = (checkoutAddress.city || checkoutAddress.district || checkoutAddress.province || '').trim();
    if (!city) return 'Şehir/ilçe bilgisini yazın.';
    if ((checkoutAddress.address_line1 || checkoutAddress.address_line || '').trim().length < 5) return 'Açık teslimat adresini yazın.';
    return '';
  }

  async function submit() {
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
        idempotencyRef.current = `checkout_${globalThis.crypto.randomUUID().replace(/-/g, '')}`;
      }
      const result = await createOrder({
        items: cart.items,
        shippingAddress: checkoutAddress,
        customerNote,
        couponCode: appliedCoupon || null,
        idempotencyKey: idempotencyRef.current,
      });
      setSuccess(result);
      applyCart({ cartId: null, currency: cart.currency, itemCount: 0, subtotalMinor: 0, items: [] });
      setPreview(null);
      idempotencyRef.current = null;
      onOrderCreated?.(result);
    } catch (e: any) {
      const raw = e?.message || 'Sipariş oluşturulamadı.';
      setError(friendlyReason(raw.split(':')[0]) || raw);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestShippingQuote() {
    if (!cart?.items?.length || quoteBusy || quoteSent) return;
    try {
      setQuoteBusy(true);
      setError('');
      const cityLabel = [checkoutAddress?.district, checkoutAddress?.province].filter(Boolean).join(' / ');
      await startShippingQuoteSupport({ countryCode, cityLabel, cart, preview });
      setQuoteSent(true);
    } catch (e: any) {
      setError(e?.message || 'Kargo teklif talebi oluşturulamadı.');
    } finally {
      setQuoteBusy(false);
    }
  }

  if (loading) return <div role="status" aria-live="polite" className="mx-auto max-w-4xl p-6 text-center">Sepetiniz yükleniyor…</div>;

  if (success) {
    return <section className="mx-auto max-w-xl p-4 sm:p-6" aria-labelledby="checkout-success-title">
      <div className="rounded-3xl border border-green-200 bg-white dark:bg-gray-900 p-6 text-center shadow-sm">
        <CheckCircle2 aria-hidden="true" className="mx-auto h-14 w-14 text-green-600" />
        <h1 id="checkout-success-title" className="mt-4 text-2xl font-bold">Siparişiniz oluşturuldu</h1>
        <p className="mt-2 text-sm text-gray-500">Sipariş no: <strong>{success.orderNumber}</strong></p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Stok rezervasyonu yapıldı. Ödeme gerçekten doğrulanana kadar sipariş “ödendi” sayılmaz.</p>
        <button type="button" onClick={onBack} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Alışverişe dön</button>
      </div>
    </section>;
  }

  if (!cart?.items?.length) {
    return <section className="mx-auto max-w-xl p-4 sm:p-6 text-center">
      <ShoppingCart aria-hidden="true" className="mx-auto h-12 w-12 text-gray-300" />
      <h1 className="mt-4 text-2xl font-bold">Sepetiniz boş</h1>
      <p className="mt-2 text-gray-500">Beğendiğiniz köy ürünlerini sepete ekleyerek devam edebilirsiniz.</p>
      <button type="button" onClick={onBack} className="mt-5 min-h-12 rounded-xl bg-brand-green px-6 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Ürünleri keşfet</button>
    </section>;
  }

  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6" aria-labelledby="cart-title">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {onBack ? <button type="button" onClick={onBack} aria-label="Alışverişe dön" className="min-h-11 min-w-11 rounded-xl border p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><ArrowLeft aria-hidden="true" className="mx-auto h-5 w-5" /></button> : null}
        <div><h1 id="cart-title" className="text-2xl font-bold">Sepetim</h1><p className="text-sm text-gray-500">{cart.itemCount} ürün</p></div>
      </div>
      <button type="button" onClick={() => { setError(''); setActionStatus(''); setClearConfirmOpen(true); }} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Sepeti temizle</button>
    </div>

    {error ? <div ref={errorRef} id="checkout-error" role="alert" aria-live="assertive" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
    {actionStatus ? <div role="status" aria-live="polite" className="rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{actionStatus}</div> : null}

    <section aria-labelledby="cart-items-title" className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5">
      <h2 id="cart-items-title" className="sr-only">Sepetteki ürünler</h2>
      <div className="space-y-4">{cart.items.map(item => { const rowBusy = rowBusyId === item.cartItemId; return <article key={item.cartItemId} aria-busy={rowBusy} className="flex gap-3 border-b pb-4 last:border-b-0 last:pb-0">
        {item.imagePath ? <img src={publicCatalogUrl(item.imagePath)} alt={`${item.productName} ürün görseli`} loading="lazy" decoding="async" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <div role="img" aria-label={`${item.productName} için görsel henüz eklenmedi`} className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-gray-100 px-2 text-center text-xs text-gray-500 dark:bg-gray-800">Görsel yok</div>}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{item.productName}</h3>
          <p className="mt-1 text-sm text-gray-500">{item.variantName} • {item.producer?.name}</p>
          {!item.available ? <p className="mt-1 text-sm font-semibold text-red-700">Bu ürün artık satışa uygun değil.</p> : null}
          {item.sellableQuantity != null && item.quantity > item.sellableQuantity ? <p className="mt-1 text-sm font-semibold text-red-700">Yeterli stok yok. Satılabilir: {item.sellableQuantity}</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center rounded-xl border" role="group" aria-label={`${item.productName} adet seçimi`}>
              <button type="button" disabled={rowBusy} onClick={() => void updateQuantity(item, item.quantity - 1)} aria-label={`${item.productName} adedini azalt`} className="min-h-11 min-w-11 p-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Minus aria-hidden="true" className="mx-auto h-4 w-4" /></button>
              <span className="min-w-10 text-center font-bold" aria-live="polite" aria-label={`${item.quantity} adet`}>{item.quantity}</span>
              <button type="button" onClick={() => void updateQuantity(item, item.quantity + 1)} disabled={rowBusy || (!item.available) || (item.sellableQuantity != null && item.quantity >= Number(item.sellableQuantity))} aria-label={`${item.productName} adedini artır`} className="min-h-11 min-w-11 p-2 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><Plus aria-hidden="true" className="mx-auto h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <strong><Money minor={item.lineTotalMinor} currency={cart.currency} /></strong>
              <button type="button" disabled={rowBusy} onClick={() => void remove(item)} aria-label={`${item.productName} ürününü sepetten çıkar`} className="min-h-11 min-w-11 rounded-xl border border-red-200 p-2 text-red-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"><Trash2 aria-hidden="true" className="mx-auto h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </article>; })}</div>
    </section>

    <section className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5" aria-labelledby="address-title">
      <h2 id="address-title" className="text-lg font-bold">Teslimat adresi</h2>
      {overview?.addresses?.length ? <div className="mt-4 space-y-3">
        <label className="block" htmlFor="checkout-saved-address"><span className="text-sm font-semibold">Kayıtlı adres</span>
          <select id="checkout-saved-address" value={useManualAddress ? '__new__' : selectedAddressId} onChange={e => {
            if (e.target.value === '__new__') setUseManualAddress(true);
            else { setUseManualAddress(false); setSelectedAddressId(e.target.value); }
          }} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3">
            {overview.addresses.map((a: any) => <option key={a.id} value={a.id}>{a.label} - {a.district}/{a.province}</option>)}
            <option value="__new__">Farklı teslimat adresi kullan</option>
          </select>
        </label>
        {onOpenAddresses ? <button type="button" onClick={onOpenAddresses} className="min-h-11 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Adreslerimi yönet</button> : null}
      </div> : null}

      {useManualAddress ? <fieldset className="mt-4 grid gap-3 sm:grid-cols-2" aria-describedby={error ? 'checkout-error' : undefined}>
        <legend className="sr-only">Yeni teslimat adresi</legend>
        {manualAddressFields.map(field => {
          const inputId = `checkout-${field.key.replace(/_/g, '-')}`;
          return <label key={field.key} className="block" htmlFor={inputId}><span className="text-sm font-semibold">{field.label}{field.required ? <span aria-hidden="true"> *</span> : null}</span><input id={inputId} name={field.key} required={field.required} maxLength={field.maxLength} autoComplete={field.autoComplete} inputMode={'inputMode' in field ? field.inputMode : undefined} value={manualAddress[field.key] || ''} onChange={e => setManualAddress({ ...manualAddress, [field.key]: field.key==='country_code' ? e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2) : e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>;
        })}
        <label className="block sm:col-span-2" htmlFor="checkout-address-line"><span className="text-sm font-semibold">Açık adres <span aria-hidden="true">*</span></span><textarea id="checkout-address-line" name="address_line" required autoComplete="street-address" maxLength={500} value={manualAddress.address_line} onChange={e => setManualAddress({ ...manualAddress, address_line: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
        <label className="block sm:col-span-2" htmlFor="checkout-delivery-notes"><span className="text-sm font-semibold">Teslimat notu</span><textarea id="checkout-delivery-notes" name="delivery_notes" maxLength={500} value={manualAddress.delivery_notes} onChange={e => setManualAddress({ ...manualAddress, delivery_notes: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
        <p className="text-xs text-gray-500 sm:col-span-2"><span aria-hidden="true">*</span> Zorunlu alanlar</p>
      </fieldset> : selectedSavedAddress ? <address className="mt-4 rounded-xl bg-gray-50 p-4 text-sm not-italic dark:bg-gray-800">
        <strong>{selectedSavedAddress.recipient_name}</strong><br />
        {selectedSavedAddress.address_line}, {selectedSavedAddress.neighborhood ? `${selectedSavedAddress.neighborhood}, ` : ''}{selectedSavedAddress.district}/{selectedSavedAddress.province} • {selectedSavedAddress.country_code}
      </address> : null}
    </section>

    <section className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5" aria-labelledby="coupon-title">
      <h2 id="coupon-title" className="text-lg font-bold">Kupon ve sipariş notu</h2>
      <div className="mt-4 flex gap-2">
        <label className="min-w-0 flex-1" htmlFor="checkout-coupon"><span className="sr-only">Kupon kodu</span><input id="checkout-coupon" name="coupon" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} placeholder="Kupon kodu" autoCapitalize="characters" autoComplete="off" maxLength={64} className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>
        <button type="button" onClick={() => void applyCoupon()} disabled={previewBusy || submitting} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{previewBusy ? 'Kontrol…' : 'Uygula'}</button>
      </div>
      {appliedCoupon ? <button type="button" disabled={previewBusy || submitting} onClick={() => { setCouponInput(''); setAppliedCoupon(''); }} className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Kuponu kaldır</button> : null}
      <label className="mt-4 block" htmlFor="checkout-customer-note"><span className="text-sm font-semibold">Sipariş notu (opsiyonel)</span><textarea id="checkout-customer-note" name="customer_note" value={customerNote} onChange={e => setCustomerNote(e.target.value)} maxLength={1000} rows={3} aria-describedby="checkout-note-counter" className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
      <div id="checkout-note-counter" className="mt-1 text-right text-xs text-gray-500" aria-live="polite">{customerNote.length}/1000</div>
    </section>

    <section className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5" aria-labelledby="summary-title">
      <div className="flex items-center justify-between gap-3"><h2 id="summary-title" className="text-lg font-bold">Sipariş özeti</h2>{previewBusy ? <span role="status" className="text-sm text-gray-500">Güncelleniyor…</span> : null}</div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><span>Ara toplam</span><strong><Money minor={preview?.subtotalMinor ?? cart.subtotalMinor} currency={cart.currency} /></strong></div>
        <div className="flex justify-between"><span>Kargo</span><strong>{preview?.shipping?.manualQuoteRequired ? 'Manuel teklif' : <Money minor={preview?.shippingMinor || 0} currency={cart.currency} />}</strong></div>
        {(preview?.discountMinor || 0) > 0 ? <div className="flex justify-between text-green-700"><span>{preview?.promotion?.title || 'İndirim'}</span><strong>-<Money minor={preview?.discountMinor || 0} currency={cart.currency} /></strong></div> : null}
        <div className="flex justify-between border-t pt-3 text-lg"><span>Toplam</span><strong><Money minor={preview?.totalMinor ?? cart.subtotalMinor} currency={cart.currency} /></strong></div>
      </div>
      {preview?.shipping?.publicNote ? <p className="mt-3 text-xs text-gray-500">{preview.shipping.publicNote}</p> : null}
      {preview && !preview.canCheckout ? <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{friendlyReason(preview.blockingReason)}</div> : null}
      {preview && !preview.canCheckout && countryCode !== 'TR' && ['manual_shipping_quote_required','shipping_rate_not_configured','shipping_zone_not_configured','international_shipping_weight_missing'].includes(preview.blockingReason || '') ? <div className="mt-3 rounded-xl border border-brand-green/30 bg-brand-green/5 p-3">
        <p className="text-sm text-gray-700 dark:text-gray-200">Otomatik fiyat verilemiyorsa destek ekibine bu sepet ve hedef ülke bilgisiyle kargo teklif talebi gönderebilirsiniz.</p>
        <button type="button" onClick={() => void requestShippingQuote()} disabled={quoteBusy || quoteSent || submitting} className="mt-3 min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{quoteSent ? 'Kargo teklif talebi gönderildi' : quoteBusy ? 'Talep gönderiliyor…' : 'Kargo teklifi talebini gönder'}</button>
        {quoteSent ? <p role="status" aria-live="polite" className="mt-2 text-xs text-green-700">Talebiniz güvenli destek konuşmasına iletildi. Destek ekibi hedef ülke ve ürün koşullarını inceleyecek.</p> : null}
      </div> : null}
      {(preview?.missingWeightQuantity || 0) > 0 && countryCode === 'TR' ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Bazı ürünlerde kargo ağırlığı eksik. Türkiye içi mevcut geçici kargo kuralı çalışabilir; yurt dışı checkout bu ürünlerle engellenir.</div> : null}
      <div className="mt-4 flex gap-2 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-green" /><p>Fiyat, stok, kargo ve indirim sunucudan hesaplanır. “Siparişi oluştur” dediğinizde her şey yeniden doğrulanır.</p></div>
      <button type="button" onClick={() => void submit()} disabled={submitting || previewBusy || rowBusyId !== null || !preview?.canCheckout} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{submitting ? 'Sipariş oluşturuluyor…' : 'Siparişi Oluştur'}</button>
      <p className="mt-2 text-center text-xs text-gray-500">Bu adım karttan para çekmez. Canlı ödeme sağlayıcısı bağlanmadan ödeme başarılı gösterilmez.</p>
    </section>

    {clearConfirmOpen ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"><div ref={clearDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="clear-cart-title" aria-describedby="clear-cart-description" tabIndex={-1} className="w-full max-w-md rounded-2xl bg-white p-5 text-brand-text shadow-xl outline-none dark:bg-gray-900"><h2 id="clear-cart-title" className="text-lg font-bold">Sepetin tamamı temizlensin mi?</h2><p id="clear-cart-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Sepetinizdeki {cart.itemCount} ürün kaldırılacak. Ürünleri daha sonra yeniden ekleyebilirsiniz.</p><div aria-live="polite" className="sr-only">{clearBusy ? 'Sepet temizleniyor.' : ''}</div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={clearBusy} onClick={() => setClearConfirmOpen(false)} className="min-h-11 rounded-xl border font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Vazgeç</button><button type="button" disabled={clearBusy} onClick={() => void confirmEmptyCart()} className="min-h-11 rounded-xl bg-red-700 font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">{clearBusy ? 'Temizleniyor…' : 'Sepeti Temizle'}</button></div></div></div> : null}
  </main>;
}
