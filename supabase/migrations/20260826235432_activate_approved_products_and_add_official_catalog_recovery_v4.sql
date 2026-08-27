create or replace function private.admin_review_product_v2(
  p_product_id uuid,
  p_approve boolean,
  p_reason text default null
)
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
  if caller_id is null or not coalesce(private.has_permission('product.moderate'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if p_product_id is null then raise exception 'product_required' using errcode='22023'; end if;
  select * into product_row from public.products where id=p_product_id for update;
  if product_row.id is null or product_row.status not in ('review','rejected') then raise exception 'product_not_reviewable' using errcode='55000'; end if;
  select * into producer_row from public.producers where id=product_row.producer_id and deleted_at is null;
  if producer_row.id is null or producer_row.status<>'active' or not producer_row.is_verified then raise exception 'verified_active_producer_required' using errcode='55000'; end if;

  if coalesce(p_approve,false) then
    if product_row.status<>'review' then raise exception 'rejected_product_must_be_resubmitted' using errcode='55000'; end if;
    if char_length(btrim(product_row.name))<2 or char_length(btrim(product_row.description))<20 or char_length(btrim(product_row.story))<20 or char_length(btrim(coalesce(product_row.origin,'')))<2 then raise exception 'product_content_incomplete' using errcode='55000'; end if;
    if not exists(select 1 from public.product_variants variant where variant.product_id=product_row.id and variant.is_active=true and variant.price_minor>0) then raise exception 'active_priced_variant_required' using errcode='55000'; end if;
    if not private.product_media_integrity_ok_v1(product_row.id) then raise exception 'product_media_integrity_failed' using errcode='55000'; end if;
    result:=private.management_upsert_product_core_v1(product_row.id::text,jsonb_build_object('is_approved',true,'is_active',true));
    update public.products set specifications=specifications-'rejectionReason',updated_at=timezone('utc',now()) where id=product_row.id;
  else
    if char_length(coalesce(reason_value,''))<8 then raise exception 'product_rejection_reason_required' using errcode='22023'; end if;
    if char_length(reason_value)>2000 then raise exception 'product_rejection_reason_too_long' using errcode='22023'; end if;
    result:=private.management_upsert_product_core_v1(product_row.id::text,jsonb_build_object('is_rejected',true,'rejection_reason',reason_value));
  end if;

  insert into private.product_moderation_events(product_id,producer_id,actor_user_id,decision,reason)
  values(product_row.id,product_row.producer_id,caller_id,case when coalesce(p_approve,false) then 'approved' else 'rejected' end,reason_value);

  if producer_row.store_kind='producer' and producer_row.owner_user_id is not null then
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(
      producer_row.owner_user_id,'producer',
      case when coalesce(p_approve,false) then 'Ürününüz onaylandı ve yayınlandı' else 'Ürününüz için düzeltme gerekiyor' end,
      case when coalesce(p_approve,false)
        then product_row.name||' ürünü Super Admin onayından geçti ve Golden Oremar mağazanızda yayınlandı.'
        else product_row.name||' ürünü henüz yayınlanmadı. Ret nedeni: '||reason_value||' Ürünü düzeltip yeniden incelemeye gönderebilirsiniz.' end,
      '/producer/products',
      jsonb_build_object('productId',product_row.id,'approved',coalesce(p_approve,false),'reason',reason_value,'canResubmit',not coalesce(p_approve,false))
    );
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('product',product_row.id,case when coalesce(p_approve,false) then 'product.published' else 'product.rejected' end,
    jsonb_build_object('product_id',product_row.id,'producer_id',product_row.producer_id,'reviewed_by',caller_id,'reason',reason_value));
  return result||jsonb_build_object('reviewed',true,'approved',coalesce(p_approve,false),'reason',reason_value);
end;
$$;

create or replace function private.super_admin_activate_official_catalog_products_atomic_v1(
  p_product_ids uuid[],
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
  candidate_ids uuid[]:='{}'::uuid[];
  requested_count integer:=0;
  distinct_count integer:=0;
  safe_count integer:=0;
  activated_count integer:=0;
begin
  if caller_id is null
    or not coalesce(private.has_permission('product.moderate'),false)
    or not coalesce(private.has_permission('product.publish'),false)
    or not coalesce(private.has_permission('product.approve'),false) then
    raise exception 'permission_required:product.publish' using errcode='42501';
  end if;
  if p_product_ids is null or cardinality(p_product_ids)=0 then raise exception 'product_ids_required' using errcode='22023'; end if;
  requested_count:=cardinality(p_product_ids);
  if requested_count>500 then raise exception 'bulk_product_limit_exceeded' using errcode='22023'; end if;
  if array_position(p_product_ids,null) is not null then raise exception 'product_id_required' using errcode='22023'; end if;
  select count(distinct value)::integer into distinct_count from unnest(p_product_ids) u(value);
  if distinct_count<>requested_count then raise exception 'duplicate_product_ids' using errcode='22023'; end if;
  if clean_reason is not null and char_length(clean_reason)>2000 then raise exception 'product_review_reason_too_long' using errcode='22023'; end if;

  select coalesce(array_agg(locked.id order by locked.created_at,locked.id),'{}'::uuid[])
  into candidate_ids
  from (
    select p.id,p.created_at
    from public.products p
    join public.producers pr on pr.id=p.producer_id
    where p.id=any(p_product_ids)
      and p.deleted_at is null
      and pr.deleted_at is null
      and pr.store_kind='official'
      and p.status='published'
      and p.is_active=false
    order by p.created_at,p.id
    for update of p
  ) locked;
  if cardinality(candidate_ids)<>requested_count then raise exception 'official_catalog_activation_set_mismatch' using errcode='55000'; end if;

  select count(*)::integer into safe_count
  from public.products p
  join public.producers pr on pr.id=p.producer_id
  where p.id=any(candidate_ids)
    and p.deleted_at is null and pr.deleted_at is null
    and pr.store_kind='official' and p.status='published' and p.is_active=false
    and pr.status='active' and pr.is_verified=true
    and private.is_producer_trust_badge_active_v1(p.producer_id)
    and lower(btrim(coalesce(p.origin,'')))=lower(btrim(coalesce(pr.production_location,'')))
    and char_length(btrim(coalesce(p.name,'')))>=2
    and char_length(btrim(coalesce(p.description,'')))>=20
    and char_length(btrim(coalesce(p.story,'')))>=20
    and char_length(btrim(coalesce(p.origin,'')))>=2
    and exists(select 1 from public.categories c where c.id=p.category_id and c.is_active=true)
    and exists(select 1 from public.product_variants v where v.product_id=p.id and v.is_active=true and v.price_minor>0)
    and exists(select 1 from public.content_entries e where e.related_product_id=p.id and e.content_type='product_health' and e.locale='tr' and e.status='published' and e.deleted_at is null)
    and exists(select 1 from private.product_editorial_drafts d where d.product_id=p.id and d.locale='tr' and d.status='approved')
    and private.product_media_integrity_ok_v1(p.id);
  if safe_count<>requested_count then raise exception 'official_catalog_activation_readiness_failed' using errcode='55000'; end if;

  perform private.write_admin_audit_v2(
    'product.official_catalog_activation_requested','product_batch',caller_id::text,null,
    jsonb_build_object('requestedCount',requested_count,'atomic',true),
    jsonb_build_object('mode','super_admin_official_catalog_activation','reason',clean_reason),null
  );

  update public.products p
  set is_active=true,updated_at=timezone('utc',now())
  where p.id=any(candidate_ids) and p.status='published' and p.is_active=false;
  get diagnostics activated_count=row_count;
  if activated_count<>requested_count then raise exception 'official_catalog_activation_count_mismatch' using errcode='55000'; end if;

  perform private.write_admin_audit_v2(
    'product.official_catalog_activation_completed','product_batch',caller_id::text,
    jsonb_build_object('publishedInactive',requested_count),
    jsonb_build_object('publishedActive',activated_count),
    jsonb_build_object('mode','super_admin_official_catalog_activation','reason',clean_reason,'atomic',true),null
  );

  return jsonb_build_object('requestedCount',requested_count,'activatedCount',activated_count,'atomic',true,'active',true);
end;
$$;

revoke all on function private.super_admin_activate_official_catalog_products_atomic_v1(uuid[],text) from public,anon,authenticated,service_role;
grant execute on function private.super_admin_activate_official_catalog_products_atomic_v1(uuid[],text) to authenticated,service_role;

create or replace function public.super_admin_activate_official_catalog_products_atomic_v1(
  p_product_ids uuid[],
  p_reason text default null
)
returns jsonb
language sql
set search_path=''
as $$
  select private.super_admin_activate_official_catalog_products_atomic_v1(p_product_ids,p_reason);
$$;

revoke all on function public.super_admin_activate_official_catalog_products_atomic_v1(uuid[],text) from public,anon,authenticated,service_role;
grant execute on function public.super_admin_activate_official_catalog_products_atomic_v1(uuid[],text) to authenticated,service_role;
