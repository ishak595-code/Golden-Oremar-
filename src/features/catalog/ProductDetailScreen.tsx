import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Gift, Heart, MapPin, PackageCheck, QrCode, ShoppingCart, Star, Store } from 'lucide-react';
import { getProductDetail, listProductReviews, publicCatalogUrl, toggleProductFavorite } from './api';
import { setCartItem } from '../cart/api';

type Props = {
  reference: string;
  authenticated: boolean;
  onBack: () => void;
  onLoginRequired: () => void;
  onCartChanged?: () => Promise<void> | void;
  onGift: (reference: string) => void;
  onProducer: (id: string, slug: string, name: string) => void;
};

export default function ProductDetailScreen({ reference, authenticated, onBack, onLoginRequired, onCartChanged, onGift, onProducer }: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [reviews, setReviews] = useState<any>(null);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const product = await getProductDetail(reference);
      setDetail(product);
      const defaultVariant = product?.variants?.find((v: any) => v.default && v.available !== false) || product?.variants?.find((v: any) => v.available !== false) || product?.variants?.[0];
      setVariantId(defaultVariant?.id || '');
      if (product?.id) {
        try { setReviews(await listProductReviews(product.id, 20, 0)); }
        catch { setReviews(null); }
      }
    } catch (err: any) {
      setError(err?.message || 'Ürün bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [reference]);

  const variant = useMemo(() => detail?.variants?.find((item: any) => item.id === variantId) || null, [detail, variantId]);
  const primaryImage = detail?.images?.find((item: any) => item.primary) || detail?.images?.[0];
  const activeBadges = Array.isArray(detail?.trustBadges) ? detail.trustBadges.filter((badge: any) => badge.active) : [];
  const hasTraceability = !!detail?.traceability?.hasReleasedBatches;

  async function addToCart() {
    if (!authenticated) { onLoginRequired(); return; }
    if (!variant?.id) return;
    try {
      setBusy(true); setError(''); setStatus('');
      await setCartItem({ variantId: variant.id, quantity });
      await onCartChanged?.();
      setStatus('Ürün sepetinize eklendi.');
    } catch (err: any) {
      setError(err?.message || 'Ürün sepete eklenemedi.');
    } finally { setBusy(false); }
  }

  async function favorite() {
    if (!authenticated) { onLoginRequired(); return; }
    try {
      setBusy(true); setError('');
      const result = await toggleProductFavorite(detail.slug || detail.id);
      setStatus(result?.isFavorite ? 'Ürün favorilerinize eklendi.' : 'Ürün favorilerinizden çıkarıldı.');
    } catch (err: any) { setError(err?.message || 'Favori işlemi tamamlanamadı.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div role="status" className="mx-auto max-w-5xl p-8 text-center">Ürün yükleniyor…</div>;
  if (error && !detail) return <div className="mx-auto max-w-5xl p-6"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div><button onClick={onBack} className="mt-4 min-h-11 rounded-xl border px-4">Geri dön</button></div>;
  if (!detail) return null;

  return (
    <article className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <button onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft className="mr-2 inline h-4 w-4" />Geri</button>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{status}</div> : null}

      <div className="grid gap-7 lg:grid-cols-2">
        <section aria-label="Ürün görselleri">
          <div className="overflow-hidden rounded-3xl border bg-gray-100 dark:bg-gray-800">
            {primaryImage?.path ? <img src={publicCatalogUrl(primaryImage.path)} alt={primaryImage.alt || detail.name} className="aspect-square h-full w-full object-cover" /> : <div className="grid aspect-square place-items-center text-gray-400">Görsel yok</div>}
          </div>
          {Array.isArray(detail.images) && detail.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">{detail.images.slice(0, 8).map((img: any, index: number) => <img key={`${img.path}:${index}`} src={publicCatalogUrl(img.path)} alt={img.alt || `${detail.name} görseli ${index + 1}`} className="aspect-square rounded-xl border object-cover" />)}</div>
          ) : null}
        </section>

        <section>
          <div className="text-sm font-semibold text-brand-gold">{detail.category?.name}</div>
          <h1 className="mt-1 text-3xl font-bold text-brand-green dark:text-brand-gold">{detail.name}</h1>
          {detail.shortDescription ? <p className="mt-3 leading-7 text-gray-600 dark:text-gray-300">{detail.shortDescription}</p> : null}

          <button onClick={() => onProducer(detail.producer?.id, detail.producer?.slug, detail.producer?.name)} className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-2xl border p-3 text-left">
            <Store className="h-5 w-5 text-brand-gold" />
            <span className="min-w-0 flex-1"><span className="block font-bold">{detail.producer?.name}</span><span className="block text-sm text-gray-500">{detail.producer?.locationLabel || detail.origin || 'Türkiye'}</span></span>
          </button>

          {activeBadges.length ? <div className="mt-4 flex flex-wrap gap-2">{activeBadges.map((badge: any) => <span key={badge.key} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800"><CheckCircle2 className="h-3.5 w-3.5" />{badge.label}</span>)}</div> : null}

          <fieldset className="mt-6"><legend className="font-bold">Seçenek</legend><div className="mt-2 space-y-2">{detail.variants?.map((item: any) => (
            <label key={item.id} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border p-3 ${variantId === item.id ? 'border-brand-gold bg-brand-gold/5' : ''}`}>
              <span className="flex items-center gap-3"><input type="radio" name="variant" value={item.id} checked={variantId === item.id} disabled={item.available === false} onChange={() => setVariantId(item.id)} /><span><span className="block font-semibold">{item.name}</span><span className="block text-xs text-gray-500">{item.available === false ? 'Satışta değil' : 'Satışta'}</span></span></span>
              <span className="font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: detail.currency }).format(Number(item.priceMinor || 0) / 100)}</span>
            </label>
          ))}</div></fieldset>

          <label className="mt-4 block"><span className="text-sm font-semibold">Adet</span><input type="number" min="1" max="99" value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} className="mt-1 min-h-11 w-28 rounded-xl border bg-transparent px-3" /></label>

          <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-2">
            <button onClick={addToCart} disabled={busy || !variant || variant.available === false} className="min-h-12 rounded-xl bg-brand-green px-4 font-bold text-white disabled:opacity-50"><ShoppingCart className="mr-2 inline h-5 w-5" />Sepete Ekle</button>
            <button onClick={favorite} disabled={busy} aria-label="Favori durumunu değiştir" className="min-h-12 min-w-12 rounded-xl border px-3"><Heart className="mx-auto h-5 w-5" /></button>
            <button onClick={() => authenticated ? onGift(detail.slug || detail.id) : onLoginRequired()} aria-label="Hediye et" className="min-h-12 min-w-12 rounded-xl border px-3"><Gift className="mx-auto h-5 w-5 text-brand-gold" /></button>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border p-5"><h2 className="text-xl font-bold">Ürün Hikâyesi</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-gray-600 dark:text-gray-300">{detail.story || detail.description || 'Ürün hikâyesi henüz eklenmedi.'}</p>{detail.origin ? <div className="mt-4 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-brand-gold" />{detail.origin}</div> : null}</section>
        <section className="rounded-2xl border p-5"><h2 className="flex items-center gap-2 text-xl font-bold"><QrCode className="h-5 w-5 text-brand-gold" />Lot / QR İzlenebilirliği</h2>{hasTraceability ? <div className="mt-3 space-y-2">{detail.traceability.batches.map((batch: any) => <div key={batch.traceCode} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="font-bold">{batch.batchCode || batch.traceCode}</div><div className="text-sm text-gray-500">Takip kodu: {batch.traceCode}</div></div>)}</div> : <p className="mt-3 text-sm text-gray-500">Bu ürün için henüz yayınlanmış lot bulunmuyor. Yayınlanmamış veya doğrulanmamış lot bilgisi müşteriye gösterilmez.</p>}</section>
      </div>

      {Array.isArray(detail.certifications) && detail.certifications.length ? <section className="mt-5 rounded-2xl border p-5"><h2 className="flex items-center gap-2 text-xl font-bold"><PackageCheck className="h-5 w-5 text-brand-gold" />Doğrulanmış Sertifikalar</h2><div className="mt-3 space-y-2">{detail.certifications.map((cert: any, index: number) => <div key={`${cert.type}:${index}`} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800"><strong>{cert.type}</strong>{cert.issuer ? ` • ${cert.issuer}` : ''}</div>)}</div></section> : null}

      <section className="mt-5 rounded-2xl border p-5"><h2 className="text-xl font-bold">Müşteri Yorumları</h2><div className="mt-2 flex items-center gap-2"><Star className="h-5 w-5 fill-brand-gold text-brand-gold" /><strong>{Number(reviews?.summary?.averageRating || detail.reviewSummary?.averageRating || 0).toFixed(1)}</strong><span className="text-sm text-gray-500">({reviews?.summary?.count || detail.reviewSummary?.count || 0} yorum)</span></div>{reviews?.items?.length ? <div className="mt-4 space-y-3">{reviews.items.map((review: any) => <article key={review.id} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800"><div className="flex items-center justify-between gap-3"><strong>{review.reviewerName}</strong><span className="text-sm">{review.rating}/5</span></div>{review.verifiedPurchase ? <div className="mt-1 text-xs font-bold text-green-700">Doğrulanmış satın alma</div> : null}{review.title ? <h3 className="mt-2 font-semibold">{review.title}</h3> : null}<p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{review.body}</p>{review.merchantReply ? <div className="mt-3 rounded-lg border-l-4 border-brand-gold bg-white p-3 text-sm dark:bg-gray-900"><strong>Üretici yanıtı:</strong> {review.merchantReply}</div> : null}</article>)}</div> : <p className="mt-4 text-sm text-gray-500">Henüz yayınlanmış müşteri yorumu yok.</p>}</section>
    </article>
  );
}
