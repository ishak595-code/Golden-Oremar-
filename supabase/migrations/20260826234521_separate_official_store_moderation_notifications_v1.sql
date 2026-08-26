create or replace function private.admin_review_product_v2(p_product_id uuid, p_approve boolean, p_reason text default null)
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
    result:=private.management_upsert_product_core_v1(product_row.id::text,jsonb_build_object('is_approved',true));
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
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('product',product_row.id,case when coalesce(p_approve,false) then 'product.published' else 'product.rejected' end,
    jsonb_build_object('product_id',product_row.id,'producer_id',product_row.producer_id,'reviewed_by',caller_id,'reason',reason_value));
  return result||jsonb_build_object('reviewed',true,'approved',coalesce(p_approve,false),'reason',reason_value);
end;
$$;
