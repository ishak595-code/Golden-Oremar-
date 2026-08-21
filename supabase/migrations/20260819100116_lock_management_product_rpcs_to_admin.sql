create or replace function public.management_upsert_product_v1(p_reference text,p_payload jsonb)
returns jsonb language plpgsql set search_path=''
as $$
declare weight_value numeric;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload->'weight')<>'number' then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
    weight_value:=(p_payload->>'weight')::numeric;
    if weight_value<=0 or weight_value>10000 then raise exception 'shipping_weight_out_of_range' using errcode='22023'; end if;
  end if;
  return private.management_upsert_product_v1(p_reference,p_payload);
end;
$$;

create or replace function public.management_archive_product_v1(p_reference text)
returns boolean language plpgsql set search_path=''
as $$
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  return private.management_archive_product_v1(p_reference);
end;
$$;

revoke all on function public.management_upsert_product_v1(text,jsonb) from public,anon;
grant execute on function public.management_upsert_product_v1(text,jsonb) to authenticated;
revoke all on function public.management_archive_product_v1(text) from public,anon;
grant execute on function public.management_archive_product_v1(text) to authenticated;
