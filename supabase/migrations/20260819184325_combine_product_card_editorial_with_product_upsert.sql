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
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>393216 then raise exception 'invalid_product_payload' using errcode='22023'; end if;
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
  safe_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  editorial jsonb;
  requested_publish boolean:=false;
  result jsonb;
  product_id uuid;
  editorial_result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>393216 then raise exception 'invalid_product_payload' using errcode='22023'; end if;
  editorial:=case when p_payload ? 'editorial' then p_payload->'editorial' else null end;
  if editorial is not null and jsonb_typeof(editorial)<>'object' then raise exception 'invalid_product_editorial_payload' using errcode='22023'; end if;
  requested_publish:=coalesce((p_payload->>'is_approved')::boolean,false);
  safe_payload:=safe_payload-'editorial';
  result:=private.management_upsert_product_v2(p_reference,safe_payload);
  if editorial is not null then
    begin product_id:=(result->>'databaseId')::uuid; exception when others then raise exception 'product_write_result_invalid' using errcode='55000'; end;
    if requested_publish then
      perform private.publish_product_editorial_v1(product_id,editorial,auth.uid());
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
