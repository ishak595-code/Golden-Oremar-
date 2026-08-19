create or replace function private.get_public_product_safety_v3(p_reference text,p_locale text default 'tr')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  base jsonb:=private.get_public_product_safety_v2(p_reference,p_locale);
  content_id uuid;
  product_id uuid;
  video_path text;
begin
  if base='{}'::jsonb then return base; end if;
  begin content_id:=(base->>'contentId')::uuid; exception when others then return base; end;
  select ce.related_product_id into product_id from public.content_entries ce where ce.id=content_id and ce.status='published' and ce.deleted_at is null;
  if product_id is not null then
    select private.verified_product_video_path_v1(p.specifications->>'video') into video_path from public.products p where p.id=product_id and p.status='published' and p.is_active=true and p.deleted_at is null;
  end if;
  return jsonb_set(base,'{safety,videoPath}',coalesce(to_jsonb(video_path),'null'::jsonb),true);
end;
$$;
revoke all on function private.get_public_product_safety_v3(text,text) from public;
create or replace function public.get_public_product_safety_v1(p_reference text,p_locale text default 'tr')
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_safety_v3(p_reference,p_locale); $$;
create or replace function public.get_public_product_safety_v2(p_reference text,p_locale text default 'tr')
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_safety_v3(p_reference,p_locale); $$;
create or replace function public.get_public_product_safety_v3(p_reference text,p_locale text default 'tr')
returns jsonb language sql stable set search_path to '' as $$ select private.get_public_product_safety_v3(p_reference,p_locale); $$;
grant execute on function public.get_public_product_safety_v1(text,text) to anon,authenticated;
grant execute on function public.get_public_product_safety_v2(text,text) to anon,authenticated;
grant execute on function public.get_public_product_safety_v3(text,text) to anon,authenticated;
