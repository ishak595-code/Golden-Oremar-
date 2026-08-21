create table if not exists private.payment_provider_customers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_customer_ref text not null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  primary key(user_id,provider),
  unique(provider,provider_customer_ref),
  constraint payment_provider_customers_provider_check check(provider ~ '^[a-z0-9_-]{2,40}$'),
  constraint payment_provider_customers_ref_check check(char_length(provider_customer_ref) between 3 and 255 and provider_customer_ref !~ '[[:cntrl:][:space:]]')
);
revoke all on table private.payment_provider_customers from public,anon,authenticated;

create or replace function public.get_provider_customer_ref_for_service_v1(p_user_id uuid,p_provider text)
returns text language plpgsql stable security definer set search_path='' as $$
declare normalized_provider text:=lower(btrim(coalesce(p_provider,''))); result text;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_user_id is null or normalized_provider !~ '^[a-z0-9_-]{2,40}$' then raise exception 'invalid_provider_customer_request' using errcode='22023'; end if;
  select c.provider_customer_ref into result from private.payment_provider_customers c where c.user_id=p_user_id and c.provider=normalized_provider;
  return result;
end; $$;

create or replace function public.store_verified_provider_payment_method_v1(
  p_user_id uuid,p_provider text,p_provider_customer_ref text,p_provider_payment_method_ref text,p_brand text,p_last4 text,
  p_exp_month smallint default null,p_exp_year smallint default null,p_billing_name text default null,p_nickname text default null,
  p_billing_country_code text default null,p_billing_postal_code text default null,p_make_default boolean default false
)
returns uuid language plpgsql security definer set search_path='' as $$
declare normalized_provider text:=lower(btrim(coalesce(p_provider,''))); customer_ref text:=btrim(coalesce(p_provider_customer_ref,'')); method_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_user_id is null or normalized_provider !~ '^[a-z0-9_-]{2,40}$' then raise exception 'invalid_provider_payment_method_request' using errcode='22023'; end if;
  if char_length(customer_ref) not between 3 and 255 or customer_ref ~ '[[:cntrl:][:space:]]' then raise exception 'invalid_provider_customer_ref' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.status='active' and p.deleted_at is null) then raise exception 'active_profile_required' using errcode='42501'; end if;
  insert into private.payment_provider_customers(user_id,provider,provider_customer_ref)
  values(p_user_id,normalized_provider,customer_ref)
  on conflict(user_id,provider) do update set provider_customer_ref=excluded.provider_customer_ref,updated_at=timezone('utc',now());
  method_id:=private.register_verified_payment_method_v2(p_user_id,normalized_provider,p_provider_payment_method_ref,p_brand,p_last4,p_exp_month,p_exp_year,p_billing_name,p_nickname,p_billing_country_code,p_billing_postal_code,p_make_default);
  return method_id;
end; $$;

create or replace function public.get_provider_payment_method_for_service_v1(p_user_id uuid,p_payment_method_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_user_id is null or p_payment_method_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  select jsonb_build_object('id',p.id,'provider',p.provider,'providerPaymentMethodRef',p.provider_payment_method_ref,'providerCustomerRef',c.provider_customer_ref,'isDefault',p.is_default,'status',p.status)
  into result from private.customer_payment_methods p left join private.payment_provider_customers c on c.user_id=p.user_id and c.provider=p.provider
  where p.id=p_payment_method_id and p.user_id=p_user_id and p.status in('active','expired');
  if result is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  return result;
end; $$;

create or replace function public.finalize_provider_payment_method_removal_v1(p_user_id uuid,p_payment_method_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target private.customer_payment_methods%rowtype; next_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  if p_user_id is null or p_payment_method_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  select * into target from private.customer_payment_methods p where p.id=p_payment_method_id and p.user_id=p_user_id and p.status in('active','expired') for update;
  if target.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  update private.customer_payment_methods set status='revoked',is_default=false,updated_at=timezone('utc',now()) where id=target.id;
  if target.is_default then
    select p.id into next_id from private.customer_payment_methods p where p.user_id=p_user_id and p.status='active' and p.id<>target.id order by p.created_at desc limit 1;
    if next_id is not null then update private.customer_payment_methods set is_default=true,updated_at=timezone('utc',now()) where id=next_id; end if;
  end if;
  return jsonb_build_object('ok',true,'removedId',target.id,'newDefaultId',next_id);
end; $$;

revoke all on function public.get_provider_customer_ref_for_service_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.store_verified_provider_payment_method_v1(uuid,text,text,text,text,text,smallint,smallint,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.get_provider_payment_method_for_service_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finalize_provider_payment_method_removal_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_provider_customer_ref_for_service_v1(uuid,text) to service_role;
grant execute on function public.store_verified_provider_payment_method_v1(uuid,text,text,text,text,text,smallint,smallint,text,text,text,text,boolean) to service_role;
grant execute on function public.get_provider_payment_method_for_service_v1(uuid,uuid) to service_role;
grant execute on function public.finalize_provider_payment_method_removal_v1(uuid,uuid) to service_role;