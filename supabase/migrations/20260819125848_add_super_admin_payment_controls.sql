create or replace function private.default_payment_control_v1()
returns jsonb
language sql
immutable
set search_path=''
as $$
  select jsonb_build_object(
    'mode','manual_confirmation',
    'provider',null,
    'live_card_payments_enabled',false,
    'card_enrollment_enabled',false,
    'pay_with_iyzico_enabled',false,
    'bank_transfer_enabled',false,
    'google_pay',jsonb_build_object('enabled',false,'environment','TEST','merchant_id',null,'gateway',null,'requires_gateway_approval',true),
    'apple_pay',jsonb_build_object('enabled',false,'merchant_id',null,'merchant_display_name','Golden Oremar','requires_processor_approval',true),
    'carrier_billing',jsonb_build_object('enabled',false,'provider',null,'allowed_countries','[]'::jsonb,'requires_commercial_contract',true,'physical_goods_eligibility_confirmed',false),
    'requires_provider_configuration',true
  );
$$;

update public.brand_settings
set public_config=jsonb_set(public_config,'{payments}',private.default_payment_control_v1() || coalesce(public_config->'payments','{}'::jsonb),true),updated_at=timezone('utc',now())
where slug='golden-oremar';

create or replace function private.validate_payment_control_v1(p_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  cfg jsonb:=coalesce(p_config,'{}'::jsonb);
  provider text:=nullif(lower(btrim(coalesce(cfg->>'provider',''))),'');
  mode text:=lower(btrim(coalesce(cfg->>'mode','manual_confirmation')));
  google_cfg jsonb:=coalesce(cfg->'google_pay','{}'::jsonb);
  apple_cfg jsonb:=coalesce(cfg->'apple_pay','{}'::jsonb);
  carrier_cfg jsonb:=coalesce(cfg->'carrier_billing','{}'::jsonb);
  google_env text:=upper(btrim(coalesce(google_cfg->>'environment','TEST')));
  carrier_provider text:=nullif(lower(btrim(coalesce(carrier_cfg->>'provider',''))),'');
begin
  if jsonb_typeof(cfg)<>'object' then raise exception 'invalid_payment_config' using errcode='22023'; end if;
  if mode not in ('manual_confirmation','provider') then raise exception 'invalid_payment_mode' using errcode='22023'; end if;
  if provider is not null and provider not in ('iyzico') then raise exception 'unsupported_primary_payment_provider' using errcode='22023'; end if;
  if coalesce((cfg->>'live_card_payments_enabled')::boolean,false) or coalesce((cfg->>'card_enrollment_enabled')::boolean,false) or coalesce((cfg->>'pay_with_iyzico_enabled')::boolean,false) then
    if provider is null then raise exception 'primary_payment_provider_required' using errcode='22023'; end if;
    if mode<>'provider' then raise exception 'provider_payment_mode_required' using errcode='22023'; end if;
  end if;
  if jsonb_typeof(google_cfg)<>'object' or jsonb_typeof(apple_cfg)<>'object' or jsonb_typeof(carrier_cfg)<>'object' then raise exception 'invalid_payment_method_config' using errcode='22023'; end if;
  if google_env not in ('TEST','PRODUCTION') then raise exception 'invalid_google_pay_environment' using errcode='22023'; end if;
  if coalesce((google_cfg->>'enabled')::boolean,false) then
    if nullif(btrim(coalesce(google_cfg->>'merchant_id','')),'') is null then raise exception 'google_pay_merchant_id_required' using errcode='22023'; end if;
    if nullif(lower(btrim(coalesce(google_cfg->>'gateway',''))),'') is null then raise exception 'google_pay_gateway_required' using errcode='22023'; end if;
    if coalesce((google_cfg->>'requires_gateway_approval')::boolean,true) then raise exception 'google_pay_gateway_approval_pending' using errcode='55000'; end if;
  end if;
  if coalesce((apple_cfg->>'enabled')::boolean,false) then
    if nullif(btrim(coalesce(apple_cfg->>'merchant_id','')),'') is null then raise exception 'apple_pay_merchant_id_required' using errcode='22023'; end if;
    if nullif(btrim(coalesce(apple_cfg->>'merchant_display_name','')),'') is null then raise exception 'apple_pay_display_name_required' using errcode='22023'; end if;
    if coalesce((apple_cfg->>'requires_processor_approval')::boolean,true) then raise exception 'apple_pay_processor_approval_pending' using errcode='55000'; end if;
  end if;
  if coalesce((carrier_cfg->>'enabled')::boolean,false) then
    if carrier_provider is null or carrier_provider not in ('boku') then raise exception 'carrier_billing_provider_required' using errcode='22023'; end if;
    if coalesce((carrier_cfg->>'requires_commercial_contract')::boolean,true) then raise exception 'carrier_billing_contract_pending' using errcode='55000'; end if;
    if not coalesce((carrier_cfg->>'physical_goods_eligibility_confirmed')::boolean,false) then raise exception 'carrier_billing_physical_goods_eligibility_required' using errcode='55000'; end if;
    if jsonb_typeof(carrier_cfg->'allowed_countries')<>'array' or jsonb_array_length(carrier_cfg->'allowed_countries')=0 then raise exception 'carrier_billing_country_scope_required' using errcode='22023'; end if;
  end if;
  return private.default_payment_control_v1() || cfg || jsonb_build_object('google_pay',(private.default_payment_control_v1()->'google_pay') || google_cfg,'apple_pay',(private.default_payment_control_v1()->'apple_pay') || apple_cfg,'carrier_billing',(private.default_payment_control_v1()->'carrier_billing') || carrier_cfg);
end;
$$;

create or replace function public.super_admin_get_payment_control_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) into cfg from public.brand_settings bs where bs.slug='golden-oremar';
  if cfg is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  return cfg;
