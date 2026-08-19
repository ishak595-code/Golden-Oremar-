create or replace function private.super_admin_remove_product_v1(p_product_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  caller_id uuid:=auth.uid();
  reason_value text:=btrim(coalesce(p_reason,''));
  product_row public.products%rowtype;
  order_refs integer;
  review_refs integer;
  batch_refs integer;
  change_refs integer;
  image_paths jsonb;
  preserve_history boolean;
begin
  if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if char_length(reason_value) not between 8 and 1000 then raise exception 'product_removal_reason_required' using errcode='22023'; end if;
  select * into product_row from public.products where id=p_product_id for update;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select count(*)::integer into order_refs from public.order_items where product_id=p_product_id;
  select count(*)::integer into review_refs from public.reviews where product_id=p_product_id;
  select count(*)::integer into batch_refs from public.product_batches where product_id=p_product_id;
  select count(*)::integer into change_refs from public.product_change_requests where product_id=p_product_id;
  select coalesce(jsonb_agg(storage_path order by sort_order,created_at),'[]'::jsonb) into image_paths from public.product_images where product_id=p_product_id;
  preserve_history:=order_refs>0 or review_refs>0 or batch_refs>0 or change_refs>0;
  if preserve_history then
    update public.products set status='archived',is_active=false,is_featured=false,deleted_at=coalesce(deleted_at,timezone('utc',now())),updated_at=timezone('utc',now()) where id=p_product_id;
    update public.product_change_requests set status='withdrawn',review_reason=coalesce(review_reason,reason_value),updated_at=timezone('utc',now()) where product_id=p_product_id and status='pending';
    delete from public.favorites where product_id=p_product_id;
    delete from public.campaign_products where product_id=p_product_id;
    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('product',p_product_id,'product.removed_preserving_history',jsonb_build_object('actor_user_id',caller_id,'reason',reason_value,'order_refs',order_refs,'review_refs',review_refs,'batch_refs',batch_refs,'change_refs',change_refs));
    return jsonb_build_object('id',p_product_id,'mode','archived_preserving_history','imagePaths','[]'::jsonb,'orderRefs',order_refs,'reviewRefs',review_refs,'batchRefs',batch_refs,'changeRefs',change_refs);
  end if;
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('product',p_product_id,'product.permanently_removed',jsonb_build_object('actor_user_id',caller_id,'reason',reason_value,'producer_id',product_row.producer_id,'name',product_row.name));
  delete from public.products where id=p_product_id;
  return jsonb_build_object('id',p_product_id,'mode','permanently_deleted','imagePaths',image_paths,'orderRefs',0,'reviewRefs',0,'batchRefs',0,'changeRefs',0);
end;
$function$;

create or replace function public.super_admin_remove_product_v1(p_product_id uuid,p_reason text)
returns jsonb language sql set search_path='' as $function$select private.super_admin_remove_product_v1(p_product_id,p_reason);$function$;
revoke all on function public.super_admin_remove_product_v1(uuid,text) from public,anon;
grant execute on function public.super_admin_remove_product_v1(uuid,text) to authenticated;
