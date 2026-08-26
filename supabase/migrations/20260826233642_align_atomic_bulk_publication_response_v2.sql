create or replace function private.super_admin_bulk_publish_products_atomic_v1(
  p_product_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  clean_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  candidate_ids uuid[]:='{}'::uuid[];
  candidate_id uuid;
  product_name text;
  item_result jsonb;
  results jsonb:='[]'::jsonb;
  requested_count integer:=0;
  distinct_count integer:=0;
begin
  if caller_id is null
    or not coalesce(private.has_permission('product.moderate'),false)
    or not coalesce(private.has_permission('product.publish'),false) then
    raise exception 'permission_required:product.publish' using errcode='42501';
  end if;
  if not coalesce(private.has_permission('product.approve'),false) then
    raise exception 'permission_required:product.approve' using errcode='42501';
  end if;
  if p_product_ids is null or cardinality(p_product_ids)=0 then raise exception 'product_ids_required' using errcode='22023'; end if;
  requested_count:=cardinality(p_product_ids);
  if requested_count>500 then raise exception 'bulk_product_limit_exceeded' using errcode='22023'; end if;
  if array_position(p_product_ids,null) is not null then raise exception 'product_id_required' using errcode='22023'; end if;
  select count(distinct value)::integer into distinct_count from unnest(p_product_ids) as u(value);
  if distinct_count<>requested_count then raise exception 'duplicate_product_ids' using errcode='22023'; end if;
  if clean_reason is not null and char_length(clean_reason)>2000 then raise exception 'product_review_reason_too_long' using errcode='22023'; end if;

  select coalesce(array_agg(locked.id order by locked.created_at,locked.id),'{}'::uuid[])
    into candidate_ids
  from (
    select p.id,p.created_at
    from public.products p
    where p.id=any(p_product_ids) and p.deleted_at is null
    order by p.created_at,p.id
    for update
  ) locked;
  if cardinality(candidate_ids)<>requested_count then raise exception 'bulk_product_set_mismatch' using errcode='55000'; end if;
  if exists(select 1 from public.products p where p.id=any(candidate_ids) and p.status<>'review') then raise exception 'product_not_reviewable' using errcode='55000'; end if;

  perform private.write_admin_audit_v2(
    'product.bulk_atomic_approval_requested','product_batch',caller_id::text,null,
    jsonb_build_object('requestedCount',requested_count,'approve',true,'atomic',true),
    jsonb_build_object('mode','super_admin_bulk_atomic','reason',clean_reason),null
  );

  foreach candidate_id in array candidate_ids loop
    select p.name into product_name from public.products p where p.id=candidate_id;
    item_result:=private.admin_review_product_v4(candidate_id,true,clean_reason,true,true,true,true);
    results:=results||jsonb_build_array(jsonb_build_object(
      'productId',candidate_id,
      'name',coalesce(product_name,'Ürün'),
      'ok',true,
      'approved',true,
      'errorCode',null,
      'error',null,
      'result',item_result
    ));
  end loop;

  perform private.write_admin_audit_v2(
    'product.bulk_atomic_approval_completed','product_batch',caller_id::text,null,
    jsonb_build_object('requestedCount',requested_count),
    jsonb_build_object('successCount',requested_count,'failureCount',0,'approve',true,'atomic',true),
    jsonb_build_object('mode','super_admin_bulk_atomic'),null
  );

  return jsonb_build_object(
    'requestedCount',requested_count,
    'successCount',requested_count,
    'failureCount',0,
    'approved',true,
    'atomic',true,
    'results',results
  );
end;
$$;
