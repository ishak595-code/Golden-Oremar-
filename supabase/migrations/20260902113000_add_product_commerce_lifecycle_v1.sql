-- Product-specific preparation options, seasonal selling windows and availability reminders.
-- Price-changing choices remain product_variants. option_schema only describes preparation/packing preferences.

create table if not exists public.product_commerce_profiles (
  product_id uuid primary key references public.products(id) on delete cascade,
  option_schema jsonb not null default '[]'::jsonb,
  seasonality_mode text not null default 'year_round' check (seasonality_mode in ('year_round','seasonal','made_to_order')),
  season_start_month smallint check (season_start_month between 1 and 12),
  season_end_month smallint check (season_end_month between 1 and 12),
  preorder_enabled boolean not null default false,
  preparation_days_min smallint check (preparation_days_min between 0 and 365),
  preparation_days_max smallint check (preparation_days_max between 0 and 365),
  customer_season_note text,
  research_basis text,
  research_source_label text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  constraint product_commerce_option_schema_array check (jsonb_typeof(option_schema)='array'),
  constraint product_commerce_preparation_range check (preparation_days_min is null or preparation_days_max is null or preparation_days_max>=preparation_days_min)
);

create table if not exists public.product_sales_windows (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  season_year integer not null check (season_year between 2020 and 2200),
  preorder_opens_at timestamptz,
  preorder_closes_at timestamptz,
  fulfillment_starts_at timestamptz,
  fulfillment_ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','open','closed','paused')),
  is_confirmed boolean not null default false,
  public_note text,
  internal_note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(product_id,season_year),
  constraint product_sales_window_preorder_range check (preorder_opens_at is null or preorder_closes_at is null or preorder_closes_at>preorder_opens_at),
  constraint product_sales_window_fulfillment_range check (fulfillment_starts_at is null or fulfillment_ends_at is null or fulfillment_ends_at>=fulfillment_starts_at)
);

create table if not exists public.product_availability_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  notify_on_preorder boolean not null default true,
  notify_on_available boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(user_id,product_id)
);

create table if not exists private.product_availability_delivery_log (
  subscription_id uuid not null references public.product_availability_subscriptions(id) on delete cascade,
  sales_window_id uuid not null references public.product_sales_windows(id) on delete cascade,
  event_type text not null check (event_type in ('preorder_open','available')),
  created_at timestamptz not null default timezone('utc',now()),
  primary key(subscription_id,sales_window_id,event_type)
);

create table if not exists public.order_item_preparation_events (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  event_type text not null check (event_type in ('accepted','harvest_planned','catch_planned','preparing','packed','ready','note')),
  note text,
  visible_to_customer boolean not null default true,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  constraint order_item_preparation_note_length check (note is null or char_length(note)<=1000)
);

create index if not exists product_sales_windows_schedule_idx on public.product_sales_windows(is_confirmed,status,preorder_opens_at,preorder_closes_at);
create index if not exists product_availability_subscriptions_active_idx on public.product_availability_subscriptions(product_id,active) where active=true;
create index if not exists order_item_preparation_events_item_idx on public.order_item_preparation_events(order_item_id,created_at);

alter table public.product_commerce_profiles enable row level security;
alter table public.product_sales_windows enable row level security;
alter table public.product_availability_subscriptions enable row level security;
alter table public.order_item_preparation_events enable row level security;

revoke all on public.product_commerce_profiles from anon,authenticated;
revoke all on public.product_sales_windows from anon,authenticated;
revoke all on public.product_availability_subscriptions from anon,authenticated;
revoke all on public.order_item_preparation_events from anon,authenticated;
revoke all on private.product_availability_delivery_log from public;

create or replace function private.normalize_product_option_schema_v1(p_schema jsonb)
returns jsonb
language plpgsql
immutable
security definer
set search_path=''
as $$
declare
  result jsonb:='[]'::jsonb;
  item jsonb;
  choice jsonb;
  visible_when jsonb;
  key_value text;
  label_value text;
  help_value text;
  choice_value text;
  choice_label text;
  seen_keys text[]:='{}';
  seen_choices text[];
  group_count integer:=0;
