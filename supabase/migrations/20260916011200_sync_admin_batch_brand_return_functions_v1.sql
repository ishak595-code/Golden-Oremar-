-- Drift closure: admin product-batch review (release/reject/recall), brand
-- configuration section editor, and the v2 return workflow with restock
-- decision and resolution handling.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.admin_review_product_batch_v1(p_batch_id uuid, p_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  batch_row public.product_batches%rowtype;
  normalized_reason text := btrim(coalesce(p_reason, ''));
begin
  if caller_id is null or not coalesce(private.has_permission('product.moderate'),false) then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_status not in ('released','rejected','recalled') then raise exception 'invalid_batch_review_status' using errcode = '22023'; end if;
  select batch.* into batch_row from public.product_batches batch where batch.id = p_batch_id for update;
  if batch_row.id is null then raise exception 'batch_not_found' using errcode = 'P0002'; end if;
  if p_status = 'released' then
    if batch_row.status <> 'review' then raise exception 'batch_not_ready_for_release' using errcode = '55000'; end if;
    if not exists (
      select 1 from public.products product
      join public.producers producer on producer.id = product.producer_id
      where product.id = batch_row.product_id
        and product.status = 'published' and product.is_active = true and product.deleted_at is null
        and producer.id = batch_row.producer_id and producer.status = 'active' and producer.is_verified = true and producer.deleted_at is null
    ) then raise exception 'batch_product_or_producer_not_public' using errcode = '55000'; end if;
    update public.product_batches
    set status = 'released', review_reason = null, reviewed_by = caller_id,
        reviewed_at = timezone('utc', now()), released_at = timezone('utc', now()), recalled_at = null
    where id = batch_row.id;
    insert into public.product_batch_events(batch_id, event_type, event_at, public_note, visibility, actor_user_id)
    values (batch_row.id, 'released', timezone('utc', now()), 'Parti bilgileri Golden Oremar doğrulama sürecinden geçti ve yayımlandı.', 'public', caller_id);
  elsif p_status = 'rejected' then
    if batch_row.status <> 'review' then raise exception 'batch_not_under_review' using errcode = '55000'; end if;
    if char_length(normalized_reason) not between 10 and 1000 then raise exception 'batch_review_reason_required' using errcode = '22023'; end if;
    update public.product_batches
    set status = 'rejected', review_reason = normalized_reason, reviewed_by = caller_id, reviewed_at = timezone('utc', now())
    where id = batch_row.id;
  else
    if batch_row.status <> 'released' then raise exception 'only_released_batch_can_be_recalled' using errcode = '55000'; end if;
    if char_length(normalized_reason) not between 10 and 1000 then raise exception 'batch_recall_reason_required' using errcode = '22023'; end if;
    update public.product_batches
    set status = 'recalled', review_reason = normalized_reason, reviewed_by = caller_id,
        reviewed_at = timezone('utc', now()), recalled_at = timezone('utc', now())
    where id = batch_row.id;
    insert into public.product_batch_events(batch_id, event_type, event_at, public_note, visibility, actor_user_id)
    values (batch_row.id, 'recalled', timezone('utc', now()), normalized_reason, 'public', caller_id);
  end if;
  insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
  values ('product_batch', batch_row.id, 'product_batch.' || p_status, jsonb_build_object('batch_id', batch_row.id, 'status', p_status, 'reviewed_by', caller_id));
  return jsonb_build_object('batch_id', batch_row.id, 'status', p_status, 'trace_code', batch_row.trace_code);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_update_brand_configuration_v1(p_section text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  normalized_section text := lower(btrim(coalesce(p_section, '')));
  next_config jsonb;
  next_contact jsonb;
  next_general jsonb;
  next_value jsonb;
  next_brand_name text;
  next_maintenance boolean;
  next_email text;
  next_phone text;
  result_row public.brand_settings%rowtype;
begin
  if caller_id is null or not coalesce(private.has_permission('system.configure'),false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_configuration_payload' using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 524288 then
    raise exception 'configuration_payload_too_large' using errcode = '22023';
  end if;
  select settings.public_config into next_config from public.brand_settings settings where settings.slug = 'golden-oremar' for update;
  if not found then raise exception 'brand_configuration_not_found' using errcode = 'P0002'; end if;
  if normalized_section = 'general' then
    if exists (select 1 from jsonb_object_keys(p_payload) key where key not in ('siteName', 'logoUrl', 'theme', 'maintenanceMode')) then
      raise exception 'unsupported_general_setting' using errcode = '22023';
    end if;
    next_brand_name := nullif(btrim(p_payload ->> 'siteName'), '');
    if next_brand_name is not null and char_length(next_brand_name) not between 2 and 80 then
      raise exception 'invalid_site_name' using errcode = '22023';
    end if;
    if p_payload ? 'theme' and coalesce(p_payload ->> 'theme', '') not in ('light', 'dark') then
      raise exception 'invalid_theme' using errcode = '22023';
    end if;
    if p_payload ? 'logoUrl' and char_length(coalesce(p_payload ->> 'logoUrl', '')) > 2048 then
      raise exception 'invalid_logo_url' using errcode = '22023';
    end if;
    if p_payload ? 'maintenanceMode' and jsonb_typeof(p_payload -> 'maintenanceMode') <> 'boolean' then
      raise exception 'invalid_maintenance_mode' using errcode = '22023';
    end if;
    next_general := coalesce(next_config -> 'appSettings', '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object('theme', case when p_payload ? 'theme' then p_payload ->> 'theme' else null end,
        'logoUrl', case when p_payload ? 'logoUrl' then p_payload ->> 'logoUrl' else null end)
    );
    next_config := jsonb_set(next_config, '{appSettings}', next_general, true);
    next_maintenance := case when p_payload ? 'maintenanceMode' then (p_payload ->> 'maintenanceMode')::boolean else null end;
    update public.brand_settings
    set brand_name = coalesce(next_brand_name, brand_name), maintenance_mode = coalesce(next_maintenance, maintenance_mode), public_config = next_config
    where slug = 'golden-oremar' returning * into result_row;
  elsif normalized_section = 'contactinfo' then
    if exists (select 1 from jsonb_object_keys(p_payload) key where key not in ('address', 'phone', 'whatsapp', 'email', 'mapUrl', 'social')) then
      raise exception 'unsupported_contact_setting' using errcode = '22023';
    end if;
    if p_payload ? 'social' and jsonb_typeof(p_payload -> 'social') <> 'object' then
      raise exception 'invalid_social_links' using errcode = '22023';
    end if;
    if char_length(coalesce(p_payload ->> 'address', '')) > 500
      or char_length(coalesce(p_payload ->> 'phone', '')) > 40
      or char_length(coalesce(p_payload ->> 'whatsapp', '')) > 40
      or char_length(coalesce(p_payload ->> 'email', '')) > 320
      or char_length(coalesce(p_payload ->> 'mapUrl', '')) > 2048 then
      raise exception 'invalid_contact_field_length' using errcode = '22023';
    end if;
    next_email := lower(btrim(coalesce(p_payload ->> 'email', '')));
    if next_email <> '' and next_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'invalid_support_email' using errcode = '22023';
    end if;
    next_phone := btrim(coalesce(p_payload ->> 'phone', ''));
    next_contact := jsonb_build_object('address', btrim(coalesce(p_payload ->> 'address', '')), 'phone', next_phone,
      'whatsapp', btrim(coalesce(p_payload ->> 'whatsapp', '')), 'email', next_email,
      'mapUrl', btrim(coalesce(p_payload ->> 'mapUrl', '')), 'social', coalesce(p_payload -> 'social', '{}'::jsonb));
    next_config := jsonb_set(next_config, '{contactInfo}', next_contact, true);
    update public.brand_settings set support_email = nullif(next_email, ''), support_phone = nullif(next_phone, ''), public_config = next_config
    where slug = 'golden-oremar' returning * into result_row;
  elsif normalized_section = 'herocategories' then
    next_value := p_payload -> 'items';
    if jsonb_typeof(next_value) <> 'array' or jsonb_array_length(next_value) not between 1 and 12 then
      raise exception 'invalid_hero_categories' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(next_value) item
      where jsonb_typeof(item) <> 'object'
        or char_length(btrim(coalesce(item ->> 'id', ''))) not between 1 and 80
        or char_length(btrim(coalesce(item ->> 'title', ''))) not between 1 and 120
        or char_length(btrim(coalesce(item ->> 'targetCategory', ''))) not between 1 and 120
        or char_length(coalesce(item ->> 'subtitle', '')) > 180
        or char_length(coalesce(item ->> 'image', '')) > 2048
        or char_length(coalesce(item ->> 'icon', '')) > 80) then
      raise exception 'invalid_hero_category_item' using errcode = '22023';
    end if;
    next_config := jsonb_set(next_config, '{heroCategories}', next_value, true);
    update public.brand_settings set public_config = next_config where slug = 'golden-oremar' returning * into result_row;
  elsif normalized_section = 'homesections' then
    next_value := p_payload -> 'items';
    if jsonb_typeof(next_value) <> 'array' or jsonb_array_length(next_value) not between 1 and 20 then
      raise exception 'invalid_home_sections' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(next_value) item
      where jsonb_typeof(item) <> 'object'
        or char_length(btrim(coalesce(item ->> 'id', ''))) not between 1 and 80
        or char_length(btrim(coalesce(item ->> 'title', ''))) not between 1 and 160
        or not (item ? 'active') or jsonb_typeof(item -> 'active') <> 'boolean') then
      raise exception 'invalid_home_section_item' using errcode = '22023';
    end if;
    next_config := jsonb_set(next_config, '{homeSections}', next_value, true);
    update public.brand_settings set public_config = next_config where slug = 'golden-oremar' returning * into result_row;
  elsif normalized_section = 'staticcontent' then
    next_value := p_payload -> 'content';
    if jsonb_typeof(next_value) <> 'object' then raise exception 'invalid_static_content' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_object_keys(next_value) key where key not in ('about', 'returns', 'privacy', 'faq', 'interface')) then
      raise exception 'unsupported_static_content_section' using errcode = '22023';
    end if;
    if not (next_value ?& array['about', 'returns', 'privacy', 'faq', 'interface'])
      or jsonb_typeof(next_value -> 'about') <> 'object'
      or jsonb_typeof(next_value -> 'returns') <> 'object'
      or jsonb_typeof(next_value -> 'privacy') <> 'object'
      or jsonb_typeof(next_value -> 'faq') <> 'array'
      or jsonb_typeof(next_value -> 'interface') <> 'object'
      or jsonb_array_length(next_value -> 'faq') > 50 then
      raise exception 'incomplete_static_content' using errcode = '22023';
    end if;
    if char_length(coalesce(next_value #>> '{about,content}', '')) > 100000
      or char_length(coalesce(next_value #>> '{returns,content}', '')) > 100000
      or char_length(coalesce(next_value #>> '{privacy,content}', '')) > 100000 then
      raise exception 'static_content_section_too_large' using errcode = '22023';
    end if;
    next_config := jsonb_set(next_config, '{staticContent}', next_value, true);
    update public.brand_settings set public_config = next_config where slug = 'golden-oremar' returning * into result_row;
  else
    raise exception 'unsupported_configuration_section' using errcode = '22023';
  end if;
  return jsonb_build_object('slug', result_row.slug, 'brandName', result_row.brand_name, 'maintenanceMode', result_row.maintenance_mode,
    'supportEmail', result_row.support_email, 'supportPhone', result_row.support_phone, 'publicConfig', result_row.public_config, 'updatedAt', result_row.updated_at);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.admin_update_return_v2(p_return_id uuid, p_status text, p_reason text DEFAULT NULL::text, p_resolution text DEFAULT NULL::text, p_restock_approved boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid();
  target_return public.return_requests%rowtype;
  next_status text:=lower(btrim(coalesce(p_status,'')));
  normalized_reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  normalized_resolution text:=nullif(lower(btrim(coalesce(p_resolution,''))),'');
begin
  if caller_id is null or not private.has_permission('refund.approve') then raise exception 'permission_required:refund.approve' using errcode='42501'; end if;
  if next_status not in ('under_review','approved','rejected','in_transit','received','closed') then raise exception 'invalid_return_status' using errcode='22023'; end if;
  if normalized_resolution is not null and normalized_resolution not in ('refund','replacement','partial_refund','store_credit','none') then raise exception 'invalid_return_resolution' using errcode='22023'; end if;
  if normalized_reason is not null and char_length(normalized_reason)>3000 then raise exception 'return_reason_too_long' using errcode='22023'; end if;
  select * into target_return from public.return_requests request where request.id=p_return_id for update;
  if target_return.id is null then raise exception 'return_request_not_found' using errcode='P0002'; end if;
  if not (
    (target_return.status='requested' and next_status in ('under_review','approved','rejected')) or
    (target_return.status='under_review' and next_status in ('approved','rejected')) or
    (target_return.status='approved' and next_status in ('in_transit','received','closed')) or
    (target_return.status='in_transit' and next_status in ('received','closed')) or
    (target_return.status='received' and next_status='closed')
  ) then raise exception 'invalid_return_status_transition:%:%',target_return.status,next_status using errcode='22023'; end if;
  if next_status='rejected' and char_length(coalesce(normalized_reason,''))<8 then raise exception 'rejection_reason_required' using errcode='22023'; end if;
  if next_status in ('approved','received','closed') and normalized_resolution is null then normalized_resolution:=target_return.resolution; end if;
  if next_status='approved' and normalized_resolution is null then raise exception 'return_resolution_required' using errcode='22023'; end if;
  if next_status='received' and p_restock_approved is null then raise exception 'restock_decision_required' using errcode='22023'; end if;
  update public.return_requests
  set status=next_status,
      review_reason=case when next_status='rejected' then normalized_reason else review_reason end,
      reviewed_by=caller_id, reviewed_at=timezone('utc',now()),
      resolution=coalesce(normalized_resolution,resolution),
      resolution_note=coalesce(normalized_reason,resolution_note),
      restock_approved=case when next_status='received' then p_restock_approved else restock_approved end,
      received_at=case when next_status='received' then timezone('utc',now()) else received_at end,
      closed_at=case when next_status='closed' then timezone('utc',now()) else closed_at end
  where id=target_return.id returning * into target_return;
  if next_status='received' and coalesce(p_restock_approved,false) then perform private.restock_return_inventory_v1(target_return.id,caller_id); end if;
  if next_status='closed' then
    update public.order_items item
    set fulfillment_status='returned'
    where exists(select 1 from public.return_items returned where returned.return_id=target_return.id and returned.order_item_id=item.id and returned.quantity>=item.quantity);
  end if;
  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(target_return.user_id,'return','İade talebiniz güncellendi',target_return.return_number||' numaralı iade talebinizin yeni durumu: '||next_status||'.','/account/orders',jsonb_build_object('returnId',target_return.id,'orderId',target_return.order_id,'status',next_status,'resolution',target_return.resolution));
  insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload)
  values('return_request',target_return.id,'return.status_changed',jsonb_build_object('return_id',target_return.id,'status',next_status,'resolution',target_return.resolution,'actor_user_id',caller_id));
  return jsonb_build_object('id',target_return.id,'orderId',target_return.order_id,'status',target_return.status,'returnNumber',target_return.return_number,'resolution',target_return.resolution,'restockApproved',target_return.restock_approved);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_product_batch_v1(p_batch_id uuid, p_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_review_product_batch_v1(p_batch_id, p_status, p_reason);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_brand_configuration_v1(p_section text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.admin_update_brand_configuration_v1(p_section, p_payload);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_return_v2(p_return_id uuid, p_status text, p_reason text DEFAULT NULL::text, p_resolution text DEFAULT NULL::text, p_restock_approved boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.admin_update_return_v2(p_return_id,p_status,p_reason,p_resolution,p_restock_approved); $function$
;
