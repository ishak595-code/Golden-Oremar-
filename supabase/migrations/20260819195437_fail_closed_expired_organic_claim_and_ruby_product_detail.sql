create or replace function private.get_public_product_detail_v4(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare base jsonb:=private.get_public_product_detail_v3(p_reference); producer_payload jsonb; provenance_payload jsonb; badges jsonb; official boolean:=false; certified boolean:=false;
begin
  if base='{}'::jsonb then return base; end if;
  producer_payload:=coalesce(base->'producer','{}'::jsonb);
  provenance_payload:=coalesce(base->'provenance','{}'::jsonb);
  official:=coalesce(producer_payload->>'storeKind','')='official';
  certified:=coalesce((provenance_payload->>'organicCertified')::boolean,false);
  if official then
    producer_payload:=jsonb_set(producer_payload,'{badgeTone}',to_jsonb('ruby'::text),true);
    select coalesce(jsonb_agg(case when item->>'key' in ('official_store','verified_origin') then jsonb_set(item,'{tone}',to_jsonb('ruby'::text),true) else item end order by ordinality),'[]'::jsonb) into badges
    from jsonb_array_elements(coalesce(producer_payload->'trustBadges','[]'::jsonb)) with ordinality rows(item,ordinality);
    producer_payload:=jsonb_set(producer_payload,'{trustBadges}',badges,true);
  end if;
  if coalesce(provenance_payload->>'organicClaim','')='certified_organic' and not certified then provenance_payload:=jsonb_set(provenance_payload,'{organicClaim}',to_jsonb('not_claimed'::text),true); end if;
  base:=jsonb_set(base,'{producer}',producer_payload,true);
  base:=jsonb_set(base,'{provenance}',provenance_payload,true);
  return base;
exception when invalid_text_representation then return base;
end;
$$;
revoke all on function private.get_public_product_detail_v4(text) from public;
create or replace function public.get_public_product_detail_v1(p_reference text) returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v4(p_reference);$$;
create or replace function public.get_public_product_detail_v2(p_reference text) returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v4(p_reference);$$;
create or replace function public.get_public_product_detail_v3(p_reference text) returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v4(p_reference);$$;
create or replace function public.get_public_product_detail_v4(p_reference text) returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v4(p_reference);$$;
grant execute on function public.get_public_product_detail_v1(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v2(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v3(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v4(text) to anon,authenticated;