begin
  if p_schema is null then return '[]'::jsonb; end if;
  if jsonb_typeof(p_schema)<>'array' or jsonb_array_length(p_schema)>8 or pg_column_size(p_schema)>24576 then
    raise exception 'invalid_product_option_schema' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_schema)
  loop
    group_count:=group_count+1;
    if jsonb_typeof(item)<>'object' then raise exception 'invalid_product_option_group' using errcode='22023'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k<>all(array['key','label','help','required','choices','visibleWhen']::text[])) then
      raise exception 'unsupported_product_option_group_field' using errcode='22023';
    end if;
    key_value:=btrim(coalesce(item->>'key',''));
    label_value:=btrim(coalesce(item->>'label',''));
    help_value:=nullif(btrim(coalesce(item->>'help','')),'');
    if key_value !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$' or char_length(label_value) not between 1 and 100 or char_length(coalesce(help_value,''))>240 then
      raise exception 'invalid_product_option_group_identity' using errcode='22023';
    end if;
    if key_value=any(seen_keys) then raise exception 'duplicate_product_option_group:%',key_value using errcode='22023'; end if;
    seen_keys:=array_append(seen_keys,key_value);
    if item ? 'required' and jsonb_typeof(item->'required')<>'boolean' then raise exception 'invalid_product_option_required' using errcode='22023'; end if;
    if not(item ? 'choices') or jsonb_typeof(item->'choices')<>'array' or jsonb_array_length(item->'choices') not between 1 and 12 then
      raise exception 'invalid_product_option_choices' using errcode='22023';
    end if;
    seen_choices:='{}';
    for choice in select value from jsonb_array_elements(item->'choices')
    loop
      if jsonb_typeof(choice)<>'object' or exists(select 1 from jsonb_object_keys(choice) k where k<>all(array['value','label','description']::text[])) then
        raise exception 'invalid_product_option_choice' using errcode='22023';
      end if;
      choice_value:=btrim(coalesce(choice->>'value',''));
      choice_label:=btrim(coalesce(choice->>'label',''));
      if choice_value !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$' or char_length(choice_label) not between 1 and 100 or char_length(coalesce(choice->>'description',''))>240 then
        raise exception 'invalid_product_option_choice_identity' using errcode='22023';
      end if;
      if choice_value=any(seen_choices) then raise exception 'duplicate_product_option_choice:%',choice_value using errcode='22023'; end if;
      seen_choices:=array_append(seen_choices,choice_value);
    end loop;
    visible_when:=item->'visibleWhen';
    if visible_when is not null then
      if jsonb_typeof(visible_when)<>'object' or btrim(coalesce(visible_when->>'key',''))='' or btrim(coalesce(visible_when->>'equals',''))='' or exists(select 1 from jsonb_object_keys(visible_when) k where k<>all(array['key','equals']::text[])) then
        raise exception 'invalid_product_option_visibility' using errcode='22023';
      end if;
    end if;
    result:=result||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'key',key_value,'label',label_value,'help',help_value,'required',coalesce((item->>'required')::boolean,false),
      'choices',item->'choices','visibleWhen',visible_when
    )));
  end loop;
  return result;
end;
$$;

revoke all on function private.normalize_product_option_schema_v1(jsonb) from public;

