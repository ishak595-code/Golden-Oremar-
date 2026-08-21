create or replace function private.list_my_payment_methods_impl_v2()
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

create or replace function private.set_my_default_payment_method_impl_v2(p_payment_method_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  target private.customer_payment_methods%rowtype;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_payment_method_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,86111));
  select * into target
  from private.customer_payment_methods p
  where p.id=p_payment_method_id and p.user_id=uid and p.status='active'
  for update;
  if target.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  update private.customer_payment_methods
  set is_default=false,updated_at=timezone('utc',now())
  where user_id=uid and is_default=true and id<>target.id;
  update private.customer_payment_methods
  set is_default=true,updated_at=timezone('utc',now())
  where id=target.id;
  return jsonb_build_object('ok',true,'id',target.id,'isDefault',true);
end;
$$;

create or replace function private.update_my_payment_method_metadata_impl_v2(
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
  if normalized_name is not null and (char_length(normalized_name) not between 2 and 120 or normalized_name ~ '[[:cntrl:]]') then raise exception 'invalid_billing_name' using errcode='22023'; end if;
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
    'ok',true,'id',target.id,'nickname',normalized_nickname,'billingName',normalized_name,
    'billingCountryCode',normalized_country,'billingPostalCode',normalized_postal
  );
end;
$$;

create or replace function private.remove_my_payment_method_impl_v2(p_payment_method_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  target private.customer_payment_methods%rowtype;
  replacement_id uuid;
begin
  if uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_payment_method_id is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,86112));
  select * into target
  from private.customer_payment_methods p
  where p.id=p_payment_method_id and p.user_id=uid and p.status in ('active','expired')
  for update;
  if target.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
  update private.customer_payment_methods
  set status='removed',is_default=false,updated_at=timezone('utc',now())
  where id=target.id;
  if target.is_default then
    select p.id into replacement_id
    from private.customer_payment_methods p
    where p.user_id=uid and p.status='active' and p.id<>target.id
    order by p.created_at desc,p.id
    limit 1
    for update;
    if replacement_id is not null then
      update private.customer_payment_methods
      set is_default=true,updated_at=timezone('utc',now())
      where id=replacement_id;
    end if;
  end if;
  return jsonb_build_object('ok',true,'removedId',target.id,'newDefaultId',replacement_id);
end;
$$;

revoke all on function private.list_my_payment_methods_impl_v2() from public,anon;
revoke all on function private.set_my_default_payment_method_impl_v2(uuid) from public,anon;
revoke all on function private.update_my_payment_method_metadata_impl_v2(uuid,text,text,text,text) from public,anon;
revoke all on function private.remove_my_payment_method_impl_v2(uuid) from public,anon;
grant execute on function private.list_my_payment_methods_impl_v2() to authenticated;
grant execute on function private.set_my_default_payment_method_impl_v2(uuid) to authenticated;
grant execute on function private.update_my_payment_method_metadata_impl_v2(uuid,text,text,text,text) to authenticated;
grant execute on function private.remove_my_payment_method_impl_v2(uuid) to authenticated;

create or replace function public.list_my_payment_methods_v1()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$ select private.list_my_payment_methods_impl_v2(); $$;

create or replace function public.set_my_default_payment_method_v1(p_payment_method_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.set_my_default_payment_method_impl_v2(p_payment_method_id); $$;

create or replace function public.update_my_payment_method_metadata_v1(
  p_payment_method_id uuid,
  p_nickname text default null,
  p_billing_name text default null,
  p_billing_country_code text default null,
  p_billing_postal_code text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.update_my_payment_method_metadata_impl_v2(p_payment_method_id,p_nickname,p_billing_name,p_billing_country_code,p_billing_postal_code); $$;

create or replace function public.remove_my_payment_method_v1(p_payment_method_id uuid)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.remove_my_payment_method_impl_v2(p_payment_method_id); $$;

revoke all on function public.list_my_payment_methods_v1() from public,anon;
revoke all on function public.set_my_default_payment_method_v1(uuid) from public,anon;
revoke all on function public.update_my_payment_method_metadata_v1(uuid,text,text,text,text) from public,anon;
revoke all on function public.remove_my_payment_method_v1(uuid) from public,anon;
grant execute on function public.list_my_payment_methods_v1() to authenticated;
grant execute on function public.set_my_default_payment_method_v1(uuid) to authenticated;
grant execute on function public.update_my_payment_method_metadata_v1(uuid,text,text,text,text) to authenticated;
grant execute on function public.remove_my_payment_method_v1(uuid) to authenticated;
