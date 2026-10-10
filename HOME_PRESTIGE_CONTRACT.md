# Golden Oremar Home Prestige Contract

This document is the permanent product-design contract for the Golden Oremar Home experience. It exists to prevent future refactors from accidentally returning the Home product list to a card grid, duplicating product content, or diluting the premium organic visual language.

## Non-negotiable product-row invariants

1. One product equals one visual row and one interactive link.
2. Home product lists use native `ul > li > a` semantics.
3. The row is horizontal. Image is left, identity and signal are center, final price and chevron are right.
4. The row never becomes a card grid on Home.
5. The entire row remains tappable. No nested product links or duplicate interactive nodes are allowed.
6. Product images come from `item.imagePath`. Missing or failed media uses the dark premium placeholder.
7. Product title stays one line with ellipsis on compact mobile screens.
8. Merchandising signals stay inline with metadata and must never create a second product row or duplicate product copy.
9. Hidden duplicate per-product copy such as `sr-only` mirrors is prohibited. The link itself owns the accessible name.
10. `go-product-card-v2` may exist only as the native audit data marker. It must never return as a Home visual class.

## Premium Home principles

- Quiet luxury over decoration. Forest, ivory and restrained gold remain the core palette.
- Negative space is intentional. Sections breathe, but discovery remains compact enough for mobile.
- Serif typography belongs to editorial section headlines. Product scanning remains sans-serif and fast.
- Category discovery is a compact horizontal rail. Home does not need a duplicate `Tümünü gör` action above the rail.
- Touch feedback is immediate and restrained. The product row changes surface tone on press without turning into a card.
- Real product and producer data remain the source of product identity, price, origin and verification.
- Persuasive presentation signals are a presentation layer. Quantitative popularity, scarcity or sales claims must be backed by real data before they are treated as factual production claims.

## Copy direction

Home section copy should evoke provenance, season, craft, discovery and selectivity. It should not say `premium` merely to sound premium. The language should create value through specificity and restraint.

Examples of the intended voice:

- `Sofranın imza parçaları`
- `Hasadın en güzel zamanı`
- `Beklemeye değen lezzetler`
- `Sıradan olmayan sofralar için`
- `Vitrine yeni düşenler`

## Research basis

The implementation follows two durable principles from established mobile commerce and platform research:

- Apple Human Interface Guidelines: hierarchy, simplicity, consistency, craft, accessible touch targets and immediate interaction feedback.
- Baymard mobile ecommerce research: balanced product-list density, sufficient decision information, clear hit areas and easy product scanning on small screens.

## Enforcement

`scripts/home-product-row-contract-audit.mjs` is a blocking structural audit. If a future change breaks the single-row architecture, reintroduces duplicate per-product accessibility copy, restores the legacy visual card class, or adds the redundant category CTA on Home, CI must fail.
