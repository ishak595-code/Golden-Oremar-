update public.brand_settings
set public_config=jsonb_set(
  coalesce(public_config,'{}'::jsonb),
  '{businessIdentity}',
  coalesce(public_config->'businessIdentity','{}'::jsonb) || jsonb_build_object(
    'registeredLegalName',coalesce(public_config#>'{businessIdentity,registeredLegalName}','null'::jsonb),
    'registeredAddress',coalesce(public_config#>'{businessIdentity,registeredAddress}','null'::jsonb),
    'taxOffice',coalesce(public_config#>'{businessIdentity,taxOffice}','null'::jsonb),
    'taxNumber',coalesce(public_config#>'{businessIdentity,taxNumber}','null'::jsonb),
    'mersisNumber',coalesce(public_config#>'{businessIdentity,mersisNumber}','null'::jsonb),
    'tradeRegistryNumber',coalesce(public_config#>'{businessIdentity,tradeRegistryNumber}','null'::jsonb),
    'countryCode',coalesce(public_config#>'{businessIdentity,countryCode}','null'::jsonb),
    'legalDocumentsFinalized',coalesce(public_config#>'{businessIdentity,legalDocumentsFinalized}','false'::jsonb)
  ),
  true
),updated_at=timezone('utc',now())
where slug='golden-oremar';

create or replace function private.commercial_checkout_legal_readiness_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  settings public.brand_settings%rowtype;
  identity jsonb;
  missing jsonb:='[]'::jsonb;
  registered_name text;
  registered_address text;
  country_code text;
  finalized boolean:=false;
  legal_count integer:=0;
begin
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then return jsonb_build_object('ready',false,'missing',jsonb_build_array('brand_settings')); end if;
  identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
  registered_name:=nullif(btrim(coalesce(identity->>'registeredLegalName','')),'');
  registered_address:=nullif(btrim(coalesce(identity->>'registeredAddress','')),'');
  country_code:=upper(btrim(coalesce(identity->>'countryCode','')));
  finalized:=coalesce((identity->>'legalDocumentsFinalized')::boolean,false);
  if registered_name is null then missing:=missing||jsonb_build_array('registered_legal_name'); end if;
  if registered_address is null or char_length(registered_address)<10 then missing:=missing||jsonb_build_array('registered_address'); end if;
  if country_code !~ '^[A-Z]{2}$' then missing:=missing||jsonb_build_array('registered_country_code'); end if;
  if settings.support_email is null or btrim(settings.support_email)='' then missing:=missing||jsonb_build_array('support_email'); end if;
  if settings.support_phone is null or btrim(settings.support_phone)='' then missing:=missing||jsonb_build_array('support_phone'); end if;
  select count(*) into legal_count from public.content_entries ce where ce.content_type='legal' and ce.slug in('about','returns','privacy','terms') and ce.locale='tr' and ce.status='published' and ce.deleted_at is null and char_length(btrim(coalesce(ce.body_markdown,'')))>=100;
  if legal_count<>4 then missing:=missing||jsonb_build_array('published_legal_documents'); end if;
  if not finalized then missing:=missing||jsonb_build_array('legal_documents_finalized'); end if;
  return jsonb_build_object('ready',jsonb_array_length(missing)=0,'missing',missing,'registeredLegalName',registered_name,'registeredAddress',registered_address,'countryCode',case when country_code~'^[A-Z]{2}$' then country_code else null end,'legalDocumentsFinalized',finalized,'publishedLegalDocumentCount',legal_count);
end;
$$;
revoke all on function private.commercial_checkout_legal_readiness_v1() from public,anon,authenticated;
grant execute on function private.commercial_checkout_legal_readiness_v1() to postgres,service_role;

create or replace function private.super_admin_get_business_identity_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare settings public.brand_settings%rowtype; identity jsonb; readiness jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if settings.slug is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  identity:=coalesce(settings.public_config->'businessIdentity','{}'::jsonb);
  readiness:=private.commercial_checkout_legal_readiness_v1();
  return jsonb_build_object('brandLegalName',settings.legal_name,'registeredLegalName',nullif(btrim(coalesce(identity->>'registeredLegalName','')),''),'registeredAddress',nullif(btrim(coalesce(identity->>'registeredAddress','')),''),'taxOffice',nullif(btrim(coalesce(identity->>'taxOffice','')),''),'taxNumber',nullif(btrim(coalesce(identity->>'taxNumber','')),''),'mersisNumber',nullif(btrim(coalesce(identity->>'mersisNumber','')),''),'tradeRegistryNumber',nullif(btrim(coalesce(identity->>'tradeRegistryNumber','')),''),'countryCode',nullif(upper(btrim(coalesce(identity->>'countryCode',''))),''),'legalDocumentsFinalized',coalesce((identity->>'legalDocumentsFinalized')::boolean,false),'supportEmail',settings.support_email,'supportPhone',settings.support_phone,'checkoutLegalReadiness',readiness,'updatedAt',settings.updated_at);
end;
$$;
revoke all on function private.super_admin_get_business_identity_v2() from public,anon,authenticated;
grant execute on function private.super_admin_get_business_identity_v2() to postgres,service_role;

create or replace function private.super_admin_update_business_identity_v2(p_registered_legal_name text,p_registered_address text,p_tax_office text,p_tax_number text,p_mersis_number text,p_trade_registry_number text,p_country_code text,p_support_email text,p_support_phone text,p_legal_documents_finalized boolean default false)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid(); registered_name text:=nullif(btrim(coalesce(p_registered_legal_name,'')),''); registered_address text:=nullif(btrim(coalesce(p_registered_address,'')),''); tax_office text:=nullif(btrim(coalesce(p_tax_office,'')),''); tax_number text:=nullif(regexp_replace(coalesce(p_tax_number,''),'[^0-9]','','g'),''); mersis_number text:=nullif(regexp_replace(coalesce(p_mersis_number,''),'[^0-9]','','g'),''); trade_registry text:=nullif(btrim(coalesce(p_trade_registry_number,'')),''); country_code text:=nullif(upper(btrim(coalesce(p_country_code,''))),''); email_value text:=lower(btrim(coalesce(p_support_email,''))); phone_value text:=btrim(coalesce(p_support_phone,'')); phone_digits text; next_config jsonb; current_identity jsonb; updated public.brand_settings%rowtype;
begin
  if caller_id is null or not coalesce(private.is_super_admin(),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
  if registered_name is not null and (char_length(registered_name) not between 2 and 240 or registered_name ~ '[[:cntrl:]]') then raise exception 'invalid_registered_legal_name' using errcode='22023'; end if;
  if registered_address is not null and (char_length(registered_address) not between 10 and 1000 or registered_address ~ '[[:cntrl:]]') then raise exception 'invalid_registered_address' using errcode='22023'; end if;
  if tax_office is not null and (char_length(tax_office)>160 or tax_office ~ '[[:cntrl:]]') then raise exception 'invalid_tax_office' using errcode='22023'; end if;
  if tax_number is not null and char_length(tax_number) not between 10 and 11 then raise exception 'invalid_tax_number' using errcode='22023'; end if;
  if mersis_number is not null and char_length(mersis_number)<>16 then raise exception 'invalid_mersis_number' using errcode='22023'; end if;
  if trade_registry is not null and (char_length(trade_registry)>120 or trade_registry ~ '[[:cntrl:]]') then raise exception 'invalid_trade_registry_number' using errcode='22023'; end if;
  if country_code is not null and country_code !~ '^[A-Z]{2}$' then raise exception 'invalid_registered_country_code' using errcode='22023'; end if;
  if char_length(email_value) not between 5 and 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_support_email' using errcode='22023'; end if;
  if char_length(phone_value) not between 7 and 40 or phone_value !~ '^[+()0-9 .-]+$' then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  phone_digits:=regexp_replace(phone_value,'[^0-9]','','g'); if char_length(phone_digits) not between 10 and 15 then raise exception 'invalid_support_phone' using errcode='22023'; end if;
  if coalesce(p_legal_documents_finalized,false) and (registered_name is null or registered_address is null or country_code is null) then raise exception 'registered_identity_required_before_legal_finalization' using errcode='22023'; end if;
  select coalesce(public_config,'{}'::jsonb),coalesce(public_config->'businessIdentity','{}'::jsonb) into next_config,current_identity from public.brand_settings where slug='golden-oremar' for update;
  if next_config is null then raise exception 'brand_settings_not_found' using errcode='P0002'; end if;
  current_identity:=current_identity||jsonb_build_object('registeredLegalName',registered_name,'registeredAddress',registered_address,'taxOffice',tax_office,'taxNumber',tax_number,'mersisNumber',mersis_number,'tradeRegistryNumber',trade_registry,'countryCode',country_code,'legalDocumentsFinalized',coalesce(p_legal_documents_finalized,false),'updatedBy',caller_id,'updatedAt',timezone('utc',now()));
  next_config:=jsonb_set(next_config,'{businessIdentity}',current_identity,true); next_config:=jsonb_set(next_config,'{contactInfo,email}',to_jsonb(email_value),true); next_config:=jsonb_set(next_config,'{contactInfo,phone}',to_jsonb(phone_value),true);
  update public.brand_settings set support_email=email_value,support_phone=phone_value,public_config=next_config,updated_at=timezone('utc',now()) where slug='golden-oremar' returning * into updated;
  insert into private.admin_audit_logs(actor_user_id,action,target_type,target_id,details) values(caller_id,'brand.registered_business_identity_updated','brand_settings','golden-oremar',jsonb_build_object('registeredLegalNameConfigured',registered_name is not null,'registeredAddressConfigured',registered_address is not null,'taxNumberConfigured',tax_number is not null,'mersisConfigured',mersis_number is not null,'tradeRegistryConfigured',trade_registry is not null,'legalDocumentsFinalized',coalesce(p_legal_documents_finalized,false)));
  return private.super_admin_get_business_identity_v2();
end;
$$;
revoke all on function private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function private.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) to postgres,service_role;

create or replace function public.super_admin_get_business_identity_v2() returns jsonb language sql stable security invoker set search_path='' as $$ select private.super_admin_get_business_identity_v2(); $$;
revoke all on function public.super_admin_get_business_identity_v2() from public,anon; grant execute on function public.super_admin_get_business_identity_v2() to authenticated;
create or replace function public.super_admin_update_business_identity_v2(p_registered_legal_name text,p_registered_address text,p_tax_office text,p_tax_number text,p_mersis_number text,p_trade_registry_number text,p_country_code text,p_support_email text,p_support_phone text,p_legal_documents_finalized boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.super_admin_update_business_identity_v2(p_registered_legal_name,p_registered_address,p_tax_office,p_tax_number,p_mersis_number,p_trade_registry_number,p_country_code,p_support_email,p_support_phone,p_legal_documents_finalized); $$;
revoke all on function public.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) from public,anon; grant execute on function public.super_admin_update_business_identity_v2(text,text,text,text,text,text,text,text,text,boolean) to authenticated;

create or replace function public.preview_my_checkout_v1(p_country_code text default 'TR'::text,p_coupon_code text default null::text)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$ declare base jsonb; readiness jsonb; begin base:=private.preview_my_checkout_v1(p_country_code,p_coupon_code); readiness:=private.commercial_checkout_legal_readiness_v1(); base:=base||jsonb_build_object('legalReadiness',readiness); if coalesce((base->>'canCheckout')::boolean,false) and not coalesce((readiness->>'ready')::boolean,false) then base:=jsonb_set(base,'{canCheckout}','false'::jsonb,true); base:=jsonb_set(base,'{blockingReason}',to_jsonb('business_legal_identity_incomplete'::text),true); end if; return base; end; $$;
revoke all on function public.preview_my_checkout_v1(text,text) from public,anon; grant execute on function public.preview_my_checkout_v1(text,text) to authenticated;

create or replace function private.create_customer_order_v5(p_items jsonb,p_shipping_address jsonb,p_customer_note text,p_coupon_code text,p_gift jsonb,p_payment_method_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); legal_readiness jsonb; payment_config jsonb; live_card_payments boolean:=false; hosted_checkout boolean:=false; configured_provider text; selected_method private.customer_payment_methods%rowtype; base jsonb; order_id_value uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  legal_readiness:=private.commercial_checkout_legal_readiness_v1(); if not coalesce((legal_readiness->>'ready')::boolean,false) then raise exception 'commercial_legal_readiness_required' using errcode='55000'; end if;
  select private.default_payment_control_v1()||coalesce(bs.public_config->'payments','{}'::jsonb) into payment_config from public.brand_settings bs where bs.slug='golden-oremar' limit 1; if payment_config is null then payment_config:=private.default_payment_control_v1(); end if;
  live_card_payments:=coalesce((payment_config->>'live_card_payments_enabled')::boolean,false); hosted_checkout:=coalesce((payment_config->>'checkout_form_enabled')::boolean,false); configured_provider:=nullif(lower(btrim(coalesce(payment_config->>'provider',''))),''); if configured_provider<>'iyzico' then raise exception 'payment_provider_not_configured' using errcode='55000'; end if;
  if p_payment_method_id is not null then if not live_card_payments then raise exception 'saved_card_payment_not_enabled' using errcode='55000'; end if; select * into selected_method from private.customer_payment_methods p where p.id=p_payment_method_id and p.user_id=caller_id and p.status='active' for update; if selected_method.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if; if selected_method.provider<>configured_provider then raise exception 'payment_method_provider_mismatch' using errcode='22023'; end if; if selected_method.exp_year is not null and selected_method.exp_month is not null and make_date(selected_method.exp_year,selected_method.exp_month,1)<date_trunc('month',timezone('utc',now()))::date then raise exception 'payment_method_expired' using errcode='22023'; end if; elsif not hosted_checkout then raise exception 'payment_method_required' using errcode='22023'; end if;
  base:=private.create_customer_order_v4(p_items,p_shipping_address,p_customer_note,p_coupon_code,p_gift,p_idempotency_key); order_id_value:=(base->>'orderId')::uuid;
  if p_payment_method_id is not null then insert into private.order_payment_preferences(order_id,user_id,payment_method_id,provider) values(order_id_value,caller_id,selected_method.id,selected_method.provider) on conflict(order_id) do update set payment_method_id=excluded.payment_method_id,provider=excluded.provider,updated_at=timezone('utc',now()) where private.order_payment_preferences.user_id=caller_id; insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('order',order_id_value,'order.payment_method_selected',jsonb_build_object('order_id',order_id_value,'user_id',caller_id,'payment_method_id',selected_method.id,'provider',selected_method.provider,'last4',selected_method.last4,'brand',selected_method.brand)); base:=base||jsonb_build_object('paymentMethod',jsonb_build_object('id',selected_method.id,'provider',selected_method.provider,'brand',selected_method.brand,'last4',selected_method.last4,'nickname',selected_method.nickname),'paymentFlow','saved_card'); else base:=base||jsonb_build_object('paymentMethod',null,'paymentFlow','checkout_form'); end if; return base;
end;
$$;
revoke all on function private.create_customer_order_v5(jsonb,jsonb,text,text,jsonb,uuid,text) from public,anon;
grant execute on function private.create_customer_order_v5(jsonb,jsonb,text,text,jsonb,uuid,text) to authenticated,service_role;
