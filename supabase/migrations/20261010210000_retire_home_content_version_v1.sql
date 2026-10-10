-- Retire the home "content version" counter (20261010100000). The app no
-- longer reads it: the home page change that used it was reverted (#164).
-- What it left behind still costs on every write: a statement trigger on
-- products, variants, inventory, producers, categories, campaigns, events,
-- brand settings, content and reviews updates one single shared row, so
-- concurrent writes to those tables (stock on order confirmation, admin
-- edits) queue on that row's lock until commit. It also left an anonymously
-- callable SECURITY DEFINER function (flagged by the Supabase advisors).
--
-- Removes the triggers, the function, the trigger function and the table.
-- Safe on any database state and safe to re-run.

do $retire$
declare
  t text;
begin
  foreach t in array array['products','product_variants','product_images','product_inventory','producers','categories','campaigns','campaign_products','campaign_categories','events','brand_settings','content_entries','reviews'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists home_content_version_bump on public.%I', t);
    end if;
  end loop;
end
$retire$;

drop function if exists public.get_home_content_version_v1();
drop function if exists private.bump_home_content_version_v1();
drop table if exists public.home_content_version;
