create or replace function public.producer_upsert_product_v2(p_reference text,p_payload jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  safe_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  editorial jsonb;
  result jsonb;
  product_id uuid;
  editorial_result jsonb;
  weight_value numeric;
  video_value text;
  producer_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>393216 then raise exception 'invalid_product_payload' using errcode='22023'; end if;
  select p.id into producer_id from public.producers p where p.owner_user_id=auth.uid() and p.status='active' and p.is_verified=true and p.origin_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
  if producer_id is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  if p_payload ? 'video' and nullif(btrim(coalesce(p_payload->>'video','')),'') is not null then
    video_value:=btrim(p_payload->>'video');
    if video_value not like producer_id::text||'/products/%' or private.verified_product_video_path_v1(video_value) is null then raise exception 'stored_product_video_required' using errcode='55000'; end if;
  end if;
  editorial:=case when p_payload ? 'editorial' then p_payload->'editorial' else null end;
  if editorial is not null and jsonb_typeof(editorial)<>'object' then raise exception 'invalid_product_editorial_payload' using errcode='22023'; end if;
  safe_payload:=safe_payload-'editorial';
  result:=private.producer_upsert_product_v1(p_reference,safe_payload);
  if editorial is not null then
    begin product_id:=(result->>'databaseId')::uuid; exception when others then raise exception 'product_write_result_invalid' using errcode='55000'; end;
    editorial_result:=private.save_product_editorial_v1(product_id::text,editorial,'submit',null);
    result:=result||jsonb_build_object('editorial',editorial_result);
  end if;
  return result;
end;
$$;
grant execute on function public.producer_upsert_product_v2(text,jsonb) to authenticated;

create or replace function public.management_upsert_product_v2(p_reference text,p_payload jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  caller_id uuid:=auth.uid();
  safe_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  editorial jsonb;
  requested_publish boolean:=false;
  result jsonb;
  product_id uuid;
  editorial_result jsonb;
  weight_value numeric;
  video_value text;
  existing_product_id uuid:=private.resolve_product_id_v1(p_reference);
  existing_video text;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>393216 then raise exception 'invalid_product_payload' using errcode='22023'; end if;
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  if existing_product_id is not null then select p.specifications->>'video' into existing_video from public.products p where p.id=existing_product_id and p.deleted_at is null; end if;
  if p_payload ? 'video' and nullif(btrim(coalesce(p_payload->>'video','')),'') is not null then
    video_value:=btrim(p_payload->>'video');
    if private.verified_product_video_path_v1(video_value) is null then raise exception 'stored_product_video_required' using errcode='55000'; end if;
    if video_value is distinct from existing_video and video_value not like 'admin/'||caller_id::text||'/%' then raise exception 'admin_owned_product_video_required' using errcode='42501'; end if;
  end if;
  editorial:=case when p_payload ? 'editorial' then p_payload->'editorial' else null end;
  if editorial is not null and jsonb_typeof(editorial)<>'object' then raise exception 'invalid_product_editorial_payload' using errcode='22023'; end if;
  requested_publish:=coalesce((p_payload->>'is_approved')::boolean,false);
  safe_payload:=safe_payload-'editorial';
  result:=private.management_upsert_product_v2(p_reference,safe_payload);
  if editorial is not null then
    begin product_id:=(result->>'databaseId')::uuid; exception when others then raise exception 'product_write_result_invalid' using errcode='55000'; end;
    if requested_publish then
      perform private.publish_product_editorial_v1(product_id,editorial,caller_id);
      editorial_result:=jsonb_build_object('status','published','productId',product_id);
    else
      editorial_result:=private.save_product_editorial_v1(product_id::text,editorial,'save',null);
    end if;
    result:=result||jsonb_build_object('editorial',editorial_result);
  end if;
  return result;
end;
$$;
grant execute on function public.management_upsert_product_v2(text,jsonb) to authenticated;
