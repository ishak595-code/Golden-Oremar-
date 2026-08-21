create or replace function private.super_admin_get_payment_control_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare cfg jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) into cfg from public.brand_settings bs where bs.slug='golden-oremar';
  if cfg is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  return cfg;
end;
$function$;

create or replace function private.super_admin_update_payment_control_v1(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); normalized jsonb; previous jsonb;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  normalized:=private.validate_payment_control_v1(p_config);
  select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) into previous from public.brand_settings bs where bs.slug='golden-oremar' for update;
  if previous is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  update public.brand_settings set public_config=jsonb_set(public_config,'{payments}',normalized,true),updated_at=timezone('utc',now()) where slug='golden-oremar';
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'payments.control_updated','brand_settings','golden-oremar',jsonb_build_object('previous',previous,'next',normalized));
  return normalized;
end;
$function$;

create or replace function private.super_admin_set_producer_payment_provider_type_v1(p_producer_id uuid,p_provider_submerchant_type text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare caller_id uuid:=auth.uid(); normalized_type text:=upper(btrim(coalesce(p_provider_submerchant_type,''))); target public.producers%rowtype; result private.producer_payment_accounts%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if p_producer_id is null then raise exception 'producer_required' using errcode='22023'; end if;
  if normalized_type not in ('PERSONAL','PRIVATE_COMPANY','LIMITED_OR_JOINT_STOCK_COMPANY') then raise exception 'invalid_provider_submerchant_type' using errcode='22023'; end if;
  select * into target from public.producers where id=p_producer_id and deleted_at is null;
  if target.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  insert into private.producer_payment_accounts(producer_id,provider,provider_submerchant_type,submerchant_external_id,status,last_error,updated_at)
  values(target.id,'iyzico',normalized_type,'GO-'||replace(target.id::text,'-',''),'pending_configuration',null,timezone('utc',now()))
  on conflict(producer_id) do update set provider_submerchant_type=excluded.provider_submerchant_type,status=case when private.producer_payment_accounts.submerchant_key is null then 'pending_configuration' else private.producer_payment_accounts.status end,last_error=null,updated_at=timezone('utc',now())
  returning * into result;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details)
  values(caller_id,'producer.payment_provider_type_set','producer',target.id,jsonb_build_object('provider','iyzico','submerchantType',normalized_type));
  return jsonb_build_object('ok',true,'producerId',result.producer_id,'provider',result.provider,'providerSubmerchantType',result.provider_submerchant_type,'status',result.status,'ready',result.status='ready');
end;
$function$;

revoke all on function private.set_my_pending_order_payment_method_v1(uuid,uuid) from public,anon;
revoke all on function private.super_admin_get_payment_control_v1() from public,anon;
revoke all on function private.super_admin_update_payment_control_v1(jsonb) from public,anon;
revoke all on function private.super_admin_set_producer_payment_provider_type_v1(uuid,text) from public,anon;
grant execute on function private.set_my_pending_order_payment_method_v1(uuid,uuid) to authenticated;
grant execute on function private.super_admin_get_payment_control_v1() to authenticated;
grant execute on function private.super_admin_update_payment_control_v1(jsonb) to authenticated;
grant execute on function private.super_admin_set_producer_payment_provider_type_v1(uuid,text) to authenticated;

create or replace function public.set_my_pending_order_payment_method_v1(p_order_id uuid,p_payment_method_id uuid)
returns jsonb language sql security invoker set search_path to '' as $function$ select private.set_my_pending_order_payment_method_v1(p_order_id,p_payment_method_id); $function$;
create or replace function public.super_admin_get_payment_control_v1()
returns jsonb language sql stable security invoker set search_path to '' as $function$ select private.super_admin_get_payment_control_v1(); $function$;
create or replace function public.super_admin_update_payment_control_v1(p_config jsonb)
returns jsonb language sql security invoker set search_path to '' as $function$ select private.super_admin_update_payment_control_v1(p_config); $function$;
create or replace function public.super_admin_set_producer_payment_provider_type_v1(p_producer_id uuid,p_provider_submerchant_type text)
returns jsonb language sql security invoker set search_path to '' as $function$ select private.super_admin_set_producer_payment_provider_type_v1(p_producer_id,p_provider_submerchant_type); $function$;

revoke all on function public.set_my_pending_order_payment_method_v1(uuid,uuid) from public,anon;
revoke all on function public.super_admin_get_payment_control_v1() from public,anon;
revoke all on function public.super_admin_update_payment_control_v1(jsonb) from public,anon;
revoke all on function public.super_admin_set_producer_payment_provider_type_v1(uuid,text) from public,anon;
grant execute on function public.set_my_pending_order_payment_method_v1(uuid,uuid) to authenticated;
grant execute on function public.super_admin_get_payment_control_v1() to authenticated;
grant execute on function public.super_admin_update_payment_control_v1(jsonb) to authenticated;
grant execute on function public.super_admin_set_producer_payment_provider_type_v1(uuid,text) to authenticated;
