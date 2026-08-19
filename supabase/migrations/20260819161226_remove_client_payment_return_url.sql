create or replace function private.validate_payment_control_v1(p_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $function$
declare
  cfg jsonb:=coalesce(p_config,'{}'::jsonb);
  hosted boolean:=coalesce((cfg->>'checkout_form_enabled')::boolean,false);
  saved_card boolean:=coalesce((cfg->>'live_card_payments_enabled')::boolean,false);
  enrollment boolean:=coalesce((cfg->>'card_enrollment_enabled')::boolean,false);
begin
  if jsonb_typeof(cfg)<>'object' then raise exception 'invalid_payment_config' using errcode='22023'; end if;
  if enrollment and not saved_card then raise exception 'card_enrollment_requires_saved_card_payments' using errcode='22023'; end if;
  return jsonb_build_object(
    'mode','provider',
    'provider','iyzico',
    'checkout_form_enabled',hosted,
    'live_card_payments_enabled',saved_card,
    'card_enrollment_enabled',enrollment,
    'return_url',null,
    'requires_provider_configuration',not (hosted or saved_card)
  );
end;
$function$;

update public.brand_settings
set public_config=jsonb_set(coalesce(public_config,'{}'::jsonb),'{payments,return_url}','null'::jsonb,true),
    updated_at=timezone('utc',now())
where slug='golden-oremar';

comment on function private.validate_payment_control_v1(jsonb) is 'Validates iyzico controls for in-app checkout. Customer-facing return URLs are not part of the runtime contract; provider callback handling is server-side.';
