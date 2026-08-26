create or replace function private.super_admin_bulk_review_products_v1(
  p_product_ids uuid[] default null,
  p_approve boolean default true,
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
  candidate_ids uuid[];
  candidate_id uuid;
  item_result jsonb;
  results jsonb:='[]'::jsonb;
  success_count integer:=0;
  failure_count integer:=0;
  total_count integer:=0;
  product_name text;
begin
  if caller_id is null
    or not coalesce(private.has_permission('product.moderate'),false)
    or not coalesce(private.has_permission('product.publish'),false) then
    raise exception 'permission_required:product.publish' using errcode='42501';
  end if;

  if coalesce(p_approve,false) then
    if not coalesce(private.has_permission('product.approve'),false) then
      raise exception 'permission_required:product.approve' using errcode='42501';
    end if;
  elsif not coalesce(private.has_permission('product.reject'),false) then
    raise exception 'permission_required:product.reject' using errcode='42501';
  end if;

  if not coalesce(p_approve,false) then
    if char_length(coalesce(clean_reason,''))<8 then
      raise exception 'product_rejection_reason_required' using errcode='22023';
    end if;
    if char_length(clean_reason)>2000 then
      raise exception 'product_rejection_reason_too_long' using errcode='22023';
    end if;
  elsif clean_reason is not null and char_length(clean_reason)>2000 then
    raise exception 'product_review_reason_too_long' using errcode='22023';
  end if;

  if p_product_ids is not null and cardinality(p_product_ids)>500 then
    raise exception 'bulk_product_limit_exceeded' using errcode='22023';
  end if;

  select coalesce(array_agg(p.id order by p.created_at,p.id),'{}'::uuid[])
    into candidate_ids
  from public.products p
  where p.deleted_at is null
    and p.status='review'
    and (
      p_product_ids is null
      or cardinality(p_product_ids)=0
      or p.id=any(p_product_ids)
    );

  total_count:=cardinality(candidate_ids);
  if total_count>500 then
    raise exception 'bulk_product_limit_exceeded' using errcode='22023';
  end if;

  perform private.write_admin_audit_v2(
    case when coalesce(p_approve,false) then 'product.bulk_approval_requested' else 'product.bulk_rejection_requested' end,
    'product_batch',
    caller_id::text,
    null,
    jsonb_build_object('requestedCount',total_count,'approve',coalesce(p_approve,false)),
    jsonb_build_object('mode','super_admin_bulk','reason',clean_reason),
    null
  );

  foreach candidate_id in array candidate_ids loop
    select p.name into product_name from public.products p where p.id=candidate_id;
    begin
      item_result:=private.admin_review_product_v4(
        candidate_id,
        coalesce(p_approve,false),
        clean_reason,
        true,
        true,
        true,
        true
      );
      success_count:=success_count+1;
      results:=results||jsonb_build_array(jsonb_build_object(
        'productId',candidate_id,
        'name',coalesce(product_name,'Ürün'),
        'ok',true,
        'approved',coalesce(p_approve,false),
        'result',item_result
      ));
    exception when others then
      failure_count:=failure_count+1;
      results:=results||jsonb_build_array(jsonb_build_object(
        'productId',candidate_id,
        'name',coalesce(product_name,'Ürün'),
        'ok',false,
        'approved',coalesce(p_approve,false),
        'errorCode',sqlstate,
        'error',left(sqlerrm,500)
      ));
    end;
  end loop;

  perform private.write_admin_audit_v2(
    case when coalesce(p_approve,false) then 'product.bulk_approval_completed' else 'product.bulk_rejection_completed' end,
    'product_batch',
    caller_id::text,
    null,
    jsonb_build_object('requestedCount',total_count),
    jsonb_build_object('successCount',success_count,'failureCount',failure_count,'approve',coalesce(p_approve,false)),
    jsonb_build_object('mode','super_admin_bulk'),
    null
  );

  return jsonb_build_object(
    'requestedCount',total_count,
    'successCount',success_count,
    'failureCount',failure_count,
    'approved',coalesce(p_approve,false),
    'results',results
  );
end;
$$;

revoke all on function private.super_admin_bulk_review_products_v1(uuid[],boolean,text) from public,anon;
grant execute on function private.super_admin_bulk_review_products_v1(uuid[],boolean,text) to authenticated,service_role;

create or replace function public.super_admin_bulk_review_products_v1(
  p_product_ids uuid[] default null,
  p_approve boolean default true,
  p_reason text default null
)
returns jsonb
language sql
set search_path=''
as $$
  select private.super_admin_bulk_review_products_v1(p_product_ids,p_approve,p_reason);
$$;

revoke all on function public.super_admin_bulk_review_products_v1(uuid[],boolean,text) from public,anon;
grant execute on function public.super_admin_bulk_review_products_v1(uuid[],boolean,text) to authenticated,service_role;
