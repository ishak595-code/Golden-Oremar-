-- Drift closure: public contact config, production-location directory,
-- newsletter unsubscribe, customer avatar update, review media validation, and
-- the category/content/event archive management calls, across their private
-- implementations, api_public_bridge layer and public wrappers.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION api_public_bridge.get_public_contact_config_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.get_public_contact_config_v1(); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.list_public_production_locations_v1(p_country_code text DEFAULT 'TR'::text, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.list_public_production_locations_v1(p_country_code,p_province,p_district,p_limit); $function$
;

CREATE OR REPLACE FUNCTION api_public_bridge.unsubscribe_newsletter_v1(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select private.unsubscribe_newsletter_v1(p_token); $function$
;

CREATE OR REPLACE FUNCTION private.get_public_contact_config_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'address',nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,address}','')),''),
    'mapUrl',nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,mapUrl}','')),''),
    'email',nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,email}','')),''),
    'phone',nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,phone}','')),''),
    'whatsapp',nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,whatsapp}','')),''),
    'social',coalesce(settings.public_config#>'{contactInfo,social}','{}'::jsonb),
    'supportChannelsReady',
      nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,email}','')),'') is not null
      or nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,phone}','')),'') is not null
      or nullif(btrim(coalesce(settings.public_config#>>'{contactInfo,whatsapp}','')),'') is not null
  )
  from public.brand_settings settings
  where settings.slug='golden-oremar';
$function$
;

CREATE OR REPLACE FUNCTION private.list_public_production_locations_v1(p_country_code text DEFAULT 'TR'::text, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  country_value text:=upper(btrim(coalesce(p_country_code,'TR')));
  province_value text:=nullif(btrim(coalesce(p_province,'')),'');
  district_value text:=nullif(btrim(coalesce(p_district,'')),'');
  result jsonb;
begin
  if country_value !~ '^[A-Z]{2}$' then raise exception 'invalid_country_code' using errcode='22023'; end if;
  if p_limit not between 1 and 200 then raise exception 'invalid_limit' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'countryCode',row.country_code,'province',row.province,'district',row.district,'village',row.village
  ) order by row.province,row.district,row.village),'[]'::jsonb)
  into result
  from (
    select distinct producer.production_country_code country_code,producer.production_province province,
      producer.production_district district,producer.production_village village
    from public.producers producer
    where producer.status='active' and producer.is_verified=true and producer.origin_verified=true and producer.deleted_at is null
      and producer.production_country_code=country_value
      and producer.production_province is not null and producer.production_district is not null and producer.production_village is not null
      and (province_value is null or lower(producer.production_province)=lower(province_value))
      and (district_value is null or lower(producer.production_district)=lower(district_value))
    order by producer.production_province,producer.production_district,producer.production_village
    limit p_limit
  ) row;
  return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.management_archive_category_v1(p_reference text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  v_category_id uuid := private.resolve_category_id_v1(p_reference);
begin
  if caller_id is null or not coalesce(private.has_permission('content.update'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if v_category_id is null then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.products product
    where product.category_id = v_category_id
      and product.status = 'published'
      and product.is_active = true
      and product.deleted_at is null
  ) then
    raise exception 'category_has_published_products' using errcode = '23503';
  end if;
  update public.categories set is_active = false where id = v_category_id;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.management_archive_content_v1(p_reference text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not coalesce(private.has_permission('content.update'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.content_entries
  set status = 'archived', deleted_at = timezone('utc', now())
  where id::text = btrim(coalesce(p_reference, '')) or legacy_id = btrim(coalesce(p_reference, ''));
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.management_archive_event_v1(p_reference text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or not coalesce(private.has_permission('event.manage'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.events set status = 'cancelled'
  where id::text = btrim(coalesce(p_reference, '')) or legacy_id = btrim(coalesce(p_reference, ''));
  if not found then raise exception 'event_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.unsubscribe_newsletter_v1(p_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare token_hash text:=private.hash_marketing_token_v1(p_token); sub private.newsletter_subscriptions%rowtype;
begin
  select * into sub from private.newsletter_subscriptions where unsubscribe_token_hash=token_hash for update;
  if sub.id is null then return false; end if;
  update private.newsletter_subscriptions set status='unsubscribed',unsubscribed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=sub.id;
  if sub.user_id is not null then
    update public.profiles set marketing_consent=false,marketing_consent_at=null,updated_at=timezone('utc',now()) where id=sub.user_id;
    update private.user_notification_preferences set campaign_push=false,updated_at=timezone('utc',now()) where user_id=sub.user_id;
  end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.update_customer_avatar_v1(p_avatar_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_path text := nullif(btrim(coalesce(p_avatar_path, '')), '');
begin
  if caller_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = caller_id and p.status = 'active' and p.deleted_at is null
  ) then
    raise exception 'active_profile_required' using errcode = '42501';
  end if;

  if normalized_path is not null then
    if char_length(normalized_path) > 500
       or split_part(normalized_path, '/', 1) <> caller_id::text
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'user-private' and o.name = normalized_path
       ) then
      raise exception 'invalid_avatar_path' using errcode = '22023';
    end if;
  end if;

  update public.profiles
  set avatar_path = normalized_path,
      updated_at = timezone('utc', now())
  where id = caller_id;

  return jsonb_build_object('avatar_path', normalized_path);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.validate_review_media_paths_v1(p_media_paths text[])
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid(); path_value text; normalized text[]:='{}'::text[];
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(array_length(p_media_paths,1),0)>5 then raise exception 'review_media_limit_exceeded' using errcode='22023'; end if;
  foreach path_value in array coalesce(p_media_paths,'{}'::text[])
  loop
    path_value:=btrim(coalesce(path_value,''));
    if char_length(path_value) not between 1 and 500 or split_part(path_value,'/',1)<>caller_id::text then raise exception 'invalid_review_media_path' using errcode='22023'; end if;
    if not exists(select 1 from storage.objects object where object.bucket_id='review-media' and object.name=path_value) then raise exception 'review_media_not_uploaded' using errcode='22023'; end if;
    normalized:=array_append(normalized,path_value);
  end loop;
  return normalized;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_contact_config_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select api_public_bridge.get_public_contact_config_v1(); $function$
;

CREATE OR REPLACE FUNCTION public.list_public_production_locations_v1(p_country_code text DEFAULT 'TR'::text, p_province text DEFAULT NULL::text, p_district text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select api_public_bridge.list_public_production_locations_v1(p_country_code, p_province, p_district, p_limit); $function$
;

CREATE OR REPLACE FUNCTION public.management_archive_category_v1(p_reference text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_archive_category_v1(p_reference); $function$
;

CREATE OR REPLACE FUNCTION public.management_archive_content_v1(p_reference text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_archive_content_v1(p_reference); $function$
;

CREATE OR REPLACE FUNCTION public.management_archive_event_v1(p_reference text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_archive_event_v1(p_reference); $function$
;

CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter_v1(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select api_public_bridge.unsubscribe_newsletter_v1(p_token); $function$
;

CREATE OR REPLACE FUNCTION public.update_customer_avatar_v1(p_avatar_path text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.update_customer_avatar_v1(p_avatar_path);
$function$
;
