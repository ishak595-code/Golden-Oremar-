/**
 * Which right of withdrawal applies to a product, shown before purchase.
 *
 * The Distance Contracts Regulation removes the 14-day right of withdrawal in
 * two cases that cover most of this catalogue:
 *   - goods that spoil quickly or may pass their use-by date, and
 *   - goods whose protective packaging has been opened after delivery and
 *     whose return is unsuitable for health and hygiene reasons.
 *
 * Those exceptions protect the seller only if the customer was told before
 * buying. A label that appears on the product page is what makes them hold.
 *
 * The tier is read from handlingProfile, which the product detail already
 * returns and which admins classify per product. It is deliberately not
 * derived from category slugs: dried yoghurt sits in dairy and dried
 * persimmon in fresh produce, and both are correctly shelf-stable.
 *
 * No imports and no DOM access, so the contract audit can execute it.
 */

export type WithdrawalTier = 'none' | 'sealed_only' | 'standard';

/**
 * Returns null when the handling profile is missing or unrecognisable. The
 * caller then shows no claim at all: a wrong statement about returns is worse
 * than none, because it either misleads the customer or waives an exception
 * the seller is entitled to.
 */
export function withdrawalTier(handling: unknown): WithdrawalTier | null {
  if (!handling || typeof handling !== 'object') return null;
  const profile = handling as Record<string, unknown>;
  if (typeof profile.isPerishable !== 'boolean') return null;
  if (profile.isPerishable) return 'none';
  const productType = typeof profile.productType === 'string' ? profile.productType : '';
  if (!productType) return null;
  if (productType === 'non_food') return 'standard';
  return 'sealed_only';
}

export const WITHDRAWAL_COPY: Record<WithdrawalTier, { title: string; body: string }> = {
  none: {
    title: 'Bu üründe cayma hakkı yoktur',
    body: 'Çabuk bozulan gıda ürünlerinde, sağlığınızı korumak için cayma hakkı kullanılamaz. Ürün size bozuk, hasarlı, eksik veya açıklamaya uygun olmayan şekilde ulaşırsa iade ve değişim hakkınız saklıdır.',
  },
  sealed_only: {
    title: 'Ambalajı açılmamışsa 14 gün içinde iade',
    body: 'Teslimden itibaren 14 gün içinde, ambalajı açılmamış ürünü gerekçe göstermeden iade edebilirsiniz. Ambalajı açılmış gıda ürünlerinde sağlık ve hijyen nedeniyle cayma hakkı yoktur. Ayıplı ürün hakkınız her durumda saklıdır.',
  },
  standard: {
    title: '14 gün içinde iade hakkı',
    body: 'Teslimden itibaren 14 gün içinde gerekçe göstermeden cayma hakkınızı kullanabilirsiniz.',
  },
};
