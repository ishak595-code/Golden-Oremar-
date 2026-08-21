create or replace function public.management_upsert_product_v1(p_reference text, p_payload jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  weight_value numeric;
begin
  if p_payload ? 'weight' then
    if jsonb_typeof(p_payload -> 'weight') <> 'number' then
      raise exception 'invalid_shipping_weight' using errcode = '22023';
    end if;
    weight_value := (p_payload ->> 'weight')::numeric;
    if weight_value <= 0 or weight_value > 10000 then
      raise exception 'shipping_weight_out_of_range' using errcode = '22023';
    end if;
  end if;
  return private.management_upsert_product_v1(p_reference, p_payload);
end;
$function$;

revoke all on function public.management_upsert_product_v1(text, jsonb) from public;
grant execute on function public.management_upsert_product_v1(text, jsonb) to authenticated;
