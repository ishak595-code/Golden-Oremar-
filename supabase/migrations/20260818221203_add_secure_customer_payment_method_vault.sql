create table if not exists private.customer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_payment_method_ref text not null,
  brand text not null,
  last4 text not null,
  exp_month smallint,
  exp_year smallint,
  billing_name text,
  is_default boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_payment_methods_provider_check check (provider ~ '^[a-z0-9_-]{2,40}$'),
  constraint customer_payment_methods_provider_ref_check check (char_length(provider_payment_method_ref) between 3 and 255 and provider_payment_method_ref !~ '[[:cntrl:][:space:]]'),
  constraint customer_payment_methods_brand_check check (char_length(brand) between 1 and 40 and brand !~ '[[:cntrl:]]'),
  constraint customer_payment_methods_last4_check check (last4 ~ '^[0-9]{4}$'),
  constraint customer_payment_methods_exp_month_check check (exp_month is null or exp_month between 1 and 12),
  constraint customer_payment_methods_exp_year_check check (exp_year is null or exp_year between 2024 and 2200),
  constraint customer_payment_methods_billing_name_check check (billing_name is null or (char_length(btrim(billing_name)) between 2 and 120 and billing_name !~ '[[:cntrl:]]')),
  constraint customer_payment_methods_status_check check (status in ('active','expired','removed')),
  unique(user_id, provider, provider_payment_method_ref)
);

create index if not exists customer_payment_methods_user_status_idx on private.customer_payment_methods(user_id,status,created_at desc);
create unique index if not exists customer_payment_methods_one_default_idx on private.customer_payment_methods(user_id) where is_default and status='active';

revoke all on private.customer_payment_methods from public, anon, authenticated;
grant select, insert, update, delete on private.customer_payment_methods to service_role;

create or replace function public.list_my_payment_methods_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'provider',p.provider,'brand',p.brand,'last4',p.last4,'expMonth',p.exp_month,'expYear',p.exp_year,
    'billingName',p.billing_name,'isDefault',p.is_default,'status',p.status,'createdAt',p.created_at
  ) order by p.is_default desc,p.created_at desc),'[]'::jsonb)
  into result
  from private.customer_payment_methods p
  where p.user_id=uid and p.status in ('active','expired');
  return result;
end;
$function$;
revoke all on function public.list_my_payment_methods_v1() from public, anon;
grant execute on function public.list_my_payment_methods_v1() to authenticated;

create or replace function public.set_my_default_payment_method_v1(p_payment_method_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid(); target private.customer_payment_methods%rowtype;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if p_payment_method_id is null then raise exception 'payment_method_required'; end if;
  select * into target from private.customer_payment_methods p where p.id=p_payment_method_id and p.user_id=uid and p.status='active' for update;
  if target.id is null then raise exception 'payment_method_not_found'; end if;
  update private.customer_payment_methods set is_default=false,updated_at=now() where user_id=uid and is_default=true and id<>target.id;
  update private.customer_payment_methods set is_default=true,updated_at=now() where id=target.id;
  return jsonb_build_object('ok',true,'id',target.id,'isDefault',true);
end;
$function$;
revoke all on function public.set_my_default_payment_method_v1(uuid) from public, anon;
grant execute on function public.set_my_default_payment_method_v1(uuid) to authenticated;

create or replace function private.register_verified_payment_method_v1(
  p_user_id uuid,p_provider text,p_provider_payment_method_ref text,p_brand text,p_last4 text,
  p_exp_month smallint default null,p_exp_year smallint default null,p_billing_name text default null,p_make_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare method_id uuid; normalized_provider text := lower(btrim(coalesce(p_provider,''))); normalized_brand text := btrim(coalesce(p_brand,''));
begin
  if p_user_id is null or not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'user_not_found'; end if;
  if normalized_provider !~ '^[a-z0-9_-]{2,40}$' then raise exception 'invalid_provider'; end if;
  if p_provider_payment_method_ref is null or char_length(p_provider_payment_method_ref) not between 3 and 255 or p_provider_payment_method_ref ~ '[[:cntrl:][:space:]]' then raise exception 'invalid_provider_payment_method_ref'; end if;
  if char_length(normalized_brand) not between 1 and 40 or normalized_brand ~ '[[:cntrl:]]' then raise exception 'invalid_brand'; end if;
  if p_last4 !~ '^[0-9]{4}$' then raise exception 'invalid_last4'; end if;
  if p_exp_month is not null and p_exp_month not between 1 and 12 then raise exception 'invalid_exp_month'; end if;
  if p_exp_year is not null and p_exp_year not between 2024 and 2200 then raise exception 'invalid_exp_year'; end if;
  if p_billing_name is not null and (char_length(btrim(p_billing_name)) not between 2 and 120 or p_billing_name ~ '[[:cntrl:]]') then raise exception 'invalid_billing_name'; end if;
  if coalesce(p_make_default,false) then update private.customer_payment_methods set is_default=false,updated_at=now() where user_id=p_user_id and is_default=true; end if;
  insert into private.customer_payment_methods(user_id,provider,provider_payment_method_ref,brand,last4,exp_month,exp_year,billing_name,is_default,status)
  values(p_user_id,normalized_provider,p_provider_payment_method_ref,normalized_brand,p_last4,p_exp_month,p_exp_year,nullif(btrim(coalesce(p_billing_name,'')),''),coalesce(p_make_default,false),'active')
  on conflict(user_id,provider,provider_payment_method_ref) do update set
    brand=excluded.brand,last4=excluded.last4,exp_month=excluded.exp_month,exp_year=excluded.exp_year,billing_name=excluded.billing_name,
    is_default=case when excluded.is_default then true else private.customer_payment_methods.is_default end,status='active',updated_at=now()
  returning id into method_id;
  return method_id;
end;
$function$;
revoke all on function private.register_verified_payment_method_v1(uuid,text,text,text,text,smallint,smallint,text,boolean) from public, anon, authenticated;
grant execute on function private.register_verified_payment_method_v1(uuid,text,text,text,text,smallint,smallint,text,boolean) to service_role;
