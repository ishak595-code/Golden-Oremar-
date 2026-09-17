# Schema Drift Closure - Progress and Resume Instructions

## What this is

The live Supabase project `golden-oremar` (`rmfcziawxjgcnxexbrvw`) contains
functions that were created directly against the database during early
development and never captured as versioned migration files. The application
works fine - those functions exist and run correctly live. The problem is
purely that the repository could not rebuild the schema from scratch, which
matters for disaster recovery, staging environments and any fresh deploy.

This is the tracking file for closing that gap.

## The method (do not deviate from this)

1. **Never apply anything to the live database.** These functions already exist
   live and are correct. Applying hand-assembled SQL is how a placeholder stub
   got into `private.admin_finance_report` earlier (detected, dropped via
   `20260916...remove_erroneous_admin_finance_report_stub_v1`, confirmed not to
   have touched the real `public.admin_finance_report`). Repository files only.

2. **Never hand-write a function body.** Pull it from live with:

   ```sql
   select string_agg(pg_get_functiondef(p.oid), E';\n\n'
            order by n.nspname, p.proname, p.oid) || ';' as sql_text,
          md5(string_agg(pg_get_functiondef(p.oid), E';\n\n'
            order by n.nspname, p.proname, p.oid) || ';') as live_md5
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','private','api_public_bridge')
     and p.prokind = 'f'
     and p.proname in ( ...names... );
   ```

3. **Write the returned `sql_text` verbatim** into a new file at
   `supabase/migrations/<timestamp>_sync_<topic>_v1.sql`, preceded only by a
   `--` comment header.

4. **Prove it byte-for-byte** before committing. Strip the leading comment
   header, strip the trailing newline, and the md5 must equal `live_md5`:

   ```bash
   python3 -c "
   import hashlib
   t=open('supabase/migrations/<file>.sql').read()
   lines=t.split('\n'); i=0
   while i<len(lines) and (lines[i].startswith('--') or lines[i].strip()==''): i+=1
   print(hashlib.md5('\n'.join(lines[i:]).rstrip('\n').encode()).hexdigest())
   "
   ```

   If it does not match, fix the file - do not commit a mismatch.

5. Commit and push. One batch per commit, message stating what was covered and
   the verified md5.

## How to recompute what is still missing

```bash
while read -r fn; do
  c=$(grep -rlP "(?i)create\s+(or\s+replace\s+)?function\s+(public\.|private\.|api_public_bridge\.)?${fn}\s*\(" \
        supabase/migrations/*.sql 2>/dev/null | wc -l)
  if [ "$c" -eq 0 ]; then echo "$fn"; fi
done < <(list of all live function names)
```

Get the live name list with:

```sql
select string_agg(distinct p.proname, E'\n' order by p.proname)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private','api_public_bridge') and p.prokind = 'f';
```

Always recompute this rather than trusting a remembered count.

## Done so far (all md5-verified)

| Migration | Covers |
|---|---|
| `...010000_sync_core_helper_functions_v1` | slugify, id resolution, is_admin, coupon/push hashing, TCKN validation |
| `...010100_sync_kyc_cart_inventory_functions_v1` | producer KYC encrypt/decrypt, cart get-or-create, inventory release |
| `...010200_sync_contact_locations_archive_functions_v1` | contact config, production locations, newsletter unsubscribe, avatar, review media, archive trio |
| `...010300_sync_intake_and_shipping_functions_v1` | contact intake, newsletter/stock-alert subscribe, shipping quote |
| `...010400_sync_producer_batch_location_functions_v1` | batch traceability chain, location change request, reservation cancel |
| `...010500_sync_public_content_category_event_functions_v1` | public content, categories, events listings |
| `...010600_sync_catalog_search_home_producer_functions_v1` | catalog search v1/v2, home catalog, producer directory |
| `...010700_sync_admin_console_listing_notification_functions_v1` | admin listings, notification broadcast pipeline |
| `...010800_sync_admin_producer_returns_overview_functions_v1` | admin producers, balances, returns queue, operations overview |

Earlier batches (applied to live as well as committed, before the
repository-only method was adopted): `20260913211111`, `20260914215826`,
`20260915060959`, `20260915061050`.

## Still missing (43 function names, recompute before trusting this list)

admin_archive_platform_user_v1, admin_finance_report,
admin_list_producer_applications, admin_list_producer_applications_v2,
admin_record_manual_payment_v1, admin_record_manual_refund_v1,
admin_review_producer_application_v2, admin_review_producer_location_change_v1,
admin_review_product_batch_v1, admin_schedule_producer_payout_v1,
admin_set_platform_user_status_v1, admin_set_producer_document_status,
admin_set_producer_phone_verified, admin_set_return_status_v1,
admin_update_account_closure_v1, admin_update_brand_configuration_v1,
admin_update_producer_payout_v1, admin_update_product_export_profile_v1,
admin_update_return_v2, admin_upsert_campaign, admin_upsert_campaign_v2,
admin_upsert_coupon_v1, admin_upsert_product_export_rule_v1,
cancel_stock_alert_by_token_v1, catalog_search_suggestions_v1,
check_product_export_eligibility_v1, confirm_newsletter_v1,
consume_order_inventory_v1, create_customer_order, create_customer_order_v2,
create_customer_order_v3, get_my_account_overview_v1,
get_my_producer_finance_summary_v1, list_my_producer_inventory_v1,
management_update_order_status_v1, management_upsert_category_v1,
management_upsert_content_v1, management_upsert_product_core_v1,
record_order_producer_sales_v1, request_customer_return_v1,
request_customer_return_v2, submit_event_reservation,
validate_product_change_payload_v1

## Scope note

Closing this list covers every *function*. Triggers were handled separately in
`20260915061050`. Tables, RLS policies, indexes, views and storage buckets have
**not** been audited for drift by this effort. If full parity is the goal,
`supabase db diff` against a fresh database restored from these migrations is
the correct tool for that remaining question, and would also independently
confirm the function work recorded here.
