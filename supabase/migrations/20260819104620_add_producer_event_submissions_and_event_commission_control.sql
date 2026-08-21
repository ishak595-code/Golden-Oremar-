alter table public.events
  add column if not exists producer_id uuid references public.producers(id) on delete set null,
  add column if not exists event_submission_id uuid,
  add column if not exists ticket_price_minor bigint not null default 0,
  add column if not exists currency text not null default 'TRY',
  add column if not exists platform_commission_basis_points integer not null default 0,
  add column if not exists sale_mode text not null default 'reservation';

do $$ begin alter table public.events add constraint events_ticket_price_minor_check check(ticket_price_minor>=0); exception when duplicate_object then null; end $$;
do $$ begin alter table public.events add constraint events_currency_check check(currency ~ '^[A-Z]{3}$'); exception when duplicate_object then null; end $$;
do $$ begin alter table public.events add constraint events_platform_commission_check check(platform_commission_basis_points between 0 and 10000); exception when duplicate_object then null; end $$;
do $$ begin alter table public.events add constraint events_sale_mode_check check(sale_mode in ('reservation','ticketed')); exception when duplicate_object then null; end $$;
create index if not exists events_producer_starts_idx on public.events(producer_id,starts_at desc) where producer_id is not null;

create table if not exists private.producer_event_submissions (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(title) between 2 and 180),
  description text not null check(char_length(description) between 20 and 20000),
  image_path text,
  location_name text not null check(char_length(location_name) between 2 and 500),
  location_details jsonb not null default '{}'::jsonb check(jsonb_typeof(location_details)='object'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer,
  reservation_deadline timestamptz,
  ticket_price_minor bigint not null default 0,
  currency text not null default 'TRY',
  requested_commission_basis_points integer,
  approved_commission_basis_points integer,
  status text not null default 'pending' check(status in ('pending','needs_changes','approved','rejected','withdrawn')),
  review_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  check(ends_at>starts_at),
  check(capacity is null or capacity between 1 and 1000000),
  check(reservation_deadline is null or reservation_deadline<=starts_at),
  check(ticket_price_minor>=0),
  check(currency ~ '^[A-Z]{3}$'),
  check(requested_commission_basis_points is null or requested_commission_basis_points between 0 and 10000),
  check(approved_commission_basis_points is null or approved_commission_basis_points between 0 and 10000),
  check(image_path is null or char_length(image_path)<=1200),
  check(review_reason is null or char_length(review_reason)<=2000)
);
create index if not exists producer_event_submissions_status_created_idx on private.producer_event_submissions(status,created_at);
create index if not exists producer_event_submissions_producer_created_idx on private.producer_event_submissions(producer_id,created_at desc);

do $$ begin alter table public.events add constraint events_event_submission_id_fkey foreign key(event_submission_id) references private.producer_event_submissions(id) on delete set null; exception when duplicate_object then null; end $$;
do $$ begin alter table public.events add constraint events_event_submission_id_key unique(event_submission_id); exception when duplicate_object then null; end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-public','event-public',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists storage_event_public_read_v1 on storage.objects;
create policy storage_event_public_read_v1 on storage.objects for select using(bucket_id='event-public');
drop policy if exists storage_event_public_producer_insert_v1 on storage.objects;
create policy storage_event_public_producer_insert_v1 on storage.objects for insert to authenticated with check(
  bucket_id='event-public' and (storage.foldername(name))[2]='events' and exists(
    select 1 from public.producers p where p.id::text=(storage.foldername(name))[1] and p.owner_user_id=auth.uid() and p.status='active' and p.is_verified=true and p.origin_verified=true and p.deleted_at is null and private.is_producer_trust_badge_active_v1(p.id)
  )
);
drop policy if exists storage_event_public_producer_delete_v1 on storage.objects;
create policy storage_event_public_producer_delete_v1 on storage.objects for delete to authenticated using(
  bucket_id='event-public' and (storage.foldername(name))[2]='events' and exists(
    select 1 from public.producers p where p.id::text=(storage.foldername(name))[1] and p.owner_user_id=auth.uid() and p.deleted_at is null
  ) and not exists(select 1 from public.events e where e.image_path=storage.objects.name)
);

