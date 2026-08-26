-- Seal the legacy direct-table product write surface and keep producer scope
-- enforcement at the database boundary as defense in depth.

create or replace function private.enforce_verified_producer_product_write_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  owner_id uuid;
  producer_status text;
  producer_verified boolean;
  producer_origin_verified boolean;
  producer_store_kind text;
  producer_location text;
  producer_categories text[];
  category_slug text;
begin
  if caller_id is null or coalesce(private.is_admin(), false) then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.producer_id is distinct from old.producer_id then
    raise exception 'product_producer_transfer_not_allowed' using errcode = '42501';
  end if;

  select p.owner_user_id,p.status,p.is_verified,p.origin_verified,p.store_kind,p.production_location,p.approved_category_slugs
  into owner_id,producer_status,producer_verified,producer_origin_verified,producer_store_kind,producer_location,producer_categories
  from public.producers p
  where p.id = new.producer_id and p.deleted_at is null;

  if owner_id is distinct from caller_id or producer_status <> 'active' or not coalesce(producer_verified, false) then
    raise exception 'verified_active_producer_required' using errcode = '42501';
  end if;

  if coalesce(producer_store_kind, '') = 'official' then
    raise exception 'official_store_product_management_requires_admin' using errcode = '42501';
  end if;

  if not coalesce(producer_origin_verified, false) then
    raise exception 'producer_origin_verification_required' using errcode = '42501';
  end if;

  if not private.is_producer_trust_badge_active_v1(new.producer_id) then
    raise exception 'active_producer_trust_badge_required' using errcode = '42501';
  end if;

  if coalesce(cardinality(producer_categories), 0) = 0 then
    raise exception 'producer_category_scope_required' using errcode = '42501';
  end if;

  select c.slug into category_slug
  from public.categories c
  where c.id = new.category_id and c.is_active = true;

  if category_slug is null or not (category_slug = any(producer_categories)) then
    raise exception 'product_category_outside_producer_scope' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(producer_location, '')), '') is null then
    raise exception 'producer_production_location_required' using errcode = '42501';
  end if;

  new.origin := producer_location;
  return new;
end;
$$;

do $$
declare
  insert_columns text;
  update_columns text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
  into insert_columns
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'products'
    and has_column_privilege('authenticated', 'public.products', c.column_name, 'INSERT');

  if insert_columns is not null then
    execute format('revoke insert (%s) on table public.products from authenticated', insert_columns);
  end if;

  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
  into update_columns
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'products'
    and has_column_privilege('authenticated', 'public.products', c.column_name, 'UPDATE');

  if update_columns is not null then
    execute format('revoke update (%s) on table public.products from authenticated', update_columns);
  end if;
end;
$$;

revoke truncate, references, trigger on table public.products from anon, authenticated;

drop policy if exists products_insert_own_producer on public.products;
drop policy if exists products_update_own_producer_draft on public.products;
