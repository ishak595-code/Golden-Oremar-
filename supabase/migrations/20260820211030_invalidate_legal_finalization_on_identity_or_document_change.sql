create or replace function private.invalidate_business_legal_finalization_on_identity_change_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare old_identity jsonb:=coalesce(old.public_config->'businessIdentity','{}'::jsonb); new_identity jsonb:=coalesce(new.public_config->'businessIdentity','{}'::jsonb);
begin
  if new.slug='golden-oremar' and (
    old_identity->>'registeredLegalName' is distinct from new_identity->>'registeredLegalName' or
    old_identity->>'registeredAddress' is distinct from new_identity->>'registeredAddress' or
    old_identity->>'countryCode' is distinct from new_identity->>'countryCode' or
    old_identity->>'taxOffice' is distinct from new_identity->>'taxOffice' or
    old_identity->>'taxNumber' is distinct from new_identity->>'taxNumber' or
    old_identity->>'mersisNumber' is distinct from new_identity->>'mersisNumber' or
    old_identity->>'tradeRegistryNumber' is distinct from new_identity->>'tradeRegistryNumber'
  ) then
    new.public_config:=jsonb_set(coalesce(new.public_config,'{}'::jsonb),'{businessIdentity,legalDocumentsFinalized}','false'::jsonb,true);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invalidate_business_legal_finalization_on_identity_change on public.brand_settings;
create trigger trg_invalidate_business_legal_finalization_on_identity_change
before update of public_config on public.brand_settings
for each row execute function private.invalidate_business_legal_finalization_on_identity_change_v1();

create or replace function private.invalidate_business_legal_finalization_on_document_change_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.content_type='legal' and new.locale='tr' and new.slug in('about','returns','privacy','terms') then
    update public.brand_settings
    set public_config=jsonb_set(coalesce(public_config,'{}'::jsonb),'{businessIdentity,legalDocumentsFinalized}','false'::jsonb,true),updated_at=timezone('utc',now())
    where slug='golden-oremar' and coalesce((public_config#>>'{businessIdentity,legalDocumentsFinalized}')::boolean,false)=true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invalidate_business_legal_finalization_on_document_change on public.content_entries;
create trigger trg_invalidate_business_legal_finalization_on_document_change
after insert or update of title,summary,body_markdown,status,locale,deleted_at on public.content_entries
for each row execute function private.invalidate_business_legal_finalization_on_document_change_v1();
