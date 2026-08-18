import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Gift,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  X,
} from 'lucide-react';
import { Money } from '../account/ui';
import { useAccessibleDialog } from '../accessibility/useAccessibleDialog';
import { saveCustomerAddress } from '../addresses/api';
import { paymentMethodLabel } from '../payments/api';
import GiftCardPreview, { giftOccasions, giftStyles } from './GiftCardPreview';
import {
  createGiftOrder,
  getGiftAccountOverview,
  getGiftProduct,
  previewGiftCheckout,
  publicCatalogUrl,
  type GiftCheckoutPreview,
  type GiftOccasion,
  type GiftPresentationStyle,
  type GiftSavedAddress,
} from './api';

type Props = {
  productReference: string;
  onClose: () => void;
  onCreated?: (order: any) => void;
  onOpenPayments?: () => void;
};

type GiftAddress = {
  country_code: string;
  administrative_area: string;
  city: string;
  locality: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  delivery_notes: string;
};

const blankAddress: GiftAddress = {
  country_code: '',
  administrative_area: '',
  city: '',
  locality: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  delivery_notes: '',
};

function safeText(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeCurrency(value: unknown) {
  const currency = safeText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function validPhone(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 40 || /[\u0000-\u001F\u007F]/.test(normalized)) return false;
  const digits = normalized.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 20;
}

function validEmail(value: string) {
  const normalized = value.trim();
  return !normalized || (normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized));
}

function addressFromSaved(saved: GiftSavedAddress): GiftAddress {
  return {
    country_code: saved.countryCode,
    administrative_area: saved.administrativeArea,
    city: saved.city,
    locality: saved.locality,
    address_line1: saved.addressLine1,
    address_line2: saved.addressLine2,
    postal_code: saved.postalCode,
    delivery_notes: saved.deliveryNotes,
  };
}

function friendlyBlockingReason(reason?: string | null) {
  switch (reason) {
    case 'stock_unverified': return 'Ürünün güncel stoğu doğrulanamadı. Lütfen biraz sonra tekrar deneyin.';
    case 'insufficient_stock': return 'Seçtiğiniz adet için yeterli stok kalmadı.';
    case 'international_shipping_weight_missing': return 'Bu ürünün uluslararası kargo ağırlığı henüz doğrulanmadığı için bu ülkeye hediye gönderimi açılamıyor.';
    case 'manual_shipping_quote_required': return 'Bu ülke için kargo fiyatı manuel olarak doğrulanmalıdır.';
    case 'shipping_rate_not_configured': return 'Bu ülke için otomatik kargo ücreti henüz tanımlanmadı.';
    case 'shipping_zone_not_configured': return 'Bu ülkeye gönderim bölgesi henüz tanımlanmadı.';
    case 'coupon_invalid_or_unavailable': return 'Kupon kodu geçersiz veya artık kullanılamıyor.';
    case 'coupon_not_applicable': return 'Kupon bu ürün veya sipariş koşullarına uygulanamıyor.';
    case 'payment_method_required': return 'Canlı ödeme için aktif bir kart seçin.';
    case 'payment_method_not_found': return 'Seçilen kayıtlı kart artık kullanılamıyor.';
    case 'payment_method_expired': return 'Seçilen kartın süresi dolmuş. Başka bir kart seçin.';
    case 'payment_method_provider_mismatch': return 'Seçilen kart mevcut ödeme sağlayıcısıyla eşleşmiyor. Kartı yeniden doğrulayın.';
    default: return reason ? `Hediye checkout şu anda tamamlanamıyor: ${reason}` : '';
  }
}

function variantSelectable(product: any, variant: any) {
  if (!variant || variant.available !== true || !safeText(variant.id, 160) || safeInteger(variant.priceMinor) === null || !safeCurrency(product?.currency)) return false;
  const tracked = product?.stockMode === 'tracked' || product?.stockMode === 'seasonal';
  if (!tracked) return true;
  const stock = safeInteger(variant.availableQuantity);
  return stock !== null && stock > 0;
}

