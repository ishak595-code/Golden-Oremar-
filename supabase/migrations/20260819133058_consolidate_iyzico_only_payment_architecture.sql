drop index if exists private.payment_intents_subject_channel_idx;
alter table private.payment_intents drop constraint if exists payment_intents_payment_channel_check;
alter table private.payment_intents drop column if exists payment_channel;

alter table private.payment_intents drop constraint if exists payment_intents_payment_flow_check;
alter table private.payment_intents add constraint payment_intents_payment_flow_check
  check (payment_flow in ('saved_card','checkout_form'));

create or replace function private.default_payment_control_v1()
returns jsonb
language sql
immutable
set search_path=''
as $$
  select jsonb_build_object(
    'mode','provider',
    'provider','iyzico',
    'checkout_form_enabled',false,
    'live_card_payments_enabled',false,
    'card_enrollment_enabled',false,
    'requires_provider_configuration',true
  );
$$;

create or replace function private.validate_payment_control_v1(p_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
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
    'requires_provider_configuration',not (hosted or saved_card)
  );
end;
$$;

update public.brand_settings
set public_config=jsonb_set(
      public_config,
      '{payments}',
      private.validate_payment_control_v1(jsonb_build_object(
        'checkout_form_enabled',coalesce((public_config->'payments'->>'checkout_form_enabled')::boolean,false),
        'live_card_payments_enabled',coalesce((public_config->'payments'->>'live_card_payments_enabled')::boolean,false),
        'card_enrollment_enabled',coalesce((public_config->'payments'->>'card_enrollment_enabled')::boolean,false)
      )),
      true
    ),
    updated_at=timezone('utc',now())
where slug='golden-oremar';

create or replace function public.get_checkout_payment_capabilities_v2()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'provider','iyzico',
    'hostedCheckout',coalesce((cfg->>'checkout_form_enabled')::boolean,false),
    'savedCardPayment',coalesce((cfg->>'live_card_payments_enabled')::boolean,false),
    'cardEnrollment',coalesce((cfg->>'card_enrollment_enabled')::boolean,false)
  )
  from (
    select private.default_payment_control_v1() || coalesce(bs.public_config->'payments','{}'::jsonb) cfg
    from public.brand_settings bs where bs.slug='golden-oremar'
  ) s;
$$;
revoke all on function public.get_checkout_payment_capabilities_v2() from public;
grant execute on function public.get_checkout_payment_capabilities_v2() to anon,authenticated;

create or replace function public.get_checkout_payment_capabilities_v1()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select public.get_checkout_payment_capabilities_v2();
$$;
revoke all on function public.get_checkout_payment_capabilities_v1() from public;
grant execute on function public.get_checkout_payment_capabilities_v1() to anon,authenticated;
