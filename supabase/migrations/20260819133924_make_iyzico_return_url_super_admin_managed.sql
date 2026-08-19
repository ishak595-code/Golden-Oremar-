create or replace function private.default_payment_control_v1()
returns jsonb language sql immutable set search_path='' as $$
select jsonb_build_object('mode','provider','provider','iyzico','checkout_form_enabled',false,'live_card_payments_enabled',false,'card_enrollment_enabled',false,'return_url',null,'requires_provider_configuration',true);
$$;

create or replace function private.validate_payment_control_v1(p_config jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare cfg jsonb:=coalesce(p_config,'{}'::jsonb); hosted boolean:=coalesce((cfg->>'checkout_form_enabled')::boolean,false); saved_card boolean:=coalesce((cfg->>'live_card_payments_enabled')::boolean,false); enrollment boolean:=coalesce((cfg->>'card_enrollment_enabled')::boolean,false); return_url text:=nullif(btrim(coalesce(cfg->>'return_url','')),'');
begin
 if jsonb_typeof(cfg)<>'object' then raise exception 'invalid_payment_config' using errcode='22023'; end if;
 if enrollment and not saved_card then raise exception 'card_enrollment_requires_saved_card_payments' using errcode='22023'; end if;
 if return_url is not null then if char_length(return_url)>1000 or return_url ~ '[[:cntrl:]]' then raise exception 'invalid_payment_return_url' using errcode='22023'; end if; if return_url !~ '^https://[^[:space:]]+$' and return_url !~ '^goldenoremar://[^[:space:]]+$' then raise exception 'invalid_payment_return_url' using errcode='22023'; end if; end if;
 if hosted and return_url is null then raise exception 'payment_return_url_required' using errcode='22023'; end if;
 return jsonb_build_object('mode','provider','provider','iyzico','checkout_form_enabled',hosted,'live_card_payments_enabled',saved_card,'card_enrollment_enabled',enrollment,'return_url',return_url,'requires_provider_configuration',not(hosted or saved_card));
end;$$;

update public.brand_settings set public_config=jsonb_set(public_config,'{payments}',private.validate_payment_control_v1(coalesce(public_config->'payments','{}'::jsonb)),true),updated_at=timezone('utc',now()) where slug='golden-oremar';
