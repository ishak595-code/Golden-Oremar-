create or replace function private.super_admin_list_shipping_weight_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'variantId',pv.id,'productId',p.id,'productName',p.name,'variantName',pv.name,'sku',pv.sku,
    'producerId',pr.id,'producerName',pr.display_name,'weightGrams',pv.weight_grams,
    'missingWeight',pv.weight_grams is null or pv.weight_grams<=0,'updatedAt',pv.updated_at
  ) order by (pv.weight_grams is null or pv.weight_grams<=0) desc,p.name,pv.name,pv.id),'[]'::jsonb)
  into result
  from public.product_variants pv
  join public.products p on p.id=pv.product_id
  join public.producers pr on pr.id=p.producer_id
  where pv.is_active=true and p.status='published' and p.is_active=true and p.deleted_at is null;
  return jsonb_build_object('ok',true,'items',result);
end;
$function$;

create or replace function private.super_admin_update_variant_shipping_weight_v1(p_variant_id uuid,p_weight_grams integer,p_expected_updated_at timestamptz,p_verification_note text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); current_row public.product_variants%rowtype; note_value text:=btrim(coalesce(p_verification_note,'')); updated public.product_variants%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_variant_id is null then raise exception 'variant_required' using errcode='22023'; end if;
  if p_weight_grams is null or p_weight_grams<1 or p_weight_grams>100000000 then raise exception 'invalid_shipping_weight' using errcode='22023'; end if;
  if char_length(note_value) not between 10 and 500 then raise exception 'shipping_weight_verification_note_required' using errcode='22023'; end if;
  select pv.* into current_row from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=p_variant_id and p.deleted_at is null for update of pv;
  if current_row.id is null then raise exception 'variant_not_found' using errcode='P0002'; end if;
  if p_expected_updated_at is null or current_row.updated_at is distinct from p_expected_updated_at then raise exception 'shipping_weight_conflict' using errcode='40001'; end if;
  update public.product_variants set weight_grams=p_weight_grams,updated_at=timezone('utc',now()) where id=p_variant_id returning * into updated;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'inventory.shipping_weight_verified','product_variant',updated.id,jsonb_build_object('previousWeightGrams',current_row.weight_grams,'nextWeightGrams',updated.weight_grams,'verificationNote',note_value));
  return jsonb_build_object('ok',true,'variantId',updated.id,'weightGrams',updated.weight_grams,'updatedAt',updated.updated_at);
end;
$function$;

revoke all on function private.super_admin_list_shipping_weight_readiness_v1() from public,anon;
revoke all on function private.super_admin_update_variant_shipping_weight_v1(uuid,integer,timestamptz,text) from public,anon;
grant execute on function private.super_admin_list_shipping_weight_readiness_v1() to authenticated;
grant execute on function private.super_admin_update_variant_shipping_weight_v1(uuid,integer,timestamptz,text) to authenticated;

create or replace function public.super_admin_list_shipping_weight_readiness_v1() returns jsonb language sql stable security invoker set search_path to '' as $function$ select private.super_admin_list_shipping_weight_readiness_v1(); $function$;
create or replace function public.super_admin_update_variant_shipping_weight_v1(p_variant_id uuid,p_weight_grams integer,p_expected_updated_at timestamptz,p_verification_note text) returns jsonb language sql security invoker set search_path to '' as $function$ select private.super_admin_update_variant_shipping_weight_v1(p_variant_id,p_weight_grams,p_expected_updated_at,p_verification_note); $function$;
revoke all on function public.super_admin_list_shipping_weight_readiness_v1() from public,anon;
revoke all on function public.super_admin_update_variant_shipping_weight_v1(uuid,integer,timestamptz,text) from public,anon;
grant execute on function public.super_admin_list_shipping_weight_readiness_v1() to authenticated;
grant execute on function public.super_admin_update_variant_shipping_weight_v1(uuid,integer,timestamptz,text) to authenticated;
