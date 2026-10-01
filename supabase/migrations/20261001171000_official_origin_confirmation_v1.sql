-- One-step origin confirmation for official-store products before publication.
--
-- Publishing (super_admin_bulk_publish_products_atomic_v1) already asks the
-- Super Admin to attest origin, but product_provenance.origin_verified stays
-- false until each product is opened and saved in the editor. A published
-- product with an unverified origin then blocks later edits
-- (published_product_origin_must_remain_verified) and is listed as
-- "Ürün menşei doğrulanmamış" in the readiness view.
--
-- This lets the same AAL2 Super Admin confirm origin for several products at
-- once, but only where the claim is already backed by a verified record:
-- official store, active and verified producer whose own origin was verified
-- by an admin, and a product origin text equal to that verified location.
-- Independent sellers and mismatching origins are skipped, never forced.

create or replace function private.super_admin_confirm_official_product_origin_v1(p_product_ids uuid[], p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  caller_id uuid := auth.uid();
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  confirmed uuid[] := '{}'::uuid[];
  skipped jsonb := '[]'::jsonb;
begin
  if caller_id is null
    or not coalesce(private.has_permission('product.publish'), false)
    or not coalesce(private.has_permission('product.approve'), false) then
    raise exception 'permission_required:product.publish' using errcode = '42501';
  end if;
  if p_product_ids is null or cardinality(p_product_ids) = 0 then raise exception 'product_ids_required' using errcode = '22023'; end if;
  if cardinality(p_product_ids) > 500 then raise exception 'bulk_product_limit_exceeded' using errcode = '22023'; end if;
  if clean_reason is not null and char_length(clean_reason) > 2000 then raise exception 'product_review_reason_too_long' using errcode = '22023'; end if;

  with candidates as (
    select p.id, p.name,
      (pr.store_kind = 'official' and pr.status = 'active' and pr.is_verified and pr.origin_verified
        and pr.deleted_at is null
        and lower(btrim(coalesce(p.origin, ''))) = lower(btrim(coalesce(pr.production_location, '')))
        and char_length(btrim(coalesce(p.origin, ''))) >= 2) as eligible
    from public.products p
    join public.producers pr on pr.id = p.producer_id
    where p.id = any(p_product_ids) and p.deleted_at is null
  ), updated as (
    update public.product_provenance pp
    set origin_verified = true, updated_at = timezone('utc', now())
    from candidates c
    where pp.product_id = c.id and c.eligible and pp.origin_verified is distinct from true
    returning pp.product_id
  )
  select coalesce((select array_agg(product_id) from updated), '{}'::uuid[]),
    coalesce((select jsonb_agg(jsonb_build_object('productId', c.id, 'name', c.name)) from candidates c where not c.eligible), '[]'::jsonb)
  into confirmed, skipped;

  perform private.write_admin_audit_v2(
    'product.official_origin_confirmed', 'product_batch', caller_id::text, null,
    jsonb_build_object('confirmedCount', cardinality(confirmed), 'confirmed', to_jsonb(confirmed), 'skipped', skipped),
    jsonb_build_object('mode', 'super_admin_official_origin', 'reason', clean_reason), null
  );

  return jsonb_build_object('confirmedCount', cardinality(confirmed), 'skipped', skipped);
end;
$function$;

create or replace function public.super_admin_confirm_official_product_origin_v1(p_product_ids uuid[], p_reason text default null)
returns jsonb
language sql
set search_path to ''
as $function$
  select private.super_admin_confirm_official_product_origin_v1(p_product_ids, p_reason);
$function$;

revoke all on function private.super_admin_confirm_official_product_origin_v1(uuid[], text) from public, anon;
revoke all on function public.super_admin_confirm_official_product_origin_v1(uuid[], text) from public, anon;
grant execute on function private.super_admin_confirm_official_product_origin_v1(uuid[], text) to authenticated, service_role;
grant execute on function public.super_admin_confirm_official_product_origin_v1(uuid[], text) to authenticated, service_role;