end;
$$;
revoke all on function public.super_admin_get_payment_control_v1() from public,anon;
grant execute on function public.super_admin_get_payment_control_v1() to authenticated;

create or replace function public.super_admin_update_payment_control_v1(p_config jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_id uuid:=auth.uid(); normalized jsonb; previous jsonb;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  normalized:=private.validate_payment_control_v1(p_config);
  select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) into previous from public.brand_settings bs where bs.slug='golden-oremar' for update;
  if previous is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  update public.brand_settings set public_config=jsonb_set(public_config,'{payments}',normalized,true),updated_at=timezone('utc',now()) where slug='golden-oremar';
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'payments.control_updated','brand_settings','golden-oremar',jsonb_build_object('previous',previous,'next',normalized));
  return normalized;
end;
$$;
revoke all on function public.super_admin_update_payment_control_v1(jsonb) from public,anon;
grant execute on function public.super_admin_update_payment_control_v1(jsonb) to authenticated;

create or replace function public.get_checkout_payment_capabilities_v1()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'card',coalesce((cfg->>'live_card_payments_enabled')::boolean,false),
    'savedCard',coalesce((cfg->>'card_enrollment_enabled')::boolean,false),
    'payWithIyzico',coalesce((cfg->>'pay_with_iyzico_enabled')::boolean,false),
    'bankTransfer',coalesce((cfg->>'bank_transfer_enabled')::boolean,false),
    'googlePay',coalesce((cfg->'google_pay'->>'enabled')::boolean,false),
    'applePay',coalesce((cfg->'apple_pay'->>'enabled')::boolean,false),
    'carrierBilling',coalesce((cfg->'carrier_billing'->>'enabled')::boolean,false),
    'carrierBillingProvider',case when coalesce((cfg->'carrier_billing'->>'enabled')::boolean,false) then cfg->'carrier_billing'->>'provider' else null end
  )
  from (select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) cfg from public.brand_settings bs where bs.slug='golden-oremar') s;
$$;
revoke all on function public.get_checkout_payment_capabilities_v1() from public;
grant execute on function public.get_checkout_payment_capabilities_v1() to anon,authenticated;
