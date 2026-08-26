# Task 3.5 Certification Invariants

This branch is the certification head for catalog discovery and Super Admin publication readiness.

The following invariants are release requirements, not optional UI behavior:

1. Public catalog data is served from live Supabase contracts. Placeholder product records do not substitute for unavailable production data.
2. Product publication remains an owner capability. `product.publish` and `product.health_manage` are Super Admin-only capabilities.
3. Independent seller products must pass the canonical media integrity gate. Missing media is blocking.
4. Golden Oremar official-store products may publish with zero product images only through the canonical official brand fallback. If any product image exists, canonical Storage path, exactly-one-primary, object and binary verification rules still apply.
5. Single-product moderation, selected bulk moderation, all-review bulk moderation, publication triggers and readiness diagnostics must derive media state from `private.product_media_integrity_ok_v1`.
6. Readiness responses expose explicit `mediaReady` and `brandFallbackAllowed` fields. Frontend code must validate these fields rather than invent a separate publication rule.
7. Public Super Admin health RPCs must not expose `SECURITY DEFINER` bodies. Privileged reads live in private permission-gated cores and public functions are invoker wrappers.
8. `catalog-owner-publish-maintenance` is permanently retired. Its repository and deployed implementation return HTTP 410 and contain no user creation, service-role, MFA enrollment or publication logic.
9. Voice search is a speech-to-text input adapter only. Recognized text enters the same catalog search route as typed text. There is no separate voice-search results engine or full-screen voice modal.
10. The branch cannot be considered releasable until release audits, TypeScript, production build, authenticated customer E2E, staff MFA/AAL2 checks, Android native build/signature validation and iOS Release archive all pass on the same commit SHA.
11. Official catalog records are not marked published through direct SQL maintenance. Final publication must use the canonical authenticated Super Admin AAL2 application path after certification.

The production catalog currently contains 42 Golden Oremar official-store products. Their final public publication is intentionally separate from schema and application certification.
