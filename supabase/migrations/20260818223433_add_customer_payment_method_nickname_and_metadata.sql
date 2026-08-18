alter table private.customer_payment_methods
  add column if not exists nickname text,
  add column if not exists billing_country_code text,
  add column if not exists billing_postal_code text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='customer_payment_methods_nickname_check'
  ) then
    alter table private.customer_payment_methods
      add constraint customer_payment_methods_nickname_check
      check (nickname is null or (char_length(btrim(nickname)) between 1 and 40 and nickname !~ '[[:cntrl:]]'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='customer_payment_methods_billing_country_check'
  ) then
    alter table private.customer_payment_methods
      add constraint customer_payment_methods_billing_country_check
      check (billing_country_code is null or billing_country_code ~ '^[A-Z]{2}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname='customer_payment_methods_billing_postal_check'
  ) then
    alter table private.customer_payment_methods
      add constraint customer_payment_methods_billing_postal_check
      check (billing_postal_code is null or (char_length(btrim(billing_postal_code)) between 1 and 30 and billing_postal_code !~ '[[:cntrl:]]'));
  end if;
end $$;

create or replace function public.list_my_payment_methods_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'provider',p.provider,
    'brand',p.brand,
    'last4',p.last4,
    'expMonth',p.exp_month,
    'expYear',p.exp_year,
    'billingName',p.billing_name,
    'nickname',p.nickname,
    'billingCountryCode',p.billing_country_code,
    'billingPostalCode',p.billing_postal_code,
    'isDefault',p.is_default,
    'status',p.status,
    'createdAt',p.created_at
  ) order by p.is_default desc,p.created_at desc),'[]'::jsonb)
  into result
  from private.customer_payment_methods p
  where p.user_id=uid and p.status in ('active','expired');
  return result;
end;
$$;

