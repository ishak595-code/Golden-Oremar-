create or replace function private.get_my_producer_payment_identity_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  p public.producers%rowtype;
  app public.producer_applications%rowtype;
  kyc private.producer_application_kyc%rowtype;
  account private.producer_payment_accounts%rowtype;
  iban_value text;
  holder_value text;
  source text;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select * into p
  from public.producers
  where owner_user_id=uid and deleted_at is null
  order by created_at desc limit 1;
  if p.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
  if p.status not in('active','suspended') or not p.is_verified then
    raise exception 'verified_producer_required' using errcode='42501';
  end if;
  if p.application_id is null then raise exception 'producer_application_required' using errcode='55000'; end if;

  select * into app
  from public.producer_applications
  where id=p.application_id and applicant_user_id=uid and status='approved';
  if app.id is null then raise exception 'producer_application_not_approved' using errcode='55000'; end if;

  select * into kyc from private.producer_application_kyc where application_id=app.id;
  if kyc.application_id is null then raise exception 'producer_kyc_missing' using errcode='55000'; end if;

  iban_value:=private.decrypt_producer_kyc(kyc.iban_ciphertext);
  holder_value:=nullif(btrim(coalesce(kyc.bank_account_holder,'')),'');
  source:='approved_application';
  if not private.is_valid_tr_iban_v1(iban_value) or holder_value is null then
    raise exception 'producer_bank_identity_incomplete' using errcode='55000';
  end if;

  select * into account from private.producer_payment_accounts where producer_id=p.id;

  insert into private.sensitive_access_log(actor_user_id,resource_type,resource_id,purpose)
  values(uid,'producer_own_bank_identity',p.id,'Satıcı kendi ödeme hesabını finans ekranında görüntüledi.');

  return jsonb_build_object(
    'producerId',p.id,
    'bankAccountHolder',holder_value,
    'iban',upper(regexp_replace(iban_value,'[^A-Za-z0-9]','','g')),
    'kycSource',source,
    'provider',coalesce(account.provider,'iyzico'),
    'paymentAccountStatus',coalesce(account.status,'pending_configuration'),
    'ready',account.status='ready' and account.submerchant_key is not null,
    'updatedAt',kyc.updated_at
  );
end;
$$;

create or replace function public.get_my_producer_payment_identity_v1()
returns jsonb
language sql
security definer
set search_path=''
as $$select private.get_my_producer_payment_identity_v1();$$;

revoke all on function private.get_my_producer_payment_identity_v1() from public,anon;
revoke all on function public.get_my_producer_payment_identity_v1() from public,anon;
grant execute on function public.get_my_producer_payment_identity_v1() to authenticated;

-- Full producer KYC is an application-owner control-plane view. Ordinary admins
-- can review the non-sensitive application snapshot, while Super Admin can open
-- the complete KYC record for payout, compliance and support operations.
create or replace function public.admin_get_producer_application_sensitive_v2(
  p_application_id uuid,
  p_purpose text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not coalesce(private.has_role('super_admin'),false) then
    raise exception 'super_admin_required' using errcode='42501';
  end if;
  return private.admin_get_producer_application_sensitive_v2(p_application_id,p_purpose);
end;
$$;

revoke all on function public.admin_get_producer_application_sensitive_v2(uuid,text) from public,anon;
grant execute on function public.admin_get_producer_application_sensitive_v2(uuid,text) to authenticated;

-- Retire authenticated access to any older public v1 overload without assuming
-- its exact historical signature.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_get_producer_application_sensitive_v1'
  loop
    execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  end loop;
end $$;
