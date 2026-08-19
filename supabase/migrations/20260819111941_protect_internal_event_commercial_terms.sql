revoke select on table public.events from anon,authenticated;
grant select(id,legacy_id,slug,title,description,image_path,location_name,location_details,starts_at,ends_at,capacity,reservation_deadline,status,producer_id,ticket_price_minor,currency,sale_mode,created_at,updated_at) on table public.events to anon,authenticated;

create or replace function private.admin_review_producer_event_submission_v1(
  p_submission_id uuid,
  p_decision text,
  p_reason text default null,
  p_commission_basis_points integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  caller_id uuid:=auth.uid();
  decision_value text:=lower(btrim(coalesce(p_decision,'')));
  reason_value text:=nullif(btrim(coalesce(p_reason,'')),'');
  submission private.producer_event_submissions%rowtype;
  producer public.producers%rowtype;
  event_row public.events%rowtype;
  commission_value integer;
  slug_value text;
begin
  if caller_id is null or not coalesce(private.has_role('super_admin'),false) then raise exception 'super_admin_required' using errcode='42501'; end if;
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
    if producer.status<>'active' or producer.is_verified is not true or producer.origin_verified is not true then raise exception 'producer_not_event_eligible' using errcode='55000'; end if;
    if submission.starts_at<=timezone('utc',now()) then raise exception 'event_start_must_be_future' using errcode='55000'; end if;
    if submission.image_path is not null and private.verified_public_storage_path_v1('event-public',submission.image_path) is null then raise exception 'stored_event_image_required' using errcode='55000'; end if;
    slug_value:=private.slugify_tr_v1(submission.title);
    if exists(select 1 from public.events where slug=slug_value) then slug_value:=slug_value||'-'||substr(gen_random_uuid()::text,1,8); end if;
    insert into public.events(slug,title,description,image_path,location_name,location_details,starts_at,ends_at,capacity,reservation_deadline,status,producer_id,event_submission_id,ticket_price_minor,currency,platform_commission_basis_points,sale_mode)
    values(slug_value,submission.title,submission.description,submission.image_path,submission.location_name,submission.location_details,submission.starts_at,submission.ends_at,submission.capacity,submission.reservation_deadline,'published',producer.id,submission.id,submission.ticket_price_minor,submission.currency,commission_value,case when submission.ticket_price_minor>0 then 'ticketed' else 'reservation' end)
    returning * into event_row;
    update private.producer_event_submissions set status='approved',approved_commission_basis_points=commission_value,review_reason=reason_value,reviewed_by=caller_id,reviewed_at=timezone('utc',now()),event_id=event_row.id,updated_at=timezone('utc',now()) where id=submission.id;
  else
    update private.producer_event_submissions set status=case when decision_value='reject' then 'rejected' else 'needs_changes' end,review_reason=reason_value,reviewed_by=caller_id,reviewed_at=timezone('utc',now()),updated_at=timezone('utc',now()) where id=submission.id;
  end if;
  insert into public.notifications(user_id,type,title,message,action_url,metadata)
  values(
    producer.owner_user_id,'producer',
    case when decision_value='approve' then 'Etkinliğiniz onaylandı ve yayınlandı' when decision_value='needs_changes' then 'Etkinlik başvurunuz için düzeltme gerekiyor' else 'Etkinlik başvurunuz reddedildi' end,
    case when decision_value='approve' then submission.title||' etkinliği Golden Oremar etkinliklerinde yayınlandı.' else submission.title||' etkinliği için yönetim notu: '||reason_value||case when decision_value='needs_changes' then ' Düzeltip yeniden gönderebilirsiniz.' else '' end end,
    '/?tab=account',jsonb_build_object('eventSubmissionId',submission.id,'decision',decision_value,'reason',reason_value,'eventId',event_row.id)
  );
  return jsonb_build_object('id',submission.id,'decision',decision_value,'status',case when decision_value='approve' then 'approved' when decision_value='reject' then 'rejected' else 'needs_changes' end,'eventId',event_row.id,'commissionBasisPoints',commission_value,'reason',reason_value);
end;
$function$;