-- Supersedes the prototype name-derived customization validator. The product's stored option schema is now authoritative.
create or replace function private.normalize_order_customization_v1(p_product_id uuid,p_input jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  schema_value jsonb;
  schema_updated_at timestamptz;
  choices_input jsonb;
  normalized_choices jsonb:='{}'::jsonb;
  normalized_labels jsonb:='{}'::jsonb;
  group_row jsonb;
  choice_row jsonb;
  visible_when jsonb;
  group_key text;
  selected_value text;
  selected_label text;
  visible boolean;
  unknown_key text;
begin
  if p_input is null or p_input='null'::jsonb then return null; end if;
  if jsonb_typeof(p_input)<>'object' or pg_column_size(p_input)>8192 or coalesce(p_input->>'schemaVersion','')<>'1' then
    raise exception 'invalid_order_customization' using errcode='22023';
  end if;
  choices_input:=p_input->'choices';
  if choices_input is null or jsonb_typeof(choices_input)<>'object' or pg_column_size(choices_input)>4096 then
    raise exception 'invalid_order_customization_choices' using errcode='22023';
  end if;
  select profile.option_schema,profile.updated_at into schema_value,schema_updated_at
  from public.product_commerce_profiles profile where profile.product_id=p_product_id;
  if schema_value is null or jsonb_array_length(schema_value)=0 then raise exception 'order_customization_not_supported' using errcode='22023'; end if;
  schema_value:=private.normalize_product_option_schema_v1(schema_value);
  select key into unknown_key from jsonb_object_keys(choices_input) key
  where not exists(select 1 from jsonb_array_elements(schema_value) g where g->>'key'=key) limit 1;
  if unknown_key is not null then raise exception 'unsupported_order_customization_choice:%',unknown_key using errcode='22023'; end if;

  for group_row in select value from jsonb_array_elements(schema_value)
  loop
    group_key:=group_row->>'key';
    visible_when:=group_row->'visibleWhen';
    visible:=visible_when is null or coalesce(choices_input->>(visible_when->>'key'),'')=coalesce(visible_when->>'equals','');
    selected_value:=nullif(btrim(coalesce(choices_input->>group_key,'')),'');
    if not visible then
      if selected_value is not null then raise exception 'hidden_order_customization_choice:%',group_key using errcode='22023'; end if;
      continue;
    end if;
    if coalesce((group_row->>'required')::boolean,false) and selected_value is null then
      raise exception 'required_order_customization_choice:%',group_key using errcode='22023';
    end if;
    if selected_value is null then continue; end if;
    selected_label:=null;
    for choice_row in select value from jsonb_array_elements(group_row->'choices')
    loop
      if choice_row->>'value'=selected_value then selected_label:=choice_row->>'label'; exit; end if;
    end loop;
    if selected_label is null then raise exception 'invalid_order_customization_choice:%',group_key using errcode='22023'; end if;
    normalized_choices:=normalized_choices||jsonb_build_object(group_key,selected_value);
    normalized_labels:=normalized_labels||jsonb_build_object(group_key,jsonb_build_object('group',group_row->>'label','choice',selected_label));
  end loop;
  return jsonb_build_object('schemaVersion',1,'choices',normalized_choices,'labels',normalized_labels,'profileRevision',schema_updated_at);
end;
$$;

revoke all on function private.normalize_order_customization_v1(uuid,jsonb) from public;

create or replace function private.product_commerce_payload_v1(p_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  profile public.product_commerce_profiles%rowtype;
  window_row public.product_sales_windows%rowtype;
  subscriber boolean:=false;
  sales_state text:='year_round';
  caller_id uuid:=auth.uid();
begin
  select * into profile from public.product_commerce_profiles where product_id=p_product_id;
  if profile.product_id is null then return null; end if;
  select * into window_row from public.product_sales_windows w
  where w.product_id=p_product_id and w.is_confirmed=true
  order by case when w.status='open' then 0 when w.preorder_opens_at>=timezone('utc',now()) then 1 else 2 end,
           w.preorder_opens_at nulls last,w.season_year desc limit 1;
  if caller_id is not null then
    select exists(select 1 from public.product_availability_subscriptions s where s.user_id=caller_id and s.product_id=p_product_id and s.active=true) into subscriber;
  end if;
  if window_row.id is not null and window_row.status='open' and (window_row.preorder_closes_at is null or window_row.preorder_closes_at>timezone('utc',now())) then sales_state:='preorder_open';
  elsif window_row.id is not null and window_row.preorder_opens_at>timezone('utc',now()) then sales_state:='scheduled';
  elsif profile.preorder_enabled then sales_state:='planning';
  elsif profile.seasonality_mode='seasonal' then sales_state:='out_of_season';
  elsif profile.seasonality_mode='made_to_order' then sales_state:='made_to_order';
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'optionSchema',profile.option_schema,
    'seasonality',jsonb_build_object('mode',profile.seasonality_mode,'startMonth',profile.season_start_month,'endMonth',profile.season_end_month,'note',profile.customer_season_note),
    'preorder',jsonb_build_object('enabled',profile.preorder_enabled,'preparationDaysMin',profile.preparation_days_min,'preparationDaysMax',profile.preparation_days_max),
    'sales',case when window_row.id is null then jsonb_build_object('state',sales_state,'confirmed',false) else jsonb_build_object('state',sales_state,'confirmed',true,'windowId',window_row.id,'opensAt',window_row.preorder_opens_at,'closesAt',window_row.preorder_closes_at,'fulfillmentStartsAt',window_row.fulfillment_starts_at,'fulfillmentEndsAt',window_row.fulfillment_ends_at,'publicNote',window_row.public_note) end,
    'availabilitySubscribed',subscriber
  ));
