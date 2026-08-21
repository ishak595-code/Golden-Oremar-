update public.product_certifications set verification_url=null where verification_url is not null;

alter table public.product_certifications
  drop constraint if exists product_certifications_no_external_verification_url;
alter table public.product_certifications
  add constraint product_certifications_no_external_verification_url check (verification_url is null);

create or replace function private.get_public_product_detail_v6(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  base jsonb:=private.get_public_product_detail_v5(p_reference);
  certifications jsonb;
begin
  if base='{}'::jsonb then return base; end if;
  select coalesce(jsonb_agg(
    (item - 'verificationUrl') || jsonb_build_object('verificationUrl',null)
    order by ordinality
  ),'[]'::jsonb)
  into certifications
  from jsonb_array_elements(coalesce(base->'certifications','[]'::jsonb)) with ordinality rows(item,ordinality);
  return jsonb_set(base,'{certifications}',certifications,true);
end;
$$;
revoke all on function private.get_public_product_detail_v6(text) from public;

create or replace function public.get_public_product_detail_v1(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v6(p_reference);$$;
create or replace function public.get_public_product_detail_v2(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v6(p_reference);$$;
create or replace function public.get_public_product_detail_v3(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v6(p_reference);$$;
create or replace function public.get_public_product_detail_v4(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v6(p_reference);$$;
create or replace function public.get_public_product_detail_v5(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v6(p_reference);$$;
create or replace function public.get_public_product_detail_v6(p_reference text)
returns jsonb language sql stable set search_path to '' as $$select private.get_public_product_detail_v6(p_reference);$$;
grant execute on function public.get_public_product_detail_v1(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v2(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v3(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v4(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v5(text) to anon,authenticated;
grant execute on function public.get_public_product_detail_v6(text) to anon,authenticated;