create or replace function private.producer_upsert_event_submission_v1(p_submission_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
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
  return jsonb_build_object('id',row.id,'status',row.status,'ticketPriceMinor',row.ticket_price_minor,'currency',row.currency,'requestedCommissionBasisPoints',row.requested_commission_basis_points);
end;
$$;
create or replace function public.producer_upsert_event_submission_v1(p_submission_id uuid default null,p_payload jsonb default '{}'::jsonb) returns jsonb language sql set search_path='' as $$select private.producer_upsert_event_submission_v1(p_submission_id,p_payload);$$;
revoke all on function public.producer_upsert_event_submission_v1(uuid,jsonb) from public,anon;
grant execute on function public.producer_upsert_event_submission_v1(uuid,jsonb) to authenticated;

create or replace function private.list_my_producer_event_submissions_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); producer_id uuid;
begin
 if caller_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
 perform private.assert_platform_access_v1(caller_id);
 select id into producer_id from public.producers where owner_user_id=caller_id and deleted_at is null order by created_at desc limit 1;
 if producer_id is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'imagePath',s.image_path,'locationName',s.location_name,'locationDetails',s.location_details,'startsAt',s.starts_at,'endsAt',s.ends_at,'capacity',s.capacity,'reservationDeadline',s.reservation_deadline,'ticketPriceMinor',s.ticket_price_minor,'currency',s.currency,'requestedCommissionBasisPoints',s.requested_commission_basis_points,'approvedCommissionBasisPoints',s.approved_commission_basis_points,'status',s.status,'reviewReason',s.review_reason,'eventId',s.event_id,'createdAt',s.created_at,'updatedAt',s.updated_at) order by s.created_at desc) from private.producer_event_submissions s where s.producer_id=producer_id),'[]'::jsonb);
end;
$$;
create or replace function public.list_my_producer_event_submissions_v1() returns jsonb language sql stable set search_path='' as $$select private.list_my_producer_event_submissions_v1();$$;
revoke all on function public.list_my_producer_event_submissions_v1() from public,anon;
grant execute on function public.list_my_producer_event_submissions_v1() to authenticated;

create or replace function private.admin_list_producer_event_submissions_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'producerId',s.producer_id,'producerName',p.display_name,'producerLocation',p.production_location,'producerCommissionBasisPoints',p.commission_basis_points,'producerBadgeActive',private.is_producer_trust_badge_active_v1(p.id),'title',s.title,'description',s.description,'imagePath',s.image_path,'locationName',s.location_name,'locationDetails',s.location_details,'startsAt',s.starts_at,'endsAt',s.ends_at,'capacity',s.capacity,'reservationDeadline',s.reservation_deadline,'ticketPriceMinor',s.ticket_price_minor,'currency',s.currency,'requestedCommissionBasisPoints',s.requested_commission_basis_points,'approvedCommissionBasisPoints',s.approved_commission_basis_points,'status',s.status,'reviewReason',s.review_reason,'eventId',s.event_id,'createdAt',s.created_at,'updatedAt',s.updated_at) order by case s.status when 'pending' then 0 when 'needs_changes' then 1 else 2 end,s.created_at asc) from private.producer_event_submissions s join public.producers p on p.id=s.producer_id),'[]'::jsonb);
end;
$$;
create or replace function public.admin_list_producer_event_submissions_v1() returns jsonb language sql stable set search_path='' as $$select private.admin_list_producer_event_submissions_v1();$$;
revoke all on function public.admin_list_producer_event_submissions_v1() from public,anon;
grant execute on function public.admin_list_producer_event_submissions_v1() to authenticated;

