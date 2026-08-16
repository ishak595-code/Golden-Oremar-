
# App.tsx — AccountCenter integration

Target: `src/App.tsx` in the legacy Golden Oremar app.

## 1. Add import

```tsx
import AccountCenter from './features/account/AccountCenter';
```

## 2. Replace the legacy `if (currentTab === 'account')` block

Replace the old `<AccountSection ... />` call with:

```tsx
if (currentTab === 'account') {
  return (
    <AccountCenter
      requestedView={accountView}
      onBack={goBack}
      onOpenProduct={(slug) => {
        const product = products.find((item: any) =>
          item.slug === slug || String(item.id) === slug
        );
        if (product) {
          handleProductClick(product);
        } else {
          showToast('Ürün güncel katalogda bulunamadı.');
        }
      }}
      onOpenProducer={(slug) => {
        const vendor =
          products.find((item: any) => item.vendor?.slug === slug)?.vendor ||
          products.find((item: any) => item.vendor_slug === slug)?.vendor;
        if (vendor) {
          setSelectedVendor(vendor);
          navigateToTab('vendor-store');
        } else {
          showToast('Üretici profili güncel katalogdan açılacak.');
        }
      }}
      onStartGift={() => navigateToTab('home')}
      onOpenContact={() => navigateToTab('contact')}
      onOpenSellerApplication={() => setAccountView('vendor-apply')}
      onOpenSellerProductManager={() => setAccountView('vendor-dashboard')}
      onOpenNotificationAction={(url, metadata) => {
        if (url?.includes('/messages/')) {
          setAccountView('support');
          return;
        }
        if (url?.includes('producer')) {
          setAccountView('seller');
          return;
        }
        if (url?.includes('order')) {
          setAccountView('orders');
          return;
        }
      }}
    />
  );
}
```

The existing header and mobile bottom navigation may continue using `setAccountView(...)`.
`AccountCenter.requestedView` maps legacy values such as `menu`, `favorites`, `orders`,
`notifications`, `vendor-apply`, and `vendor-dashboard` to the new account screens.

## 3. Delete obsolete account-only state after the new center is mounted

Safe to delete from the legacy AccountSection implementation once no call sites remain:

- local address state and `handleAddAddress`
- local card state, CVV/card-number form, and `handleAddCard`
- fixed `250 Doğa Puan`
- fake order-complete payment-transfer UI
- local `followedVendors` rendering inside the old account section
- local gift order filtering by `order.isGift`
- local profile photo `URL.createObjectURL` persistence
- account-only simulation toasts

Do **not** delete shared content favorites, recipes, events, health/blog features until their
separate modules are migrated.

## 4. Temporary rule

The old `AccountSection` function can be removed only after the build confirms there are no
remaining references. This avoids deleting shared legacy content code by accident.


## Automated integration

Use `frontend/integration/apply-account-center.mjs`; it also removes the old AccountSection safely before CartSection.
