-- Notification preferences v2: categories tied to real app events, per-channel
-- choices and quiet hours, enforced where notifications are created.
--
-- Channels that really exist: the in-app inbox (public.notifications) and
-- phone push (private.push_deliveries, sent by the push-dispatch function to
-- the Android app). There is no per-category e-mail or SMS, so none is
-- offered. Legally required payment receipts are always e-mailed.
--
-- Event categories and where they come from:
--   harvest          process_product_sales_windows_v1 (kind product_preorder_open)
--   restock          dispatch_stock_alerts_v1 (system row with productId + sellableQuantity)
--   review_reminder  notify_order_delivered_review_request_v1 (kind review_request)
--   campaign         admin_broadcast_notification_v1 with type campaign
--   everything else  its notifications.type (order, shipment, payment, ...)
--
-- Engagement categories (harvest, restock, review_reminder, campaign) can be
-- switched off in the inbox too: the row is simply not created. Transactional
-- categories (order, shipment, payment, return, message, review replies,
-- producer, account/security) always reach the inbox; only their push can be
-- switched off. Quiet hours (Europe/Istanbul) hold back push for everything
-- except account and security notices; the inbox row is still created.

alter table private.user_notification_preferences
  add column if not exists harvest_inapp boolean not null default true,
  add column if not exists harvest_push boolean not null default true,
  add column if not exists restock_inapp boolean not null default true,
  add column if not exists restock_push boolean not null default true,
  add column if not exists review_reminder_inapp boolean not null default true,
  add column if not exists review_reminder_push boolean not null default true,
  add column if not exists campaign_inapp boolean not null default true,
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start time not null default '22:00',
  add column if not exists quiet_hours_end time not null default '08:00';

