-- The person who makes a product ("Üreten"), editable from the super admin
-- product editor. Stored as products.specifications->>'makerName'.
-- Applied to the live database on 2026-10-02 through apply_migration.
-- The names themselves were then set as data (one UPDATE per product slug),
-- as assigned by the owner; they are edited in the admin panel from now on.

-- 1. Catalogue cards carry makerName.
do $$
declare def text := pg_get_functiondef('private.catalog_public_card_rows_live_v1()'::regprocedure);
        needle text := '''handlingProfile'',private.product_handling_profile_v1(product.id)';
begin
  if position('''makerName''' in def) = 0 then
    if position(needle in def) = 0 then raise exception 'card builder changed; makerName not added'; end if;
    execute replace(def, needle, needle || ',' || E'\n      ''makerName'',nullif(btrim(coalesce(product.specifications->>''makerName'','''')),'''')');
  end if;
end $$;

-- 2. The product page carries makerName.
create or replace function private.get_public_product_detail_v11(p_reference text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  base jsonb := private.get_public_product_detail_v10(p_reference);
  maker text;
begin
  if base = '{}'::jsonb or base is null then return base; end if;
  select nullif(btrim(coalesce(p.specifications->>'makerName','')),'') into maker
  from public.products p where p.id = private.resolve_product_id_v1(p_reference);
  return base || jsonb_build_object('makerName', maker);
end;
$function$;
revoke all on function private.get_public_product_detail_v11(text) from public, anon, authenticated;

create or replace function api_public_bridge.get_public_product_detail_v6(p_reference text)
returns jsonb language sql stable security definer set search_path to ''
as $function$ select private.get_public_product_detail_v11(p_reference); $function$;

-- 3. The admin product list carries makerName.
create or replace function private.management_catalog_snapshot_v4()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  base jsonb := private.management_catalog_snapshot_v3();
  products_payload jsonb;
begin
  select coalesce(jsonb_agg(item || jsonb_build_object('makerName', coalesce(nullif(btrim(coalesce(product.specifications->>'makerName','')),''),'')) order by ordinality),'[]'::jsonb)
  into products_payload
  from jsonb_array_elements(coalesce(base->'products','[]'::jsonb)) with ordinality rows(item,ordinality)
  left join public.products product on product.id = (item->>'databaseId')::uuid;
  return jsonb_set(base,'{products}',products_payload,true);
end;
$function$;
revoke all on function private.management_catalog_snapshot_v4() from public, anon;
grant execute on function private.management_catalog_snapshot_v4() to authenticated, service_role;

create or replace function public.management_catalog_snapshot_v1()
returns jsonb language sql set search_path to ''
as $function$ select private.management_catalog_snapshot_v4(); $function$;

-- 4. Admins set or clear the maker.
create or replace function private.admin_set_product_maker_v1(p_reference text, p_maker_name text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_product_id uuid := private.resolve_product_id_v1(p_reference);
  maker text := nullif(btrim(regexp_replace(coalesce(p_maker_name,''), '\s+', ' ', 'g')), '');
begin
  if auth.uid() is null or not coalesce(private.has_permission('product.update'),false) then
    raise exception 'permission_required:product.update' using errcode='42501';
  end if;
  if v_product_id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  if maker is not null and (char_length(maker) > 80 or maker ~ '[[:cntrl:]<>]') then
    raise exception 'invalid_maker_name' using errcode='22023';
  end if;
  update public.products p
     set specifications = case when maker is null then coalesce(p.specifications,'{}'::jsonb) - 'makerName'
                               else jsonb_set(coalesce(p.specifications,'{}'::jsonb), '{makerName}', to_jsonb(maker), true) end
   where p.id = v_product_id and p.deleted_at is null;
  return jsonb_build_object('productId', v_product_id, 'makerName', maker);
end;
$function$;
revoke all on function private.admin_set_product_maker_v1(text,text) from public, anon;
grant execute on function private.admin_set_product_maker_v1(text,text) to authenticated, service_role;

create or replace function public.admin_set_product_maker_v1(p_reference text, p_maker_name text)
returns jsonb language sql set search_path to ''
as $function$ select private.admin_set_product_maker_v1(p_reference, p_maker_name); $function$;
revoke all on function public.admin_set_product_maker_v1(text,text) from public, anon;
grant execute on function public.admin_set_product_maker_v1(text,text) to authenticated, service_role;
