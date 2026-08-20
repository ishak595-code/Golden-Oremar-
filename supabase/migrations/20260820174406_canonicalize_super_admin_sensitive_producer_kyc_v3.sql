create or replace function private.admin_get_producer_application_sensitive_v3(
  p_application_id uuid,
  p_purpose text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  result jsonb;
begin
  if caller_id is null or not coalesce(private.has_role('super_admin'),false) then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  if p_application_id is null then
    raise exception 'producer_application_required' using errcode='22023';
  end if;
  if char_length(btrim(coalesce(p_purpose,''))) not between 10 and 200 then
    raise exception 'sensitive_access_purpose_required' using errcode='22023';
  end if;

  select jsonb_build_object(
    'application_id',a.id,
    'legal_name',k.legal_name,
    'national_id',private.decrypt_producer_kyc(k.national_id_ciphertext),
    'tax_number',private.decrypt_producer_kyc(k.tax_number_ciphertext),
    'tax_office',k.tax_office,
    'mersis_number',private.decrypt_producer_kyc(k.mersis_number_ciphertext),
    'tax_exemption_number',private.decrypt_producer_kyc(k.tax_exemption_number_ciphertext),
    'food_registration_number',private.decrypt_producer_kyc(k.food_registration_number_ciphertext),
    'organic_certificate_number',private.decrypt_producer_kyc(k.organic_certificate_number_ciphertext),
    'iban',private.decrypt_producer_kyc(k.iban_ciphertext),
    'bank_account_holder',k.bank_account_holder,
    'phone',k.phone,
    'contact_email',k.contact_email,
    'address',k.address,
    'consent_version',k.consent_version,
    'consented_at',k.consented_at
  ) into result
  from public.producer_applications a
  join private.producer_application_kyc k on k.application_id=a.id
  where a.id=p_application_id;

  if result is null then
    raise exception 'producer_application_not_found' using errcode='P0002';
  end if;

  insert into private.sensitive_access_log(actor_user_id,resource_type,resource_id,purpose)
  values(caller_id,'producer_application_kyc',p_application_id,btrim(p_purpose));

  return result;
end;
$$;

create or replace function public.admin_get_producer_application_sensitive_v3(
  p_application_id uuid,
  p_purpose text
)
returns jsonb
language sql
set search_path=''
as $$select private.admin_get_producer_application_sensitive_v3(p_application_id,p_purpose);$$;

revoke all on function private.admin_get_producer_application_sensitive_v3(uuid,text) from public,anon;
grant execute on function private.admin_get_producer_application_sensitive_v3(uuid,text) to authenticated,service_role;
revoke all on function public.admin_get_producer_application_sensitive_v3(uuid,text) from public,anon;
grant execute on function public.admin_get_producer_application_sensitive_v3(uuid,text) to authenticated;

-- v3 is the single public full-KYC endpoint. Remove obsolete v1/v2 entrypoints
-- regardless of their exact historical overload signature.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in('admin_get_producer_application_sensitive_v1','admin_get_producer_application_sensitive_v2')
  loop
    execute format('drop function if exists %s',r.signature);
  end loop;

  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname in('admin_get_producer_application_sensitive_v1','admin_get_producer_application_sensitive_v2')
  loop
    execute format('drop function if exists %s',r.signature);
  end loop;
end $$;