create or replace function private.notification_category_v1(p_type text, p_metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type = 'order' and coalesce(p_metadata ->> 'kind', '') = 'product_preorder_open' then 'harvest'
    when p_type = 'system' and coalesce(p_metadata, '{}'::jsonb) ? 'productId' and coalesce(p_metadata, '{}'::jsonb) ? 'sellableQuantity' then 'restock'
    when p_type = 'review' and coalesce(p_metadata ->> 'kind', '') = 'review_request' then 'review_reminder'
    else coalesce(p_type, 'system')
  end;
$$;

create or replace function private.in_quiet_hours_v1(p_enabled boolean, p_start time, p_end time, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when not coalesce(p_enabled, false) or p_start is null or p_end is null or p_start = p_end then false
    when p_start < p_end then (p_at at time zone 'Europe/Istanbul')::time >= p_start and (p_at at time zone 'Europe/Istanbul')::time < p_end
    else (p_at at time zone 'Europe/Istanbul')::time >= p_start or (p_at at time zone 'Europe/Istanbul')::time < p_end
  end;
$$;

-- Inbox gate for the engagement categories.
create or replace function private.apply_notification_preferences_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category text := private.notification_category_v1(new.type, new.metadata);
  pref private.user_notification_preferences%rowtype;
begin
  if category not in ('harvest', 'restock', 'review_reminder', 'campaign') then
    return new;
  end if;
  select * into pref from private.user_notification_preferences where user_id = new.user_id;
  if pref.user_id is null then
    return new;
  end if;
  if (category = 'harvest' and not pref.harvest_inapp)
     or (category = 'restock' and not pref.restock_inapp)
     or (category = 'review_reminder' and not pref.review_reminder_inapp)
     or (category = 'campaign' and not pref.campaign_inapp) then
    return null;
  end if;
  return new;
end;
$$;

-- Runs before localize_order_status_notification_v1 (triggers fire by name).
drop trigger if exists apply_notification_preferences_v2 on public.notifications;
create trigger apply_notification_preferences_v2
  before insert on public.notifications
  for each row execute function private.apply_notification_preferences_v2();

create or replace function private.should_queue_push_v2(p_user_id uuid, p_type text, p_metadata jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pref private.user_notification_preferences%rowtype;
  category text := private.notification_category_v1(p_type, p_metadata);
  marketing_allowed boolean := false;
begin
  select * into pref from private.user_notification_preferences where user_id = p_user_id;
  if pref.user_id is not null and not pref.push_enabled then return false; end if;
  if category <> 'system' and pref.user_id is not null
     and private.in_quiet_hours_v1(pref.quiet_hours_enabled, pref.quiet_hours_start, pref.quiet_hours_end) then
    return false;
  end if;
  if category = 'campaign' then
    select marketing_consent into marketing_allowed from public.profiles where id = p_user_id;
    return coalesce(marketing_allowed, false) and coalesce(pref.campaign_push, false);
  end if;
  return case category
    when 'harvest' then coalesce(pref.harvest_push, true)
    when 'restock' then coalesce(pref.restock_push, true)
    when 'review_reminder' then coalesce(pref.review_reminder_push, true)
    when 'order' then coalesce(pref.order_push, true)
    when 'payment' then coalesce(pref.payment_push, true)
    when 'shipment' then coalesce(pref.shipment_push, true)
    when 'return' then coalesce(pref.return_push, true)
    when 'message' then coalesce(pref.message_push, true)
    when 'review' then coalesce(pref.review_push, true)
    when 'producer' then coalesce(pref.producer_push, true)
    else coalesce(pref.system_push, true)
  end;
end;
$$;

-- The v1 function stays for anything that still calls it, now category-aware
-- for the plain types.
create or replace function private.queue_notification_push_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.should_queue_push_v2(new.user_id, new.type, new.metadata) then
    insert into private.push_deliveries(notification_id, user_id, device_token_id)
    select new.id, new.user_id, token.id from private.device_push_tokens token
    where token.user_id = new.user_id and token.disabled_at is null
    on conflict (notification_id, device_token_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.get_my_notification_preferences_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  pref private.user_notification_preferences%rowtype;
  marketing_allowed boolean := false;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into pref from private.user_notification_preferences where user_id = caller_id;
  select coalesce(marketing_consent, false) into marketing_allowed from public.profiles where id = caller_id;
  return jsonb_build_object(
    'pushEnabled', coalesce(pref.push_enabled, true),
    'marketingConsent', coalesce(marketing_allowed, false),
    'categories', jsonb_build_object(
      'order', jsonb_build_object('inApp', true, 'push', coalesce(pref.order_push, true)),
      'shipment', jsonb_build_object('inApp', true, 'push', coalesce(pref.shipment_push, true)),
      'payment', jsonb_build_object('inApp', true, 'push', coalesce(pref.payment_push, true)),
      'return', jsonb_build_object('inApp', true, 'push', coalesce(pref.return_push, true)),
      'message', jsonb_build_object('inApp', true, 'push', coalesce(pref.message_push, true)),
      'review', jsonb_build_object('inApp', true, 'push', coalesce(pref.review_push, true)),
      'producer', jsonb_build_object('inApp', true, 'push', coalesce(pref.producer_push, true)),
      'system', jsonb_build_object('inApp', true, 'push', coalesce(pref.system_push, true)),
      'harvest', jsonb_build_object('inApp', coalesce(pref.harvest_inapp, true), 'push', coalesce(pref.harvest_push, true)),
      'restock', jsonb_build_object('inApp', coalesce(pref.restock_inapp, true), 'push', coalesce(pref.restock_push, true)),
      'review_reminder', jsonb_build_object('inApp', coalesce(pref.review_reminder_inapp, true), 'push', coalesce(pref.review_reminder_push, true)),
      'campaign', jsonb_build_object('inApp', coalesce(pref.campaign_inapp, true), 'push', coalesce(pref.campaign_push, false))
    ),
    'quietHours', jsonb_build_object(
      'enabled', coalesce(pref.quiet_hours_enabled, false),
      'start', to_char(coalesce(pref.quiet_hours_start, '22:00'::time), 'HH24:MI'),
      'end', to_char(coalesce(pref.quiet_hours_end, '08:00'::time), 'HH24:MI'),
      'timeZone', 'Europe/Istanbul'
    ),
    'updatedAt', pref.updated_at
  );
end;
$$;

create or replace function private.update_my_notification_preferences_v2(p_preferences jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_value jsonb;
  merged jsonb;
  cats jsonb;
  marketing_allowed boolean := false;
  quiet_start time;
  quiet_end time;
  key_name text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'invalid_preferences' using errcode = '22023';
  end if;
  current_value := private.get_my_notification_preferences_v2();
  cats := current_value -> 'categories';
  if p_preferences ? 'categories' then
    if jsonb_typeof(p_preferences -> 'categories') <> 'object' then raise exception 'invalid_preferences' using errcode = '22023'; end if;
    for key_name in select jsonb_object_keys(p_preferences -> 'categories') loop
      if not cats ? key_name then raise exception 'unknown_notification_category' using errcode = '22023'; end if;
      if jsonb_typeof(p_preferences -> 'categories' -> key_name) <> 'object' then raise exception 'invalid_preferences' using errcode = '22023'; end if;
      cats := jsonb_set(cats, array[key_name], (cats -> key_name) || jsonb_strip_nulls(jsonb_build_object(
        'inApp', case when jsonb_typeof(p_preferences -> 'categories' -> key_name -> 'inApp') = 'boolean' then p_preferences -> 'categories' -> key_name -> 'inApp' end,
        'push', case when jsonb_typeof(p_preferences -> 'categories' -> key_name -> 'push') = 'boolean' then p_preferences -> 'categories' -> key_name -> 'push' end
      )));
    end loop;
  end if;
  merged := current_value || jsonb_build_object('categories', cats);
  if jsonb_typeof(p_preferences -> 'pushEnabled') = 'boolean' then
    merged := merged || jsonb_build_object('pushEnabled', p_preferences -> 'pushEnabled');
  end if;
  if p_preferences ? 'quietHours' then
    if jsonb_typeof(p_preferences -> 'quietHours') <> 'object' then raise exception 'invalid_preferences' using errcode = '22023'; end if;
    merged := jsonb_set(merged, '{quietHours}', (merged -> 'quietHours') || jsonb_strip_nulls(jsonb_build_object(
      'enabled', case when jsonb_typeof(p_preferences -> 'quietHours' -> 'enabled') = 'boolean' then p_preferences -> 'quietHours' -> 'enabled' end,
      'start', case when coalesce(p_preferences -> 'quietHours' ->> 'start', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then p_preferences -> 'quietHours' -> 'start' end,
      'end', case when coalesce(p_preferences -> 'quietHours' ->> 'end', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then p_preferences -> 'quietHours' -> 'end' end
    )));
  end if;
  quiet_start := (merged -> 'quietHours' ->> 'start')::time;
  quiet_end := (merged -> 'quietHours' ->> 'end')::time;
  if (merged -> 'quietHours' ->> 'enabled')::boolean and quiet_start = quiet_end then
    raise exception 'quiet_hours_invalid' using errcode = '22023';
  end if;
  select coalesce(marketing_consent, false) into marketing_allowed from public.profiles where id = caller_id and status = 'active' and deleted_at is null;
  if (merged -> 'categories' -> 'campaign' ->> 'push')::boolean and not coalesce(marketing_allowed, false) then
    raise exception 'campaign_push_requires_marketing_consent' using errcode = '22023';
  end if;

  insert into private.user_notification_preferences(
    user_id, push_enabled, order_push, payment_push, shipment_push, return_push, message_push, review_push, producer_push, system_push, campaign_push,
    harvest_inapp, harvest_push, restock_inapp, restock_push, review_reminder_inapp, review_reminder_push, campaign_inapp,
    quiet_hours_enabled, quiet_hours_start, quiet_hours_end, updated_at)
  values (
    caller_id, (merged ->> 'pushEnabled')::boolean,
    (merged -> 'categories' -> 'order' ->> 'push')::boolean, (merged -> 'categories' -> 'payment' ->> 'push')::boolean,
    (merged -> 'categories' -> 'shipment' ->> 'push')::boolean, (merged -> 'categories' -> 'return' ->> 'push')::boolean,
    (merged -> 'categories' -> 'message' ->> 'push')::boolean, (merged -> 'categories' -> 'review' ->> 'push')::boolean,
    (merged -> 'categories' -> 'producer' ->> 'push')::boolean, (merged -> 'categories' -> 'system' ->> 'push')::boolean,
    (merged -> 'categories' -> 'campaign' ->> 'push')::boolean,
    (merged -> 'categories' -> 'harvest' ->> 'inApp')::boolean, (merged -> 'categories' -> 'harvest' ->> 'push')::boolean,
    (merged -> 'categories' -> 'restock' ->> 'inApp')::boolean, (merged -> 'categories' -> 'restock' ->> 'push')::boolean,
    (merged -> 'categories' -> 'review_reminder' ->> 'inApp')::boolean, (merged -> 'categories' -> 'review_reminder' ->> 'push')::boolean,
    (merged -> 'categories' -> 'campaign' ->> 'inApp')::boolean,
    (merged -> 'quietHours' ->> 'enabled')::boolean, quiet_start, quiet_end, timezone('utc', now()))
  on conflict (user_id) do update set
    push_enabled = excluded.push_enabled, order_push = excluded.order_push, payment_push = excluded.payment_push,
    shipment_push = excluded.shipment_push, return_push = excluded.return_push, message_push = excluded.message_push,
    review_push = excluded.review_push, producer_push = excluded.producer_push, system_push = excluded.system_push,
    campaign_push = excluded.campaign_push, harvest_inapp = excluded.harvest_inapp, harvest_push = excluded.harvest_push,
    restock_inapp = excluded.restock_inapp, restock_push = excluded.restock_push,
    review_reminder_inapp = excluded.review_reminder_inapp, review_reminder_push = excluded.review_reminder_push,
    campaign_inapp = excluded.campaign_inapp, quiet_hours_enabled = excluded.quiet_hours_enabled,
    quiet_hours_start = excluded.quiet_hours_start, quiet_hours_end = excluded.quiet_hours_end, updated_at = excluded.updated_at;
  return private.get_my_notification_preferences_v2();
end;
$$;

create or replace function public.get_my_notification_preferences_v2()
returns jsonb
language sql
set search_path = ''
as $$ select private.get_my_notification_preferences_v2(); $$;

create or replace function public.update_my_notification_preferences_v2(p_preferences jsonb)
returns jsonb
language sql
set search_path = ''
as $$ select private.update_my_notification_preferences_v2(p_preferences); $$;

revoke all on function private.notification_category_v1(text, jsonb) from public, anon, authenticated;
revoke all on function private.in_quiet_hours_v1(boolean, time, time, timestamptz) from public, anon, authenticated;
revoke all on function private.apply_notification_preferences_v2() from public, anon, authenticated;
revoke all on function private.should_queue_push_v2(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.get_my_notification_preferences_v2() from public, anon;
revoke all on function private.update_my_notification_preferences_v2(jsonb) from public, anon;
grant execute on function private.get_my_notification_preferences_v2() to authenticated;
grant execute on function private.update_my_notification_preferences_v2(jsonb) to authenticated;
revoke all on function public.get_my_notification_preferences_v2() from public, anon;
revoke all on function public.update_my_notification_preferences_v2(jsonb) from public, anon;
grant execute on function public.get_my_notification_preferences_v2() to authenticated;
grant execute on function public.update_my_notification_preferences_v2(jsonb) to authenticated;
