# Reading the Supabase advisors on this project

Two advisor findings on `golden-oremar` look alarming, are expected, and would
cause real damage if acted on literally. This note exists so that nobody -
human or assistant - "fixes" them.

## 1. `unused_index` - 104 findings, INFO level

**Do not delete these indexes.**

The advisor reports an index as unused when `pg_stat_user_indexes` shows zero
scans. That statistic measures history, not usefulness. As of 2026-09-16 the
storefront has not opened, and the tables behind most of these indexes are
empty:

| table | rows |
|---|---|
| orders | 0 |
| order_items | 0 |
| payment_records | 0 |
| refunds | 0 |
| shipments | 0 |
| return_requests | 0 |
| reviews | 0 |
| messages | 0 |
| event_reservations | 0 |
| producer_payouts | 0 |
| producer_ledger_entries | 0 |
| campaigns | 0 |

An index on `orders` cannot have been scanned when no order exists. "Unused"
here means "this feature has not been used yet", which is a statement about the
business, not the schema.

Two specific dangers if the list is applied literally:

**Correctness, not performance.** Several flagged entries are partial unique
indexes that enforce rules no CHECK constraint can express, because they span
rows or cover nullable columns. Examples in the flagged list include
`promotion_redemptions_*` (a campaign or coupon cannot be redeemed beyond its
limits), `payment_item_splits_*` (a payment cannot be split twice against the
same subject) and `orders_expiring_reservations_idx` (the sweep that releases
stock held by abandoned checkouts). Dropping one of these does not slow the
system down - it removes a guarantee, silently.

**Search.** `products_search_text_trgm_idx`, `producers_display_name_trgm_idx`,
`producers_village_trgm_idx`, `categories_name_trgm_idx`,
`content_entries_search_idx` and `products_name_search_idx` back
`search_catalog_v1/v2` and `catalog_search_suggestions_v1`. Without them those
functions still return correct results, so nothing appears broken in testing
with 42 products. They degrade to sequential scans, and the failure only
surfaces once the catalogue is large enough to matter. Searching by village
name is a headline feature of this storefront, not an optimisation.

**When this finding becomes meaningful:** after the store has been live long
enough to accumulate real order, payment and search traffic - realistically
some months. At that point, re-read the list and evaluate each entry on its
own. Check `pg_stat_user_indexes.idx_scan` again, confirm the index is not
unique, confirm no function or RLS policy depends on the access path, and only
then consider dropping it. Treat the list as a prompt to investigate, never as
a to-do list.

One genuine duplicate pair was found and removed deliberately in
`20260916260000_drop_duplicate_stock_alert_unique_indexes_v1.sql`. That was
identified by comparing `pg_index` column sets and predicates, not by trusting
the advisor.

## 2. `rls_enabled_no_policy` - 41 findings, INFO level

**This is the intended state.** These are `private` schema tables reached only
through `SECURITY DEFINER` functions owned by `postgres`, which are exempt from
RLS, and through `service_role`, which carries `rolbypassrls`. RLS is enabled
with no policy so the default answer to any other role is deny.

"No policy" is how deny-by-default is expressed in PostgreSQL. Adding
permissive policies to silence the advisor would open tables that are meant to
be closed. See `20260916040000_enable_rls_backstop_on_private_tables_v1.sql`
for the reasoning and the safety checks performed before enabling it.

## 3. `auth_leaked_password_protection` - 1 finding, WARN level

This one is real and actionable, and it is not a schema matter. Supabase can
check new passwords against the HaveIBeenPwned breach corpus and reject ones
that have appeared in known leaks. It is off. Turning it on is a toggle in
Authentication settings and costs nothing.

This is worth doing before the store opens to real customers.
