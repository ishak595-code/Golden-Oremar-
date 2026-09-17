-- Drift closure: campaign upsert. v1 carries the full validation and target
-- linking; v2 wraps it and adds activation mode, priority and max discount.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_upsert_campaign_v2(p_id uuid, p_slug text, p_title text, p_description text, p_banner_path text, p_discount_type text, p_discount_value integer, p_currency text, p_minimum_order_minor bigint, p_usage_limit integer, p_per_user_limit integer, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status text, p_target_scope text, p_target_ids uuid[], p_activation_mode text, p_priority integer, p_max_discount_minor bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  campaign_id uuid;
  normalized_activation text:=lower(btrim(coalesce(p_activation_mode,'automatic')));
begin
  if auth.uid() is null or not coalesce(private.has_permission('campaign.manage'),false) then raise exception 'admin_required' using errcode='42501'; end if;
  if normalized_activation not in ('automatic','coupon') then raise exception 'invalid_campaign_activation_mode' using errcode='22023'; end if;
  if p_priority is null or p_priority not between -1000 and 1000 then raise exception 'invalid_campaign_priority' using errcode='22023'; end if;
  if p_max_discount_minor is not null and p_max_discount_minor<=0 then raise exception 'invalid_campaign_max_discount' using errcode='22023'; end if;
  campaign_id:=public.admin_upsert_campaign(
    p_id,p_slug,p_title,p_description,p_banner_path,p_discount_type,p_discount_value,p_currency,
    p_minimum_order_minor,p_usage_limit,p_per_user_limit,p_starts_at,p_ends_at,p_status,p_target_scope,p_target_ids
  );
  update public.campaigns
  set activation_mode=normalized_activation, priority=p_priority, max_discount_minor=p_max_discount_minor, updated_at=timezone('utc',now())
  where id=campaign_id;
  return jsonb_build_object('id',campaign_id,'activationMode',normalized_activation,'priority',p_priority,'maxDiscountMinor',p_max_discount_minor);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_upsert_campaign(p_id uuid, p_slug text, p_title text, p_description text, p_banner_path text, p_discount_type text, p_discount_value integer, p_currency text, p_minimum_order_minor bigint, p_usage_limit integer, p_per_user_limit integer, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status text, p_target_scope text, p_target_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_campaign_id uuid;
  normalized_target_ids uuid[];
  inserted_target_count integer := 0;
begin
  if not coalesce(private.has_permission('campaign.manage'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) > 160 then
    raise exception 'invalid_campaign_slug' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 160 then
    raise exception 'invalid_campaign_title' using errcode = '22023';
  end if;

  if char_length(coalesce(p_description, '')) > 4000 then
    raise exception 'invalid_campaign_description' using errcode = '22023';
  end if;

  if p_discount_type not in ('percentage', 'fixed', 'free_shipping') then
    raise exception 'invalid_discount_type' using errcode = '22023';
  end if;

  if p_discount_type = 'percentage'
    and (p_discount_value is null or p_discount_value not between 1 and 10000) then
    raise exception 'invalid_percentage_discount' using errcode = '22023';
  end if;

  if p_discount_type = 'fixed'
    and (p_discount_value is null or p_discount_value <= 0 or coalesce(p_currency, '') !~ '^[A-Z]{3}$') then
    raise exception 'invalid_fixed_discount' using errcode = '22023';
  end if;

  if p_discount_type = 'free_shipping' and coalesce(p_discount_value, -1) <> 0 then
    raise exception 'invalid_free_shipping_discount' using errcode = '22023';
  end if;

  if p_minimum_order_minor is null
    or p_minimum_order_minor < 0
    or p_per_user_limit is null
    or p_per_user_limit <= 0
    or (p_usage_limit is not null and p_usage_limit <= 0) then
    raise exception 'invalid_campaign_limits' using errcode = '22023';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'invalid_campaign_dates' using errcode = '22023';
  end if;

  if p_status not in ('draft', 'scheduled', 'active', 'paused', 'ended') then
    raise exception 'invalid_campaign_status' using errcode = '22023';
  end if;

  if p_status = 'active'
    and not (timezone('utc', now()) between p_starts_at and p_ends_at) then
    raise exception 'active_campaign_outside_window' using errcode = '22023';
  end if;

  if p_target_scope not in ('all', 'products', 'categories') then
    raise exception 'invalid_campaign_target_scope' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct target_id order by target_id), '{}'::uuid[])
  into normalized_target_ids
  from unnest(coalesce(p_target_ids, '{}'::uuid[])) as target_id;

  if p_target_scope <> 'all' and cardinality(normalized_target_ids) = 0 then
    raise exception 'campaign_targets_required' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.campaigns(
      slug,
      title,
      description,
      banner_path,
      discount_type,
      discount_value,
      currency,
      minimum_order_minor,
      usage_limit,
      per_user_limit,
      starts_at,
      ends_at,
      status,
      target_scope
    ) values (
      p_slug,
      btrim(p_title),
      coalesce(p_description, ''),
      nullif(btrim(coalesce(p_banner_path, '')), ''),
      p_discount_type,
      p_discount_value,
      case when p_discount_type = 'fixed' then upper(p_currency) else null end,
      p_minimum_order_minor,
      p_usage_limit,
      p_per_user_limit,
      p_starts_at,
      p_ends_at,
      p_status,
      p_target_scope
    )
    returning id into v_campaign_id;
  else
    update public.campaigns
    set
      slug = p_slug,
      title = btrim(p_title),
      description = coalesce(p_description, ''),
      banner_path = nullif(btrim(coalesce(p_banner_path, '')), ''),
      discount_type = p_discount_type,
      discount_value = p_discount_value,
      currency = case when p_discount_type = 'fixed' then upper(p_currency) else null end,
      minimum_order_minor = p_minimum_order_minor,
      usage_limit = p_usage_limit,
      per_user_limit = p_per_user_limit,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      target_scope = p_target_scope
    where id = p_id
    returning id into v_campaign_id;

    if v_campaign_id is null then
      raise exception 'campaign_not_found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.campaign_products link where link.campaign_id = v_campaign_id;
  delete from public.campaign_categories link where link.campaign_id = v_campaign_id;

  if p_target_scope = 'products' then
    insert into public.campaign_products(campaign_id, product_id)
    select v_campaign_id, product.id
    from unnest(normalized_target_ids) requested_id
    join public.products product on product.id = requested_id;

    get diagnostics inserted_target_count = row_count;
  elsif p_target_scope = 'categories' then
    insert into public.campaign_categories(campaign_id, category_id)
    select v_campaign_id, category.id
    from unnest(normalized_target_ids) requested_id
    join public.categories category on category.id = requested_id;

    get diagnostics inserted_target_count = row_count;
  end if;

  if p_target_scope <> 'all' and inserted_target_count <> cardinality(normalized_target_ids) then
    raise exception 'campaign_target_not_found' using errcode = 'P0002';
  end if;

  return v_campaign_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_upsert_campaign_v2(p_id uuid, p_slug text, p_title text, p_description text, p_banner_path text, p_discount_type text, p_discount_value integer, p_currency text, p_minimum_order_minor bigint, p_usage_limit integer, p_per_user_limit integer, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_status text, p_target_scope text, p_target_ids uuid[], p_activation_mode text, p_priority integer, p_max_discount_minor bigint)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_upsert_campaign_v2(
    p_id,p_slug,p_title,p_description,p_banner_path,p_discount_type,p_discount_value,p_currency,
    p_minimum_order_minor,p_usage_limit,p_per_user_limit,p_starts_at,p_ends_at,p_status,p_target_scope,p_target_ids,
    p_activation_mode,p_priority,p_max_discount_minor
  );
$function$
;
