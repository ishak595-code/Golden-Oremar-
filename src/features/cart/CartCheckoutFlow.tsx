import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from 'lucide-react';
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

export default function CartCheckoutFlow({
  onBack,
  onOrderCreated,
  onOpenAddresses,
}: {
  onBack?: () => void;
  onOrderCreated?: (order: any) => void;
  onOpenAddresses?: () => void;
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
  const [success, setSuccess] = useState<any>(null);
  const idempotencyRef = useRef<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [nextCart, nextOverview] = await Promise.all([getCart(), getCheckoutAccountOverview()]);
      setCart(nextCart);
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
    // country / cart totals change should refresh; coupon only changes after explicit apply.
  }, [countryCode, cart?.subtotalMinor, cart?.itemCount, appliedCoupon, loading]);

  async function updateQuantity(item: CartSnapshot['items'][number], nextQuantity: number) {
    try {
      setError('');
      const maxAllowed = item.sellableQuantity != null ? Math.max(0, Number(item.sellableQuantity)) : null;
      if (maxAllowed != null && nextQuantity > maxAllowed) {
        setError(`Bu ürün için en fazla ${maxAllowed} adet sepete eklenebilir.`);
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
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h1 id="checkout-success-title" className="mt-4 text-2xl font-bold">Siparişiniz oluşturuldu</h1>
        <p className="mt-2 text-sm text-gray-500">Sipariş no: <strong>{success.orderNumber}</strong></p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Stok rezervasyonu yapıldı. Ödeme gerçekten doğrulanana kadar sipariş “ödendi” sayılmaz.</p>
        <button onClick={onBack} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white">Alışverişe dön</button>
      </div>
    </section>;
  }

  if (!cart?.items?.length) {
    return <section className="mx-auto max-w-xl p-4 sm:p-6 text-center">
      <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
      <h1 className="mt-4 text-2xl font-bold">Sepetiniz boş</h1>
      <p className="mt-2 text-gray-500">Beğendiğiniz köy ürünlerini sepete ekleyerek devam edebilirsiniz.</p>
      <button onClick={onBack} className="mt-5 min-h-12 rounded-xl bg-brand-green px-6 font-bold text-white">Ürünleri keşfet</button>
    </section>;
  }

  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6" aria-labelledby="cart-title">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {onBack ? <button onClick={onBack} aria-label="Alışverişe dön" className="min-h-11 min-w-11 rounded-xl border p-2"><ArrowLeft className="mx-auto h-5 w-5" /></button> : null}
        <div><h1 id="cart-title" className="text-2xl font-bold">Sepetim</h1><p className="text-sm text-gray-500">{cart.itemCount} ürün</p></div>
      </div>
      <button onClick={emptyCart} className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700">Sepeti temizle</button>
    </div>

    {error ? <div role="alert" tabIndex={-1} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

    <section aria-labelledby="cart-items-title" className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5">
      <h2 id="cart-items-title" className="sr-only">Sepetteki ürünler</h2>
      <div className="space-y-4">{cart.items.map(item => <article key={item.cartItemId} className="flex gap-3 border-b pb-4 last:border-b-0 last:pb-0">
        {item.imagePath ? <img src={publicCatalogUrl(item.imagePath)} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <div className="h-24 w-24 shrink-0 rounded-xl bg-gray-100" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{item.productName}</h3>
          <p className="mt-1 text-sm text-gray-500">{item.variantName} • {item.producer?.name}</p>
          {!item.available ? <p className="mt-1 text-sm font-semibold text-red-700">Bu ürün artık satışa uygun değil.</p> : null}
          {item.sellableQuantity != null && item.quantity > item.sellableQuantity ? <p className="mt-1 text-sm font-semibold text-red-700">Yeterli stok yok. Satılabilir: {item.sellableQuantity}</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center rounded-xl border" aria-label={`${item.productName} adet seçimi`}>
              <button onClick={() => updateQuantity(item, item.quantity - 1)} aria-label="Adedi azalt" className="min-h-11 min-w-11 p-2"><Minus className="mx-auto h-4 w-4" /></button>
              <span className="min-w-10 text-center font-bold" aria-live="polite">{item.quantity}</span>
              <button onClick={() => updateQuantity(item, item.quantity + 1)} disabled={(!item.available) || (item.sellableQuantity != null && item.quantity >= Number(item.sellableQuantity))} aria-label="Adedi artır" className="min-h-11 min-w-11 p-2 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="mx-auto h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <strong><Money minor={item.lineTotalMinor} currency={cart.currency} /></strong>
              <button onClick={() => remove(item)} aria-label={`${item.productName} ürününü sepetten çıkar`} className="min-h-11 min-w-11 rounded-xl border border-red-200 p-2 text-red-700"><Trash2 className="mx-auto h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </article>)}</div>
    </section>

    <section className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5" aria-labelledby="address-title">
      <h2 id="address-title" className="text-lg font-bold">Teslimat adresi</h2>
      {overview?.addresses?.length ? <div className="mt-4 space-y-3">
        <label className="block"><span className="text-sm font-semibold">Kayıtlı adres</span>
          <select value={useManualAddress ? '__new__' : selectedAddressId} onChange={e => {
            if (e.target.value === '__new__') setUseManualAddress(true);
            else { setUseManualAddress(false); setSelectedAddressId(e.target.value); }
          }} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3">
            {overview.addresses.map((a: any) => <option key={a.id} value={a.id}>{a.label} — {a.district}/{a.province}</option>)}
            <option value="__new__">Farklı teslimat adresi kullan</option>
          </select>
        </label>
        {onOpenAddresses ? <button onClick={onOpenAddresses} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Adreslerimi yönet</button> : null}
      </div> : null}

      {useManualAddress ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ['recipient_name','Teslim alacak kişi'],['phone','Telefon'],['country_code','Ülke kodu'],['province','İl/Bölge'],
          ['district','Şehir/İlçe'],['neighborhood','Mahalle/Köy'],['postal_code','Posta kodu']
        ].map(([key,label]) => <label key={key} className="block"><span className="text-sm font-semibold">{label}</span><input value={manualAddress[key] || ''} onChange={e => setManualAddress({ ...manualAddress, [key]: key==='country_code' ? e.target.value.toUpperCase() : e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>)}
        <label className="block sm:col-span-2"><span className="text-sm font-semibold">Açık adres</span><textarea value={manualAddress.address_line} onChange={e => setManualAddress({ ...manualAddress, address_line: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
        <label className="block sm:col-span-2"><span className="text-sm font-semibold">Teslimat notu</span><textarea value={manualAddress.delivery_notes} onChange={e => setManualAddress({ ...manualAddress, delivery_notes: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
      </div> : selectedSavedAddress ? <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800 p-4 text-sm">
        <strong>{selectedSavedAddress.recipient_name}</strong><br />
        {selectedSavedAddress.address_line}, {selectedSavedAddress.neighborhood ? `${selectedSavedAddress.neighborhood}, ` : ''}{selectedSavedAddress.district}/{selectedSavedAddress.province} • {selectedSavedAddress.country_code}
      </div> : null}
    </section>

    <section className="rounded-2xl border bg-white dark:bg-gray-900 p-4 sm:p-5" aria-labelledby="coupon-title">
      <h2 id="coupon-title" className="text-lg font-bold">Kupon ve sipariş notu</h2>
      <div className="mt-4 flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Kupon kodu</span><input value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} placeholder="Kupon kodu" autoCapitalize="characters" className="min-h-11 w-full rounded-xl border bg-transparent px-3" /></label>
        <button onClick={applyCoupon} disabled={previewBusy} className="min-h-11 rounded-xl border px-4 font-bold disabled:opacity-50">{previewBusy ? 'Kontrol…' : 'Uygula'}</button>
      </div>
      {appliedCoupon ? <button onClick={() => { setCouponInput(''); setAppliedCoupon(''); }} className="mt-2 min-h-11 text-sm font-semibold text-red-700">Kuponu kaldır</button> : null}
      <label className="mt-4 block"><span className="text-sm font-semibold">Sipariş notu (opsiyonel)</span><textarea value={customerNote} onChange={e => setCustomerNote(e.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
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
        <button onClick={() => void requestShippingQuote()} disabled={quoteBusy || quoteSent} className="mt-3 min-h-11 w-full rounded-xl border border-brand-green px-4 font-bold text-brand-green disabled:opacity-50">{quoteSent ? 'Kargo teklif talebi gönderildi' : quoteBusy ? 'Talep gönderiliyor…' : 'Kargo teklifi talebini gönder'}</button>
        {quoteSent ? <p role="status" aria-live="polite" className="mt-2 text-xs text-green-700">Talebiniz güvenli destek konuşmasına iletildi. Destek ekibi hedef ülke ve ürün koşullarını inceleyecek.</p> : null}
      </div> : null}
      {(preview?.missingWeightQuantity || 0) > 0 && countryCode === 'TR' ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Bazı ürünlerde kargo ağırlığı eksik. Türkiye içi mevcut geçici kargo kuralı çalışabilir; yurt dışı checkout bu ürünlerle engellenir.</div> : null}
      <div className="mt-4 flex gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-brand-green" /><p>Fiyat, stok, kargo ve indirim sunucudan hesaplanır. “Siparişi oluştur” dediğinizde her şey yeniden doğrulanır.</p></div>
      <button onClick={submit} disabled={submitting || previewBusy || !preview?.canCheckout} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Sipariş oluşturuluyor…' : 'Siparişi Oluştur'}</button>
      <p className="mt-2 text-center text-xs text-gray-500">Bu adım karttan para çekmez. Canlı ödeme sağlayıcısı bağlanmadan ödeme başarılı gösterilmez.</p>
    </section>
  </main>;
}
