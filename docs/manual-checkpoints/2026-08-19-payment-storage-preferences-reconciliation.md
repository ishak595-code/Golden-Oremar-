# 2026-08-19 Golden Oremar payment, storage and preference reconciliation

Branch: `agent/admin-supabase-retire-node`
PR: #47
Supabase project: `rmfcziawxjgcnxexbrvw`
Latest functional app code before state/report documentation commits: `983d6c1350e4e46259c68cf948edb7956ebb519e`

## Why this checkpoint exists

This checkpoint reconciles the live Supabase schema/functions with the GitHub feature branch after a large sequence of payment, gift, preference and storage-integrity changes. The goal is to prevent a later developer or agent from restoring stale 130-migration/order-v4 assumptions or treating database image paths as real uploaded assets.

## Migration reconciliation

Live Supabase contains 151 migrations. Latest migration:

`20260818232517_verify_producer_product_gallery_assets`

The current feature branch contains the corresponding hardening-series SQL files, including the 2026-08-18 migrations for:

- explicit shipping-country enforcement
- legacy order RPC retirement
- social-auth profile bootstrap hardening
- secure customer payment-method vault tables/RPCs
- gift presentation persistence
- server-authoritative gift checkout preview
- international address upsert v2
- payment-method management, nickname and metadata
- order v5 saved payment-method binding
- payment-method RPC proxy hardening
- provider card-vault service contract
- card-enrollment readiness v3
- management gift and masked payment snapshot v2
- direct payment-method removal retirement
- persistent theme and notification-sound preferences
- catalog asset fail-closed v2
- public catalog RPC routing through verified assets
- admin real-asset product readiness
- admin image readiness aligned to Storage
- content/event asset fail-closed behavior
- producer catalog Storage policy hardening
- producer gallery real-object verification

Do not create duplicate migrations for these blocks.

## Current checkout contract

Live privilege check at this checkpoint:

- `create_customer_order`: authenticated false, anon false
- `create_customer_order_v2`: authenticated false, anon false
- `create_customer_order_v3`: authenticated false, anon false
- `create_customer_order_v4`: authenticated false, anon false
- `create_customer_order_v5`: authenticated true, anon false

Therefore v5 is the only customer-facing order creation RPC. Do not restore v4 as an externally executable entrypoint.

## Payment method vault

Live Edge Function:

- slug: `payment-method-vault`
- version: 1
- status: ACTIVE
- verify_jwt: true
- source is recorded in `supabase/functions/payment-method-vault/index.ts`
- import config is recorded in `supabase/functions/payment-method-vault/deno.json`

The function is fail-closed when real provider configuration/credentials are unavailable. Never represent card enrollment as production-ready without merchant/provider configuration.

Reusable provider card/customer references stay server-side. Client/admin surfaces receive only safe payment metadata such as method id, provider name, card brand/association, last four digits, expiry, billing name, nickname, country/postal metadata and default/status flags.

## Gift order operations

Gift checkout data persists with the order, including applicable occasion/presentation metadata, sender/recipient information, card message and hide-price preference.

Management order snapshot v2 exposes only the gift instructions needed for fulfillment plus masked payment metadata. Provider secrets/tokens are not returned in the management snapshot.

## Theme and notification sound persistence

Theme and notification-sound preferences are account-backed in Supabase. Device local storage is a fast-start/cache layer only. Server preference hydration must not block authentication if it temporarily fails.

Runtime theme application is event-synchronized so server hydration, settings changes and other theme writes update React/native visual state consistently.

## Public Storage integrity

Observed live object counts at this checkpoint:

- `catalog-public`: 0 real objects
- `content-public`: 0 real objects

Existing database paths are therefore stale references, not valid media assets.

The application/backend now treats this truthfully:

- catalog/public product RPCs return an image path only when the referenced object exists in `catalog-public`
- content/event RPCs return an image path only when the referenced object exists in `content-public`
- missing object means controlled no-image UI, not a broken public URL
- admin product approval requires a real primary object in Storage
- producer product gallery returns only objects that actually exist

## Producer public-image Storage policy

Producer write permissions were tightened:

- INSERT requires authenticated ownership of a verified active producer
- object path must be inside `{producerId}/products/...`
- UPDATE/overwrite policy was removed
- DELETE is limited to the producer's own object and only when the object is not referenced by `product_images`

This prevents a producer from overwriting or deleting a live referenced product image directly through Storage.

## Producer product client boundary

`src/features/producer-products/api.ts` now validates:

- product/category/variant identities
- real number/integer ranges for price, stock and inventory fields
- currency
- exactly one active default variant
- image path safety
- producer identity before upload
- upload MIME, size and path generation
- image removal path safety

Malformed server data does not silently become editable zero values.

## Security status

Supabase Security Advisor after migration 151: 0 lints.

## Important blockers

Do not fabricate values to clear these blockers:

- zero real `catalog-public` product assets
- zero real `content-public` content/event assets
- fourteen active perishable variants still missing real shipping weights
- legal business/support identity
- final applicable legal copy
- production payment merchant/provider configuration
- production Google/Facebook OAuth
- FCM/APNs credentials
- Play Store/App Store signing/release configuration
- real public HTTPS share origin

## CI/release rule

The newest head is not CI-green. GitHub Actions runner allocation remains blocked by account billing/minute/spending-limit conditions. Do not trigger repeated Actions runs while blocked.

Last recorded blocked run: `32029478472`.

Do not merge PR #47 until a current-head mobile quality gate can execute successfully and the user explicitly authorizes merge.

## Historical state preservation

The previous `PROJECT_STATE.json` and `TEST_REPORT.json` versions remain recoverable through Git history. The updated files record their previous blob SHAs. Do not treat the replacement of stale 130/v4 state fields as deletion of historical work.

## Next block

Continue manually from the current branch with the remaining account/seller/admin accessibility and production data-contract scan. First refetch the current PR head and touched files before each write. Never force an update using a stale blob SHA.
