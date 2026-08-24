create or replace function private.producer_archive_product_v1(p_reference text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  caller_producer_id uuid;
  target_product_id uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.has_permission('product.archive') then raise exception 'permission_required:product.archive' using errcode='42501'; end if;
  if coalesce(private.has_permission('admin.access'),false) then raise exception 'producer_portal_separate_from_admin' using errcode='42501'; end if;

  select p.id into caller_producer_id
  from public.producers p
  where p.owner_user_id=caller_id
    and p.status='active'
    and p.is_verified=true
    and p.origin_verified=true
    and p.deleted_at is null
  order by p.created_at desc
  limit 1;
  if caller_producer_id is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;

  select product.id into target_product_id
  from public.products product
  where product.producer_id=caller_producer_id
    and product.deleted_at is null
    and (product.id::text=btrim(coalesce(p_reference,'')) or product.slug=btrim(coalesce(p_reference,'')))
  limit 1;
  if target_product_id is null then raise exception 'product_access_denied' using errcode='42501'; end if;

  return private.management_archive_product_v1(target_product_id::text);
end;
$$;