create or replace function private.get_my_producer_profile_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); producer public.producers%rowtype; badge_active boolean;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.assert_platform_access_v1(caller_id);
  select * into producer from public.producers where owner_user_id=caller_id and deleted_at is null order by created_at desc limit 1;
  if not found then raise exception 'producer_profile_not_found' using errcode='P0002'; end if;
  badge_active:=private.is_producer_trust_badge_active_v1(producer.id);
  return jsonb_build_object(
    'id',producer.id,'display_name',producer.display_name,'description',producer.description,'story',producer.story,
    'production_location',producer.production_location,'production_country_code',producer.production_country_code,
    'production_province',producer.production_province,'production_district',producer.production_district,
    'production_village',producer.production_village,'production_village_is_custom',producer.production_village_is_custom,
    'logo_path',producer.logo_path,'cover_path',producer.cover_path,'status',producer.status,'is_verified',producer.is_verified,
    'origin_verified',producer.origin_verified,'activity_types',producer.activity_types,
    'approved_category_slugs',producer.approved_category_slugs,
    'approved_categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name) order by c.sort_order,c.name) from public.categories c where c.is_active=true and c.slug=any(producer.approved_category_slugs)),'[]'::jsonb),
    'verified_at',producer.verified_at,'verification_due_at',producer.verification_due_at,
    'trust_badge_status',producer.trust_badge_status,'trust_badge_active',badge_active,
    'trust_badge_granted_at',producer.trust_badge_granted_at,'trust_badge_review_due_at',producer.trust_badge_review_due_at,
    'trust_badge_revoked_at',producer.trust_badge_revoked_at,'trust_badge_reason',producer.trust_badge_reason,
    'rating_average',producer.rating_average,'rating_count',producer.rating_count,
    'product_count',(select count(*) from public.products product where product.producer_id=producer.id and product.deleted_at is null),
    'published_product_count',(select count(*) from public.products product where product.producer_id=producer.id and product.status='published' and product.is_active=true and product.deleted_at is null),
    'order_count',(select count(distinct item.order_id) from public.order_items item where item.producer_id=producer.id),
    'customer_count',(select count(distinct customer_order.user_id) from public.order_items item join public.orders customer_order on customer_order.id=item.order_id where item.producer_id=producer.id and customer_order.status not in ('draft','cancelled'))
  );
end;
$function$;

create or replace function private.list_my_producer_event_submissions_v1()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); producer_id uuid;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.assert_platform_access_v1(caller_id);
  if coalesce(private.is_admin(),false) then raise exception 'producer_portal_separate_from_admin' using errcode='42501'; end if;
  select id into producer_id from public.producers where owner_user_id=caller_id and deleted_at is null order by created_at desc limit 1;
  if producer_id is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'description',s.description,'imagePath',s.image_path,'locationName',s.location_name,'locationDetails',s.location_details,
    'startsAt',s.starts_at,'endsAt',s.ends_at,'capacity',s.capacity,'reservationDeadline',s.reservation_deadline,
    'ticketPriceMinor',s.ticket_price_minor,'currency',s.currency,'status',s.status,'reviewReason',s.review_reason,'eventId',s.event_id,
    'createdAt',s.created_at,'updatedAt',s.updated_at
  ) order by s.created_at desc) from private.producer_event_submissions s where s.producer_id=producer_id),'[]'::jsonb);
end;
$function$;

