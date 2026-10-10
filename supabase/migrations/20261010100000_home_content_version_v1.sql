-- Home page freshness: one tiny version number that moves whenever anything
-- the home page shows changes (products, prices, stock, photos, producers,
-- categories, campaigns, events, the showcase/hero settings in brand_settings
-- and content entries, reviews). The site asks only for this number (a few
-- bytes, cached for one second at the edge) and downloads the home page again
-- only when it changed, so an edit in the super admin panel reaches the home
-- page within seconds without every visit pulling the whole catalogue.
--
-- Statement-level triggers: one bump per statement, never per row. Safe to
-- re-run.

create table if not exists public.home_content_version (
  id smallint primary key default 1 check (id = 1),
  version bigint not null default 1,
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.home_content_version enable row level security;
revoke all on public.home_content_version from anon, authenticated;
insert into public.home_content_version (id) values (1) on conflict (id) do nothing;

create or replace function private.bump_home_content_version_v1()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  update public.home_content_version
     set version = version + 1, updated_at = clock_timestamp()
   where id = 1;
  return null;
end;
$function$;
revoke all on function private.bump_home_content_version_v1() from public, anon, authenticated;

do $do$
declare
  t text;
begin
  foreach t in array array['products','product_variants','product_images','product_inventory','producers','categories','campaigns','campaign_products','campaign_categories','events','brand_settings','content_entries','reviews'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists home_content_version_bump on public.%I', t);
      execute format('create trigger home_content_version_bump after insert or update or delete or truncate on public.%I for each statement execute function private.bump_home_content_version_v1()', t);
    end if;
  end loop;
end;
$do$;

create or replace function public.get_home_content_version_v1()
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object('version', v.version, 'updatedAt', v.updated_at)
    from public.home_content_version v where v.id = 1;
$function$;
revoke all on function public.get_home_content_version_v1() from public;
grant execute on function public.get_home_content_version_v1() to anon, authenticated;