create or replace function private.admin_review_producer_event_submission_v1(p_submission_id uuid,p_decision text,p_reason text default null,p_commission_basis_points integer default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); decision_value text:=lower(btrim(coalesce(p_decision,''))); reason_value text:=nullif(btrim(coalesce(p_reason,'')),''); submission private.producer_event_submissions%rowtype; producer public.producers%rowtype; event_row public.events%rowtype; commission_value integer; slug_value text;
begin
 if caller_id is null or not coalesce(private.is_admin(),false) then raise exception 'admin_required' using errcode='42501'; end if;
 if decision_value not in ('approve','reject','needs_changes') then raise exception 'invalid_event_review_decision' using errcode='22023'; end if;
 if decision_value<>'approve' and char_length(coalesce(reason_value,''))<8 then raise exception 'event_review_reason_required' using errcode='22023'; end if;
 if reason_value is not null and char_length(reason_value)>2000 then raise exception 'event_review_reason_too_long' using errcode='22023'; end if;
 select * into submission from private.producer_event_submissions where id=p_submission_id for update;
 if submission.id is null or submission.status not in ('pending','needs_changes') then raise exception 'event_submission_not_reviewable' using errcode='55000'; end if;
 select * into producer from public.producers where id=submission.producer_id and deleted_at is null;
 if producer.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
 commission_value:=coalesce(p_commission_basis_points,submission.requested_commission_basis_points,producer.commission_basis_points);
 if commission_value not between 0 and 10000 then raise exception 'invalid_event_commission' using errcode='22023'; end if;
 if decision_value='approve' then
   if not private.is_producer_trust_badge_active_v1(producer.id) then raise exception 'producer_trust_badge_required' using errcode='55000'; end if;
   if submission.starts_at<=timezone('utc',now()) then raise exception 'event_start_must_be_future' using errcode='55000'; end if;
   if submission.image_path is not null and private.verified_public_storage_path_v1('event-public',submission.image_path) is null then raise exception 'stored_event_image_required' using errcode='55000'; end if;
   slug_value:=private.slugify_tr_v1(submission.title); if exists(select 1 from public.events where slug=slug_value) then slug_value:=slug_value||'-'||substr(gen_random_uuid()::text,1,8); end if;
   insert into public.events(slug,title,description,image_path,location_name,location_details,starts_at,ends_at,capacity,reservation_deadline,status,producer_id,event_submission_id,ticket_price_minor,currency,platform_commission_basis_points,sale_mode)
   values(slug_value,submission.title,submission.description,submission.image_path,submission.location_name,submission.location_details,submission.starts_at,submission.ends_at,submission.capacity,submission.reservation_deadline,'published',producer.id,submission.id,submission.ticket_price_minor,submission.currency,commission_value,case when submission.ticket_price_minor>0 then 'ticketed' else 'reservation' end) returning * into event_row;
   update private.producer_event_submissions set status='approved',approved_commission_basis_points=commission_value,review_reason=reason_value,reviewed_by=caller_id,reviewed_at=timezone('utc',now()),event_id=event_row.id,updated_at=timezone('utc',now()) where id=submission.id;
 else
   update private.producer_event_submissions set status=case when decision_value='reject' then 'rejected' else 'needs_changes' end,review_reason=reason_value,reviewed_by=caller_id,reviewed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=submission.id;
 end if;
 insert into public.notifications(user_id,type,title,message,action_url,metadata) values(producer.owner_user_id,'producer',case when decision_value='approve' then 'Etkinliğiniz onaylandı ve yayınlandı' when decision_value='needs_changes' then 'Etkinlik başvurunuz için düzeltme gerekiyor' else 'Etkinlik başvurunuz reddedildi' end,case when decision_value='approve' then submission.title||' etkinliği Golden Oremar etkinliklerinde yayınlandı.' else submission.title||' etkinliği için yönetim notu: '||reason_value||case when decision_value='needs_changes' then ' Düzeltip yeniden gönderebilirsiniz.' else '' end end,'/?tab=account',jsonb_build_object('eventSubmissionId',submission.id,'decision',decision_value,'reason',reason_value,'eventId',event_row.id,'commissionBasisPoints',commission_value));
 return jsonb_build_object('id',submission.id,'decision',decision_value,'status',case when decision_value='approve' then 'approved' when decision_value='reject' then 'rejected' else 'needs_changes' end,'eventId',event_row.id,'commissionBasisPoints',commission_value,'reason',reason_value);
end;
$$;
create or replace function public.admin_review_producer_event_submission_v1(p_submission_id uuid,p_decision text,p_reason text default null,p_commission_basis_points integer default null) returns jsonb language sql set search_path='' as $$select private.admin_review_producer_event_submission_v1(p_submission_id,p_decision,p_reason,p_commission_basis_points);$$;
revoke all on function public.admin_review_producer_event_submission_v1(uuid,text,text,integer) from public,anon;
grant execute on function public.admin_review_producer_event_submission_v1(uuid,text,text,integer) to authenticated;

create or replace function private.admin_set_producer_commission_v1(p_producer_id uuid,p_commission_basis_points integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller_id uuid:=auth.uid(); producer_row public.producers%rowtype;
begin
 if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
 if p_commission_basis_points is null or p_commission_basis_points not between 0 and 10000 then raise exception 'invalid_producer_commission' using errcode='22023'; end if;
 update public.producers set commission_basis_points=p_commission_basis_points,updated_at=timezone('utc',now()) where id=p_producer_id and deleted_at is null returning * into producer_row;
 if producer_row.id is null then raise exception 'producer_not_found' using errcode='P0002'; end if;
 insert into private.outbox_events(aggregate_type,aggregate_id,event_type,payload) values('producer',producer_row.id,'producer.commission_updated',jsonb_build_object('producer_id',producer_row.id,'commission_basis_points',p_commission_basis_points,'actor_user_id',caller_id));
 return jsonb_build_object('producerId',producer_row.id,'commissionBasisPoints',producer_row.commission_basis_points);
end;
$$;
