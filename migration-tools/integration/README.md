
# Legacy App integration

When the new GitHub repository is available and the existing `src/App.tsx` has been copied in:

```bash
node frontend/integration/apply-account-center.mjs src/App.tsx
```

Then add/copy `frontend/src/features/account` into the real project's `src/features/account`
and `frontend/src/lib/supabase.ts` into `src/lib/supabase.ts`.

The patch script intentionally:
1. imports `AccountCenter`,
2. replaces only the `currentTab === 'account'` render branch,
3. preserves `VendorOnboarding` as the seller-application screen,
4. removes the complete legacy `AccountSection` and `AccountMenuItem`,
5. stops before `CartSection`, leaving cart/categories/content code untouched,
6. aborts rather than guessing if any expected marker is missing.

Do not delete Firebase globally at this step. Other legacy areas still use it. Firebase dependencies
should be removed only after cart, auth, catalog and remaining shared content have all been migrated.


## Gift flow

After the account patch:

```bash
node frontend/integration/apply-gift-flow.mjs src/App.tsx
```

This replaces the legacy `GiftModal` behavior that merely added a product to the normal cart.
The new flow uses `create_customer_order_v4`, server-authoritative variant price/stock, real gift
recipient data, hide-price preference, coupon support, and shipping/export validation.
