create or replace function private.admin_list_products_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb;
  result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_admin(),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  base:=private.admin_list_products_v1();
  select coalesce(jsonb_agg(
    item
    || jsonb_build_object(
      'stored_image_count',asset_metrics.stored_image_count,
      'stored_primary_image_count',asset_metrics.stored_primary_image_count,
      'image_asset_ready',asset_metrics.stored_primary_image_count=1,
      'catalog_issue_count',coalesce((item->>'catalog_issue_count')::integer,0)
        + case
            when coalesce((item->>'primary_image_count')::integer,0)=1 and asset_metrics.stored_primary_image_count<>1 then 1
            else 0
          end
    )
    order by ordinality
  ),'[]'::jsonb)
  into result
  from jsonb_array_elements(coalesce(base,'[]'::jsonb)) with ordinality as rows(item,ordinality)
  cross join lateral (
    select
      count(*) filter(where private.verified_public_storage_path_v1('catalog-public',image.storage_path) is not null)::integer as stored_image_count,
      count(*) filter(where image.is_primary=true and private.verified_public_storage_path_v1('catalog-public',image.storage_path) is not null)::integer as stored_primary_image_count
    from public.product_images image
    where image.product_id=(item->>'id')::uuid
  ) asset_metrics;
  return result;
end;
$$;

revoke all on function private.admin_list_products_v2() from public,anon;
grant execute on function private.admin_list_products_v2() to authenticated;

create or replace function public.admin_list_products_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.admin_list_products_v2(); $$;
revoke all on function public.admin_list_products_v1() from public,anon;
grant execute on function public.admin_list_products_v1() to authenticated;

create or replace function private.admin_review_product_v2(p_product_id uuid,p_approve boolean,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  producer_row public.producers%rowtype;
  reason_value text:=nullif(btrim(coalesce(p_reason,'')),'');
  result jsonb;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_product_id is null then raise exception 'product_required' using errcode='22023'; end if;
  select * into product_row from public.products where id=p_product_id for update;
  if product_row.id is null or product_row.status not in ('review','rejected') then raise exception 'product_not_reviewable' using errcode='55000'; end if;
  select * into producer_row from public.producers where id=product_row.producer_id and deleted_at is null;
  if producer_row.id is null or producer_row.status<>'active' or not producer_row.is_verified then raise exception 'verified_active_producer_required' using errcode='55000'; end if;

  if coalesce(p_approve,false) then
    if product_row.status<>'review' then raise exception 'rejected_product_must_be_resubmitted' using errcode='55000'; end if;
    if char_length(btrim(product_row.name))<2 or char_length(btrim(product_row.description))<20 or char_length(btrim(product_row.story))<20 or char_length(btrim(coalesce(product_row.origin,'')))<2 then
      raise exception 'product_content_incomplete' using errcode='55000';
    end if;
    if not exists(select 1 from public.product_variants variant where variant.product_id=product_row.id and variant.is_active=true and variant.price_minor>0) then raise exception 'active_priced_variant_required' using errcode='55000'; end if;
    if not exists(
      select 1
      from public.product_images image
      where image.product_id=product_row.id
        and image.is_primary=true
        and private.verified_public_storage_path_v1('catalog-public',image.storage_path) is not null
    ) then raise exception 'stored_primary_product_image_required' using errcode='55000'; end if;
    result:=private.management_upsert_product_v1(product_row.id::text,jsonb_build_object('is_approved',true));
  else
    if char_length(coalesce(reason_value,''))<8 then raise exception 'product_rejection_reason_required' using errcode='22023'; end if;
    if char_length(reason_value)>2000 then raise exception 'product_rejection_reason_too_long' using errcode='22023'; end if;
    result:=private.management_upsert_product_v1(product_row.id::text,jsonb_build_object('is_rejected',true,'rejection_reason',reason_value));
  end if;

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(producer_row.owner_user_id,'producer',case when coalesce(p_approve,false) then 'Ürününüz yayınlandı' else 'Ürün incelemeniz sonuçlandı' end,
    case when coalesce(p_approve,false) then product_row.name||' Golden Oremar kataloğunda yayınlandı.' else product_row.name||' için düzeltme gerekiyor.' end,
    '/producer/products',jsonb_build_object('productId',product_row.id,'approved',coalesce(p_approve,false),'reason',reason_value));
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('product',product_row.id,case when coalesce(p_approve,false) then 'product.published' else 'product.rejected' end,
    jsonb_build_object('product_id',product_row.id,'producer_id',product_row.producer_id,'reviewed_by',caller_id,'reason',reason_value));
  return result||jsonb_build_object('reviewed',true,'approved',coalesce(p_approve,false));
end;
$$;

revoke all on function private.admin_review_product_v2(uuid,boolean,text) from public,anon;
grant execute on function private.admin_review_product_v2(uuid,boolean,text) to authenticated;

create or replace function public.admin_review_product_v1(p_product_id uuid,p_approve boolean,p_reason text default null)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.admin_review_product_v2(p_product_id,p_approve,p_reason); $$;
revoke all on function public.admin_review_product_v1(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_product_v1(uuid,boolean,text) to authenticated;
