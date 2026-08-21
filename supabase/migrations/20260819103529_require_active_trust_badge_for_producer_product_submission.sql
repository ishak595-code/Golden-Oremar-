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
  if not private.is_producer_trust_badge_active_v1(producer.id) then raise exception 'active_producer_trust_badge_required' using errcode='42501'; end if;
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
