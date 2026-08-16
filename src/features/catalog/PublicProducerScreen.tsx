import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Heart, MapPin, Package, ShoppingCart, Star, Store } from 'lucide-react';
import { getPublicProducerProfile, publicCatalogUrl, toggleProducerFollow } from './api';

type Props = {
  reference: string;
  authenticated: boolean;
  onBack: () => void;
  onLoginRequired: () => void;
  onOpenProduct: (slug: string) => void;
  onAddToCart: (product: { id: string; slug: string; name: string; variantId: string }) => Promise<void> | void;
};

export default function PublicProducerScreen({ reference, authenticated, onBack, onLoginRequired, onOpenProduct, onAddToCart }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [following, setFollowing] = useState<boolean | null>(null);

  async function load() {
    try {
      setLoading(true); setError('');
      setProfile(await getPublicProducerProfile(reference));
    } catch (err: any) {
      setError(err?.message || 'Üretici profili yüklenemedi.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [reference]);

  async function follow() {
    if (!authenticated) { onLoginRequired(); return; }
    if (!profile?.id) return;
    try {
      setBusy(true); setError(''); setStatus('');
      const result = await toggleProducerFollow(profile.id);
      setFollowing(!!result?.following);
      setStatus(result?.following ? 'Üreticiyi takip etmeye başladınız.' : 'Üretici takibi bırakıldı.');
    } catch (err: any) { setError(err?.message || 'Takip işlemi tamamlanamadı.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div role="status" className="mx-auto max-w-6xl p-8 text-center">Üretici profili yükleniyor…</div>;
  if (!profile) return <div className="mx-auto max-w-6xl p-6"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error || 'Üretici bulunamadı.'}</div><button onClick={onBack} className="mt-4 min-h-11 rounded-xl border px-4">Geri</button></div>;

  const activeBadges = Array.isArray(profile.badges) ? profile.badges.filter((item: any) => item.active) : [];
  const structuredLocation = [profile.location?.village, profile.location?.district, profile.location?.province].filter(Boolean).join(', ');
  const locationText = structuredLocation || profile.location_label || 'Türkiye';

  return (
    <article className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <button onClick={onBack} className="mb-5 min-h-11 rounded-xl border px-4 font-semibold"><ArrowLeft className="mr-2 inline h-4 w-4" />Geri</button>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {status ? <div role="status" aria-live="polite" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{status}</div> : null}

      <section className="overflow-hidden rounded-3xl border bg-white dark:bg-gray-900">
        <div className="h-44 bg-gradient-to-br from-brand-green/70 to-brand-gold/30 sm:h-60">
          {profile.cover_path ? <img src={publicCatalogUrl(profile.cover_path)} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="-mt-16 grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg dark:border-gray-900 dark:bg-gray-800">
              {profile.logo_path ? <img src={publicCatalogUrl(profile.logo_path)} alt="" className="h-full w-full object-cover" /> : <Store className="h-10 w-10 text-brand-gold" />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-brand-green dark:text-brand-gold">{profile.display_name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">{activeBadges.map((badge: any) => <span key={badge.key} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800"><CheckCircle2 className="h-3.5 w-3.5" />{badge.label}</span>)}</div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-brand-gold" />{locationText}</span>
                <span className="inline-flex items-center gap-1"><Package className="h-4 w-4 text-brand-gold" />{profile.product_count || 0} ürün</span>
                {Number(profile.rating_count || 0) > 0 ? <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-brand-gold text-brand-gold" />{Number(profile.rating_average || 0).toFixed(1)} ({profile.rating_count})</span> : null}
              </div>
            </div>
            <button onClick={follow} disabled={busy} className="min-h-11 rounded-xl border border-brand-gold/40 px-5 font-bold text-brand-gold disabled:opacity-50"><Heart className="mr-2 inline h-4 w-4" />{following === true ? 'Takibi bırak' : 'Takip et'}</button>
          </div>
          {profile.description ? <p className="mt-6 leading-7 text-gray-600 dark:text-gray-300">{profile.description}</p> : null}
          {profile.story ? <div className="mt-5 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800"><h2 className="font-bold">Üretici Hikâyesi</h2><p className="mt-2 whitespace-pre-wrap leading-7 text-gray-600 dark:text-gray-300">{profile.story}</p></div> : null}
          <p className="mt-4 text-xs text-gray-500">Gizlilik nedeniyle üreticinin ev adresi, telefon, e-posta, banka/KYC bilgileri ve kesin koordinatları public profilde gösterilmez.</p>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="producer-products-title">
        <h2 id="producer-products-title" className="text-2xl font-bold text-brand-green dark:text-brand-gold">Ürünleri</h2>
        {!profile.products?.length ? <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-gray-500">Bu üreticinin yayında ürünü bulunmuyor.</div> : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {profile.products.map((product: any) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border bg-white dark:bg-gray-900">
                <button onClick={() => onOpenProduct(product.slug)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800">{product.image_path ? <img src={publicCatalogUrl(product.image_path)} alt={product.name} className="h-full w-full object-cover" /> : null}</div>
                  <div className="p-4"><h3 className="line-clamp-2 font-bold">{product.name}</h3><p className="mt-1 text-sm text-gray-500">{product.origin || locationText}</p><div className="mt-3 font-bold text-brand-green dark:text-brand-gold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: product.currency || 'TRY' }).format(Number(product.price_minor || 0) / 100)}</div></div>
                </button>
                <div className="px-4 pb-4"><button onClick={() => onAddToCart({ id: product.id, slug: product.slug, name: product.name, variantId: product.variant_id })} className="min-h-11 w-full rounded-xl bg-brand-green px-3 font-bold text-white"><ShoppingCart className="mr-2 inline h-4 w-4" />Sepete Ekle</button></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
