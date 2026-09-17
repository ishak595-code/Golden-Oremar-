-- Drift closure: public catalog-adjacent read functions - content entry detail
-- (v1 base plus v2 safety overlay), paginated public content listing, public
-- category listing (v1 raw plus v2 with verified storage paths), and the public
-- events listing with live remaining-capacity and reservability computation.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION api_public_bridge.list_public_categories_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.list_public_categories_v2(); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.list_public_content_v1(p_content_type text, p_locale text DEFAULT 'tr'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.list_public_content_v2(p_content_type,p_locale,p_limit,p_offset); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.list_public_events_v1(p_include_past boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.list_public_events_v2(p_include_past); $function$
;

CREATE OR REPLACE FUNCTION private.get_public_content_entry_v1(p_reference text, p_locale text DEFAULT 'tr'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  entry public.content_entries%rowtype;
  result jsonb;
begin
  if char_length(btrim(coalesce(p_reference,''))) not between 1 and 240 then raise exception 'invalid_content_reference' using errcode='22023'; end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then raise exception 'invalid_locale' using errcode='22023'; end if;
  select item.* into entry
  from public.content_entries item
  where (item.id::text=btrim(p_reference) or item.legacy_id=btrim(p_reference) or item.slug=btrim(p_reference))
    and item.locale=locale_value and item.status='published' and item.deleted_at is null
    and (item.published_at is null or item.published_at<=timezone('utc',now()))
  order by case when item.id::text=btrim(p_reference) then 0 when item.slug=btrim(p_reference) then 1 else 2 end
  limit 1;
  if entry.id is null then raise exception 'content_not_found' using errcode='P0002'; end if;

  select jsonb_build_object(
    'id',entry.id,'legacyId',entry.legacy_id,'type',entry.content_type,'slug',entry.slug,
    'title',entry.title,'summary',entry.summary,'markdown',entry.body_markdown,
    'sanitizedHtml',entry.body_html_sanitized,'heroImagePath',entry.hero_image_path,
    'tags',entry.tags,'publishedAt',entry.published_at,
    'category',nullif(btrim(coalesce(entry.metadata->>'originalCategory','')),''),
    'relatedProduct',case when product.id is null then null else jsonb_build_object(
      'id',product.id,'slug',product.slug,'name',product.name,'origin',product.origin,
      'imagePath',(select image.storage_path from public.product_images image where image.product_id=product.id order by image.is_primary desc,image.sort_order,image.created_at limit 1)
    ) end
  ) into result
  from (select 1) anchor
  left join public.products product on product.id=entry.related_product_id
    and product.status='published' and product.is_active=true and product.deleted_at is null
    and exists(select 1 from public.producers producer where producer.id=product.producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null);
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_public_content_entry_v2(p_reference text, p_locale text DEFAULT 'tr'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  base jsonb;
  safety jsonb;
  entry_id uuid;
begin
  base:=private.get_public_content_entry_v1(p_reference,p_locale);
  entry_id:=(base->>'id')::uuid;
  select coalesce(metadata->'safetyV2','{}'::jsonb)
    into safety
  from public.content_entries
  where id=entry_id;
  return base || jsonb_build_object('safety',coalesce(safety,'{}'::jsonb));
end;
$function$
;

CREATE OR REPLACE FUNCTION private.list_public_categories_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',category.id,
    'parentId',category.parent_id,
    'slug',category.slug,
    'name',category.name,
    'description',category.description,
    'icon',category.icon,
    'imagePath',category.image_path,
    'sortOrder',category.sort_order,
    'productCount',(
      select count(*)
      from public.products product
      join public.producers producer on producer.id=product.producer_id
      where product.category_id=category.id
        and product.status='published' and product.is_active=true and product.deleted_at is null
        and producer.status='active' and producer.is_verified=true and producer.deleted_at is null
    )
  ) order by category.sort_order,category.name),'[]'::jsonb)
  from public.categories category
  where category.is_active=true;
$function$
;

CREATE OR REPLACE FUNCTION private.list_public_categories_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  base jsonb:=private.list_public_categories_v1();
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_set(item,'{imagePath}',coalesce(to_jsonb(private.verified_public_storage_path_v1('catalog-public',item->>'imagePath')),'null'::jsonb),true)
    order by ordinality
  ),'[]'::jsonb) into result
  from jsonb_array_elements(coalesce(base,'[]'::jsonb)) with ordinality as rows(item,ordinality);
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.list_public_content_v1(p_content_type text, p_locale text DEFAULT 'tr'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  type_value text:=lower(btrim(coalesce(p_content_type,'')));
  locale_value text:=lower(btrim(coalesce(p_locale,'tr')));
  result jsonb;
begin
  if type_value not in ('recipe','health_guide','product_health','page','legal') then raise exception 'invalid_content_type' using errcode='22023'; end if;
  if locale_value not in ('tr','en','de','fr','ku','ar') then raise exception 'invalid_locale' using errcode='22023'; end if;
  if p_limit not between 1 and 50 or p_offset<0 then raise exception 'invalid_pagination' using errcode='22023'; end if;

  with eligible as (
    select entry.*
    from public.content_entries entry
    where entry.content_type=type_value and entry.locale=locale_value
      and entry.status='published' and entry.deleted_at is null
      and (entry.published_at is null or entry.published_at<=timezone('utc',now()))
  ), paged as (
    select entry.* from eligible entry
    order by entry.published_at desc nulls last,entry.created_at desc,entry.id
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total',(select count(*) from eligible),
    'limit',p_limit,'offset',p_offset,
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',paged.id,'legacyId',paged.legacy_id,'type',paged.content_type,'slug',paged.slug,
      'title',paged.title,'summary',paged.summary,'heroImagePath',paged.hero_image_path,
      'tags',paged.tags,'publishedAt',paged.published_at,
      'category',nullif(btrim(coalesce(paged.metadata->>'originalCategory','')),''),
      'relatedProduct',case when product.id is null then null else jsonb_build_object(
        'id',product.id,'slug',product.slug,'name',product.name
      ) end
    ) order by paged.published_at desc nulls last,paged.created_at desc,paged.id),'[]'::jsonb)
  ) into result
  from paged
  left join public.products product on product.id=paged.related_product_id
    and product.status='published' and product.is_active=true and product.deleted_at is null
    and exists(select 1 from public.producers producer where producer.id=product.producer_id and producer.status='active' and producer.is_verified=true and producer.deleted_at is null);
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.list_public_events_v1(p_include_past boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  with event_rows as (
    select e.id,e.legacy_id,e.slug,e.title,e.description,e.image_path,e.location_name,e.starts_at,e.ends_at,e.capacity,e.reservation_deadline,e.status,e.ticket_price_minor,e.currency,e.sale_mode,
      coalesce((select sum(r.guest_count)::integer from public.event_reservations r left join private.event_reservation_finance f on f.reservation_id=r.id
        where r.event_id=e.id and (r.status in ('pending','confirmed','attended') or (r.status='pending_payment' and f.payment_status='pending' and f.payment_expires_at>timezone('utc',now())))),0) as reserved_guests
    from public.events e
    where e.status in ('published','sold_out','completed') and (p_include_past or e.ends_at>=timezone('utc',now()))
  )
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',row.id,'legacyId',row.legacy_id,'slug',row.slug,'title',row.title,'description',row.description,'imagePath',row.image_path,'locationName',row.location_name,
      'startsAt',row.starts_at,'endsAt',row.ends_at,
      'status',case when row.status='sold_out' and row.capacity is not null and row.reserved_guests<row.capacity then 'published' else row.status end,
      'capacity',row.capacity,'remainingCapacity',case when row.capacity is null then null else greatest(0,row.capacity-row.reserved_guests) end,
      'reservationDeadline',row.reservation_deadline,
      'reservable',row.status in ('published','sold_out') and row.starts_at>timezone('utc',now()) and (row.reservation_deadline is null or row.reservation_deadline>=timezone('utc',now())),
      'waitlistOnly',case when row.capacity is null then row.status='sold_out' else row.reserved_guests>=row.capacity end,
      'ticketPriceMinor',row.ticket_price_minor,'currency',row.currency,'isPaid',row.ticket_price_minor>0,'saleMode',row.sale_mode
    ) order by case when row.ends_at>=timezone('utc',now()) then 0 else 1 end,case when row.ends_at>=timezone('utc',now()) then row.starts_at end asc,case when row.ends_at<timezone('utc',now()) then row.starts_at end desc),'[]'::jsonb),
    'upcomingCount',count(*) filter(where row.ends_at>=timezone('utc',now())),'pastCount',count(*) filter(where row.ends_at<timezone('utc',now()))
  ) into result from event_rows row;
  return result;
end;$function$
;

CREATE OR REPLACE FUNCTION public.list_public_categories_v2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select api_public_bridge.list_public_categories_v2(); $function$
;

CREATE OR REPLACE FUNCTION public.list_public_content_v1(p_content_type text, p_locale text DEFAULT 'tr'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select api_public_bridge.list_public_content_v1(p_content_type, p_locale, p_limit, p_offset); $function$
;

CREATE OR REPLACE FUNCTION public.list_public_events_v1(p_include_past boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select api_public_bridge.list_public_events_v1(p_include_past); $function$
;