create or replace function public.update_my_payment_method_metadata_v1(
  p_payment_method_id uuid,
  p_nickname text default null,
  p_billing_name text default null,
  p_billing_country_code text default null,
  p_billing_postal_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  target private.customer_payment_methods%rowtype;
  normalized_nickname text:=nullif(btrim(coalesce(p_nickname,'')),'');
  normalized_name text:=nullif(btrim(coalesce(p_billing_name,'')),'');
  normalized_country text:=nullif(upper(btrim(coalesce(p_billing_country_code,''))),'');
  normalized_postal text:=nullif(btrim(coalesce(p_billing_postal_code,'')),'');
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_payment_method_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  if normalized_nickname is not null and (char_length(normalized_nickname)>40 or normalized_nickname ~ '[[:cntrl:]]') then raise exception 'invalid_payment_method_nickname' using errcode='22023'; end if;
  if normalized_name is not null and (char_length(normalized_name)>120 or normalized_name ~ '[[:cntrl:]]') then raise exception 'invalid_billing_name' using errcode='22023'; end if;
  if normalized_country is not null and normalized_country !~ '^[A-Z]{2}$' then raise exception 'invalid_billing_country' using errcode='22023'; end if;
  if normalized_postal is not null and (char_length(normalized_postal)>30 or normalized_postal ~ '[[:cntrl:]]') then raise exception 'invalid_billing_postal_code' using errcode='22023'; end if;

  select * into target
  from private.customer_payment_methods p
  where p.id=p_payment_method_id and p.user_id=uid and p.status in ('active','expired')
  for update;
  if target.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;

  update private.customer_payment_methods
  set nickname=normalized_nickname,
      billing_name=normalized_name,
      billing_country_code=normalized_country,
      billing_postal_code=normalized_postal,
      updated_at=timezone('utc',now())
  where id=target.id;

  return jsonb_build_object(
    'ok',true,
    'id',target.id,
    'nickname',normalized_nickname,
    'billingName',normalized_name,
    'billingCountryCode',normalized_country,
    'billingPostalCode',normalized_postal
  );
end;
$$;

revoke all on function public.update_my_payment_method_metadata_v1(uuid,text,text,text,text) from public,anon;
grant execute on function public.update_my_payment_method_metadata_v1(uuid,text,text,text,text) to authenticated;

create or replace function private.register_verified_payment_method_v2(
  p_user_id uuid,
  p_provider text,
  p_provider_payment_method_ref text,
  p_brand text,
  p_last4 text,
  p_exp_month smallint default null,
  p_exp_year smallint default null,
  p_billing_name text default null,
  p_nickname text default null,
  p_billing_country_code text default null,
  p_billing_postal_code text default null,
  p_make_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  method_id uuid;
  normalized_provider text:=lower(btrim(coalesce(p_provider,'')));
  normalized_brand text:=btrim(coalesce(p_brand,''));
  normalized_name text:=nullif(btrim(coalesce(p_billing_name,'')),'');
  normalized_nickname text:=nullif(btrim(coalesce(p_nickname,'')),'');
  normalized_country text:=nullif(upper(btrim(coalesce(p_billing_country_code,''))),'');
  normalized_postal text:=nullif(btrim(coalesce(p_billing_postal_code,'')),'');
begin
  if p_user_id is null or not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'user_not_found'; end if;
  if normalized_provider !~ '^[a-z0-9_-]{2,40}$' then raise exception 'invalid_provider'; end if;
  if p_provider_payment_method_ref is null or char_length(p_provider_payment_method_ref) not between 3 and 255 or p_provider_payment_method_ref ~ '[[:cntrl:][:space:]]' then raise exception 'invalid_provider_payment_method_ref'; end if;
  if char_length(normalized_brand) not between 1 and 40 or normalized_brand ~ '[[:cntrl:]]' then raise exception 'invalid_brand'; end if;
  if p_last4 !~ '^[0-9]{4}$' then raise exception 'invalid_last4'; end if;
  if p_exp_month is not null and p_exp_month not between 1 and 12 then raise exception 'invalid_exp_month'; end if;
  if p_exp_year is not null and p_exp_year not between 2024 and 2200 then raise exception 'invalid_exp_year'; end if;
  if normalized_name is not null and (char_length(normalized_name)>120 or normalized_name ~ '[[:cntrl:]]') then raise exception 'invalid_billing_name'; end if;
  if normalized_nickname is not null and (char_length(normalized_nickname)>40 or normalized_nickname ~ '[[:cntrl:]]') then raise exception 'invalid_payment_method_nickname'; end if;
  if normalized_country is not null and normalized_country !~ '^[A-Z]{2}$' then raise exception 'invalid_billing_country'; end if;
  if normalized_postal is not null and (char_length(normalized_postal)>30 or normalized_postal ~ '[[:cntrl:]]') then raise exception 'invalid_billing_postal_code'; end if;

  if coalesce(p_make_default,false) then
    update private.customer_payment_methods set is_default=false,updated_at=timezone('utc',now()) where user_id=p_user_id and is_default=true;
  end if;

  insert into private.customer_payment_methods(
    user_id,provider,provider_payment_method_ref,brand,last4,exp_month,exp_year,billing_name,nickname,billing_country_code,billing_postal_code,is_default,status
  ) values (
    p_user_id,normalized_provider,p_provider_payment_method_ref,normalized_brand,p_last4,p_exp_month,p_exp_year,normalized_name,normalized_nickname,normalized_country,normalized_postal,coalesce(p_make_default,false),'active'
  )
  on conflict(user_id,provider,provider_payment_method_ref) do update set
    brand=excluded.brand,last4=excluded.last4,exp_month=excluded.exp_month,exp_year=excluded.exp_year,
    billing_name=excluded.billing_name,nickname=coalesce(excluded.nickname,private.customer_payment_methods.nickname),
    billing_country_code=excluded.billing_country_code,billing_postal_code=excluded.billing_postal_code,
    is_default=case when excluded.is_default then true else private.customer_payment_methods.is_default end,
    status='active',updated_at=timezone('utc',now())
  returning id into method_id;
  return method_id;
end;
$$;

revoke all on function private.register_verified_payment_method_v2(uuid,text,text,text,text,smallint,smallint,text,text,text,text,boolean) from public,anon,authenticated;