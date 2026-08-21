create table if not exists private.product_moderation_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  change_request_id uuid references public.product_change_requests(id) on delete cascade,
  producer_id uuid not null references public.producers(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved','rejected','resubmitted','change_approved','change_rejected')),
  reason text,
  created_at timestamptz not null default timezone('utc',now()),
  check (reason is null or char_length(reason) <= 2000)
);
create index if not exists product_moderation_events_product_created_idx on private.product_moderation_events(product_id,created_at desc);
create index if not exists product_moderation_events_producer_created_idx on private.product_moderation_events(producer_id,created_at desc);

create or replace function private.admin_review_product_v2(p_product_id uuid,p_approve boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
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
    if char_length(btrim(product_row.name))<2 or char_length(btrim(product_row.description))<20 or char_length(btrim(product_row.story))<20 or char_length(btrim(coalesce(product_row.origin,'')))<2 then raise exception 'product_content_incomplete' using errcode='55000'; end if;
    if not exists(select 1 from public.product_variants variant where variant.product_id=product_row.id and variant.is_active=true and variant.price_minor>0) then raise exception 'active_priced_variant_required' using errcode='55000'; end if;
    if not exists(select 1 from public.product_images image where image.product_id=product_row.id and image.is_primary=true and private.verified_public_storage_path_v1('catalog-public',image.storage_path) is not null) then raise exception 'stored_primary_product_image_required' using errcode='55000'; end if;
    result:=private.management_upsert_product_v1(product_row.id::text,jsonb_build_object('is_approved',true));
    update public.products set specifications=specifications-'rejectionReason',updated_at=timezone('utc',now()) where id=product_row.id;
  else
    if char_length(coalesce(reason_value,''))<8 then raise exception 'product_rejection_reason_required' using errcode='22023'; end if;
    if char_length(reason_value)>2000 then raise exception 'product_rejection_reason_too_long' using errcode='22023'; end if;
    result:=private.management_upsert_product_v1(product_row.id::text,jsonb_build_object('is_rejected',true,'rejection_reason',reason_value));
  end if;

  insert into private.product_moderation_events(product_id,producer_id,actor_user_id,decision,reason)
  values(product_row.id,product_row.producer_id,caller_id,case when coalesce(p_approve,false) then 'approved' else 'rejected' end,reason_value);

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(
    producer_row.owner_user_id,
    'producer',
    case when coalesce(p_approve,false) then 'Ürününüz onaylandı ve yayınlandı' else 'Ürününüz için düzeltme gerekiyor' end,
    case when coalesce(p_approve,false)
      then product_row.name||' ürünü Super Admin onayından geçti ve Golden Oremar mağazanızda yayınlandı.'
      else product_row.name||' ürünü henüz yayınlanmadı. Ret nedeni: '||reason_value||' Ürünü düzeltip yeniden incelemeye gönderebilirsiniz.'
    end,
    '/producer/products',
    jsonb_build_object('productId',product_row.id,'approved',coalesce(p_approve,false),'reason',reason_value,'canResubmit',not coalesce(p_approve,false))
  );

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('product',product_row.id,case when coalesce(p_approve,false) then 'product.published' else 'product.rejected' end,
    jsonb_build_object('product_id',product_row.id,'producer_id',product_row.producer_id,'reviewed_by',caller_id,'reason',reason_value));
  return result||jsonb_build_object('reviewed',true,'approved',coalesce(p_approve,false),'reason',reason_value);
end;
$$;

create or replace function private.admin_review_product_change_v1(p_change_request_id uuid,p_approve boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  request_row public.product_change_requests%rowtype;
  product_row public.products%rowtype;
  producer_owner uuid;
  reason_value text:=nullif(btrim(coalesce(p_reason,'')),'');
  apply_result jsonb;
begin
  if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
  select * into request_row from public.product_change_requests where id=p_change_request_id for update;
  if request_row.id is null or request_row.status<>'pending' then raise exception 'pending_product_change_not_found' using errcode='P0002'; end if;
  if not coalesce(p_approve,false) and char_length(coalesce(reason_value,''))<8 then raise exception 'product_change_rejection_reason_required' using errcode='22023'; end if;
  if reason_value is not null and char_length(reason_value)>2000 then raise exception 'product_change_reason_too_long' using errcode='22023'; end if;

  perform private.validate_product_change_payload_v1(request_row.product_id,request_row.producer_id,request_row.requested_by,request_row.proposed_payload);
  select * into product_row from public.products where id=request_row.product_id for update;
  if product_row.status<>'published' then raise exception 'product_no_longer_published' using errcode='55000'; end if;

  if coalesce(p_approve,false) then
    apply_result:=private.management_upsert_product_v1(product_row.id::text,request_row.proposed_payload);
    update public.product_change_requests set status='approved',review_reason=reason_value,reviewed_by=caller_id,reviewed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=request_row.id;
  else
    update public.product_change_requests set status='rejected',review_reason=reason_value,reviewed_by=caller_id,reviewed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=request_row.id;
  end if;

  insert into private.product_moderation_events(product_id,change_request_id,producer_id,actor_user_id,decision,reason)
  values(product_row.id,request_row.id,request_row.producer_id,caller_id,case when coalesce(p_approve,false) then 'change_approved' else 'change_rejected' end,reason_value);

  select owner_user_id into producer_owner from public.producers where id=request_row.producer_id;
  if producer_owner is not null then
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(
      producer_owner,
      'producer',
      case when coalesce(p_approve,false) then 'Ürün değişikliğiniz onaylandı' else 'Ürün değişikliğiniz için düzeltme gerekiyor' end,
      case when coalesce(p_approve,false)
        then product_row.name||' ürünü için gönderdiğiniz değişiklikler onaylandı ve yayındaki ürüne uygulandı.'
        else product_row.name||' ürünü için gönderdiğiniz değişiklik onaylanmadı. Ret nedeni: '||reason_value||' Düzelterek yeniden gönderebilirsiniz.'
      end,
      '/producer/products',
      jsonb_build_object('productId',product_row.id,'changeRequestId',request_row.id,'approved',coalesce(p_approve,false),'reason',reason_value,'canResubmit',not coalesce(p_approve,false))
    );
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('product_change_request',request_row.id,case when coalesce(p_approve,false) then 'product_change.approved' else 'product_change.rejected' end,
    jsonb_build_object('change_request_id',request_row.id,'product_id',product_row.id,'reviewed_by',caller_id,'reason',reason_value));
  return jsonb_build_object('changeRequestId',request_row.id,'productId',product_row.id,'status',case when coalesce(p_approve,false) then 'approved' else 'rejected' end,'reason',reason_value,'result',apply_result);
end;
$$;

create or replace function private.producer_upsert_product_v1(p_reference text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  producer public.producers%rowtype;
  target public.products%rowtype;
  target_category_slug text;
  sanitized jsonb;
  result jsonb;
  was_rejected boolean:=false;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(private.is_admin(),false) then raise exception 'producer_portal_separate_from_admin' using errcode='42501'; end if;
  select * into producer from public.producers p where p.owner_user_id=caller_id and p.status='active' and p.is_verified=true and p.origin_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
  if producer.id is null then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  if cardinality(producer.approved_category_slugs)=0 then raise exception 'producer_category_scope_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_product_payload' using errcode='22023'; end if;
  if p_payload ?| array['vendor_id','is_approved','is_rejected','verificationStatus','claimReviewStatus','section','homeSection'] then raise exception 'producer_admin_fields_not_allowed' using errcode='42501'; end if;

  if nullif(btrim(coalesce(p_reference,'')),'') is not null then
    select * into target from public.products product where (product.id::text=btrim(p_reference) or product.slug=btrim(p_reference)) and product.deleted_at is null limit 1;
    if target.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
    if target.producer_id<>producer.id then raise exception 'product_access_denied' using errcode='42501'; end if;
    was_rejected:=target.status='rejected';
  end if;

  if p_payload ? 'category' or p_payload ? 'categoryId' or target.id is null then
    select c.slug into target_category_slug from public.categories c where c.is_active=true and (c.slug=coalesce(nullif(p_payload->>'category',''),p_payload->>'categoryId') or c.id::text=coalesce(nullif(p_payload->>'categoryId',''),p_payload->>'category')) limit 1;
  else
    select c.slug into target_category_slug from public.categories c where c.id=target.category_id;
  end if;
  if target_category_slug is null or not (target_category_slug=any(producer.approved_category_slugs)) then raise exception 'product_category_outside_producer_scope' using errcode='42501'; end if;

  sanitized:=p_payload-'vendor_id'-'is_approved'-'is_rejected'-'verificationStatus'-'claimReviewStatus'-'section'-'homeSection';
  sanitized:=jsonb_set(sanitized,'{origin}',to_jsonb(producer.production_location),true);
  result:=private.management_upsert_product_v1(p_reference,sanitized);

  if was_rejected and coalesce(result->>'status','')='review' then
    update public.products set specifications=specifications-'rejectionReason',updated_at=timezone('utc',now()) where id=target.id;
    insert into private.product_moderation_events(product_id,producer_id,actor_user_id,decision,reason)
    values(target.id,producer.id,caller_id,'resubmitted','Satıcı ret gerekçesine göre ürünü düzenleyip yeniden incelemeye gönderdi.');
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(caller_id,'producer','Ürün yeniden incelemeye gönderildi',target.name||' için yaptığınız düzeltmeler alındı. Super Admin incelemesinden sonra size bildirim gönderilecek.','/producer/products',jsonb_build_object('productId',target.id,'status','review'));
  end if;

  return result||jsonb_build_object('producerScope','own_products_only','categoryScope',target_category_slug,'resubmitted',was_rejected and coalesce(result->>'status','')='review');
end;
$$;

create or replace function private.list_my_producer_products_v3()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare base jsonb:=private.list_my_producer_products_v2(); result jsonb;
begin
  select coalesce(jsonb_agg(product_item||jsonb_build_object(
    'rejectionReason',case when product.status='rejected' then nullif(product.specifications->>'rejectionReason','') else null end,
    'moderation',jsonb_build_object(
      'lastDecision',(select event.decision from private.product_moderation_events event where event.product_id=product.id order by event.created_at desc limit 1),
      'lastReason',(select event.reason from private.product_moderation_events event where event.product_id=product.id order by event.created_at desc limit 1),
      'lastDecisionAt',(select event.created_at from private.product_moderation_events event where event.product_id=product.id order by event.created_at desc limit 1),
      'lastRejectedChangeReason',(select request.review_reason from public.product_change_requests request where request.product_id=product.id and request.status='rejected' order by request.reviewed_at desc nulls last,request.updated_at desc limit 1)
    )
  ) order by product_ordinality),'[]'::jsonb) into result
  from jsonb_array_elements(coalesce(base,'[]'::jsonb)) with ordinality rows(product_item,product_ordinality)
  join public.products product on product.id=(product_item->>'id')::uuid;
  return result;
end;
$$;

create or replace function public.list_my_producer_products_v3()
returns jsonb language sql stable set search_path=''
as $$ select private.list_my_producer_products_v3(); $$;
revoke all on function public.list_my_producer_products_v3() from public,anon;
grant execute on function public.list_my_producer_products_v3() to authenticated;
