create table if not exists private.order_payment_preferences (
  order_id uuid primary key references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_method_id uuid not null references private.customer_payment_methods(id),
  provider text not null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now())
);

create index if not exists order_payment_preferences_user_id_idx on private.order_payment_preferences(user_id,created_at desc);
create index if not exists order_payment_preferences_payment_method_id_idx on private.order_payment_preferences(payment_method_id);
revoke all on table private.order_payment_preferences from public,anon,authenticated;

create or replace function private.create_customer_order_v5(
  p_items jsonb,
  p_shipping_address jsonb,
  p_customer_note text,
  p_coupon_code text,
  p_gift jsonb,
  p_payment_method_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  payment_config jsonb;
  live_card_payments boolean:=false;
  configured_provider text;
  selected_method private.customer_payment_methods%rowtype;
  base jsonb;
  order_id_value uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select coalesce(bs.public_config->'payments','{}'::jsonb)
  into payment_config
  from public.brand_settings bs
  where bs.slug='golden-oremar'
  limit 1;
  if payment_config is null then payment_config:='{}'::jsonb; end if;

  live_card_payments:=coalesce((payment_config->>'live_card_payments_enabled')::boolean,false);
  configured_provider:=nullif(lower(btrim(coalesce(payment_config->>'provider',''))),'');

  if p_payment_method_id is not null then
    select * into selected_method
    from private.customer_payment_methods p
    where p.id=p_payment_method_id and p.user_id=caller_id and p.status='active'
    for update;
    if selected_method.id is null then raise exception 'payment_method_not_found' using errcode='P0002'; end if;
    if selected_method.exp_year is not null and selected_method.exp_month is not null
       and make_date(selected_method.exp_year,selected_method.exp_month,1) < date_trunc('month',timezone('utc',now()))::date then
      raise exception 'payment_method_expired' using errcode='22023';
    end if;
    if live_card_payments and configured_provider is not null and selected_method.provider<>configured_provider then
      raise exception 'payment_method_provider_mismatch' using errcode='22023';
    end if;
  elsif live_card_payments then
    raise exception 'payment_method_required' using errcode='22023';
  end if;

  base:=private.create_customer_order_v4(
    p_items,p_shipping_address,p_customer_note,p_coupon_code,p_gift,p_idempotency_key
  );
  order_id_value:=(base->>'orderId')::uuid;

  if p_payment_method_id is not null then
    insert into private.order_payment_preferences(order_id,user_id,payment_method_id,provider)
    values(order_id_value,caller_id,selected_method.id,selected_method.provider)
    on conflict(order_id) do update set
      payment_method_id=excluded.payment_method_id,
      provider=excluded.provider,
      updated_at=timezone('utc',now())
    where private.order_payment_preferences.user_id=caller_id;

    insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
    values(
      'order',order_id_value,'order.payment_method_selected',
      jsonb_build_object(
        'order_id',order_id_value,
        'user_id',caller_id,
        'payment_method_id',selected_method.id,
        'provider',selected_method.provider,
        'last4',selected_method.last4,
        'brand',selected_method.brand
      )
    );

    base:=base||jsonb_build_object(
      'paymentMethod',jsonb_build_object(
        'id',selected_method.id,
        'provider',selected_method.provider,
        'brand',selected_method.brand,
        'last4',selected_method.last4,
        'nickname',selected_method.nickname
      )
    );
  else
    base:=base||jsonb_build_object('paymentMethod',null);
  end if;
  return base;
end;
$$;

create or replace function public.create_customer_order_v5(
  p_items jsonb,
  p_shipping_address jsonb,
  p_customer_note text,
  p_coupon_code text,
  p_gift jsonb,
  p_payment_method_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
set search_path=''
as $$
  select private.create_customer_order_v5(
    p_items,p_shipping_address,p_customer_note,p_coupon_code,p_gift,p_payment_method_id,p_idempotency_key
  );
$$;

revoke all on function public.create_customer_order_v5(jsonb,jsonb,text,text,jsonb,uuid,text) from public,anon;
grant execute on function public.create_customer_order_v5(jsonb,jsonb,text,text,jsonb,uuid,text) to authenticated;
revoke all on function public.create_customer_order_v4(jsonb,jsonb,text,text,jsonb,text) from public,anon,authenticated;