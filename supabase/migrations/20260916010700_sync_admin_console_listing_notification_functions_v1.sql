-- Drift closure: admin console read/write functions - brand configuration
-- retrieval, campaign/category/content/coupon/event listings with aggregate
-- counts, and the notification broadcast pipeline (single-user create, audience
-- count, and scoped broadcast to all/producer/specific).
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_broadcast_notification_v1(p_target_scope text, p_user_id uuid, p_title text, p_message text, p_type text, p_action_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  scope text := lower(btrim(coalesce(p_target_scope,'')));
  normalized_title text := btrim(coalesce(p_title,''));
  normalized_message text := btrim(coalesce(p_message,''));
  normalized_type text := lower(btrim(coalesce(p_type,'system')));
  broadcast_id uuid := gen_random_uuid();
  inserted_count integer := 0;
begin
  if caller_id is null or not private.has_permission('notification.send') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  if scope not in ('all','producer','specific') then
    raise exception 'invalid_notification_target_scope' using errcode='22023';
  end if;
  if scope='specific' and p_user_id is null then
    raise exception 'notification_target_user_required' using errcode='22023';
  end if;
  if char_length(normalized_title) not between 2 and 160 or char_length(normalized_message) not between 2 and 5000 then
    raise exception 'invalid_notification_content' using errcode='22023';
  end if;
  if normalized_type not in ('order','payment','shipment','return','campaign','system','producer') then
    raise exception 'invalid_notification_type' using errcode='22023';
  end if;
  if char_length(coalesce(p_action_url,'')) > 2048 then
    raise exception 'invalid_action_url' using errcode='22023';
  end if;

  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  select audience.user_id, normalized_type, normalized_title, normalized_message,
         nullif(btrim(coalesce(p_action_url,'')),''),
         jsonb_build_object('createdBy',caller_id,'broadcastId',broadcast_id,'targetScope',scope)
  from (
    select p.id as user_id
    from public.profiles p
    where scope='all' and p.status='active' and p.deleted_at is null
    union
    select producer.owner_user_id
    from public.producers producer
    join public.profiles profile on profile.id=producer.owner_user_id
    where scope='producer' and producer.deleted_at is null and producer.status='active'
      and profile.status='active' and profile.deleted_at is null
    union
    select p.id
    from public.profiles p
    where scope='specific' and p.id=p_user_id and p.status='active' and p.deleted_at is null
  ) audience;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception 'notification_audience_empty' using errcode='P0002';
  end if;

  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('notification_broadcast',broadcast_id,'notification.broadcast_created',jsonb_build_object(
    'broadcast_id',broadcast_id,'target_scope',scope,'recipient_count',inserted_count,'type',normalized_type,'actor_user_id',caller_id
  ));

  return jsonb_build_object('broadcastId',broadcast_id,'recipientCount',inserted_count,'type',normalized_type,'targetScope',scope);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_create_platform_notification_v1(p_user_id uuid, p_title text, p_message text, p_type text, p_action_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_message text := btrim(coalesce(p_message, ''));
  normalized_type text := lower(btrim(coalesce(p_type, 'system')));
  notification_id uuid;
begin
  if caller_id is null or not coalesce(private.has_permission('notification.send'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_user_id is null or not exists (select 1 from public.profiles profile where profile.id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if char_length(normalized_title) not between 2 and 160
    or char_length(normalized_message) not between 2 and 5000 then
    raise exception 'invalid_notification_content' using errcode = '22023';
  end if;
  if normalized_type not in ('order', 'payment', 'shipment', 'return', 'campaign', 'system', 'producer') then
    raise exception 'invalid_notification_type' using errcode = '22023';
  end if;
  if char_length(coalesce(p_action_url, '')) > 2048 then
    raise exception 'invalid_action_url' using errcode = '22023';
  end if;

  insert into public.notifications(user_id, type, title, message, action_url, metadata)
  values (
    p_user_id,
    normalized_type,
    normalized_title,
    normalized_message,
    nullif(btrim(coalesce(p_action_url, '')), ''),
    jsonb_build_object('createdBy', caller_id)
  )
  returning id into notification_id;

  return notification_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_get_brand_configuration_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare settings public.brand_settings%rowtype;
begin
  if auth.uid() is null or not private.has_permission('system.read') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  select * into settings from public.brand_settings where slug='golden-oremar';
  if not found then raise exception 'brand_configuration_not_found' using errcode='P0002'; end if;
  return jsonb_build_object(
    'slug',settings.slug,
    'brandName',settings.brand_name,
    'maintenanceMode',settings.maintenance_mode,
    'supportEmail',settings.support_email,
    'supportPhone',settings.support_phone,
    'publicConfig',settings.public_config,
    'updatedAt',settings.updated_at
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_list_categories_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.has_permission('content.read') then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', category.id,
      'parent_id', category.parent_id,
      'slug', category.slug,
      'name', category.name,
      'description', category.description,
      'icon', category.icon,
      'image_path', category.image_path,
      'sort_order', category.sort_order,
      'is_active', category.is_active,
      'product_count', (select count(*) from public.products p where p.category_id=category.id and p.deleted_at is null),
      'published_product_count', (
        select count(*)
        from public.products p
        join public.producers producer on producer.id=p.producer_id
        where p.category_id=category.id and p.status='published' and p.is_active=true and p.deleted_at is null
          and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
      )
    ) order by category.sort_order, category.name)
    from public.categories category
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_list_content_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.has_permission('content.read') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', entry.id,
      'legacy_id', entry.legacy_id,
      'content_type', entry.content_type,
      'slug', entry.slug,
      'title', entry.title,
      'summary', entry.summary,
      'content', entry.body_markdown,
      'image', entry.hero_image_path,
      'related_product_id', entry.related_product_id,
      'related_product_name', product.name,
      'status', entry.status,
      'locale', entry.locale,
      'metadata', entry.metadata,
      'published_at', entry.published_at,
      'created_at', entry.created_at,
      'updated_at', entry.updated_at
    ) order by entry.updated_at desc)
    from public.content_entries entry
    left join public.products product on product.id=entry.related_product_id
    where entry.deleted_at is null
      and entry.content_type in ('blog','recipe','health_guide','product_health')
  ), '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_list_coupons_v1()
 RETURNS TABLE(id uuid, campaign_id uuid, campaign_title text, display_hint text, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, usage_limit integer, per_user_limit integer, reserved_count bigint, consumed_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not coalesce(private.has_permission('campaign.read'),false) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  return query
  select coupon.id,coupon.campaign_id,campaign.title,coupon.display_hint,coupon.status,
         coupon.starts_at,coupon.ends_at,coupon.usage_limit,coupon.per_user_limit,
         count(redemption.id) filter (where redemption.status='reserved')::bigint,
         count(redemption.id) filter (where redemption.status='consumed')::bigint
  from public.coupons coupon
  join public.campaigns campaign on campaign.id=coupon.campaign_id
  left join private.promotion_redemptions redemption on redemption.coupon_id=coupon.id
  group by coupon.id,campaign.title
  order by coupon.created_at desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_list_events_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not private.has_permission('event.read') then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'legacy_id', event.legacy_id,
        'slug', event.slug,
        'title', event.title,
        'description', event.description,
        'image_path', event.image_path,
        'location_name', event.location_name,
        'location_details', event.location_details,
        'starts_at', event.starts_at,
        'ends_at', event.ends_at,
        'capacity', event.capacity,
        'reservation_deadline', event.reservation_deadline,
        'status', event.status,
        'created_at', event.created_at,
        'updated_at', event.updated_at,
        'reservation_count', (select count(*) from public.event_reservations r where r.event_id=event.id and r.status <> 'cancelled'),
        'reserved_guests', (select coalesce(sum(r.guest_count),0) from public.event_reservations r where r.event_id=event.id and r.status <> 'cancelled')
      ) order by event.starts_at desc)
      from public.events event
    ), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', reservation.id,
        'event_id', reservation.event_id,
        'event_title', event.title,
        'event_starts_at', event.starts_at,
        'reservation_code', reservation.reservation_code,
        'user_id', reservation.user_id,
        'guest_name', reservation.guest_name,
        'guest_email', reservation.guest_email,
        'guest_phone', reservation.guest_phone,
        'guest_count', reservation.guest_count,
        'notes', reservation.notes,
        'status', reservation.status,
        'created_at', reservation.created_at,
        'updated_at', reservation.updated_at
      ) order by reservation.created_at desc)
      from public.event_reservations reservation
      join public.events event on event.id=reservation.event_id
    ), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_notification_audience_count_v1(p_target_scope text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  scope text := lower(btrim(coalesce(p_target_scope,'')));
  result integer;
begin
  if auth.uid() is null or not private.has_permission('notification.read') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  if scope not in ('all','producer','specific') then
    raise exception 'invalid_notification_target_scope' using errcode='22023';
  end if;
  if scope='specific' and p_user_id is null then
    raise exception 'notification_target_user_required' using errcode='22023';
  end if;

  if scope='all' then
    select count(*)::integer into result from public.profiles p where p.status='active' and p.deleted_at is null;
  elsif scope='producer' then
    select count(distinct producer.owner_user_id)::integer into result
    from public.producers producer
    join public.profiles profile on profile.id=producer.owner_user_id
    where producer.deleted_at is null and producer.status='active' and profile.status='active' and profile.deleted_at is null;
  else
    select count(*)::integer into result from public.profiles p where p.id=p_user_id and p.status='active' and p.deleted_at is null;
  end if;
  return coalesce(result,0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification_v1(p_target_scope text, p_user_id uuid, p_title text, p_message text, p_type text, p_action_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_broadcast_notification_v1(p_target_scope,p_user_id,p_title,p_message,p_type,p_action_url);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_create_platform_notification_v1(p_user_id uuid, p_title text, p_message text, p_type text, p_action_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_create_platform_notification_v1(
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_action_url
  );
$function$
;

CREATE OR REPLACE FUNCTION public.admin_get_brand_configuration_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.admin_get_brand_configuration_v1(); $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_campaigns()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  if not coalesce(private.has_permission('campaign.read'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', campaign.id,
        'slug', campaign.slug,
        'title', campaign.title,
        'description', campaign.description,
        'banner_path', campaign.banner_path,
        'discount_type', campaign.discount_type,
        'discount_value', campaign.discount_value,
        'currency', campaign.currency,
        'minimum_order_minor', campaign.minimum_order_minor,
        'usage_limit', campaign.usage_limit,
        'per_user_limit', campaign.per_user_limit,
        'starts_at', campaign.starts_at,
        'ends_at', campaign.ends_at,
        'status', campaign.status,
        'target_scope', campaign.target_scope,
        'target_ids', case campaign.target_scope
          when 'products' then coalesce(
            (
              select jsonb_agg(link.product_id order by link.product_id)
              from public.campaign_products link
              where link.campaign_id = campaign.id
            ),
            '[]'::jsonb
          )
          when 'categories' then coalesce(
            (
              select jsonb_agg(link.category_id order by link.category_id)
              from public.campaign_categories link
              where link.campaign_id = campaign.id
            ),
            '[]'::jsonb
          )
          else '[]'::jsonb
        end,
        'created_at', campaign.created_at,
        'updated_at', campaign.updated_at
      )
      order by campaign.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from public.campaigns campaign;

  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_categories_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.admin_list_categories_v1();
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_content_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.admin_list_content_v1(); $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_coupons_v1()
 RETURNS TABLE(id uuid, campaign_id uuid, campaign_title text, display_hint text, status text, starts_at timestamp with time zone, ends_at timestamp with time zone, usage_limit integer, per_user_limit integer, reserved_count bigint, consumed_count bigint)
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from private.admin_list_coupons_v1(); $function$
;

CREATE OR REPLACE FUNCTION public.admin_list_events_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.admin_list_events_v1();
$function$
;

CREATE OR REPLACE FUNCTION public.admin_notification_audience_count_v1(p_target_scope text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.admin_notification_audience_count_v1(p_target_scope,p_user_id);
$function$
;
