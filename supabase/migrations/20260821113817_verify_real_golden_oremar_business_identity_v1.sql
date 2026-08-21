do $$
declare
  cfg private.super_admin_company_configuration_v1%rowtype;
  current_config jsonb;
  current_identity jsonb;
  published_count integer;
begin
  select count(*)::integer into published_count
  from public.content_entries
  where content_type='legal'
    and locale='tr'
    and slug in ('about','returns','privacy','terms')
    and status='published'
    and deleted_at is null
    and char_length(btrim(coalesce(body_markdown,''))) >= 100;

  if published_count <> 4 then
    raise exception 'required_turkish_legal_documents_not_published';
  end if;

  select * into cfg
  from private.super_admin_company_configuration_v1
  where singleton=true;

  if cfg.singleton is null then
    raise exception 'business_configuration_missing';
  end if;

  select coalesce(public_config,'{}'::jsonb), coalesce(public_config->'businessIdentity','{}'::jsonb)
    into current_config,current_identity
  from public.brand_settings
  where slug='golden-oremar'
  for update;

  current_identity := current_identity || jsonb_build_object(
    'registeredLegalName',cfg.registered_legal_name,
    'registeredAddress',cfg.registered_address,
    'taxOffice',cfg.tax_office,
    'taxNumber',cfg.tax_number,
    'mersisNumber',cfg.mersis_number,
    'tradeRegistryNumber',cfg.trade_registry_number,
    'countryCode',cfg.country_code,
    'verificationStatus','verified',
    'registeredIdentityVerified',true,
    'legalDocumentsFinalized',true,
    'verifiedAt',timezone('utc',now()),
    'updatedAt',timezone('utc',now())
  );
  current_identity := current_identity - 'provisionalDefaults';

  current_config := jsonb_set(current_config,'{businessIdentity}',current_identity,true);

  update public.brand_settings
  set public_config=current_config,
      support_email=cfg.support_email,
      support_phone=cfg.support_phone,
      updated_at=timezone('utc',now())
  where slug='golden-oremar';
end;
$$;