end;
$$;

revoke all on function private.product_commerce_payload_v1(uuid) from public;

create or replace function private.get_public_product_detail_v9(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb:=private.get_public_product_detail_v8(p_reference);
  product_id uuid;
  commerce jsonb;
  has_confirmed_window boolean:=false;
  sales_state text;
  variants jsonb;
begin
  if base='{}'::jsonb then return base; end if;
  begin product_id:=(base->>'id')::uuid; exception when others then product_id:=private.resolve_product_id_v1(p_reference); end;
  if product_id is null then return base; end if;
  commerce:=private.product_commerce_payload_v1(product_id);
  if commerce is null then return base; end if;
  sales_state:=commerce#>>'{sales,state}';
  has_confirmed_window:=coalesce((commerce#>>'{sales,confirmed}')::boolean,false);
  if has_confirmed_window and coalesce((commerce#>>'{preorder,enabled}')::boolean,false) and sales_state<>'preorder_open' then
    select coalesce(jsonb_agg(item||jsonb_build_object('available',false) order by ordinality),'[]'::jsonb)
    into variants from jsonb_array_elements(coalesce(base->'variants','[]'::jsonb)) with ordinality rows(item,ordinality);
    base:=jsonb_set(base,'{variants}',variants,true);
  end if;
  return jsonb_set(base,'{commerce}',commerce,true);
end;
$$;

create or replace function api_public_bridge.get_public_product_detail_v6(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select private.get_public_product_detail_v9(p_reference); $$;

create or replace function private.set_product_availability_subscription_v1(p_reference text,p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_id uuid:=private.resolve_product_id_v1(p_reference);
  row_value public.product_availability_subscriptions%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if product_id is null or not exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.is_active=true and p.deleted_at is null) then raise exception 'product_not_available' using errcode='P0002'; end if;
  insert into public.product_availability_subscriptions(user_id,product_id,active,updated_at)
  values(caller_id,product_id,coalesce(p_active,true),timezone('utc',now()))
  on conflict(user_id,product_id) do update set active=excluded.active,updated_at=excluded.updated_at
  returning * into row_value;
  return jsonb_build_object('productId',product_id,'active',row_value.active,'updatedAt',row_value.updated_at);
end;
$$;

create or replace function public.set_product_availability_subscription_v1(p_reference text,p_active boolean)
returns jsonb language sql set search_path='' as $$ select private.set_product_availability_subscription_v1(p_reference,p_active); $$;
revoke all on function public.set_product_availability_subscription_v1(text,boolean) from public;
grant execute on function public.set_product_availability_subscription_v1(text,boolean) to authenticated;

create or replace function private.management_save_product_commerce_profile_v1(p_product_id uuid,p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  producer_owner uuid;
  normalized_schema jsonb;
  mode_value text;
  start_month integer;
  end_month integer;
  prep_min integer;
  prep_max integer;
  result public.product_commerce_profiles%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  if p_profile is null or jsonb_typeof(p_profile)<>'object' or pg_column_size(p_profile)>32768 then raise exception 'invalid_product_commerce_profile' using errcode='22023'; end if;
  select * into product_row from public.products where id=p_product_id and deleted_at is null;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select owner_user_id into producer_owner from public.producers where id=product_row.producer_id;
  if producer_owner is distinct from caller_id and not coalesce(private.has_permission('product.approve'),false) then raise exception 'product_owner_or_admin_required' using errcode='42501'; end if;
  normalized_schema:=private.normalize_product_option_schema_v1(coalesce(p_profile->'optionSchema','[]'::jsonb));
  mode_value:=coalesce(nullif(btrim(p_profile->>'seasonalityMode'),''),'year_round');
  if mode_value not in ('year_round','seasonal','made_to_order') then raise exception 'invalid_seasonality_mode' using errcode='22023'; end if;
  start_month:=nullif(p_profile->>'seasonStartMonth','')::integer;
  end_month:=nullif(p_profile->>'seasonEndMonth','')::integer;
  prep_min:=nullif(p_profile->>'preparationDaysMin','')::integer;
  prep_max:=nullif(p_profile->>'preparationDaysMax','')::integer;
  if start_month is not null and start_month not between 1 and 12 then raise exception 'invalid_season_start_month' using errcode='22023'; end if;
  if end_month is not null and end_month not between 1 and 12 then raise exception 'invalid_season_end_month' using errcode='22023'; end if;
  if prep_min is not null and prep_min not between 0 and 365 then raise exception 'invalid_preparation_days' using errcode='22023'; end if;
  if prep_max is not null and prep_max not between coalesce(prep_min,0) and 365 then raise exception 'invalid_preparation_days' using errcode='22023'; end if;
  insert into public.product_commerce_profiles(product_id,option_schema,seasonality_mode,season_start_month,season_end_month,preorder_enabled,preparation_days_min,preparation_days_max,customer_season_note,research_basis,research_source_label,updated_by,updated_at)
  values(product_row.id,normalized_schema,mode_value,start_month,end_month,coalesce((p_profile->>'preorderEnabled')::boolean,false),prep_min,prep_max,nullif(btrim(coalesce(p_profile->>'customerSeasonNote','')),''),nullif(btrim(coalesce(p_profile->>'researchBasis','')),''),nullif(btrim(coalesce(p_profile->>'researchSourceLabel','')),''),caller_id,timezone('utc',now()))
  on conflict(product_id) do update set option_schema=excluded.option_schema,seasonality_mode=excluded.seasonality_mode,season_start_month=excluded.season_start_month,season_end_month=excluded.season_end_month,preorder_enabled=excluded.preorder_enabled,preparation_days_min=excluded.preparation_days_min,preparation_days_max=excluded.preparation_days_max,customer_season_note=excluded.customer_season_note,research_basis=excluded.research_basis,research_source_label=excluded.research_source_label,updated_by=caller_id,updated_at=timezone('utc',now())
  returning * into result;
  update public.products set preorder_lead_days=case when result.preorder_enabled then coalesce(result.preparation_days_max,result.preparation_days_min,preorder_lead_days) else preorder_lead_days end,updated_at=timezone('utc',now()) where id=product_row.id;
  return private.product_commerce_payload_v1(product_row.id);
end;
$$;

create or replace function public.management_save_product_commerce_profile_v1(p_product_id uuid,p_profile jsonb)
returns jsonb language sql set search_path='' as $$ select private.management_save_product_commerce_profile_v1(p_product_id,p_profile); $$;
revoke all on function public.management_save_product_commerce_profile_v1(uuid,jsonb) from public;
grant execute on function public.management_save_product_commerce_profile_v1(uuid,jsonb) to authenticated;

create or replace function private.management_save_product_sales_window_v1(p_product_id uuid,p_window jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  product_row public.products%rowtype;
  owner_id uuid;
  season_year_value integer;
  confirmed_value boolean;
  result public.product_sales_windows%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('product.update'),false) then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  select * into product_row from public.products where id=p_product_id and deleted_at is null;
  if product_row.id is null then raise exception 'product_not_found' using errcode='P0002'; end if;
  select owner_user_id into owner_id from public.producers where id=product_row.producer_id;
  if owner_id is distinct from caller_id and not coalesce(private.has_permission('product.approve'),false) then raise exception 'product_owner_or_admin_required' using errcode='42501'; end if;
  if p_window is null or jsonb_typeof(p_window)<>'object' or pg_column_size(p_window)>16384 then raise exception 'invalid_product_sales_window' using errcode='22023'; end if;
  season_year_value:=coalesce(nullif(p_window->>'seasonYear','')::integer,extract(year from timezone('utc',now()))::integer);
  confirmed_value:=coalesce((p_window->>'confirmed')::boolean,false);
  if confirmed_value and not coalesce(private.has_permission('product.approve'),false) then raise exception 'permission_required:product.approve' using errcode='42501'; end if;
  insert into public.product_sales_windows(product_id,season_year,preorder_opens_at,preorder_closes_at,fulfillment_starts_at,fulfillment_ends_at,status,is_confirmed,public_note,internal_note,updated_by,updated_at)
  values(product_row.id,season_year_value,nullif(p_window->>'opensAt','')::timestamptz,nullif(p_window->>'closesAt','')::timestamptz,nullif(p_window->>'fulfillmentStartsAt','')::timestamptz,nullif(p_window->>'fulfillmentEndsAt','')::timestamptz,case when coalesce(p_window->>'status','scheduled') in ('scheduled','open','closed','paused') then coalesce(p_window->>'status','scheduled') else 'scheduled' end,confirmed_value,nullif(btrim(coalesce(p_window->>'publicNote','')),''),nullif(btrim(coalesce(p_window->>'internalNote','')),''),caller_id,timezone('utc',now()))
  on conflict(product_id,season_year) do update set preorder_opens_at=excluded.preorder_opens_at,preorder_closes_at=excluded.preorder_closes_at,fulfillment_starts_at=excluded.fulfillment_starts_at,fulfillment_ends_at=excluded.fulfillment_ends_at,status=excluded.status,is_confirmed=excluded.is_confirmed,public_note=excluded.public_note,internal_note=excluded.internal_note,updated_by=caller_id,updated_at=timezone('utc',now())
  returning * into result;
  return jsonb_build_object('id',result.id,'productId',result.product_id,'seasonYear',result.season_year,'status',result.status,'confirmed',result.is_confirmed,'opensAt',result.preorder_opens_at,'closesAt',result.preorder_closes_at,'fulfillmentStartsAt',result.fulfillment_starts_at,'fulfillmentEndsAt',result.fulfillment_ends_at,'publicNote',result.public_note);
end;
$$;

create or replace function public.management_save_product_sales_window_v1(p_product_id uuid,p_window jsonb)
returns jsonb language sql set search_path='' as $$ select private.management_save_product_sales_window_v1(p_product_id,p_window); $$;
revoke all on function public.management_save_product_sales_window_v1(uuid,jsonb) from public;
grant execute on function public.management_save_product_sales_window_v1(uuid,jsonb) to authenticated;

create or replace function private.process_product_sales_windows_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  opened_count integer:=0;
  closed_count integer:=0;
  notification_count integer:=0;
begin
  with updated as (
    update public.product_sales_windows w set status='open',updated_at=timezone('utc',now())
    where w.is_confirmed=true and w.status='scheduled' and w.preorder_opens_at is not null and w.preorder_opens_at<=timezone('utc',now()) and (w.preorder_closes_at is null or w.preorder_closes_at>timezone('utc',now()))
    returning id
  ) select count(*) into opened_count from updated;
  with updated as (
    update public.product_sales_windows w set status='closed',updated_at=timezone('utc',now())
    where w.is_confirmed=true and w.status='open' and w.preorder_closes_at is not null and w.preorder_closes_at<=timezone('utc',now()) returning id
  ) select count(*) into closed_count from updated;

  with candidates as (
    select s.id subscription_id,s.user_id,w.id window_id,p.slug,p.name
    from public.product_sales_windows w
    join public.product_availability_subscriptions s on s.product_id=w.product_id and s.active=true and s.notify_on_preorder=true
    join public.products p on p.id=w.product_id
    where w.is_confirmed=true and w.status='open' and p.status='published' and p.is_active=true and p.deleted_at is null
  ), claimed as (
    insert into private.product_availability_delivery_log(subscription_id,sales_window_id,event_type)
    select c.subscription_id,c.window_id,'preorder_open' from candidates c
    on conflict do nothing returning subscription_id,sales_window_id
  ), messages as (
    select c.user_id,c.slug,c.name,c.window_id from candidates c join claimed x on x.subscription_id=c.subscription_id and x.sales_window_id=c.window_id
  ), inserted as (
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    select m.user_id,'product_preorder_open','Sipariş dönemi açıldı',m.name||' için sipariş dönemi açıldı. Ürün sayfasından hazırlama seçeneklerini seçerek sipariş verebilirsiniz.','/?tab=product-detail&product='||m.slug,jsonb_build_object('productSlug',m.slug,'salesWindowId',m.window_id)
    from messages m returning id
  ) select count(*) into notification_count from inserted;
  return jsonb_build_object('opened',opened_count,'closed',closed_count,'notifications',notification_count);
end;
$$;

revoke all on function private.process_product_sales_windows_v1() from public;

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') and not exists(select 1 from cron.job where jobname='golden-oremar-product-sales-window-worker') then
    perform cron.schedule('golden-oremar-product-sales-window-worker','*/15 * * * *','select private.process_product_sales_windows_v1();');
  end if;
exception when undefined_table or insufficient_privilege then null;
end;
$$;

create or replace function private.management_add_order_item_preparation_event_v1(p_order_item_id uuid,p_event_type text,p_note text,p_visible_to_customer boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  caller_id uuid:=auth.uid();
  item public.order_items%rowtype;
  owner_id uuid;
  order_user_id uuid;
  order_id_value uuid;
  product_slug text;
  event_id uuid;
  label text;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into item from public.order_items where id=p_order_item_id;
  if item.id is null then raise exception 'order_item_not_found' using errcode='P0002'; end if;
  select owner_user_id into owner_id from public.producers where id=item.producer_id;
  if owner_id is distinct from caller_id and not coalesce(private.has_permission('order.update'),false) then raise exception 'order_owner_or_admin_required' using errcode='42501'; end if;
  if p_event_type not in ('accepted','harvest_planned','catch_planned','preparing','packed','ready','note') then raise exception 'invalid_preparation_event_type' using errcode='22023'; end if;
  if char_length(coalesce(p_note,''))>1000 then raise exception 'preparation_note_too_long' using errcode='22023'; end if;
  insert into public.order_item_preparation_events(order_item_id,event_type,note,visible_to_customer,actor_user_id)
  values(item.id,p_event_type,nullif(btrim(coalesce(p_note,'')),''),coalesce(p_visible_to_customer,true),caller_id) returning id into event_id;
  if coalesce(p_visible_to_customer,true) then
    select o.user_id,o.id,p.slug into order_user_id,order_id_value,product_slug from public.orders o join public.products p on p.id=item.product_id where o.id=item.order_id;
    label:=case p_event_type when 'accepted' then 'Sipariş hazırlığa alındı' when 'harvest_planned' then 'Hasat planlandı' when 'catch_planned' then 'Av planlandı' when 'preparing' then 'Ürün hazırlanıyor' when 'packed' then 'Paketleme tamamlandı' when 'ready' then 'Ürün gönderime hazır' else 'Siparişinizden haber var' end;
    insert into public.notifications(user_id,type,title,message,action_url,metadata)
    values(order_user_id,'order_preparation',label,item.product_name||case when nullif(btrim(coalesce(p_note,'')),'') is null then ' için hazırlık durumu güncellendi.' else ': '||btrim(p_note) end,'/?tab=account&view=orders:'||order_id_value::text,jsonb_build_object('orderId',order_id_value,'orderItemId',item.id,'productSlug',product_slug,'eventType',p_event_type));
  end if;
  return jsonb_build_object('id',event_id,'orderItemId',item.id,'eventType',p_event_type,'visibleToCustomer',coalesce(p_visible_to_customer,true));
end;
$$;

create or replace function public.management_add_order_item_preparation_event_v1(p_order_item_id uuid,p_event_type text,p_note text,p_visible_to_customer boolean default true)
returns jsonb language sql set search_path='' as $$ select private.management_add_order_item_preparation_event_v1(p_order_item_id,p_event_type,p_note,p_visible_to_customer); $$;
revoke all on function public.management_add_order_item_preparation_event_v1(uuid,text,text,boolean) from public;
grant execute on function public.management_add_order_item_preparation_event_v1(uuid,text,text,boolean) to authenticated;
