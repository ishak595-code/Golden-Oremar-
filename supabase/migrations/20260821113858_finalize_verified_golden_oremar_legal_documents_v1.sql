do $$
declare
  cfg jsonb;
  identity jsonb;
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

  select coalesce(public_config,'{}'::jsonb), coalesce(public_config->'businessIdentity','{}'::jsonb)
    into cfg,identity
  from public.brand_settings
  where slug='golden-oremar'
  for update;

  if coalesce(identity->>'verificationStatus','') <> 'verified'
     or coalesce((identity->>'registeredIdentityVerified')::boolean,false) is not true then
    raise exception 'registered_identity_not_verified';
  end if;

  identity := identity || jsonb_build_object(
    'legalDocumentsFinalized',true,
    'legalDocumentsFinalizedAt',timezone('utc',now()),
    'updatedAt',timezone('utc',now())
  );
  cfg := jsonb_set(cfg,'{businessIdentity}',identity,true);

  update public.brand_settings
  set public_config=cfg,
      updated_at=timezone('utc',now())
  where slug='golden-oremar';
end;
$$;