export default function GiftOrderFlow({ productReference, onClose, onCreated, onOpenPayments }: Props) {
  const [product, setProduct] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [hidePrice, setHidePrice] = useState(true);
  const [occasion, setOccasion] = useState<GiftOccasion>('just_because');
  const [presentationStyle, setPresentationStyle] = useState<GiftPresentationStyle>('oremar_gold');
  const [cardTitle, setCardTitle] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [useManualAddress, setUseManualAddress] = useState(true);
  const [manualAddress, setManualAddress] = useState<GiftAddress>(blankAddress);
  const [preview, setPreview] = useState<GiftCheckoutPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [created, setCreated] = useState<any>(null);
  const previewSequence = useRef(0);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const loadingDialogRef = useAccessibleDialog<HTMLDivElement>(loading, onClose);
  const formDialogRef = useAccessibleDialog<HTMLDivElement>(!loading && !created, () => { if (!submitting) onClose(); });
  const successDialogRef = useAccessibleDialog<HTMLDivElement>(!loading && !!created, onClose);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        setStatus('');
        setProduct(null);
        setAccount(null);
        setCreated(null);
        setManualAddress(blankAddress);
        setRecipientPhone('');
        setRecipientEmail('');
        setRecipientName('');
        setMessage('');
        setCouponInput('');
        setAppliedCoupon('');
        setSelectedPaymentMethodId('');
        setQuantity(1);
        setOccasion('just_because');
        setPresentationStyle('oremar_gold');
        setCardTitle('');

        const [detail, overview] = await Promise.all([getGiftProduct(productReference), getGiftAccountOverview()]);
        if (!active) return;
        setProduct(detail);
        setAccount(overview);
        const variants = Array.isArray(detail?.variants) ? detail.variants : [];
        const defaultVariant = variants.find((variant: any) => variant?.default === true && variantSelectable(detail, variant))
          || variants.find((variant: any) => variantSelectable(detail, variant))
          || variants.find((variant: any) => variant?.available === true)
          || variants[0];
        setVariantId(safeText(defaultVariant?.id, 160));
        setSenderName(safeText(overview?.profile?.display_name, 120));

        const addresses = Array.isArray(overview?.addresses) ? overview.addresses as GiftSavedAddress[] : [];
        const defaultAddress = addresses.find(address => address.isDefault) || addresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          setUseManualAddress(false);
          setRecipientName(defaultAddress.recipientName);
          setRecipientPhone(defaultAddress.phone);
        } else {
          setSelectedAddressId('');
          setUseManualAddress(true);
        }

        const methods = Array.isArray(overview?.paymentMethods) ? overview.paymentMethods : [];
        const defaultPayment = methods.find((method: any) => method?.status === 'active' && method?.isDefault === true)
          || methods.find((method: any) => method?.status === 'active');
        setSelectedPaymentMethodId(safeText(defaultPayment?.id, 160));
      } catch (e: any) {
        if (active) setError(e?.message || 'Hediye bilgileri yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; previewSequence.current += 1; };
  }, [productReference]);

  useEffect(() => {
    if (error) queueMicrotask(() => errorRef.current?.focus({ preventScroll: true }));
  }, [error]);

  const addresses: GiftSavedAddress[] = Array.isArray(account?.addresses) ? account.addresses : [];
  const paymentMethods = Array.isArray(account?.paymentMethods) ? account.paymentMethods : [];
  const paymentReadiness = account?.paymentReadiness && typeof account.paymentReadiness === 'object' ? account.paymentReadiness : null;
  const provider = safeText(paymentReadiness?.provider, 40);
  const livePayments = paymentReadiness?.liveCardPaymentsEnabled === true && Boolean(provider);
  const selectedPaymentMethod = paymentMethods.find((method: any) => safeText(method?.id, 160) === selectedPaymentMethodId && method?.status === 'active') || null;
  const selectedSavedAddress = useMemo(() => addresses.find(address => address.id === selectedAddressId) || null, [addresses, selectedAddressId]);
  const effectiveAddress = useMemo(() => useManualAddress ? manualAddress : selectedSavedAddress ? addressFromSaved(selectedSavedAddress) : null, [useManualAddress, manualAddress, selectedSavedAddress]);
  const countryCode = safeText(effectiveAddress?.country_code, 2).toUpperCase();
  const validCountry = /^[A-Z]{2}$/.test(countryCode);
  const variant = useMemo(() => Array.isArray(product?.variants) ? product.variants.find((v: any) => v?.id === variantId) || null : null, [product, variantId]);
  const image = Array.isArray(product?.images) ? product.images.find((i: any) => i?.primary === true) || product.images[0] : null;
  const tracked = product?.stockMode === 'tracked' || product?.stockMode === 'seasonal';
  const stock = safeInteger(variant?.availableQuantity);
  const stockReady = !tracked || stock !== null;
  const priceReady = safeInteger(variant?.priceMinor) !== null && safeCurrency(product?.currency) !== null;
  const variantReady = Boolean(safeText(variant?.id, 160)) && variant?.available === true;
  const soldOut = variant?.available === false || (tracked && stock !== null && stock <= 0);
  const purchaseReady = variantReady && priceReady && stockReady && !soldOut;
  const maxQuantity = tracked && stock !== null ? Math.max(1, Math.min(20, stock)) : 20;
  const canonicalProductReference = safeText(product?.slug || product?.id, 220);

  useEffect(() => {
    setQuantity(current => Math.max(1, Math.min(current, maxQuantity)));
  }, [variantId, maxQuantity]);

  useEffect(() => {
    const sequence = ++previewSequence.current;
    if (!purchaseReady || !canonicalProductReference || !variantId || !validCountry) {
      setPreview(null);
      setPreviewBusy(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setPreviewBusy(true);
        const next = await previewGiftCheckout({
          productReference: canonicalProductReference,
          variantReference: variantId,
          quantity,
          countryCode,
          couponCode: appliedCoupon || null,
        });
        if (previewSequence.current === sequence) {
          setPreview(next);
          setError('');
        }
      } catch (e: any) {
        if (previewSequence.current === sequence) {
          setPreview(null);
          setError(e?.message || 'Hediye sipariş özeti hesaplanamadı.');
        }
      } finally {
        if (previewSequence.current === sequence) setPreviewBusy(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [purchaseReady, canonicalProductReference, variantId, quantity, countryCode, appliedCoupon, validCountry]);

  function chooseSavedAddress(id: string) {
    if (id === '__manual__') {
      setUseManualAddress(true);
      return;
    }
    const saved = addresses.find(address => address.id === id);
    if (!saved) return;
    setSelectedAddressId(saved.id);
    setUseManualAddress(false);
    setRecipientName(saved.recipientName);
    setRecipientPhone(saved.phone);
  }

  function validate() {
    if (!product || !canonicalProductReference) return 'Ürün referansı doğrulanamadı.';
    if (!variant || !safeText(variantId, 160)) return 'Ürün varyantı doğrulanamadı.';
    if (!purchaseReady) return !priceReady ? 'Ürün fiyatı doğrulanamadığı için hediye siparişi oluşturulamaz.' : !stockReady ? 'Ürün stoğu doğrulanamadığı için hediye siparişi oluşturulamaz.' : soldOut ? 'Seçilen ürün stokta yok.' : 'Seçilen varyant satışa açık değil.';
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) return `Hediye adedi 1 ile ${maxQuantity} arasında olmalıdır.`;
    const name = recipientName.trim();
    if (name.length < 2 || name.length > 120 || /[\u0000-\u001F\u007F]/.test(name)) return 'Alıcının adı 2 ile 120 karakter arasında olmalıdır.';
    if (!validPhone(recipientPhone)) return 'Teslimat için gerçek bir alıcı telefonu yazın. Telefon 7 ile 20 rakam içermelidir.';
    if (!validEmail(recipientEmail)) return 'Geçerli bir alıcı e-postası yazın.';
    if (senderName.trim().length > 120 || /[\u0000-\u001F\u007F]/.test(senderName)) return 'Gönderen adı doğrulanamadı.';
    if (message.length > 1000) return 'Hediye notu en fazla 1000 karakter olabilir.';
    if (cardTitle.trim() && (cardTitle.trim().length < 2 || cardTitle.trim().length > 100 || /[\u0000-\u001F\u007F]/.test(cardTitle))) return 'Hediye kartı başlığı 2 ile 100 karakter arasında olmalıdır.';
    if (!effectiveAddress) return 'Teslimat adresi seçin veya yeni adres yazın.';
    if (!/^[A-Z]{2}$/.test(countryCode)) return 'Ülke kodu iki harfli ISO kodu olmalıdır.';
    if (safeText(effectiveAddress.administrative_area, 161).length > 160) return 'İl veya bölge en fazla 160 karakter olabilir.';
    if (!effectiveAddress.city.trim() || effectiveAddress.city.trim().length > 160) return 'Şehir veya ilçe bilgisini yazın.';
    if (effectiveAddress.locality.trim().length > 160) return 'Mahalle veya köy en fazla 160 karakter olabilir.';
    if (effectiveAddress.address_line1.trim().length < 5 || effectiveAddress.address_line1.trim().length > 1000) return 'Açık teslimat adresi 5 ile 1000 karakter arasında olmalıdır.';
    if (effectiveAddress.address_line2.trim().length > 500) return 'Adres devamı en fazla 500 karakter olabilir.';
    if (effectiveAddress.postal_code.trim().length > 30) return 'Posta kodu en fazla 30 karakter olabilir.';
    if (effectiveAddress.delivery_notes.trim().length > 500) return 'Teslimat notu en fazla 500 karakter olabilir.';
    if (appliedCoupon && !/^[A-Z0-9_-]{1,64}$/.test(appliedCoupon)) return 'Kupon kodu doğrulanamadı.';
    if (livePayments && !selectedPaymentMethod) return 'Canlı ödeme için aktif bir kayıtlı kart seçin veya yeni kart ekleyin.';
    if (!preview) return 'Sipariş toplamı henüz sunucudan doğrulanmadı.';
    if (!preview.canCheckout) return friendlyBlockingReason(preview.blockingReason) || 'Hediye siparişi şu anda oluşturulamıyor.';
    return '';
  }

  async function applyCoupon() {
    const normalized = couponInput.trim().toUpperCase();
    if (normalized && !/^[A-Z0-9_-]{1,64}$/.test(normalized)) {
      setError('Kupon kodu yalnız harf, rakam, tire ve alt çizgi içerebilir.');
      return;
    }
    setAppliedCoupon(normalized);
    setStatus(normalized ? 'Kupon sunucuda kontrol ediliyor.' : 'Kupon kaldırıldı.');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formData = new FormData(event.currentTarget);
    const shouldSaveAddress = useManualAddress && formData.get('save_address') === 'on';
    const makeDefaultAddress = shouldSaveAddress && formData.get('make_default_address') === 'on';
    const addressLabel = safeText(formData.get('address_label'), 60) || 'Hediye Teslimatı';
    const issue = validate();
    if (issue) { setError(issue); return; }
    try {
      setSubmitting(true);
      setError('');
      setStatus('Sipariş, stok, kargo ve kampanya son kez doğrulanıyor.');
      const finalPreview = await previewGiftCheckout({
        productReference: canonicalProductReference,
        variantReference: variantId,
        quantity,
        countryCode,
        couponCode: appliedCoupon || null,
      });
      setPreview(finalPreview);
      if (!finalPreview.canCheckout) throw new Error(friendlyBlockingReason(finalPreview.blockingReason) || 'Hediye siparişi şu anda oluşturulamıyor.');
      if (!effectiveAddress) throw new Error('Teslimat adresi doğrulanamadı.');
      if (livePayments && !selectedPaymentMethod) throw new Error('payment_method_required');

      if (shouldSaveAddress) {
        setStatus('Yeni teslimat adresi hesabınıza kaydediliyor.');
        await saveCustomerAddress({
          label: addressLabel,
          recipientName: recipientName.trim(),
          phone: recipientPhone.trim(),
          countryCode,
          administrativeArea: effectiveAddress.administrative_area.trim() || null,
          city: effectiveAddress.city.trim(),
          locality: effectiveAddress.locality.trim() || null,
          addressLine1: effectiveAddress.address_line1.trim(),
          addressLine2: effectiveAddress.address_line2.trim() || null,
          postalCode: effectiveAddress.postal_code.trim() || null,
          deliveryNotes: effectiveAddress.delivery_notes.trim() || null,
          isDefault: makeDefaultAddress,
        });
        setStatus('Adres kaydedildi. Hediye siparişi oluşturuluyor.');
      }

      const result = await createGiftOrder({
        productReference: canonicalProductReference,
        variantReference: variantId,
        quantity,
        shippingAddress: {
          label: 'Hediye Teslimatı',
          recipient_name: recipientName.trim(),
          phone: recipientPhone.trim(),
          country_code: countryCode,
          administrative_area: effectiveAddress.administrative_area.trim() || null,
          city: effectiveAddress.city.trim(),
          locality: effectiveAddress.locality.trim() || null,
          address_line1: effectiveAddress.address_line1.trim(),
          address_line2: effectiveAddress.address_line2.trim() || null,
          postal_code: effectiveAddress.postal_code.trim() || null,
          delivery_notes: effectiveAddress.delivery_notes.trim() || null,
        },
        couponCode: appliedCoupon || null,
        paymentMethodId: selectedPaymentMethod?.id || null,
        gift: {
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientEmail: recipientEmail.trim() || null,
          message: message.trim() || null,
          senderName: senderName.trim() || null,
          hidePrice,
          occasion,
          presentationStyle,
          cardTitle: cardTitle.trim() || null,
        },
      });
      setCreated(result);
      setStatus('');
      onCreated?.(result);
    } catch (e: any) {
      const raw = String(e?.message || 'Hediye siparişi oluşturulamadı.');
      const code = raw.split(':')[0];
      const friendly = raw.includes('invalid_shipping_country') ? 'Teslimat ülkesi açıkça seçilmelidir. Ülke bilgisi varsayılan olarak atanmaz.'
        : raw.includes('international_shipping_weight_missing') ? 'Bu ürünün uluslararası kargo ağırlığı henüz doğrulanmadığı için yurt dışı hediye siparişi açılamıyor.'
        : raw.includes('manual_shipping_quote_required') ? 'Bu ülke için otomatik kargo fiyatı henüz tanımlı değil.'
        : raw.includes('shipping_not_available') ? 'Seçilen ülkeye otomatik gönderim henüz açık değil.'
        : raw.includes('insufficient_stock') ? 'Seçtiğiniz ürün için yeterli stok kalmadı.'
        : raw.includes('authentication_required') ? 'Hediye siparişi oluşturmak için giriş yapmalısınız.'
        : raw.includes('invalid_shipping_address') || raw.includes('invalid_address') ? 'Teslimat adresi veya telefonu doğrulanamadı.'
        : raw.includes('address_limit_exceeded') ? 'Hesabınıza en fazla 20 teslimat adresi kaydedebilirsiniz.'
        : friendlyBlockingReason(code) || raw;
      setError(friendly);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4"><div ref={loadingDialogRef} role="dialog" aria-modal="true" aria-labelledby="gift-loading-title" tabIndex={-1} className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-brand-text outline-none shadow-2xl dark:bg-gray-900"><h2 id="gift-loading-title" className="font-bold">Hediye ekranı hazırlanıyor</h2><div role="status" aria-live="polite" className="mt-2 text-sm text-gray-500">Ürün, stok, kayıtlı adres ve ödeme hazırlığı doğrulanıyor…</div><button type="button" onClick={onClose} className="mt-4 min-h-11 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Kapat</button></div></div>;

  if (created) {
    const occasionMeta = giftOccasions.find(item => item.value === occasion) || giftOccasions[0];
    return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-black/70 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={successDialogRef} role="dialog" aria-modal="true" aria-labelledby="gift-success-title" aria-describedby="gift-success-description" tabIndex={-1} className="w-full max-w-lg rounded-3xl bg-white p-6 text-center text-brand-text outline-none shadow-2xl dark:bg-gray-900">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"><CheckCircle2 aria-hidden="true" className="h-8 w-8" /></div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-brand-gold">{occasionMeta.label}</p>
        <h2 id="gift-success-title" className="mt-1 text-2xl font-bold">{recipientName.trim()} için hediyeniz kaydedildi</h2>
        <p className="mt-2 text-sm text-gray-500">Sipariş no: <strong>{safeText(created.orderNumber, 120) || 'Doğrulanamadı'}</strong></p>
        <p id="gift-success-description" className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">Ürün, teslimat bilgileri ve hazırladığınız hediye kartı siparişle birlikte güvenli biçimde kaydedildi. Ödeme gerçekten doğrulanmadan sipariş ödendi olarak gösterilmeyecek.</p>
        {created?.paymentMethod ? <p className="mt-2 text-sm text-gray-500">Seçilen ödeme yöntemi: {safeText(created.paymentMethod.nickname, 40) || safeText(created.paymentMethod.brand, 40)} •••• {safeText(created.paymentMethod.last4, 4)}</p> : null}
        {message.trim() ? <div className="mt-4 rounded-2xl bg-brand-gold/5 p-4 text-left"><p className="text-sm italic leading-6">“{message.trim()}”</p><p className="mt-2 text-right text-xs font-bold">{senderName.trim()}</p></div> : null}
        <button type="button" onClick={onClose} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">Tamam</button>
      </div>
    </div>;
  }

  const productName = safeText(product?.name, 300) || 'Ürün';
  const imageUrl = publicCatalogUrl(image?.path);
  const trustLabels = Array.isArray(product?.trustBadges) ? product.trustBadges.filter((badge: any) => badge?.active === true && safeText(badge?.label, 120)).map((badge: any) => safeText(badge.label, 120)) : [];

  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-3 sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <div ref={formDialogRef} role="dialog" aria-modal="true" aria-labelledby="gift-title" aria-describedby="gift-description" tabIndex={-1} className="mx-auto my-2 w-full max-w-4xl rounded-3xl bg-white text-brand-text outline-none shadow-2xl dark:bg-gray-900 sm:my-4">
      <div className="sticky top-0 z-10 flex items-start justify-between rounded-t-3xl border-b bg-white/95 p-5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gold"><Gift aria-hidden="true" className="h-4 w-4" /> Golden Oremar Hediye</div><h2 id="gift-title" className="mt-1 text-2xl font-bold">Bir üründen fazlasını gönderin</h2><p id="gift-description" className="mt-1 max-w-2xl text-sm text-gray-500">Ürün, stok, teslimat ve toplam sunucudan doğrulanır. Hediye kartınız ve notunuz siparişle birlikte kalıcı olarak kaydedilir.</p></div>
        <button type="button" disabled={submitting} onClick={onClose} aria-label="Hediye ekranını kapat" className="min-h-11 min-w-11 rounded-full border p-2 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><X aria-hidden="true" className="mx-auto h-5 w-5" /></button>
      </div>

      {error ? <div ref={errorRef} role="alert" tabIndex={-1} className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 outline-none dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{error}</div> : null}
      {status ? <div role="status" aria-live="polite" className="mx-5 mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-200">{status}</div> : null}

      <form onSubmit={submit} className="space-y-6 p-5">
        <section aria-labelledby="gift-product-title" className="rounded-3xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
          <div className="flex gap-4">
            {imageUrl ? <img src={imageUrl} alt={safeText(image?.alt, 300) || `${productName} ürün görseli`} loading="lazy" decoding="async" className="h-28 w-28 shrink-0 rounded-2xl object-cover" /> : <div role="img" aria-label={`${productName} için görsel yok`} className="grid h-28 w-28 shrink-0 place-items-center rounded-2xl bg-gray-100 px-3 text-center text-xs text-gray-500 dark:bg-gray-800">Görsel henüz yok</div>}
            <div className="min-w-0 flex-1"><h3 id="gift-product-title" className="text-lg font-bold">{productName}</h3>{safeText(product?.shortDescription, 600) ? <p className="mt-1 text-sm leading-6 text-gray-500">{safeText(product.shortDescription, 600)}</p> : null}<p className="mt-2 font-bold text-brand-green dark:text-brand-gold">{priceReady ? <Money minor={variant?.priceMinor} currency={product?.currency} /> : 'Fiyat doğrulanamadı'}</p>{trustLabels.length ? <div className="mt-2 flex flex-wrap gap-2">{trustLabels.slice(0, 4).map(label => <span key={label} className="rounded-full bg-brand-green/10 px-2.5 py-1 text-xs font-semibold text-brand-green dark:text-brand-gold">{label}</span>)}</div> : null}</div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label htmlFor="gift-variant"><span className="text-sm font-semibold">Ürün seçeneği</span><select id="gift-variant" value={variantId} onChange={event => setVariantId(event.target.value)} disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60">{(Array.isArray(product?.variants) ? product.variants : []).map((item: any) => <option key={safeText(item.id, 160)} value={safeText(item.id, 160)} disabled={!variantSelectable(product, item)}>{safeText(item.name, 160) || 'Varyant'}{item.available === false ? ' - Stokta yok' : ''}</option>)}</select></label>
            <label htmlFor="gift-quantity"><span className="text-sm font-semibold">Adet</span><input id="gift-quantity" type="number" inputMode="numeric" min={1} max={maxQuantity} value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(maxQuantity, Number(event.target.value) || 1)))} disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3 disabled:opacity-60" /></label>
          </div>
          {!purchaseReady ? <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{!priceReady ? 'Bu ürünün fiyatı doğrulanamadı.' : !stockReady ? 'Bu ürünün stoğu doğrulanamadı.' : soldOut ? 'Seçilen ürün stokta yok.' : 'Seçilen varyant satışa açık değil.'}</div> : null}
        </section>

        <section aria-labelledby="gift-personalize-title" className="space-y-4">
          <div><div className="flex items-center gap-2"><Sparkles aria-hidden="true" className="h-5 w-5 text-brand-gold" /><h3 id="gift-personalize-title" className="text-lg font-bold">Hediyeyi kişiselleştirin</h3></div><p className="mt-1 text-sm text-gray-500">Alıcı hediyeyi açtığında önce sizin sözlerinizle karşılaşsın.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor="gift-recipient-name"><span className="text-sm font-semibold">Alıcının adı</span><input id="gift-recipient-name" value={recipientName} onChange={event => setRecipientName(event.target.value.slice(0, 120))} maxLength={120} autoComplete="name" required disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-recipient-phone"><span className="text-sm font-semibold">Teslimat telefonu</span><input id="gift-recipient-phone" value={recipientPhone} onChange={event => setRecipientPhone(event.target.value.slice(0, 40))} maxLength={40} inputMode="tel" autoComplete="tel" required disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-recipient-email"><span className="text-sm font-semibold">Alıcı e-postası <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-recipient-email" type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value.slice(0, 254))} maxLength={254} inputMode="email" autoComplete="email" disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-sender-name"><span className="text-sm font-semibold">Kimden</span><input id="gift-sender-name" value={senderName} onChange={event => setSenderName(event.target.value.slice(0, 120))} maxLength={120} disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
          </div>

          <fieldset><legend className="text-sm font-semibold">Bu hediye hangi an için?</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{giftOccasions.map(item => <button key={item.value} type="button" aria-pressed={occasion === item.value} disabled={submitting} onClick={() => setOccasion(item.value)} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${occasion === item.value ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-gray-200 dark:border-gray-700'}`}>{item.label}</button>)}</div></fieldset>

          <label htmlFor="gift-card-title"><span className="text-sm font-semibold">Kart başlığı <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-card-title" value={cardTitle} onChange={event => setCardTitle(event.target.value.slice(0, 100))} maxLength={100} placeholder={giftOccasions.find(item => item.value === occasion)?.title} disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
          <label htmlFor="gift-message"><span className="text-sm font-semibold">Hediye notunuz</span><textarea id="gift-message" value={message} onChange={event => setMessage(event.target.value.slice(0, 1000))} maxLength={1000} rows={4} placeholder="Kendi cümlenizle yazın. En değerli kısım burası." disabled={submitting} className="mt-1 w-full rounded-xl border bg-transparent p-3" /><span className="mt-1 block text-right text-xs text-gray-500" aria-live="polite">{message.length}/1000</span></label>

          <fieldset><legend className="text-sm font-semibold">Kart sunumu</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{giftStyles.map(style => <button key={style.value} type="button" aria-pressed={presentationStyle === style.value} disabled={submitting} onClick={() => setPresentationStyle(style.value)} className={`min-h-16 rounded-2xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${presentationStyle === style.value ? 'border-brand-gold bg-brand-gold/10' : 'border-gray-200 dark:border-gray-700'}`}><span className="block font-bold">{style.label}</span><span className="mt-1 block text-xs text-gray-500">{style.description}</span></button>)}</div></fieldset>

          <label className="flex min-h-12 items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={hidePrice} onChange={event => setHidePrice(event.target.checked)} disabled={submitting} className="mt-1 h-5 w-5" /><span><span className="block font-semibold">Fiyatı alıcıdan gizle</span><span className="mt-1 block text-xs text-gray-500">Hediye kartında ve alıcı sunumunda ürün bedeli gösterilmez. Sipariş sahibi kendi hesabında gerçek tutarı görür.</span></span></label>

          <GiftCardPreview recipientName={recipientName} senderName={senderName} message={message} occasion={occasion} presentationStyle={presentationStyle} cardTitle={cardTitle} hidePrice={hidePrice} />
        </section>

        <section aria-labelledby="gift-address-title" className="rounded-3xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 id="gift-address-title" className="text-lg font-bold">Teslimat adresi</h3><p className="mt-1 text-sm text-gray-500">Hesabınıza kaydettiğiniz adresi seçebilir veya bu hediye için farklı bir adres yazabilirsiniz.</p></div><MapPin aria-hidden="true" className="h-5 w-5 text-brand-green" /></div>
          {addresses.length ? <label htmlFor="gift-saved-address" className="mt-4 block"><span className="text-sm font-semibold">Kayıtlı adresler</span><select id="gift-saved-address" value={useManualAddress ? '__manual__' : selectedAddressId} onChange={event => chooseSavedAddress(event.target.value)} disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3">{addresses.map(saved => <option key={saved.id} value={saved.id}>{saved.label} - {[saved.city, saved.administrativeArea, saved.countryCode].filter(Boolean).join(' / ')}</option>)}<option value="__manual__">Bu hediye için farklı adres kullan</option></select></label> : null}

          {!useManualAddress && selectedSavedAddress ? <address className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm not-italic dark:bg-gray-800"><strong>{recipientName.trim() || selectedSavedAddress.recipientName}</strong><br />{recipientPhone.trim() || selectedSavedAddress.phone}<br />{selectedSavedAddress.addressLine1}{selectedSavedAddress.locality ? `, ${selectedSavedAddress.locality}` : ''}<br />{[selectedSavedAddress.city, selectedSavedAddress.administrativeArea, selectedSavedAddress.countryCode].filter(Boolean).join(' / ')}</address> : null}

          {useManualAddress ? <fieldset className="mt-4 grid gap-3 sm:grid-cols-2"><legend className="sr-only">Yeni hediye teslimat adresi</legend>
            <label htmlFor="gift-country"><span className="text-sm font-semibold">Ülke kodu</span><input id="gift-country" value={manualAddress.country_code} onChange={event => setManualAddress({ ...manualAddress, country_code: event.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2) })} maxLength={2} autoComplete="country" required disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-admin-area"><span className="text-sm font-semibold">İl / bölge <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-admin-area" value={manualAddress.administrative_area} onChange={event => setManualAddress({ ...manualAddress, administrative_area: event.target.value.slice(0, 160) })} maxLength={160} autoComplete="address-level1" disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-city"><span className="text-sm font-semibold">Şehir / ilçe</span><input id="gift-city" value={manualAddress.city} onChange={event => setManualAddress({ ...manualAddress, city: event.target.value.slice(0, 160) })} maxLength={160} autoComplete="address-level2" required disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-locality"><span className="text-sm font-semibold">Mahalle / köy</span><input id="gift-locality" value={manualAddress.locality} onChange={event => setManualAddress({ ...manualAddress, locality: event.target.value.slice(0, 160) })} maxLength={160} autoComplete="address-level3" disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-postal-code"><span className="text-sm font-semibold">Posta kodu</span><input id="gift-postal-code" value={manualAddress.postal_code} onChange={event => setManualAddress({ ...manualAddress, postal_code: event.target.value.slice(0, 30) })} maxLength={30} autoComplete="postal-code" disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <div className="hidden sm:block" />
            <label htmlFor="gift-address-line1" className="sm:col-span-2"><span className="text-sm font-semibold">Açık adres</span><textarea id="gift-address-line1" value={manualAddress.address_line1} onChange={event => setManualAddress({ ...manualAddress, address_line1: event.target.value.slice(0, 1000) })} maxLength={1000} autoComplete="street-address" rows={3} required disabled={submitting} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
            <label htmlFor="gift-address-line2" className="sm:col-span-2"><span className="text-sm font-semibold">Adres devamı <span className="font-normal text-gray-500">(opsiyonel)</span></span><input id="gift-address-line2" value={manualAddress.address_line2} onChange={event => setManualAddress({ ...manualAddress, address_line2: event.target.value.slice(0, 500) })} maxLength={500} disabled={submitting} className="mt-1 min-h-12 w-full rounded-xl border bg-transparent px-3" /></label>
            <label htmlFor="gift-delivery-notes" className="sm:col-span-2"><span className="text-sm font-semibold">Teslimat notu</span><textarea id="gift-delivery-notes" value={manualAddress.delivery_notes} onChange={event => setManualAddress({ ...manualAddress, delivery_notes: event.target.value.slice(0, 500) })} maxLength={500} rows={2} disabled={submitting} className="mt-1 w-full rounded-xl border bg-transparent p-3" /></label>
            <div className="sm:col-span-2 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4">
              <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="save_address" disabled={submitting} className="mt-1 h-5 w-5" /><span><span className="block font-semibold">Bu adresi hesabıma kaydet</span><span className="mt-1 block text-xs text-gray-500">Hediye tamamlandıktan sonra da Adreslerim bölümünde kullanabilirsiniz.</span></span></label>
              <label className="mt-3 block" htmlFor="gift-address-label"><span className="text-sm font-semibold">Adres etiketi</span><input id="gift-address-label" name="address_label" defaultValue="Hediye Teslimatı" maxLength={60} disabled={submitting} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 dark:bg-gray-950" /></label>
              <label className="mt-3 flex min-h-11 items-center gap-3"><input type="checkbox" name="make_default_address" disabled={submitting} className="h-5 w-5" /><span className="text-sm font-semibold">Kaydedersem varsayılan teslimat adresim yap</span></label>
            </div>
          </fieldset> : null}
          {!validCountry ? <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Kargo ve toplam hesaplanabilmesi için gerçek iki harfli ülke kodu gerekiyor.</div> : null}
        </section>

        <section aria-labelledby="gift-payment-title" className="rounded-3xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 id="gift-payment-title" className="text-lg font-bold">Ödeme yöntemi</h3><p className="mt-1 text-sm text-gray-500">Kayıtlı kartınızı seçin. Kart numarası yalnız maskeli son dört haneyle gösterilir; CVC saklanmaz.</p></div><CreditCard aria-hidden="true" className="h-5 w-5 text-brand-green" /></div>
          {paymentMethods.length ? <fieldset className="mt-4 space-y-2"><legend className="sr-only">Hediye için ödeme yöntemi seçin</legend>{paymentMethods.map((method: any) => { const id=safeText(method.id,160); const active=method.status==='active'; return <label key={id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 ${selectedPaymentMethodId===id?'border-brand-gold bg-brand-gold/10':'border-gray-200 dark:border-gray-700'} ${active?'':'cursor-not-allowed opacity-60'}`}><input type="radio" name="gift-payment-method" value={id} checked={selectedPaymentMethodId===id} disabled={!active||submitting} onChange={()=>setSelectedPaymentMethodId(id)} className="h-5 w-5"/><span className="min-w-0 flex-1"><span className="block font-semibold">{paymentMethodLabel(method)}</span><span className="mt-1 block text-xs text-gray-500">{method.isDefault ? 'Varsayılan ödeme yöntemi' : 'Kayıtlı ödeme yöntemi'}{active?'':' • Süresi dolmuş veya kullanılamıyor'}</span></span></label>; })}</fieldset> : <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">Hesabınızda doğrulanmış kayıtlı ödeme yöntemi yok.</div>}
          {onOpenPayments ? <button type="button" onClick={onOpenPayments} disabled={submitting} className="mt-3 min-h-11 rounded-xl border border-brand-green px-4 text-sm font-bold text-brand-green disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold dark:border-brand-gold dark:text-brand-gold">Kartlarımı yönet / yeni kart ekle</button> : null}
          <div className={`mt-3 rounded-xl border p-3 text-sm ${livePayments ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-100' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'}`}>{livePayments ? `Canlı ödeme sağlayıcısı ${provider} etkin. Seçilen aktif kart sipariş v5 ile sunucuda siparişe bağlanır; ödeme sonucu yalnız backend doğrulamasıyla kabul edilir.` : 'Canlı kart tahsilatı henüz etkin değil. Kayıtlı kart tercihi siparişe bağlanabilir, ancak bu ekran karttan para çekmez veya sahte ödeme başarısı göstermez.'}</div>
          {livePayments && !selectedPaymentMethod ? <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Canlı ödeme için aktif bir kart seçmeniz veya yeni kart eklemeniz gerekiyor.</div> : null}
        </section>

        <section aria-labelledby="gift-summary-title" className="rounded-3xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><PackageCheck aria-hidden="true" className="h-5 w-5 text-brand-green" /><h3 id="gift-summary-title" className="text-lg font-bold">Hediye sipariş özeti</h3></div><p className="mt-1 text-sm text-gray-500">Tüm tutarlar Golden Oremar sunucusundan gelir.</p></div>{previewBusy ? <span role="status" className="text-sm text-gray-500">Hesaplanıyor…</span> : null}</div>
          <div className="mt-4 flex gap-2"><label htmlFor="gift-coupon" className="min-w-0 flex-1"><span className="sr-only">Kupon kodu</span><input id="gift-coupon" value={couponInput} onChange={event => setCouponInput(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64))} maxLength={64} placeholder="Kupon kodu" disabled={submitting} className="min-h-12 w-full rounded-xl border bg-transparent px-3" /></label><button type="button" onClick={() => void applyCoupon()} disabled={submitting || previewBusy || !validCountry} className="min-h-12 rounded-xl border px-4 font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"><TicketPercent aria-hidden="true" className="mr-2 inline h-4 w-4" />Uygula</button></div>
          {appliedCoupon ? <button type="button" onClick={() => { setCouponInput(''); setAppliedCoupon(''); setStatus('Kupon kaldırıldı.'); }} disabled={submitting} className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300">Kuponu kaldır</button> : null}

          <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><span>Ara toplam</span><strong>{preview ? <Money minor={preview.subtotalMinor} currency={preview.currency} /> : 'Doğrulanıyor…'}</strong></div><div className="flex justify-between gap-3"><span>Kargo</span><strong>{preview ? <Money minor={preview.shippingMinor} currency={preview.currency} /> : validCountry ? 'Doğrulanıyor…' : 'Ülke gerekli'}</strong></div>{preview && preview.discountMinor > 0 ? <div className="flex justify-between gap-3 text-green-700 dark:text-green-300"><span>{safeText(preview.promotion?.title, 160) || 'İndirim'}</span><strong>-<Money minor={preview.discountMinor} currency={preview.currency} /></strong></div> : null}<div className="flex justify-between gap-3 border-t pt-3 text-lg"><span>Toplam</span><strong>{preview ? <Money minor={preview.totalMinor} currency={preview.currency} /> : 'Doğrulanmadı'}</strong></div></div>
          {preview && !preview.canCheckout ? <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">{friendlyBlockingReason(preview.blockingReason) || 'Hediye checkout uygunluğu doğrulanamadı.'}</div> : null}
          {safeText(preview?.shipping?.publicNote, 800) ? <p className="mt-3 text-xs text-gray-500">{safeText(preview?.shipping?.publicNote, 800)}</p> : null}
          <div className="mt-4 flex gap-2 rounded-2xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-green" /><div>Ürün, varyant, stok, kargo, kampanya ve toplam sipariş gönderilmeden hemen önce yeniden doğrulanır. Hediye notu, kart tercihi ve seçilen ödeme yöntemi siparişle birlikte veritabanında saklanır.</div></div>
          <button type="submit" disabled={submitting || previewBusy || !purchaseReady || !preview?.canCheckout || !validCountry || (livePayments && !selectedPaymentMethod)} className="mt-5 min-h-12 w-full rounded-xl bg-brand-green px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">{submitting ? 'Hediye siparişi doğrulanıyor…' : 'Hediye Siparişini Oluştur'}</button>
        </section>
      </form>
    </div>
  </div>;
}
