-- Drift closure: producer-side batch traceability (event log, certification
-- linking, submit-for-review), producer production-location change requests,
-- and admin cancellation of event reservations.
-- Bodies are verbatim pg_get_functiondef output from the live "golden-oremar"
-- project, md5-verified byte-for-byte before commit. Applying is a no-op live.

CREATE OR REPLACE FUNCTION private.management_cancel_event_reservation_v1(p_reservation_id uuid)
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
  update public.event_reservations
  set status = 'cancelled'
  where id = p_reservation_id and status <> 'cancelled';
  if not found then raise exception 'reservation_not_found_or_cancelled' using errcode = 'P0002'; end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.producer_add_product_batch_event_v1(p_batch_id uuid, p_event_type text, p_event_at timestamp with time zone, p_location_label text, p_public_note text, p_visibility text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  batch_row public.product_batches%rowtype;
  new_id bigint;
  normalized_note text := btrim(coalesce(p_public_note, ''));
  normalized_location text := nullif(btrim(coalesce(p_location_label, '')), '');
  normalized_visibility text := coalesce(nullif(btrim(coalesce(p_visibility, '')), ''), 'public');
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if; if not private.has_permission('product.update') then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  select batch.* into batch_row
  from public.product_batches batch
  join public.producers producer on producer.id = batch.producer_id
  where batch.id = p_batch_id and producer.owner_user_id = caller_id
  for update of batch;
  if batch_row.id is null then raise exception 'batch_not_found_or_access_denied' using errcode = '42501'; end if;
  if batch_row.status not in ('draft','rejected') then raise exception 'batch_events_frozen' using errcode = '55000'; end if;
  if p_event_type not in ('harvested','produced','packed','quality_checked','stored','correction') then raise exception 'invalid_batch_event_type' using errcode = '22023'; end if;
  if p_event_at is null or p_event_at > timezone('utc', now()) + interval '5 minutes' then raise exception 'invalid_batch_event_time' using errcode = '22023'; end if;
  if normalized_visibility not in ('public','private') then raise exception 'invalid_batch_event_visibility' using errcode = '22023'; end if;
  if char_length(normalized_note) > 1500 then raise exception 'batch_event_note_too_long' using errcode = '22023'; end if;
  if normalized_location is not null and char_length(normalized_location) > 200 then raise exception 'batch_event_location_too_long' using errcode = '22023'; end if;

  insert into public.product_batch_events(batch_id, event_type, event_at, location_label, public_note, visibility, actor_user_id)
  values (p_batch_id, p_event_type, p_event_at, normalized_location, normalized_note, normalized_visibility, caller_id)
  returning id into new_id;
  return new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.producer_set_product_batch_certification_v1(p_batch_id uuid, p_certification_id uuid, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  batch_row public.product_batches%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if; if not private.has_permission('product.update') then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  select batch.* into batch_row
  from public.product_batches batch
  join public.producers producer on producer.id = batch.producer_id
  where batch.id = p_batch_id and producer.owner_user_id = caller_id
  for update of batch;
  if batch_row.id is null then raise exception 'batch_not_found_or_access_denied' using errcode = '42501'; end if;
  if batch_row.status not in ('draft','rejected') then raise exception 'batch_certifications_frozen' using errcode = '55000'; end if;
  if not exists (
    select 1 from public.product_certifications certification
    where certification.id = p_certification_id
      and certification.product_id = batch_row.product_id
      and certification.status = 'valid'
      and (certification.expires_at is null or certification.expires_at >= current_date)
  ) then
    raise exception 'invalid_product_certification' using errcode = '22023';
  end if;

  if coalesce(p_enabled, true) then
    insert into public.product_batch_certifications(batch_id, certification_id, linked_by)
    values (p_batch_id, p_certification_id, caller_id)
    on conflict (batch_id, certification_id) do nothing;
  else
    delete from public.product_batch_certifications
    where batch_id = p_batch_id and certification_id = p_certification_id;
  end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.producer_submit_product_batch_v1(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := (select auth.uid());
  batch_row public.product_batches%rowtype;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode = '42501'; end if; if not private.has_permission('product.update') then raise exception 'permission_required:product.update' using errcode='42501'; end if;
  select batch.* into batch_row
  from public.product_batches batch
  join public.producers producer on producer.id = batch.producer_id
  where batch.id = p_batch_id and producer.owner_user_id = caller_id
  for update of batch;
  if batch_row.id is null then raise exception 'batch_not_found_or_access_denied' using errcode = '42501'; end if;
  if batch_row.status not in ('draft','rejected') then raise exception 'batch_not_submittable' using errcode = '55000'; end if;
  if char_length(batch_row.origin_province) < 2 or char_length(batch_row.origin_district) < 2 or char_length(batch_row.origin_village) < 2 then raise exception 'batch_origin_incomplete' using errcode = '22023'; end if;
  if batch_row.harvest_date is null and batch_row.production_date is null then raise exception 'batch_origin_date_incomplete' using errcode = '22023'; end if;
  if char_length(batch_row.production_method) < 2 then raise exception 'batch_production_method_incomplete' using errcode = '22023'; end if;

  update public.product_batches
  set status = 'review', submitted_at = timezone('utc', now()), review_reason = null
  where id = batch_row.id;

  insert into private.outbox_events(aggregate_type, aggregate_id, event_type, payload)
  values ('product_batch', batch_row.id, 'product_batch.submitted', jsonb_build_object('batch_id', batch_row.id, 'producer_id', batch_row.producer_id, 'product_id', batch_row.product_id));

  return jsonb_build_object('batch_id', batch_row.id, 'status', 'review');
end;
$function$
;

CREATE OR REPLACE FUNCTION private.request_producer_location_change_v1(p_country_code text, p_province text, p_district text, p_village text, p_village_is_custom boolean, p_latitude numeric, p_longitude numeric, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid:=auth.uid(); producer public.producers%rowtype; request_id uuid;
  cc text:=upper(btrim(coalesce(p_country_code,'TR')));
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into producer from public.producers where owner_user_id=caller_id and deleted_at is null order by created_at desc limit 1;
  if producer.id is null or producer.status not in ('active','suspended') then raise exception 'producer_profile_not_editable' using errcode='42501'; end if;
  if cc !~ '^[A-Z]{2}$' or char_length(btrim(coalesce(p_province,''))) not between 2 and 100 or char_length(btrim(coalesce(p_district,''))) not between 2 and 100 or char_length(btrim(coalesce(p_village,''))) not between 2 and 160 then raise exception 'invalid_location' using errcode='22023'; end if;
  if (p_latitude is null) <> (p_longitude is null) or (p_latitude is not null and p_latitude not between -90 and 90) or (p_longitude is not null and p_longitude not between -180 and 180) then raise exception 'invalid_coordinates' using errcode='22023'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 20 and 2000 then raise exception 'location_change_reason_required' using errcode='22023'; end if;
  if exists(select 1 from public.producer_location_change_requests r where r.producer_id=producer.id and r.status='pending') then raise exception 'location_change_request_already_pending' using errcode='55000'; end if;

  insert into public.producer_location_change_requests(producer_id,requested_by,country_code,province,district,village,village_is_custom,latitude,longitude,reason)
  values(producer.id,caller_id,cc,btrim(p_province),btrim(p_district),btrim(p_village),coalesce(p_village_is_custom,false),p_latitude,p_longitude,btrim(p_reason))
  returning id into request_id;
  return jsonb_build_object('request_id',request_id,'status','pending');
end; $function$
;

CREATE OR REPLACE FUNCTION public.management_cancel_event_reservation_v1(p_reservation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.management_cancel_event_reservation_v1(p_reservation_id); $function$
;

CREATE OR REPLACE FUNCTION public.producer_add_product_batch_event_v1(p_batch_id uuid, p_event_type text, p_event_at timestamp with time zone, p_location_label text, p_public_note text, p_visibility text)
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.producer_add_product_batch_event_v1(
    p_batch_id, p_event_type, p_event_at, p_location_label, p_public_note, p_visibility
  );
$function$
;

CREATE OR REPLACE FUNCTION public.producer_set_product_batch_certification_v1(p_batch_id uuid, p_certification_id uuid, p_enabled boolean)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.producer_set_product_batch_certification_v1(p_batch_id, p_certification_id, p_enabled);
$function$
;

CREATE OR REPLACE FUNCTION public.producer_submit_product_batch_v1(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.producer_submit_product_batch_v1(p_batch_id);
$function$
;

CREATE OR REPLACE FUNCTION public.request_producer_location_change_v1(p_country_code text, p_province text, p_district text, p_village text, p_village_is_custom boolean, p_latitude numeric, p_longitude numeric, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.request_producer_location_change_v1(p_country_code,p_province,p_district,p_village,p_village_is_custom,p_latitude,p_longitude,p_reason); $function$
;