create or replace function private.producer_upsert_event_submission_v1(p_submission_id uuid,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare caller_id uuid:=auth.uid(); producer public.producers%rowtype; current private.producer_event_submissions%rowtype; row private.producer_event_submissions%rowtype; title_value text; description_value text; image_value text; location_value text; details_value jsonb; starts_value timestamptz; ends_value timestamptz; capacity_value integer; deadline_value timestamptz; price_value bigint; currency_value text; commission_value integer;
begin
  if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform private.assert_platform_access_v1(caller_id);
  if coalesce(private.is_admin(),false) then raise exception 'producer_portal_separate_from_admin' using errcode='42501'; end if;
  select * into producer from public.producers p where p.owner_user_id=caller_id and p.status='active' and p.is_verified=true and p.origin_verified=true and p.deleted_at is null order by p.created_at desc limit 1;
  if producer.id is null or not private.is_producer_trust_badge_active_v1(producer.id) then raise exception 'verified_active_producer_required' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_event_submission_payload' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('title','description','imagePath','locationName','locationDetails','startsAt','endsAt','capacity','reservationDeadline','ticketPriceMinor','currency')) then raise exception 'unsupported_event_submission_field' using errcode='22023'; end if;
  if p_submission_id is not null then
    select * into current from private.producer_event_submissions s where s.id=p_submission_id and s.producer_id=producer.id for update;
    if current.id is null then raise exception 'event_submission_not_found' using errcode='P0002'; end if;
    if current.status not in ('pending','needs_changes','rejected') then raise exception 'event_submission_not_editable' using errcode='55000'; end if;
  end if;
  title_value:=btrim(coalesce(p_payload->>'title',current.title,'')); description_value:=btrim(coalesce(p_payload->>'description',current.description,'')); image_value:=nullif(btrim(coalesce(p_payload->>'imagePath',current.image_path,'')),''); location_value:=btrim(coalesce(p_payload->>'locationName',current.location_name,producer.production_location,''));
  details_value:=case when p_payload ? 'locationDetails' then p_payload->'locationDetails' else coalesce(current.location_details,'{}'::jsonb) end;
  if jsonb_typeof(details_value)<>'object' then raise exception 'invalid_event_location_details' using errcode='22023'; end if;
  if char_length(title_value) not between 2 and 180 or char_length(description_value) not between 20 and 20000 or char_length(location_value) not between 2 and 500 then raise exception 'invalid_event_submission_content' using errcode='22023'; end if;
  if image_value is not null and (image_value !~ ('^'||producer.id::text||'/events/[A-Za-z0-9._-]+$') or private.verified_public_storage_path_v1('event-public',image_value) is null) then raise exception 'stored_event_image_required' using errcode='22023'; end if;
  begin starts_value:=coalesce((p_payload->>'startsAt')::timestamptz,current.starts_at); exception when others then raise exception 'invalid_event_start' using errcode='22007'; end;
  begin ends_value:=coalesce((p_payload->>'endsAt')::timestamptz,current.ends_at); exception when others then raise exception 'invalid_event_end' using errcode='22007'; end;
  if starts_value is null or ends_value is null or ends_value<=starts_value or starts_value<=timezone('utc',now()) then raise exception 'invalid_event_date_range' using errcode='22023'; end if;
  if p_payload ? 'capacity' then if jsonb_typeof(p_payload->'capacity')='null' then capacity_value:=null; elsif jsonb_typeof(p_payload->'capacity')='number' then capacity_value:=(p_payload->>'capacity')::integer; else raise exception 'invalid_event_capacity' using errcode='22023'; end if; else capacity_value:=current.capacity; end if;
  if capacity_value is not null and capacity_value not between 1 and 1000000 then raise exception 'invalid_event_capacity' using errcode='22023'; end if;
  if p_payload ? 'reservationDeadline' then if jsonb_typeof(p_payload->'reservationDeadline')='null' or btrim(coalesce(p_payload->>'reservationDeadline',''))='' then deadline_value:=null; else begin deadline_value:=(p_payload->>'reservationDeadline')::timestamptz; exception when others then raise exception 'invalid_event_reservation_deadline' using errcode='22007'; end; end if; else deadline_value:=current.reservation_deadline; end if;
  if deadline_value is not null and deadline_value>starts_value then raise exception 'invalid_event_reservation_deadline' using errcode='22023'; end if;
  if p_payload ? 'ticketPriceMinor' then if jsonb_typeof(p_payload->'ticketPriceMinor')<>'number' then raise exception 'invalid_event_ticket_price' using errcode='22023'; end if; price_value:=(p_payload->>'ticketPriceMinor')::bigint; else price_value:=coalesce(current.ticket_price_minor,0); end if;
  if price_value<0 or price_value>100000000000 then raise exception 'invalid_event_ticket_price' using errcode='22023'; end if;
  currency_value:=upper(btrim(coalesce(p_payload->>'currency',current.currency,'TRY'))); if currency_value !~ '^[A-Z]{3}$' then raise exception 'invalid_event_currency' using errcode='22023'; end if;
  commission_value:=producer.commission_basis_points;
  if p_submission_id is null then
    insert into private.producer_event_submissions(producer_id,submitted_by,title,description,image_path,location_name,location_details,starts_at,ends_at,capacity,reservation_deadline,ticket_price_minor,currency,requested_commission_basis_points,status)
    values(producer.id,caller_id,title_value,description_value,image_value,location_value,details_value||jsonb_build_object('producerProductionLocation',producer.production_location,'producerVillage',producer.production_village,'producerDistrict',producer.production_district,'producerProvince',producer.production_province),starts_value,ends_value,capacity_value,deadline_value,price_value,currency_value,commission_value,'pending') returning * into row;
  else
    update private.producer_event_submissions set title=title_value,description=description_value,image_path=image_value,location_name=location_value,location_details=details_value||jsonb_build_object('producerProductionLocation',producer.production_location,'producerVillage',producer.production_village,'producerDistrict',producer.production_district,'producerProvince',producer.production_province),starts_at=starts_value,ends_at=ends_value,capacity=capacity_value,reservation_deadline=deadline_value,ticket_price_minor=price_value,currency=currency_value,requested_commission_basis_points=commission_value,status='pending',review_reason=null,reviewed_by=null,reviewed_at=null,updated_at=timezone('utc',now()) where id=current.id returning * into row;
  end if;
  insert into public.notifications(user_id,type,title,message,action_url,metadata) values(caller_id,'producer','Etkinlik başvurunuz incelemeye gönderildi',row.title||' etkinliği Super Admin inceleme kuyruğuna alındı. Karar verildiğinde bildirim alacaksınız.','/?tab=account',jsonb_build_object('eventSubmissionId',row.id,'status',row.status));
  return jsonb_build_object('id',row.id,'status',row.status,'ticketPriceMinor',row.ticket_price_minor,'currency',row.currency);
end;
$function$;

create or replace function public.producer_upsert_event_submission_v1(p_submission_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql set search_path='' as $function$select private.producer_upsert_event_submission_v1(p_submission_id,p_payload);$function$;
