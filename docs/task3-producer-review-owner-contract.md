# Golden Oremar Producer Review Owner Contract

This document freezes the product moderation invariant used after Task 3.

- A producer can create, correct and resubmit its own product, but cannot make it public.
- Producer submission enters `review` and remains non-public until the final owner decision.
- Rejection requires a human-readable correction reason which is returned to the producer workflow.
- Product review covers seller ownership, category scope, origin, real catalog media, price/stock, product description and the published health/allergen/storage/recipe package.
- `product.publish` is the final publication capability and remains assigned only to `super_admin`.
- `super_admin` is the Golden Oremar owner. A valid AAL2 session is still required by the staff authorization baseline.
- Moderation/supporting roles may perform only the capabilities explicitly assigned to them; none can bypass the final `product.publish` requirement.
- Product health information is managed through the canonical Super Admin product-health editor. No parallel health-content model is introduced.
- Runtime logo/black fallbacks are presentation fallbacks only and never satisfy authentic product-media publish integrity.
