create or replace function private.get_public_product_detail_v5(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  base jsonb:=private.get_public_product_detail_v4(p_reference);
  badges jsonb;
  official boolean:=coalesce(base->'producer'->>'storeKind','')='official';
begin
  if base='{}'::jsonb or not official then return base; end if;
  select coalesce(jsonb_agg(
    case when item->>'key' in ('official_store','verified_origin')
      then jsonb_set(item,'{tone}',to_jsonb('ruby'::text),true)
      else item end
    order by ordinality
  ),'[]'::jsonb)
  into badges
  from jsonb_array_elements(coalesce(base->'trustBadges','[]'::jsonb)) with ordinality rows(item,ordinality);
  return jsonb_set(base,'{trustBadges}',badges,true);
end;
$$;
revoke all on function private.get_public_product_detail_v5(text) from public;

create or replace function public.get_public_product_detail_v1(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v5(p_reference);$$;
create or replace function public.get_public_product_detail_v2(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v5(p_reference);$$;
create or replace function public.get_public_product_detail_v3(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v5(p_reference);$$;
create or replace function public.get_public_product_detail_v4(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v5(p_reference);$$;
create or replace function public.get_public_product_detail_v5(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v5(p_reference);$$;
grant execute on function public.get_public_product_detail_v1(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v2(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v3(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v4(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v5(text) to anon,authenticated;
